"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { Button, type ButtonSize } from "../Button/Button";
import styles from "./ChatHeader.module.css";

export type ChatHeaderVariant = "plain" | "glass" | "bordered";
export type ChatHeaderSize = "s" | "m" | "l";
export type ChatHeaderStatus = "online" | "busy" | "thinking";

/**
 * One action in the end region.
 *
 * Described rather than handed over as a node, and the reason is not tidiness:
 * a header that is given arbitrary children cannot fold them into an overflow
 * menu when the space runs out, because it has no idea what any of them are —
 * no label to list, no icon to draw. Everything `collapseActionsAt` does
 * depends on this shape.
 */
export interface ChatHeaderAction {
  /** Stable across renders. Also the React key and the menu item's id. */
  id: string;
  /**
   * The accessible name, and the text used in the overflow menu.
   *
   * Not optional. An icon button has no name of its own, and a header full of
   * unlabelled glyphs is a header a screen reader reads as "button, button,
   * button".
   */
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  /** Renders an anchor rather than a button. Navigation is not a click. */
  href?: string;
  /**
   * A number worth showing on the glyph — saved bookmarks, unread replies.
   * It is folded into the accessible name too: the badge is decorative, and a
   * reader who cannot see it would otherwise lose the count entirely.
   */
  count?: number;
  /** A toggle rather than a command. Renders `aria-pressed`. */
  active?: boolean;
  disabled?: boolean;
  /** Stays visible when the rest collapse. For the one action that matters. */
  pinned?: boolean;
}

export interface ChatHeaderProps
  extends Omit<HTMLAttributes<HTMLElement>, "title" | "children"> {
  /** What the conversation is about, so the reader can see where they are. */
  title?: ReactNode;
  /** The second line: the model, a count, a state. */
  subtitle?: ReactNode;
  /** Logo or agent avatar, drawn before the title. */
  avatar?: ReactNode;
  /** A dot beside the title. Silent decoration until `statusLabel` names it. */
  status?: ChatHeaderStatus | null;
  /** What the dot means, spoken. Defaults to the status word itself. */
  statusLabel?: string;
  /**
   * How the title is exposed to assistive technology. A heading is what makes
   * the conversation reachable by heading navigation; the level belongs to the
   * host's document, not to us, so it is a prop. `false` renders plain text.
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6 | false;
  /** Long titles get an ellipsis rather than a second line. */
  truncate?: boolean;

  /** Renders a back button. */
  onBack?: () => void;
  /** Renders a back link instead — navigation belongs in an anchor. */
  backHref?: string;
  backLabel?: string;

  /** The managed actions. These are what collapse. */
  actions?: ChatHeaderAction[];
  overflowLabel?: string;

  variant?: ChatHeaderVariant;
  size?: ChatHeaderSize;
  /** `center` is the native/mobile arrangement: title centred, actions apart. */
  align?: "start" | "center";
  sticky?: boolean;
  /** Grow a border and a backdrop once the conversation has scrolled under it. */
  elevateOnScroll?: boolean;
  /**
   * Width, in pixels, below which unpinned actions fold into an overflow menu.
   * `false` never folds. Measured on the header itself, not the viewport, so
   * a header in a narrow panel collapses on its own terms.
   */
  collapseActionsAt?: number | false;
  /**
   * Render as `<header>`, which is a `banner` landmark at the top level of a
   * page. Set `false` for a header inside a panel or a card, where claiming
   * the page's banner would be a lie.
   */
  landmark?: boolean;

  /**
   * Anything the kit should not manage — a segmented control, a model picker.
   * Sits in the end region before the actions, and never collapses: the kit
   * cannot summarise what it cannot read.
   */
  children?: ReactNode;
}

const BUTTON_SIZE: Record<ChatHeaderSize, ButtonSize> = { s: "s", m: "m", l: "l" };
const ICON_SIZE: Record<ChatHeaderSize, number> = { s: 14, m: 16, l: 18 };

const sizeClass: Record<ChatHeaderSize, string> = {
  s: styles.s,
  m: styles.m,
  l: styles.l,
};

