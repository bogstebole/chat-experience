"use client";

import { memo, type Ref } from "react";
import { motion } from "motion/react";
import { ChatInput, type ChatInputHandle, type InlineAnimConfig } from "../ChatInput/ChatInput";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import type { ChatTurn } from "../useChatTurns/useChatTurns";
import styles from "./ChatTurnRow.module.css";

export interface ChatTurnRowProps {
  turn: ChatTurn;
  /** This row owns the live composer: the one the reader types the next question into. */
  isActiveInput?: boolean;
  inputRef?: Ref<ChatInputHandle> | null;
  placeholder?: string;
  animationConfig?: InlineAnimConfig;
  /** Stagger for the entrance, in seconds. */
  entranceDelay?: number;
  /** Passed through to the highlighter over the answer. */
  selectionMode?: "marker" | "precise";

  /**
   * Every callback takes the turn's id rather than being closed over per row.
   *
   * Not a style choice. An inline arrow is a new function on every render, and
   * a new function prop is what makes `memo` give up — see the note on the
   * component below. Taking the id lets a consumer hoist these once.
   */
  onDraft?: (id: string, value: string) => void;
  onSubmit?: (id: string, value: string) => void;
  onStop?: () => void;
  onEdit?: (id: string) => void;
  onCancelEdit?: (id: string) => void;
  /** Defaults to writing to the clipboard. */
  onCopy?: (value: string) => void;
  onHighlight?: (turnId: string, text: string) => void;
  onReplyInThread?: (text: string, rect: DOMRect) => void;

  className?: string;
}

const copyToClipboard = (value: string) => {
  void navigator.clipboard?.writeText(value);
};

/**
 * One turn: the question as a composer that has become a bubble, and the
 * answer beneath it.
 *
 * Not `Message`, because it is not one. The user half is a live input that
 * morphs into its own bubble rather than a rendered record of what was typed
 * — which is the whole idea, and the reason the row is a turn.
 *
 * **Memoised, and the memo is load-bearing.** `useChatTurns` already leaves
 * untouched turns referentially identical when it rewrites one of them, but
 * that only pays off if the rows can act on it. Left inline in a `.map()`,
 * every row re-renders on every flush anyway, because the parent re-rendered.
 * Measured before this existed: streaming a second answer produced 366 DOM
 * mutations inside the first, already-finished turn.
 *
 * The two halves have to be in place together. Stable objects give React the
 * grounds to skip; `memo` is what makes it skip.
 */
export const ChatTurnRow = memo(function ChatTurnRow({
  turn,
  isActiveInput = false,
  inputRef = null,
  placeholder,
  animationConfig,
  entranceDelay = 0,
  selectionMode = "marker",
  onDraft,
  onSubmit,
  onStop,
  onEdit,
  onCancelEdit,
  onCopy = copyToClipboard,
  onHighlight,
  onReplyInThread,
  className,
}: ChatTurnRowProps) {
  // A row arriving is travel, and this reader has asked for less of it. The
  // fade stays: without it a turn would appear with no transition at all,
  // which reads as a glitch rather than as calm.
  const still = prefersReducedMotion();
  const offset = still ? 0 : -16;

  return (
    <motion.article
      id={`turn-${turn.id}`}
      className={[styles.turn, isActiveInput ? styles.active : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      aria-busy={turn.state === "responding" || undefined}
      initial={{ opacity: 0, y: offset }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: offset }}
      transition={{ duration: still ? 0.15 : 0.4, ease: [0.22, 1, 0.36, 1], delay: entranceDelay }}
    >
      <div className={styles.question}>
        <ChatInput
          ref={inputRef}
          state={turn.state}
          value={turn.user}
          onChange={(v) => onDraft?.(turn.id, v)}
          onSubmit={(v) => onSubmit?.(turn.id, v)}
          onStop={onStop}
          onCopy={onCopy}
          onEdit={() => onEdit?.(turn.id)}
          onCancelEdit={() => onCancelEdit?.(turn.id)}
          // An edit, rather than a first draft: there is already an answer
          // under this input, so the buttons say save and cancel.
          isEditing={turn.ai.length > 0 && turn.state === "typing"}
          animationConfig={animationConfig}
          placeholder={placeholder}
        />
      </div>

      {turn.ai && (
        <div className={styles.answer}>
          <TextHighlighter
            text={turn.ai}
            selectionMode={selectionMode}
            onHighlightComplete={(text) => onHighlight?.(turn.id, text)}
            onReplyInThread={onReplyInThread}
          />
        </div>
      )}
    </motion.article>
  );
});
