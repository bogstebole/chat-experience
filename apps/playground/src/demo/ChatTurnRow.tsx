import { memo, type Ref } from "react";
import { motion } from "motion/react";
import {
  ChatInput,
  TextHighlighter,
  type ChatTurn,
  type ChatInputHandle,
  type InlineAnimConfig,
} from "inline-chat-kit";

/**
 * One turn, memoised.
 *
 * `useChatTurns` already leaves untouched turns referentially identical when it
 * updates one of them — but that only pays off if the rows can act on it. Left
 * inline in a `.map()`, every row re-renders on every flush anyway, because the
 * parent re-rendered. Measured: streaming a second answer produced 366 DOM
 * mutations inside the first, already-finished turn.
 *
 * The two halves have to be in place together. Stable objects give React the
 * grounds to skip; `memo` is what makes it actually skip. Which is why the
 * callbacks below take an id rather than being closed over per row — an inline
 * arrow prop is a new function every render and defeats the whole thing.
 */
export interface ChatTurnRowProps {
  turn: ChatTurn;
  isActiveInput: boolean;
  inputRef: Ref<ChatInputHandle> | null;
  entranceDelay: number;
  selectionMode: "marker" | "precise";
  animationConfig: InlineAnimConfig;
  placeholder: string;
  onDraft: (id: string, value: string) => void;
  onSubmit: (id: string, value: string) => void;
  onStop: () => void;
  onEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onHighlight: (turnId: string, text: string) => void;
  onReplyInThread: (text: string, rect: DOMRect) => void;
}

export const ChatTurnRow = memo(function ChatTurnRow({
  turn,
  isActiveInput,
  inputRef,
  entranceDelay,
  selectionMode,
  animationConfig,
  placeholder,
  onDraft,
  onSubmit,
  onStop,
  onEdit,
  onCancelEdit,
  onHighlight,
  onReplyInThread,
}: ChatTurnRowProps) {
  return (
    <motion.article
      id={`turn-${turn.id}`}
      className={`chatTurn${isActiveInput ? " activeInput" : ""}`}
      aria-busy={turn.state === "responding" || undefined}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: entranceDelay }}
    >
      <div className="userRow">
        <ChatInput
          ref={inputRef}
          state={turn.state}
          value={turn.user}
          onChange={(v) => onDraft(turn.id, v)}
          onSubmit={(v) => onSubmit(turn.id, v)}
          onStop={onStop}
          onCopy={(v) => navigator.clipboard.writeText(v)}
          onEdit={() => onEdit(turn.id)}
          onCancelEdit={() => onCancelEdit(turn.id)}
          isEditing={turn.ai.length > 0 && turn.state === "typing"}
          animationConfig={animationConfig}
          placeholder={placeholder}
        />
      </div>
      {turn.ai && (
        <div className="aiText">
          <TextHighlighter
            text={turn.ai}
            selectionMode={selectionMode}
            onHighlightComplete={(text) => onHighlight(turn.id, text)}
            onReplyInThread={onReplyInThread}
          />
        </div>
      )}
    </motion.article>
  );
});
