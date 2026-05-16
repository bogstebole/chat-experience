import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, LayoutGroup, motion, useAnimationControls, type Transition } from "motion/react";
import { Copy, Pencil } from "lucide-react";
import { Button } from "../Button/Button";
import { MorphGlyph } from "./MorphGlyph";
import styles from "./ChatInput.module.css";

const MotionButton = motion(Button);

export type ChatInputState = "idle" | "typing" | "responding" | "resting";

export interface InlineAnimConfig {
  bubble: { stiffness: number; damping: number; mass: number };
  button: { stiffness: number; damping: number; mass: number; stagger: number };
  addButton: { duration: number; visualDuration: number; bounce: number };
  enterButton: { duration: number; visualDuration: number; bounce: number };
  ripple: { scaleX: number; duration: number; pulseDuration: number };
  wrap: {
    nearThreshold: number;
    exitThreshold: number;
    preExpandHeight: number;
    slideInDelay: number;
  };
}

export const defaultInlineAnimConfig: InlineAnimConfig = {
  bubble: { stiffness: 600, damping: 21.5, mass: 0.2 },
  button: { stiffness: 380, damping: 34, mass: 0.9, stagger: 0.055 },
  addButton: { duration: 0.4, visualDuration: 0.4, bounce: 0.5 },
  enterButton: { duration: 0.4, visualDuration: 0.4, bounce: 0.5 },
  ripple: { scaleX: 1.000, duration: 0.19, pulseDuration: 140 },
  wrap: { nearThreshold: 0.92, exitThreshold: 0.75, preExpandHeight: 16, slideInDelay: 120 },
};

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
  /** Live-tweak overrides for the inline variant's animation parameters. */
  animationConfig?: InlineAnimConfig;
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
    bubbleSpring: { type: "spring", stiffness: 600, damping: 21.5, mass: 0.2 },
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
      animationConfig,
    },
    ref
  ) {
    const instanceId = useId();
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const measureSpanRef = useRef<HTMLSpanElement>(null);
    const [hovered, setHovered] = useState(false);
    const [pulsing, setPulsing] = useState(false);
    const [expandedMode, setExpandedMode] = useState(false);
    const [isActuallyWrapped, setIsActuallyWrapped] = useState(false);
    const [showButtons, setShowButtons] = useState(true);
    const singleLineHeight = useRef(0);
    const expandedModeRef = useRef(false);
    const compactAvailWidthRef = useRef(0);
    const pendingExpansion = useRef(false);
    const buttonsTimerRef = useRef<number | null>(null);
    const surfaceControls = useAnimationControls();
    const prevState = useRef(state);
    const cfg = VARIANTS[variant];
    // Stable ref so the state-change effect always reads the latest config
    // without needing it as a dependency (avoids re-subscribing on every tweak).
    const animCfgRef = useRef(animationConfig);
    animCfgRef.current = animationConfig;

    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus(),
      setValue: (v) => onChange(v),
      getValue: () => value,
    }), [onChange, value]);

    // ── Derived values ── hoisted above effects that reference them
    const isGlass = state === "responding" || state === "resting";
    const isReadOnly = isGlass;
    const showSend = state === "typing" && value.trim().length > 0;
    const showStop = state === "responding";
    const isRestingHovered = state === "resting" && hovered;
    const showActions = isRestingHovered;
    const isInline = variant === "inline";
    const showInlineGlyph = isInline && (showSend || showStop);

    const ac = animationConfig;
    const bubbleSpring: Transition = isInline && ac
      ? { type: "spring", stiffness: ac.bubble.stiffness, damping: ac.bubble.damping, mass: ac.bubble.mass }
      : cfg.bubbleSpring;
    const buttonSpring: Transition = isInline && ac
      ? { type: "spring", stiffness: ac.button.stiffness, damping: ac.button.damping, mass: ac.button.mass }
      : spring;

    // Auto-focus when entering typing-capable states
    useEffect(() => {
      if (state === "idle" || state === "typing") {
        editorRef.current?.focus();
      }
    }, [state]);

    // Capture single-line height once on mount
    useEffect(() => {
      if (editorRef.current) {
        singleLineHeight.current = editorRef.current.scrollHeight;
      }
    }, []);

    // On every keystroke: decide whether to enter or exit expanded mode.
    // compactAvailWidthRef is frozen once we enter expanded mode so the exit
    // threshold is always compared against the same compact baseline (with buttons).
    // Entering expanded mode only hides buttons here — the layout switch and
    // button re-reveal are driven by onExitComplete so the three-step sequence
    // (exit → expand → enter) is continuous and event-driven, not timer-guessed.
    useEffect(() => {
      const el = editorRef.current;
      const span = measureSpanRef.current;
      if (!el || !singleLineHeight.current) return;

      requestAnimationFrame(() => {
        const textW = span ? span.offsetWidth : 0;
        const contentW = el.clientWidth - 16;
        const isMultiline = el.scrollHeight > singleLineHeight.current + 2;

        const ac = animCfgRef.current;
        if (!expandedModeRef.current) {
          compactAvailWidthRef.current = contentW;
          if (isMultiline || textW >= compactAvailWidthRef.current * (ac?.wrap?.nearThreshold ?? 0.92)) {
            expandedModeRef.current = true;
            pendingExpansion.current = true;
            setShowButtons(false);
          }
        } else {
          const wrappedNow = isMultiline || textW >= contentW - 2;
          setIsActuallyWrapped(wrappedNow);
          if (!wrappedNow && textW < compactAvailWidthRef.current * (ac?.wrap?.exitThreshold ?? 0.75)) {
            expandedModeRef.current = false;
            pendingExpansion.current = false;
            setExpandedMode(false);
            setIsActuallyWrapped(false);
            setShowButtons(true);
            if (buttonsTimerRef.current) {
              clearTimeout(buttonsTimerRef.current);
              buttonsTimerRef.current = null;
            }
          }
        }
      });
    }, [value]);

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
          const ac = animCfgRef.current;
          const scaleX = ac?.ripple?.scaleX ?? 1.018;
          const duration = ac?.ripple?.duration ?? 0.38;
          surfaceControls.start({
            scaleX: [1, scaleX, 1],
            transition: { duration, times: [0, 0.4, 1], ease: [0.25, 1, 0.5, 1] },
          });
        }
        const pulseDuration = variant === "inline" ? (animCfgRef.current?.ripple?.pulseDuration ?? 260) : 260;
        const id = window.setTimeout(() => setPulsing(false), pulseDuration);
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
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (value.trim().length > 0) onSubmit(value);
        }
      },
      [value, onSubmit]
    );

    return (
      <LayoutGroup id={instanceId}>
        <div
          className={styles.wrap}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <motion.div className={`${styles.root} ${isGlass ? styles.isGlassRoot : ""}`} layout transition={bubbleSpring}>
            <motion.div
              className={`${styles.surface} ${isGlass ? styles.glass : ""} ${isRestingHovered ? styles.hovered : ""} ${pulsing ? styles.pulsed : ""}`}
              style={{
                alignItems: "center",
                flexWrap: expandedMode ? "wrap" : "nowrap",
                justifyContent: expandedMode ? "flex-end" : "flex-start",
              }}
              transition={bubbleSpring}
              animate={surfaceControls}
              onClick={() => editorRef.current?.focus()}
            >
              {/* Hidden span for text-width measurement (near-wrap detection) */}
              <span
                ref={measureSpanRef}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  visibility: "hidden",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  font: "inherit",
                  letterSpacing: "inherit",
                }}
              >
                {value}
              </span>

              <motion.textarea
                ref={editorRef}
                className={styles.editor}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                readOnly={isReadOnly}
                spellCheck={false}
                rows={1}
                animate={{
                  minHeight: expandedMode && !isActuallyWrapped
                    ? singleLineHeight.current + (animCfgRef.current?.wrap?.preExpandHeight ?? 16)
                    : undefined,
                }}
                transition={bubbleSpring}
                style={{
                  flexBasis: expandedMode ? "100%" : undefined,
                }}
              />

              {/* Both buttons are trailing — add button stays right of text,
                send appears to its right. In expanded mode they wrap to the
                second row right-aligned so text only ever grows leftward. */}
              <div className={styles.buttonGroup}>
                <AnimatePresence
                  initial={false}
                  onExitComplete={() => {
                    if (!pendingExpansion.current) return;
                    pendingExpansion.current = false;
                    setExpandedMode(true);
                    if (buttonsTimerRef.current) clearTimeout(buttonsTimerRef.current);
                    buttonsTimerRef.current = window.setTimeout(() => {
                      setShowButtons(true);
                      buttonsTimerRef.current = null;
                    }, animCfgRef.current?.wrap?.slideInDelay ?? 120);
                  }}
                >
                  {!isGlass && showButtons && (
                    <motion.div
                      key="lead"
                      initial={{ opacity: 0, scale: 0, width: 0 }}
                      animate={{ opacity: 1, scale: 1, width: 28 }}
                      exit={{ 
                        opacity: 0, 
                        scale: 0, 
                        width: 0,
                        transition: pendingExpansion.current 
                          ? { type: "tween", duration: 0.15, ease: "easeOut" } 
                          : undefined
                      }}
                      transition={{
                        type: "spring",
                        visualDuration: ac?.addButton?.visualDuration ?? 0.4,
                        bounce: ac?.addButton?.bounce ?? 0.5,
                        delay: ac?.button?.stagger ?? 0.055,
                        opacity: { type: "tween", duration: 0.15 }
                      }}
                      style={{ display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 }}
                    >
                      <Button
                        variant="secondary"
                        icon={<PlusIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdd?.();
                        }}
                        aria-label="Add attachment"
                        title="Add"
                        style={{ flexShrink: 0, width: 28 }}
                      />
                    </motion.div>
                  )}
                  {showInlineGlyph && showButtons && (
                    <motion.div
                      key="inline-action"
                      initial={{ opacity: 0, scale: 0, width: 0, marginLeft: 0 }}
                      animate={{ opacity: 1, scale: 1, width: 28, marginLeft: 8 }}
                      exit={{ 
                        opacity: 0, 
                        scale: 0, 
                        width: 0, 
                        marginLeft: 0,
                        transition: pendingExpansion.current 
                          ? { type: "tween", duration: 0.15, ease: "easeOut" } 
                          : undefined
                      }}
                      transition={{
                        type: "spring",
                        visualDuration: ac?.enterButton?.visualDuration ?? 0.4,
                        bounce: ac?.enterButton?.bounce ?? 0.5,
                        opacity: { type: "tween", duration: 0.15 }
                      }}
                      style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", flexShrink: 0, transformOrigin: "right" }}
                    >
                      <Button
                        variant="primary"
                        icon={<MorphGlyph mode={showStop ? "stop" : "send"} color="#111" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showStop) onStop?.();
                          else onSubmit(value);
                        }}
                        aria-label={showStop ? "Stop response" : "Send message"}
                        style={{ flexShrink: 0, width: 28 }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
                  layoutId={`${instanceId}-action`}
                  type="button"
                  className={styles.action}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
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
