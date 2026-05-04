"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import styles from "./GlassButton.module.css";

type GlassButtonSize = "s" | "m" | "l";

const sizeClassMap: Record<GlassButtonSize, string> = {
  s: styles.sizeS,
  m: styles.sizeM,
  l: styles.sizeL,
};

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Show loading spinner and disable interaction */
  loading?: boolean;
  /** Leading icon element */
  iconLeft?: ReactNode;
  /** Trailing icon element */
  iconRight?: ReactNode;
  /** Button size: s=32px, m=40px, l=48px */
  size?: GlassButtonSize;
  /** Dark mode variant */
  dark?: boolean;
}

const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ children, loading = false, iconLeft, iconRight, size = "m", dark = false, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          ${styles.glassBtn}
          ${sizeClassMap[size]}
          ${loading ? styles.loading : ""}
          ${className ?? ""}
        `}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
        <span className={styles.label}>{children}</span>
        {iconRight && <span className={styles.icon}>{iconRight}</span>}
        {loading && <span className={styles.spinner} aria-hidden="true" />}
      </button>
    );
  }
);

GlassButton.displayName = "GlassButton";

export default GlassButton;
