"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Button } from "../Button/Button";

export type GlassButtonSize = "s" | "m" | "l";

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Show loading spinner and disable interaction */
  loading?: boolean;
  /** Leading icon element */
  iconLeft?: ReactNode;
  /** Trailing icon element */
  iconRight?: ReactNode;
  /** Button size: s=32px, m=40px, l=48px */
  size?: GlassButtonSize;
}

/**
 * The old size names, one step below the merged scale.
 *
 * `GlassButton size="s"` was 32px. On the single scale 32px is `m`, because
 * `s` is the 28px the round icon button has always been. Translating here
 * keeps every existing call site rendering exactly what it rendered before.
 */
const SIZE: Record<GlassButtonSize, "m" | "l" | "xl"> = { s: "m", m: "l", l: "xl" };

/**
 * @deprecated Use `<Button variant="glass">`. Kept so existing installs keep
 * working; it is a thin wrapper, not a second component.
 */
const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { size = "m", iconLeft, ...rest },
  ref
) {
  return <Button ref={ref} variant="glass" size={SIZE[size]} icon={iconLeft} {...rest} />;
});

export default GlassButton;
