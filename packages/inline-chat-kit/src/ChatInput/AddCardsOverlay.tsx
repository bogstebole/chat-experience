"use client";

import React, { type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Paperclip, Palette, Link2, X } from "lucide-react";
import { Button } from "../Button/Button";
import styles from "./ChatInput.module.css";
import type { InlineAnimConfig } from "./ChatInput";
import { useLabels } from "../labels/labels";

/**
 * One entry in the composer's "+" menu.
 *
 * `attach` is the one id the composer knows: without an `onSelect` of its own
 * it opens the file picker, which is what the first built-in entry does.
 */
export interface ComposerMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
}

/** What the menu holds when the host says nothing, in the reader's language. */
export function useDefaultComposerMenu(): ComposerMenuItem[] {
  const text = useLabels("input");
  return [
    { id: "attach", label: text.attach, icon: <Paperclip size={16} aria-hidden /> },
    { id: "design", label: text.design, icon: <Palette size={16} aria-hidden /> },
    { id: "connectors", label: text.connectors, icon: <Link2 size={16} aria-hidden /> },
  ];
}

export interface AddCardsOverlayProps {
  isAddOpen: boolean;
  setIsAddOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Called with the entry's label and, second, its id — match on the id. */
  onAdd?: (label?: string, id?: string) => void;
  /** The entries. Defaults to Add, Design and Connectors. */
  items?: ComposerMenuItem[];
  showInlineGlyph: boolean;
  showButtons: boolean;
  ac: InlineAnimConfig | undefined;
}

export function AddCardsOverlay({
  isAddOpen,
  setIsAddOpen,
  onAdd,
  items,
  showInlineGlyph,
  showButtons,
  ac,
}: AddCardsOverlayProps) {
  const builtIn = useDefaultComposerMenu();
  const cards = items ?? builtIn;
  const { closeMenu } = useLabels("input");
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
              {cards.map(({ id, icon, label, onSelect }, i) => {
                const sd = ac?.addCards?.staggerDelay ?? 0.04;
                const enterDelay = i * sd;
                const exitDelay = (cards.length - 1 - i) * sd;
                const angles = [
                  ac?.addCards?.angle1 ?? -26,
                  ac?.addCards?.angle2 ?? -2,
                  ac?.addCards?.angle3 ?? 22,
                ];
                // A fourth entry and beyond fans at the last angle there is.
                const angle = angles[Math.min(i, angles.length - 1)];
                const hoverPull = ac?.addCards?.hoverPull ?? 8;

                return (
                  <motion.button
                    key={id}
                    className={styles.addCardFan}
                    style={{
                      right: showInlineGlyph && showButtons ? 36 : 0,
                      bottom: 1,
                      transformOrigin: "calc(100% - 22px) 50%",
                      zIndex: cards.length - i,
                    }}
                    initial={{ opacity: 0, scale: 0.95, rotate: 0, width: 160 }}
                    animate={{
                      opacity: 1, scale: 1, rotate: angle, width: 160,
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
                      onSelect?.();
                      onAdd?.(label, id);
                    }}
                    aria-label={label}
                  >
                    {icon}
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
                aria-label={closeMenu}
                title={closeMenu}
                className={styles.closeAdd}
              />
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
