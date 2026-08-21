"use client";

import { forwardRef } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon: React.ReactNode;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", icon, children, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={`${styles.btn} ${styles[variant]}${children ? ` ${styles.hasText}` : ""}${className ? ` ${className}` : ""}`}
        {...rest}
      >
        {icon}
        {children && <span>{children}</span>}
      </button>
    );
  }
);
