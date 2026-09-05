"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ArrowDown } from "lucide-react";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./Conversation.module.css";

export interface ConversationProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /**
   * How close to the end still counts as following, in pixels. Below this the
   * view keeps up on its own; above it, the reader is reading and is left
   * alone.
   */
  threshold?: number;
  /** The button offering a way back. `false` for none. */
  scrollButton?: boolean;
  scrollButtonLabel?: string;
  /**
   * The id of an element to hold at the top of the view — a turn, usually.
   *
   * Without it the view follows the end of the content, which is what a chat
   * that stacks downwards wants. With it, the named element is brought to the
   * top and **held** there while the answer grows underneath, so a reader sees
   * their question and its answer and nothing else. Change the id and the view
   * moves to the new one.
   *
   * This needs room to scroll into: an element cannot be brought to the top of
   * a container that ends just below it. That is what a large bottom padding
   * on the viewport is for.
   */
  anchorId?: string;
  /**
   * How far below the top edge the anchor sits, in pixels. A fixed header over
   * the conversation is the usual reason — without it the turn is scrolled
   * neatly underneath and out of sight.
   */
  anchorOffset?: number;
  /** Switch the whole thing off and it is a plain scroll container. */
  follow?: boolean;
  /**
   * For the element that actually scrolls, which is not the one `className`
   * lands on.
   *
   * There are three: a root that positions the button, the viewport that
   * scrolls, and a wrapper whose height is what "the end" is measured from.
   * `className` goes to the root, because that is the box a consumer lays out.
   * Padding has to go here instead — on the scroller — or it is not padding
   * inside the scroll at all.
   */
  viewportClassName?: string;
}

const THRESHOLD = 64;

/**
 * The scroll container: it keeps up with an answer as it arrives, and stops
 * the instant the reader scrolls away.
 *
 * **It follows the end of the content, not the bottom of the container**, and
 * those are only the same thing when nothing is padded below. This kit's demo
 * carries a screen-height bottom padding so a turn can be pulled to the top,
 * and scrolling to the true bottom there would push the answer off the screen
 * to sit in front of a blank space. Measuring the content instead makes one
 * behaviour correct for both.
 *
 * The other half is not fighting the reader. A naive version listens to the
 * scroll event, cannot tell its own scrolling from theirs, and either drags
 * them back down while they are reading or lets go entirely. This reads intent
 * from the input — a wheel, a drag, a page key — and uses the scroll event
 * only to measure where things ended up.
 */
