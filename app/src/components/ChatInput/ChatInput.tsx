import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, LayoutGroup, motion, useAnimationControls, type Transition } from "motion/react";
import { Copy, Pencil } from "lucide-react";
import { MorphGlyph } from "./MorphGlyph";
import styles from "./ChatInput.module.css";

export type ChatInputState = "idle" | "typing" | "responding" | "resting";

/**
 * Variants for the responding -> resting moment (when the AI finishes and
 * the stop button leaves). Everything else stays identical so options can
 * be compared side-by-side.
 *
 * - "default": the original — button shrinks in place, bubble layout-animates.
 * - "absorb":  button slides INTO the bubble while shrinking; bubble pulls right edge.
 * - "mass":    differentiated springs (light button, heavy bubble) + shadow pulse.
 * - "baton":   stop square morphs to a circle, the circle slides into the bubble center,
 *              bubble glass ripples outward as it dissolves.
 * - "inline":  no trailing button. Send/stop glyph lives inside the input,
 *              right-aligned with the text. Whole transition happens within the pill.
 */
export type ChatInputVariant = "default" | "absorb" | "mass" | "baton" | "inline";

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
  /** Choreography for the responding -> resting transition. */
  variant?: ChatInputVariant;
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

/**
 * Per-variant choreography. Each variant overrides:
 *   - bubbleSpring: the layout spring on the surface (controls how the
 *     bubble re-flows when the button leaves).
 *   - actionExit:   the exit transition + animate target for the trailing
 *     action button (send / stop).
 */
type ActionExit = {
  exit: Record<string, number | string>;
  transition: Transition;
};

interface VariantConfig {
  bubbleSpring: Transition;
  actionExit: ActionExit;
}