const variantClass: Record<ChatHeaderVariant, string> = {
  plain: styles.plain,
  glass: styles.glass,
  bordered: styles.bordered,
};

/** The name a reader hears, which has to carry what the badge shows. */
const actionName = (action: ChatHeaderAction): string =>
  action.count === undefined ? action.label : `${action.label}, ${action.count}`;

/**
 * The nearest ancestor that actually scrolls, or the window.
 *
 * `elevateOnScroll` cannot just listen to the window: a chat is very often a
 * panel with its own overflow, and in that case the window never scrolls at
 * all — the header would stay flat forever.
 */
const scrollParent = (node: HTMLElement | null): HTMLElement | Window => {
  let current = node?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (/(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
};

export const ChatHeader = forwardRef<HTMLElement, ChatHeaderProps>(function ChatHeader(
  {
    title,
    subtitle,
    avatar,
    status = null,
    statusLabel,
    headingLevel = 2,
    truncate = true,
    onBack,
    backHref,
    backLabel = "Back",
    actions = [],
    overflowLabel = "More actions",
    variant = "plain",
    size = "m",
    align = "start",
    sticky = false,
    elevateOnScroll = sticky,
    collapseActionsAt = 520,
    landmark = true,
    children,
    className,
    ...rest
  },
  ref
) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  /* ── Collapsing ──────────────────────────────────────────────────────────
     Measured on the element, not the viewport. A width of zero means nobody
     has laid it out yet — jsdom, a display:none ancestor — and guessing
     "collapsed" from an unmeasurable element would hide the actions in every
     test and every hidden tab. */
  useEffect(() => {
    const node = rootRef.current;
    if (!node || collapseActionsAt === false || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setCollapsed(width > 0 && width < collapseActionsAt);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [collapseActionsAt]);

  /* ── Elevation ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!elevateOnScroll) return;
    const target = scrollParent(rootRef.current);
    const read = () => {
      // Identity, not `instanceof Window` and not a property check. The first
      // is a realm test — already false under jsdom, and false in a browser
      // the moment the node lives in an iframe. The second is worse than it
      // looks: `"scrollTop" in window` is true under jsdom even though the
      // value is undefined. This is the one thing that cannot be wrong, since
      // `scrollParent` returned this very object a moment ago.
      const top = target === window ? window.scrollY : (target as HTMLElement).scrollTop;
      setScrolled(top > 0);
    };
    read();
    target.addEventListener("scroll", read, { passive: true });
    return () => target.removeEventListener("scroll", read);
  }, [elevateOnScroll]);

  /* Both flags are read through their prop rather than cleared when it turns
     off. An effect that resets state on the way out leaves a render where the
     old value is still on screen, and needs the state to be written twice for
     what is really one derived fact. */
  const isCollapsed = collapseActionsAt !== false && collapsed;
  const visible = isCollapsed ? actions.filter((a) => a.pinned) : actions;
  const folded = isCollapsed ? actions.filter((a) => !a.pinned) : [];

  const Heading = (headingLevel ? (`h${headingLevel}` as const) : "span") as "span";

  const Root = (landmark ? "header" : "div") as "header";

  return (
    <Root
      ref={setRefs}
      className={[
        styles.header,
        sizeClass[size],
        variantClass[variant],
        align === "center" ? styles.center : "",
        sticky ? styles.sticky : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-scrolled={(elevateOnScroll && scrolled) || undefined}
      {...rest}
    >
      <div className={styles.start}>
        {backHref ? (
          <a href={backHref} className={styles.back} aria-label={backLabel}>
            <ArrowLeft size={ICON_SIZE[size]} aria-hidden />
          </a>
        ) : onBack ? (
          <Button
            variant="secondary"
            size={BUTTON_SIZE[size]}
            icon={<ArrowLeft size={ICON_SIZE[size]} aria-hidden />}
            aria-label={backLabel}
            onClick={onBack}
          />
        ) : null}

        {avatar && <span className={styles.avatar}>{avatar}</span>}

        {(title || subtitle) && (
          <div className={styles.titles}>
            {title && (
              <Heading
                className={[styles.title, truncate ? styles.truncate : ""].filter(Boolean).join(" ")}
                title={typeof title === "string" && truncate ? title : undefined}
              >
                {status && (
                  <span className={styles.status} data-status={status}>
                    {/* The dot is a picture of the state; this is the state. */}
                    <span className={styles.srOnly}>{statusLabel ?? status}</span>
                  </span>
                )}
                {title}
              </Heading>
            )}
            {subtitle && (
              <span
                className={[styles.subtitle, truncate ? styles.truncate : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.end}>
        {children}
        {visible.map((action) => (
          <HeaderAction key={action.id} action={action} size={size} />
        ))}
        {folded.length > 0 && (
          <OverflowMenu actions={folded} size={size} label={overflowLabel} />
        )}
      </div>
    </Root>
  );
});

/** One managed action: a button, or an anchor when it navigates. */
function HeaderAction({ action, size }: { action: ChatHeaderAction; size: ChatHeaderSize }) {
  const name = actionName(action);
  const badge =
    action.count !== undefined && action.count > 0 ? (
      <span className={styles.badge} aria-hidden="true">
        {action.count > 99 ? "99+" : action.count}
      </span>
    ) : null;

  if (action.href) {
    return (
      <a href={action.href} className={styles.back} aria-label={name} title={action.label}>
        {action.icon}
        {badge}
      </a>
    );
  }

  return (
    <span className={styles.actionWrap}>
      <Button
        variant="secondary"
        size={BUTTON_SIZE[size]}
        icon={action.icon}
        aria-label={name}
        title={action.label}
        aria-pressed={action.active}
        disabled={action.disabled}
        onClick={action.onClick}
      />
      {badge}
    </span>
  );
}

/**
 * The folded actions.
 *
 * A real menu, not a list of buttons in a box: one tab stop, arrows to move,
 * Escape to leave, and focus handed back to the trigger on the way out. The
 * pattern is the same one the highlighter's menu uses.
 */
function OverflowMenu({
  actions,
  size,
  label,
}: {
  actions: ChatHeaderAction[];
  size: ChatHeaderSize;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    []
  );

  /* Clamped here rather than corrected by an effect. A menu left open while
     the list shrinks under it would otherwise point past the end for one
     render, and that render is the one that moves focus. */
  const active = Math.min(index, Math.max(actions.length - 1, 0));

  // Focus lands on the item the roving index names, once the menu exists.
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"], [role="menuitemcheckbox"]'
    );
    items?.[active]?.focus();
  }, [open, active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((i) => (i + 1) % actions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((i) => (i - 1 + actions.length) % actions.length);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setIndex(actions.length - 1);
    }
  };

  return (
    <span className={styles.overflow}>
      <Button
        ref={triggerRef}
        variant="secondary"
        size={BUTTON_SIZE[size]}
        icon={<MoreHorizontal size={ICON_SIZE[size]} aria-hidden />}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setIndex(0);
          setOpen((v) => !v);
        }}
      />
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={styles.menu}
          onKeyDown={onKeyDown}
          onBlur={(event) => {
            // Tab away and the menu goes with you, rather than being left
            // open behind the focus ring.
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              close(false);
            }
          }}
        >
          {actions.map((action, i) => (
            <button
              key={action.id}
              type="button"
              /* A toggle inside a menu is a `menuitemcheckbox`. `menuitem`
                 does not take a pressed or checked state, so saying it that
                 way is an ARIA error, not a shortcut. */
              role={action.active === undefined ? "menuitem" : "menuitemcheckbox"}
              aria-checked={action.active}
              tabIndex={active === i ? 0 : -1}
              className={styles.menuItem}
              disabled={action.disabled}
              onClick={() => {
                action.onClick?.();
                close(true);
              }}
            >
              <span className={styles.menuIcon}>{action.icon}</span>
              <span>{action.label}</span>
              {action.count !== undefined && action.count > 0 && (
                <span className={styles.menuCount}>{action.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
