"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Pencil } from "lucide-react";
import { Button } from "../Button/Button";
import styles from "./ChatInput.module.css";
import type { InlineAnimConfig } from "./ChatInput";

export interface HoverActionsRowProps {
  showActions: boolean;
  showReadMore: boolean;
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  onCopy?: (value: string) => void;
  onEdit?: (value: string) => void;
  value: string;
  ac: InlineAnimConfig | undefined;
}

export function HoverActionsRow({
  showActions,
  showReadMore,
  isExpanded,
  setIsExpanded,
  onCopy,
  onEdit,
  value,
  ac,
}: HoverActionsRowProps) {
  return (
    <AnimatePresence initial={false}>
      {showActions && (
        <motion.div
          key="actions"
          className={styles.actionsRow}
          variants={{
            hidden: { scale: 0.85, opacity: 0 },
            visible: { scale: 1, opacity: 1, transition: { stiffness: 460, damping: 38, staggerChildren: ac?.actions?.staggerDelay ?? 0.07 } },
            exit: { scale: 0.85, opacity: 0, transition: { duration: 0.12 } },
          }}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {showReadMore && (
            <motion.div
              key="read-more"
              style={{ marginRight: "auto" }}
              variants={{
                hidden: { opacity: 0, scale: 0.8 },
                visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: ac?.actions?.stiffness ?? 400, damping: ac?.actions?.damping ?? 22 } },
                exit: {},
              }}
            >
              <Button
                variant="ghost"
                icon={isExpanded ? "Read less" : "Read more"}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded((v) => !v);
                }}
                aria-label={isExpanded ? "Read less" : "Read more"}
                style={{ width: "auto", padding: "4px 10px", fontSize: 10, letterSpacing: "0.03em" }}
              />
            </motion.div>
          )}
          {([
            { icon: <Copy size={14} aria-hidden />, onClick: () => onCopy?.(value), label: "Copy" },
            { icon: <Pencil size={14} aria-hidden />, onClick: () => onEdit?.(value), label: "Edit" },
          ] as const).map(({ icon, onClick, label }) => (
            <motion.div
              key={label}
              variants={{
                hidden: { opacity: 0, scale: 0.8 },
                visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: ac?.actions?.stiffness ?? 400, damping: ac?.actions?.damping ?? 22 } },
                exit: {},
              }}
            >
              <Button variant="ghost" icon={icon} onClick={onClick} aria-label={label} title={label} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
