"use client";

import { forwardRef, useCallback, useRef, type CSSProperties, type ForwardedRef } from "react";
import { Button, type ButtonProps } from "./Button";
import {
  useChatComponents,
  type KitButtonProps,
  type KitButtonRole,
  type KitButtonShape,
} from "../components/components";
import { useHostButtonChecks } from "./hostButtonChecks";
import styles from "./KitButton.module.css";

export interface KitButtonUse extends Omit<ButtonProps, "type"> {
  /** What it is for. Written to `data-ick-role`, and handed to a host's button. */
  kitRole: Exclude<KitButtonRole, "send" | "stop" | "save">;
  /** Worked out from the content when not given: an icon alone is `square`. */
  shape?: KitButtonShape;
  /** The layout box a host's button sits in. The kit's own button ignores it. */
  boxClassName?: string;
  boxStyle?: CSSProperties;
  /** Given to a host's button instead of what the kit's own is given. */
  hostProps?: Partial<Pick<KitButtonProps, "icon" | "iconRight" | "children">>;
}

const sizeClass = {
  xs: styles.xs,
  s: styles.s,
  m: styles.m,
  l: styles.l,
  xl: styles.xl,
} as const;

function assign<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/**
 * Every button the kit draws but the composer's morphing glyph.
 *
 * With no host button in `ComponentsProvider` this is the kit's `Button`,
 * given exactly what it was given before the slot existed — the same element,
 * the same attributes, so nothing about the default changes.
 *
 * With one, the host's button is drawn inside a box the kit lays out: the box
 * has the size, takes the place in the row, and carries the 44px hit area on
 * a touch screen; the host's button fills it and paints it. `className` and
 * `style` here are the kit's paint and stay with the kit's button; where they
 * also place it, the call site says so again as `boxClassName` / `boxStyle`.
 */
export const KitButton = forwardRef<HTMLButtonElement, KitButtonUse>(function KitButton(
  {
    kitRole,
    shape,
    boxClassName,
    boxStyle,
    hostProps,
    variant = "primary",
    size = "s",
    icon,
    iconRight,
    loading = false,
    disabled,
    children,
    className,
    style,
    ...rest
  },
  ref
) {
  const Host = useChatComponents().Button;

  const element = useRef<HTMLButtonElement | null>(null);
  const forwarded = useRef(false);
  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      element.current = node;
      if (node) forwarded.current = true;
      assign(ref, node);
    },
    [ref]
  );
  const box = useRef<HTMLSpanElement | null>(null);

  const given = {
    ...rest,
    kitRole,
    icon: hostProps && "icon" in hostProps ? hostProps.icon : icon,
    iconRight: hostProps && "iconRight" in hostProps ? hostProps.iconRight : iconRight,
    children: hostProps && "children" in hostProps ? hostProps.children : children,
  };
  const resolvedShape: KitButtonShape =
    shape ?? (given.icon && !given.children ? "square" : "default");

  useHostButtonChecks(Host ? kitRole : undefined, box, element, forwarded, rest);

  if (!Host) {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        icon={icon}
        iconRight={iconRight}
        loading={loading}
        disabled={disabled}
        className={className}
        style={style}
        data-ick-role={kitRole}
        {...rest}
      >
        {children}
      </Button>
    );
  }

  const pressedAttr = rest["aria-pressed"];
  const pressed = pressedAttr === true || pressedAttr === "true" ? true : pressedAttr === undefined ? undefined : false;

  return (
    <span
      ref={box}
      className={[styles.box, sizeClass[size], boxClassName ?? ""].filter(Boolean).join(" ")}
      style={boxStyle}
      data-ick-box={kitRole}
      data-shape={resolvedShape}
      /* The hit area past the button's edge is the box's, so a press there
         lands here and is handed on. Not a press on the button itself — that
         one bubbles through with the button as its target. */
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        event.stopPropagation();
        element.current?.click();
      }}
    >
      <Host
        {...given}
        ref={setRef}
        variant={variant}
        size={size}
        shape={resolvedShape}
        loading={loading || undefined}
        pressed={pressed}
        disabled={disabled || loading || undefined}
        aria-busy={rest["aria-busy"] ?? (loading || undefined)}
        type="button"
        data-ick-role={kitRole}
        data-ick-variant={variant}
      />
    </span>
  );
});
