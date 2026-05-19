import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Paperclip, Palette, Link2, X } from "lucide-react";
import { Button } from "../Button/Button";
import styles from "./ChatInput.module.css";
import type { InlineAnimConfig } from "./ChatInput";

const ADD_CARDS = [
  { Icon: Paperclip, label: "Add" },
  { Icon: Palette, label: "Design" },
  { Icon: Link2, label: "Connectors" },
] as const;

interface AddCardsOverlayProps {
  isAddOpen: boolean;
  setIsAddOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onAdd?: () => void;
  showInlineGlyph: boolean;
  showButtons: boolean;
  ac: InlineAnimConfig | undefined;
}

export function AddCardsOverlay({
  isAddOpen,
  setIsAddOpen,
  onAdd,
  showInlineGlyph,
  showButtons,
  ac,
}: AddCardsOverlayProps) {
  return (
    <AnimatePresence>
      {isAddOpen && (
        <>
          <motion.div
            key="backdrop"
            className={styles.addBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsAddOpen(false);
            }}
          />
          <motion.div
            key="add-overlay"
            className={styles.addOverlay}
          >
            <div className={styles.addCardsContainer}>
              {ADD_CARDS.map(({ Icon, label }, i) => {
                const sd = ac?.addCards?.staggerDelay ?? 0.04;
                const enterDelay = i * sd;
                const exitDelay = (ADD_CARDS.length - 1 - i) * sd;
                const angles = [
                  ac?.addCards?.angle1 ?? -26,
                  ac?.addCards?.angle2 ?? -2,
                  ac?.addCards?.angle3 ?? 22,
                ];
                const hoverPull = ac?.addCards?.hoverPull ?? 8;

                return (
                  <motion.button
                    key={label}
                    className={styles.addCardFan}
                    style={{
                      right: showInlineGlyph && showButtons ? 36 : 0,
                      bottom: 1,
                      transformOrigin: "calc(100% - 22px) 50%",
                      zIndex: 3 - i,
                    }}
                    initial={{ opacity: 0, scale: 0.95, rotate: 0, width: 160 }}
                    animate={{
                      opacity: 1, scale: 1, rotate: angles[i], width: 160,
                      transition: {
                        type: "spring", stiffness: ac?.addCards?.stiffness ?? 350, damping: ac?.addCards?.damping ?? 25, delay: enterDelay,
                        opacity: { duration: 0.1, delay: enterDelay },
                      },
                    }}
                    whileHover={{
                      width: 160 + hoverPull,
                      transition: { type: "spring", stiffness: 400, damping: 25 },
                    }}
                    exit={{
                      opacity: 0, scale: 0.5, rotate: 0, width: 160,
                      transition: { duration: 0.15, delay: exitDelay, ease: "easeIn" },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddOpen(false);
                      onAdd?.();
                    }}
                    aria-label={label}
                  >
                    <Icon size={16} aria-hidden />
                    <span>{label}</span>
                  </motion.button>
                );
              })}
            </div>

            <motion.div
              key="x-btn-wrap"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              style={{
                position: "absolute",
                right: showInlineGlyph && showButtons ? 44 : 8,
                bottom: 8,
                width: 28,
                height: 28,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                pointerEvents: "auto",
                zIndex: 10,
              }}
            >
              <Button
                variant="ghost"
                icon={<X size={14} aria-hidden />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddOpen(false);
                }}
                aria-label="Close"
                title="Close"
                style={{ flexShrink: 0, width: 28, backgroundColor: "rgba(0, 0, 0, 0.05)", color: "#111" }}
              />
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