export const Conversation = forwardRef<HTMLDivElement, ConversationProps>(function Conversation(
  {
    children,
    anchorId,
    anchorOffset = 0,
    threshold = THRESHOLD,
    scrollButton = true,
    scrollButtonLabel = "Jump to the latest",
    follow = true,
    className,
    viewportClassName,
    onScroll,
    ...rest
  },
  ref
) {
  const viewport = useRef<HTMLDivElement | null>(null);
  /* The forwarded ref is the *viewport*, not the root. Anyone reaching for a
     ref here wants to scroll something, and the root does not scroll. */
  useImperativeHandle(ref, () => viewport.current as HTMLDivElement, []);
  const content = useRef<HTMLDivElement | null>(null);
  const [following, setFollowing] = useState(true);

  /**
   * Where the last pixel of the last *turn* sits flush with the bottom edge.
   *
   * The last child rather than the wrapper, because the wrapper carries the
   * tail — the empty room under the conversation that lets a turn reach the
   * top. Measuring the wrapper would count that room as content and park the
   * reader a screen below the thing they are reading.
   */
  const endOfContent = useCallback(() => {
    const view = viewport.current;
    const inner = content.current;
    if (!view || !inner) return 0;
    const last = inner.lastElementChild as HTMLElement | null;
    const bottom = last
      ? inner.offsetTop + last.offsetTop + last.offsetHeight
      : inner.offsetTop + inner.offsetHeight;
    return Math.max(0, bottom - view.clientHeight);
  }, []);

  /**
   * Where the view wants to be: the anchor's top — unless holding it there
   * would push the anchored turn's own bottom off the screen.
   *
   * The second half is what this was missing. An anchor pins the turn you sent
   * to the top and holds it there while the answer is written underneath,
   * which is right and is the whole point of anchoring. It stops being right
   * the moment the turn is longer than the screen: the anchor does not move,
   * so the target does not move, and every line after the first screenful is
   * written below the fold with nothing to bring it back.
   *
   * So the anchor holds the top only while its own end is still in view, and
   * gives way to that end when it is not. The handover lands exactly where it
   * should, because the two are the same number at the moment the turn grows
   * to the height of the viewport.
   *
   * Note what this is **not**: the end of the *conversation*. Taking that
   * would follow whatever came after the anchored turn, and anchoring an older
   * turn — a jump to a message further up — would snap straight back to the
   * bottom. Only the anchored turn's own bottom is allowed to overrule its
   * top.
   */
  const target = useCallback(() => {
    const view = viewport.current;
    if (!view) return 0;

    if (anchorId) {
      const el = view.querySelector<HTMLElement>(`[id="${CSS.escape(anchorId)}"]`);
      if (el) {
        const max = Math.max(0, view.scrollHeight - view.clientHeight);
        const top = el.offsetTop - anchorOffset;
        // Where the anchored turn's last pixel sits flush with the bottom.
        const tail = el.offsetTop + el.offsetHeight - view.clientHeight;
        return Math.max(0, Math.min(Math.max(top, tail), max));
      }
    }
    return endOfContent();
  }, [anchorId, anchorOffset, endOfContent]);

  const jump = useCallback(
    (smooth: boolean) => {
      const view = viewport.current;
      if (!view) return;
      view.scrollTo({
        top: target(),
        behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
      });
      setFollowing(true);
    },
    [target]
  );

  /* ── Keeping up ────────────────────────────────────────────────────────
     Layout effect, and the reason matters: run after paint and the answer is
     drawn one frame lower before the scroll catches up, which reads as a
     shudder on every frame of every answer. */
  useLayoutEffect(() => {
    if (!follow || !following) return;
    const view = viewport.current;
    const inner = content.current;
    if (!view || !inner || typeof ResizeObserver === "undefined") return;

    const keepUp = () => {
      view.scrollTop = target();
    };
    keepUp();

    const observer = new ResizeObserver(keepUp);
    observer.observe(inner);
    return () => observer.disconnect();
    /* `anchorId` is in here on purpose: a new turn means the view moves to it,
       and it moves whether or not the reader had scrolled away from the last
       one. Sending a message is asking to be taken to it. */
  }, [follow, following, target, anchorId]);

  /* ── Letting go ────────────────────────────────────────────────────────
     Intent, read from the input rather than inferred from the scroll event.
     A wheel or a drag upwards means the reader wants to be somewhere else,
     and that is true before the scroll has even happened. */
  useEffect(() => {
    if (!follow) return;
    const view = viewport.current;
    if (!view) return;

    const away = () => {
      if (Math.abs(view.scrollTop - target()) > threshold) setFollowing(false);
    };

    const onWheel = (event: WheelEvent) => {
      // Upwards means "not here" only when the place to be is above. With an
      // anchor held at the top, scrolling up is often how a reader returns to
      // it, so the distance decides rather than the direction.
      if (anchorId) away();
      else if (event.deltaY < 0) setFollowing(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home", "ArrowDown", "PageDown", "End"].includes(event.key)) {
        // Same reasoning: with an anchor, any key that moves the view is only
        // "away" if it lands somewhere else.
        if (anchorId) requestAnimationFrame(away);
        else if (["ArrowUp", "PageUp", "Home"].includes(event.key)) setFollowing(false);
      }
    };

    view.addEventListener("wheel", onWheel, { passive: true });
    view.addEventListener("touchmove", away, { passive: true });
    view.addEventListener("keydown", onKey);
    return () => {
      view.removeEventListener("wheel", onWheel);
      view.removeEventListener("touchmove", away);
      view.removeEventListener("keydown", onKey);
    };
  }, [follow, threshold, target, anchorId]);

  /** Back at the end by any route — dragging the bar, momentum, the button. */
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      onScroll?.(event);
      if (!follow) return;
      const view = viewport.current;
      if (!view) return;
      if (Math.abs(view.scrollTop - target()) <= threshold) setFollowing(true);
    },
    [follow, onScroll, threshold, target]
  );

  const detached = follow && !following;

  return (
    <div className={[styles.root, className ?? ""].filter(Boolean).join(" ")}>
      <div
        ref={viewport}
        className={[styles.viewport, viewportClassName ?? ""].filter(Boolean).join(" ")}
        onScroll={handleScroll}
        {...rest}
      >
        <div ref={content} className={styles.content}>
          {children}
        </div>
      </div>

      {scrollButton && (
        <button
          type="button"
          className={styles.jump}
          data-shown={detached || undefined}
          /* Out of the tab order while it is not offering anything, rather
             than merely invisible: a hidden control that still takes focus is
             a dead stop in the middle of a page. */
          tabIndex={detached ? 0 : -1}
          aria-hidden={detached ? undefined : true}
          onClick={() => jump(true)}
          aria-label={scrollButtonLabel}
        >
          <ArrowDown size={15} aria-hidden />
        </button>
      )}
    </div>
  );
});
