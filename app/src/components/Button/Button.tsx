import { forwardRef } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", icon, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={`${styles.btn} ${styles[variant]}${className ? ` ${className}` : ""}`}
        {...rest}
      >
        {icon}
      </button>
    );
  }
);
