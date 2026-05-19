import { AnimatePresence, motion } from "motion/react";
import { MorphGlyph } from "./MorphGlyph";
import styles from "./ChatInput.module.css";
import type { ActionExit } from "./ChatInput";

interface TrailingActionButtonProps {
  isInline: boolean;
  showSend: boolean;
  showStop: boolean;
  instanceId: string;
  actionExit: ActionExit;
  onStop?: () => void;
  onSubmit: (value: string) => void;
  value: string;
}

export function TrailingActionButton({
  isInline,
  showSend,
  showStop,
  instanceId,
  actionExit,
  onStop,
  onSubmit,
  value,
}: TrailingActionButtonProps) {
  return (
    <AnimatePresence initial={false}>
      {!isInline && (showSend || showStop) && (
        <motion.button
          key="action"
          layout
          layoutId={`${instanceId}-action`}
          type="button"
          className={styles.action}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={actionExit.exit}
          transition={actionExit.transition}
          onClick={() => {
            if (showStop) onStop?.();
            else onSubmit(value);
          }}
          aria-label={showStop ? "Stop response" : "Send message"}
        >
          <MorphGlyph mode={showStop ? "stop" : "send"} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
