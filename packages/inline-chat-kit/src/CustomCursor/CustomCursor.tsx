"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useMotionValue } from "motion/react";

export function CustomCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const [variant, setVariant] = useState<"default" | "marker" | "text">("default");
  const [isActive, setIsActive] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!isVisible) setIsVisible(true);
      x.set(e.clientX);
      y.set(e.clientY);
      
      const target = e.target as Element | null;
      if (!target) return;
      
      const cursorEl = target.closest('[data-cursor]');
      const activeEl = target.closest('[data-cursor-active="true"]');
      const controlEl = target.closest('a, button, [role="button"], input, select, textarea, [tabindex]');

      if (activeEl || e.buttons > 0) {
        setIsActive(true);
      } else {
        setIsActive(false);
      }

      // Whichever of the two is nearer to the pointer wins. A button sitting
      // inside a marker surface should still show the arrow — but a marker
      // surface that is itself focusable is not a button, and `[tabindex]`
      // alone cannot tell the two apart.
      const controlWins =
        !!controlEl && (!cursorEl || (controlEl !== cursorEl && cursorEl.contains(controlEl)));

      if (controlWins || !cursorEl) {
        setVariant("default");
      } else {
        const customVariant = cursorEl.getAttribute("data-cursor");
        setVariant(customVariant === "marker" ? "marker" : customVariant === "text" ? "text" : "default");
      }
    };
    
    const handleDown = () => setIsActive(true);
    const handleUp = () => setIsActive(false);
    const handleLeave = () => setIsVisible(false);
    const handleEnter = () => setIsVisible(true);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerdown", handleDown);
    window.addEventListener("pointerup", handleUp);
    document.addEventListener("mouseleave", handleLeave);
    document.addEventListener("mouseenter", handleEnter);
    
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointerup", handleUp);
      document.removeEventListener("mouseleave", handleLeave);
      document.removeEventListener("mouseenter", handleEnter);
    };
  }, [isVisible, x, y]);

  if (!isVisible) return null;

  return (
    <motion.div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: "var(--ick-z-cursor)",
        x,
        y,
      }}
    >
      <motion.div
        animate={{
          scale: isActive ? 0.8 : 1,
          x: variant === "marker" ? -2 : variant === "text" ? -7 : 0,
          y: variant === "marker" ? -12 : variant === "text" ? -10 : 0,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <AnimatePresence mode="popLayout">
          {variant === "default" && (
            <motion.div
              key="default"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <svg width="19" height="19" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 1px 2px rgb(var(--ick-glass-shade-rgb) / 0.15))" }}>
                <path d="M2.691 3.125C2.665 3.065 2.658 2.997 2.67 2.932C2.682 2.867 2.714 2.808 2.761 2.761C2.808 2.714 2.867 2.682 2.932 2.67C2.997 2.658 3.065 2.665 3.125 2.691L13.792 7.025C13.857 7.051 13.912 7.097 13.949 7.157C13.986 7.216 14.003 7.286 13.999 7.355C13.994 7.425 13.968 7.492 13.923 7.546C13.878 7.6 13.818 7.638 13.75 7.656L9.667 8.709C9.437 8.769 9.226 8.889 9.057 9.057C8.889 9.225 8.768 9.435 8.709 9.666L7.656 13.75C7.638 13.818 7.6 13.878 7.546 13.923C7.492 13.968 7.425 13.994 7.355 13.999C7.286 14.003 7.216 13.986 7.157 13.949C7.097 13.912 7.051 13.857 7.025 13.792L2.691 3.125Z" fill="var(--ick-cursor-fill)" stroke="var(--ick-cursor-ink)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          )}
          {variant === "text" && (
            <motion.div
              key="text"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <svg width="14" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* white halo for visibility on any background */}
                <path d="M7 3 V17 M4 3 H10 M4 17 H10" stroke="var(--ick-cursor-fill)" strokeWidth="3.4" strokeLinecap="round" />
                <path d="M7 3 V17 M4 3 H10 M4 17 H10" stroke="var(--ick-cursor-ink)" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </motion.div>
          )}
          {variant === "marker" && (
            <motion.div
              key="marker"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              style={{
                filter: isActive 
                  ? "drop-shadow(0px 1px 0px rgb(var(--ick-ink-rgb) / 0.2))" 
                  : "drop-shadow(0px 3px 0px rgb(var(--ick-ink-rgb) / 0.2))"
              }}
            >
              <svg width="27" height="16" viewBox="0 0 34 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.383 7.767L25.309 1.111C27.347 0.259 29.69 1.22 30.542 3.259L32.085 6.949C32.937 8.987 31.975 11.33 29.937 12.182L14.011 18.839L5.353 17.813L3.251 18.692L1.228 15.821L4.03 14.65L9.383 7.767Z" fill="var(--ick-cursor-fill)" />
                <path d="M4.03 14.65L9.383 7.767L25.309 1.111C27.347 0.259 29.69 1.22 30.542 3.259L32.085 6.949C32.937 8.987 31.975 11.33 29.937 12.182L14.011 18.839L5.353 17.813M9.383 7.767L14.011 18.839M4.03 14.65L1.228 15.821L3.251 18.692L5.353 17.813M4.03 14.65L5.353 17.813" stroke="var(--ick-cursor-ink)" strokeWidth="1.6" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