const VARIANTS: Record<ChatInputVariant, VariantConfig> = {
  default: {
    bubbleSpring: spring,
    actionExit: {
      exit: { opacity: 0, scale: 0.6, width: 0, marginLeft: -4 },
      transition: spring,
    },
  },
  // ── A: ABSORB ──
  // Button physically slides leftward into the bubble while shrinking.
  // Bubble's right edge naturally pulls over via layout. Cleanest single-element read.
  absorb: {
    bubbleSpring: { type: "spring", stiffness: 260, damping: 26, mass: 1.2 },
    actionExit: {
      exit: { opacity: 0, scale: 0, x: -28, width: 0, marginLeft: -4 },
      transition: { type: "spring", stiffness: 420, damping: 30, mass: 0.7 },
    },
  },
  // ── B: HEAVY BUBBLE ──
  // Snappy light-feeling button + heavy bubble that overshoots into place.
  // Plus a brief shadow pulse on the moment of impact (handled separately).
  mass: {
    bubbleSpring: { type: "spring", stiffness: 180, damping: 14, mass: 1.6 },
    actionExit: {
      exit: { opacity: 0, scale: 0.5, width: 0, marginLeft: -4 },
      transition: { type: "spring", stiffness: 520, damping: 32, mass: 0.55 },
    },
  },
  // ── C: BATON ──
  // Stop button slides hard left into the bubble center; the bubble's inner
  // highlight ripples outward. The square -> circle morph is handled in JSX.
  baton: {
    bubbleSpring: { type: "spring", stiffness: 240, damping: 22, mass: 1.3 },
    actionExit: {
      exit: { opacity: 0, scale: 0, x: -42, width: 0, marginLeft: -4 },
      transition: { type: "spring", stiffness: 380, damping: 26, mass: 0.8 },
    },
  },
  // ── D: INLINE ──
  // No trailing button at all. The send/stop glyph lives inside the input
  // pill. On submit/stop, the glyph slides left into the text (baton-pass
  // style) while the pill morphs to a bubble with the same heavy overshoot
  // spring as the baton variant.
  inline: {
    bubbleSpring: { type: "spring", stiffness: 240, damping: 22, mass: 1.3 },
    actionExit: {
      // Unused for the trailing button (not rendered) but drives the inline
      // glyph exit via the showInlineGlyph AnimatePresence below.
      exit: { opacity: 0, scale: 0.6 },
      transition: spring,
    },
  },
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
      variant = "default",
    },
    ref
  ) {
    const editorRef = useRef<HTMLInputElement>(null);
    const [hovered, setHovered] = useState(false);
    const [pulsing, setPulsing] = useState(false);
    const surfaceControls = useAnimationControls();
    const prevState = useRef(state);
    const cfg = VARIANTS[variant];

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

    // ── Variant side effects on responding -> resting ──
    // Triggers a brief shadow pulse on the bubble (mass + baton variants)
    // and a subtle width bulge so the bubble "absorbs" the button's mass.
    useEffect(() => {
      const prev = prevState.current;
      prevState.current = state;
      if (prev !== "responding" || state !== "resting") return;

      if (variant === "mass" || variant === "baton" || variant === "inline") {
        setPulsing(true);
        if (variant === "inline") {
          // Glyph lands inside the pill — ripple outward as it dissolves.
          surfaceControls.start({
            scaleX: [1, 1.018, 1],
            transition: { duration: 0.38, times: [0, 0.4, 1], ease: [0.25, 1, 0.5, 1] },
          });
        }
        const id = window.setTimeout(() => setPulsing(false), 260);
        return () => clearTimeout(id);
      }
      if (variant === "absorb") {
        // Tiny width overshoot: bubble visibly receives the mass.
        surfaceControls.start({
          scaleX: [1, 1.015, 1],
          transition: { duration: 0.42, times: [0, 0.45, 1], ease: [0.25, 1, 0.5, 1] },
        });
      }
    }, [state, variant, surfaceControls]);

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
    const isInline = variant === "inline";
    const showInlineGlyph = isInline && (showSend || showStop);

    return (
      <LayoutGroup id="chat-input">
        <div
          className={styles.wrap}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
        <motion.div className={`${styles.root} ${isGlass ? styles.isGlassRoot : ""}`} layout transition={cfg.bubbleSpring}>
          <motion.div
            layout
            className={`${styles.surface} ${isGlass ? styles.glass : ""} ${isRestingHovered ? styles.hovered : ""} ${pulsing ? styles.pulsed : ""}`}
            transition={cfg.bubbleSpring}
            animate={surfaceControls}
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

            <input
              ref={editorRef}
              className={styles.editor}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              readOnly={isReadOnly}
              spellCheck={false}
            />

            {/* Inline action — variant D only.
                Sits inside the pill, right-aligned with the editor text.
                Same morph (↵ → L → U → square), darker color so it reads
                on the light pill. Whole transition stays within the input. */}
            <AnimatePresence initial={false}>
              {showInlineGlyph && (
                <motion.button
                  key="inline-action"
                  layout
                  type="button"
                  className={styles.inlineAction}
                  initial={{ opacity: 0, scale: 0.5, width: 0, marginLeft: -4 }}
                  animate={{ opacity: 1, scale: 1, width: 24, marginLeft: 0 }}
                  exit={{ opacity: 0, scale: 0, x: -20, width: 0, marginLeft: -4 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26, mass: 0.8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showStop) onStop?.();
                    else onSubmit(value);
                  }}
                  aria-label={showStop ? "Stop response" : "Send message"}
                >
                  <MorphGlyph
                    mode={showStop ? "stop" : "send"}
                    color="#111"
                  />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Trailing action button — single morphing element across
              send (typing) <-> stop (responding). Same layoutId so the
              circle persists; only its glyph swaps. Hidden in the inline
              variant which renders the glyph inside the pill instead. */}
          <AnimatePresence initial={false}>
            {!isInline && (showSend || showStop) && (
              <motion.button
                key="action"
                layout
                layoutId="chat-action"
                type="button"
                className={styles.action}
                initial={{ opacity: 0, scale: 0.6, width: 0, marginLeft: -4 }}
                animate={{ opacity: 1, scale: 1, width: 42, marginLeft: 0 }}
                exit={cfg.actionExit.exit}
                transition={cfg.actionExit.transition}
                onClick={() => {
                  if (showStop) onStop?.();
                  else onSubmit(value);
                }}
                aria-label={showStop ? "Stop response" : "Send message"}
              >
                {/* Single morphing path: send (↵) → L → U → filled square.
                    One element, one continuous tween — no fade-swap. */}
                <MorphGlyph mode={showStop ? "stop" : "send"} />
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
