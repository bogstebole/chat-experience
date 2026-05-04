import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, LayoutGroup, motion, type Transition } from "motion/react";
import { Copy, Pencil } from "lucide-react";
import styles from "./ChatInput.module.css";

export type ChatInputState = "idle" | "typing" | "responding" | "resting";

export interface ChatInputHandle {
  focus: () => void;
  setValue: (value: string) => void;
  getValue: () => string;
}

interface ChatInputProps {
  state: ChatInputState;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  onAdd?: () => void;
  onCopy?: (value: string) => void;
  onEdit?: (value: string) => void;
  placeholder?: string;
  /** When true, the morph from typing -> responding becomes a one-frame snapshot. */
  disableEntryAnimation?: boolean;
}

/**
 * Single-element chat input that morphs through states using shared
 * layout animations. The same DOM nodes persist across states — only
 * style/state changes — so transitions feel like one continuous object
 * rather than crossfaded variants.
 */
const spring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 34,
  mass: 0.9,
};

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 11 11" fill="none" aria-hidden>
    <path
      d="M0.5 5.167H9.833M5.167 0.5V9.833"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArrowUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 11 11" fill="none" aria-hidden>
    <path
      d="M0.5 5.167L5.167 0.5M5.167 0.5L9.833 5.167M5.167 0.5V9.833"
      stroke="#FFFFFFFA"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    {
      state,
      value,
      onChange,
      onSubmit,
      onStop,
      onAdd,
      onCopy,
      onEdit,
      placeholder = "Placeholder text...",
    },
    ref
  ) {
    const editorRef = useRef<HTMLInputElement>(null);
    const [hovered, setHovered] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus(),
      setValue: (v) => onChange(v),
      getValue: () => value,
    }), [onChange, value]);

    // Auto-focus when entering typing-capable states
    useEffect(() => {
      if (state === "idle" || state === "typing") {
        editorRef.current?.focus();
      }
    }, [state]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (value.trim().length > 0) onSubmit(value);
        }
      },
      [value, onSubmit]
    );

    const isGlass = state === "responding" || state === "resting";
    const isReadOnly = isGlass; // bubble states display the message
    const showSend = state === "typing" && value.trim().length > 0;
    const showStop = state === "responding";
    // Hover affordances (glass hover + action row) are only meaningful
    // on a settled bubble.
    const isRestingHovered = state === "resting" && hovered;
    const showActions = isRestingHovered;

    return (
      <LayoutGroup id="chat-input">
        <div
          className={styles.wrap}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
        <motion.div className={styles.root} layout transition={spring}>
          <motion.div
            layout
            className={`${styles.surface} ${isGlass ? styles.glass : ""} ${isRestingHovered ? styles.hovered : ""}`}
            transition={spring}
            onClick={() => editorRef.current?.focus()}
          >
            {/* Leading + button — only shown when not in bubble state.
                Real <button> so it gets keyboard + hover/active. Stops
                propagation so clicks don't refocus the editor. */}
            <AnimatePresence initial={false}>
              {!isGlass && (
                <motion.button
                  key="lead"
                  layout
                  type="button"
                  className={styles.leadSlot}
                  initial={{ opacity: 0, scale: 0.6, width: 0, marginRight: -4 }}
                  animate={{ opacity: 1, scale: 1, width: 28, marginRight: 0 }}
                  exit={{ opacity: 0, scale: 0.6, width: 0, marginRight: -4 }}
                  transition={spring}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd?.();
                  }}
                  aria-label="Add attachment"
                  title="Add"
                >
                  <PlusIcon />
                </motion.button>
              )}
            </AnimatePresence>

            <motion.input
              ref={editorRef}
              layout
              className={styles.editor}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              readOnly={isReadOnly}
              transition={spring}
              spellCheck={false}
            />
          </motion.div>

          {/* Trailing action button — single morphing element across
              send (typing) <-> stop (responding). Same layoutId so the
              circle persists; only its glyph swaps. */}
          <AnimatePresence initial={false}>
            {(showSend || showStop) && (
              <motion.button
                key="action"
                layout
                layoutId="chat-action"
                type="button"
                className={styles.action}
                initial={{ opacity: 0, scale: 0.6, width: 0, marginLeft: -4 }}
                animate={{ opacity: 1, scale: 1, width: 42, marginLeft: 0 }}
                exit={{ opacity: 0, scale: 0.6, width: 0, marginLeft: -4 }}
                transition={spring}
                onClick={() => {
                  if (showStop) onStop?.();
                  else onSubmit(value);
                }}
                aria-label={showStop ? "Stop response" : "Send message"}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {showStop ? (
                    <motion.span
                      key="stop"
                      className={styles.stopGlyph}
                      initial={{ scale: 0.4, opacity: 0, borderRadius: 999 }}
                      animate={{ scale: 1, opacity: 1, borderRadius: 4 }}
                      exit={{ scale: 0.4, opacity: 0, borderRadius: 999 }}
                      transition={spring}
                    />
                  ) : (
                    <motion.span
                      key="send"
                      initial={{ scale: 0.4, opacity: 0, rotate: -45 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.4, opacity: 0, rotate: 45 }}
                      transition={spring}
                      style={{ display: "flex" }}
                    >
                      <ArrowUpIcon />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Hover-revealed actions — only on a settled (resting) bubble.
            Animates from beneath; tracks the wrap's hover so cursor can
            move from bubble to actions without dismissing. */}
        <AnimatePresence initial={false}>
          {showActions && (
            <motion.div
              key="actions"
              className={styles.actionsRow}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ ...spring, stiffness: 460, damping: 38 }}
            >
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => onCopy?.(value)}
                aria-label="Copy"
                title="Copy"
              >
                <Copy aria-hidden />
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => onEdit?.(value)}
                aria-label="Edit"
                title="Edit"
              >
                <Pencil aria-hidden />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </LayoutGroup>
    );
  }
);
