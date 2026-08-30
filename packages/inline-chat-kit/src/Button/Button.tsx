"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "glass";

/**
 * Heights: xs 24, s 28, m 32, l 40, xl 48.
 *
 * One scale, from two that disagreed — the round icon button was 28 with no
 * say in the matter, and the glass pill offered 32/40/48 under the names
 * s/m/l. Both sets of values survive; only the glass names moved up one step,
 * which is what the deprecated `GlassButton` wrapper exists to absorb.
 */
export type ButtonSize = "xs" | "s" | "m" | "l" | "xl";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon. On its own it makes a square button; give it an aria-label. */
  icon?: ReactNode;
  /** Trailing icon. */
  iconRight?: ReactNode;
  /** Replaces the content with a spinner and refuses interaction. */
  loading?: boolean;
  children?: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  outline: styles.outline,
  ghost: styles.ghost,
  glass: styles.glass,
};

const sizeClass: Record<ButtonSize, string> = {
  xs: styles.xs,
  s: styles.s,
  m: styles.m,
  l: styles.l,
  xl: styles.xl,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "s",
    icon,
    iconRight,
    loading = false,
    children,
    className,
    disabled,
    ...rest
  },
  ref
) {
  const classes = [
    styles.btn,
    variantClass[variant],
    sizeClass[size],
    children ? styles.hasText : "",
    loading ? styles.loading : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      /* Stated either way rather than only when true: "not busy" is a fact
         worth having, and it is the contract the glass button already had. */
      aria-busy={loading}
      {...rest}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {children && <span className={styles.label}>{children}</span>}
      {iconRight && <span className={styles.icon}>{iconRight}</span>}
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  );
});
