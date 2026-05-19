import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";

function placeCursorAtEnd(el: HTMLElement) {
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}
import { AnimatePresence, LayoutGroup, animate, motion, useAnimationControls, type Transition } from "motion/react";
import { Copy, Link2, Palette, Paperclip, Pencil, Plus, X } from "lucide-react";
import { Button } from "../Button/Button";
import { MorphGlyph } from "./MorphGlyph";
import styles from "./ChatInput.module.css";


export type ChatInputState = "idle" | "typing" | "responding" | "resting";

export interface InlineAnimConfig {
  bubble: { stiffness: number; damping: number; mass: number };
  button: { stiffness: number; damping: number; mass: number; staggerEnter: number; staggerExit: number };
  addButton: { duration: number; visualDuration: number; bounce: number };
  enterButton: { duration: number; visualDuration: number; bounce: number };
  ripple: { scaleX: number; duration: number; pulseDuration: number };
  wrap: {
    nearThreshold: number;
    exitThreshold: number;
    preExpandHeight: number;
    slideInDelay: number;
  };
  actions: { staggerDelay: number; duration: number; stiffness: number; damping: number };
  addCards: { staggerDelay: number; stiffness: number; damping: number; inputScale: number; inputBlur: number; angle1: number; angle2: number; angle3: number; hoverPull: number };
}

export const defaultInlineAnimConfig: InlineAnimConfig = {
  bubble: { stiffness: 600, damping: 21.5, mass: 0.2 },
  button: { stiffness: 500, damping: 50, mass: 0.2, staggerEnter: 0.12, staggerExit: 0.06 },
  addButton: { duration: 0.2, visualDuration: 0.18, bounce: 0.2 },
  enterButton: { duration: 0.2, visualDuration: 0.18, bounce: 0.3 },
  ripple: { scaleX: 1.000, duration: 0.19, pulseDuration: 140 },
  wrap: { nearThreshold: 0.92, exitThreshold: 0.75, preExpandHeight: 16, slideInDelay: 120 },
  actions: { staggerDelay: 0.07, duration: 0.12, stiffness: 400, damping: 22 },
  addCards: { staggerDelay: 0.06, stiffness: 800, damping: 41, inputScale: 0.95, inputBlur: 2, angle1: 0, angle2: -25, angle3: -50, hoverPull: 12 },
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


const ADD_CARDS = [
  { Icon: Paperclip, label: "Add" },
  { Icon: Palette, label: "Design" },
  { Icon: Link2, label: "Connectors" },
] as const;

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
    const editorRef = useRef<HTMLDivElement>(null);
    const editorWrapRef = useRef<HTMLDivElement>(null);
    const editorClipRef = useRef<HTMLDivElement>(null);
    const textScrollHeightRef = useRef(0);
    const internalChangeRef = useRef(false);
    const measureSpanRef = useRef<HTMLSpanElement>(null);
    const [hovered, setHovered] = useState(false);
    const [pulsing, setPulsing] = useState(false);
    const [expandedMode, setExpandedMode] = useState(false);
    const [showButtons, setShowButtons] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
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
      setValue: (v) => {
        const el = editorRef.current;
        if (el) { el.textContent = v; placeCursorAtEnd(el); }
        onChange(v);
      },
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
    const showReadMore = isInline && state === "resting" && isOverflowing;
    const showInlineGlyph = isInline && (showSend || showStop);

    const ac = animationConfig;
    const bubbleSpring: Transition = isInline && ac
      ? { type: "spring", stiffness: ac.bubble.stiffness, damping: ac.bubble.damping, mass: ac.bubble.mass }
      : cfg.bubbleSpring;

    // Sync fade mask on the editor wrapper based on scroll position
    const updateFade = useCallback(() => {
      const wrap = editorWrapRef.current;
      const clip = editorClipRef.current;
      if (!wrap || !clip) return;
      const hasOverflow = wrap.scrollHeight > wrap.clientHeight;
      if (!hasOverflow) { clip.removeAttribute("data-fade"); return; }
      const atTop = wrap.scrollTop <= 1;
      const atBottom = wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 1;
      if (!atTop && !atBottom) clip.dataset.fade = "both";
      else if (!atTop) clip.dataset.fade = "top";
      else if (!atBottom) clip.dataset.fade = "bottom";
      else clip.removeAttribute("data-fade");
    }, []);

    useEffect(() => {
      const wrap = editorWrapRef.current;
      if (!wrap) return;
      wrap.addEventListener("scroll", updateFade, { passive: true });
      return () => wrap.removeEventListener("scroll", updateFade);
    }, [updateFade]);

    useEffect(() => {
      const id = requestAnimationFrame(() => {
        const wrap = editorWrapRef.current;
        if (wrap && !isReadOnly) {
          wrap.scrollTop = wrap.scrollHeight;
        }
        updateFade();
      });
      return () => cancelAnimationFrame(id);
    }, [value, isReadOnly, updateFade]);

    // Auto-focus when entering typing-capable states
    useEffect(() => {
      if (state === "idle" || state === "typing") {
        editorRef.current?.focus();
      }
    }, [state]);

    // Capture single-line height once on mount
    useEffect(() => {
      const el = editorRef.current;
      if (el) singleLineHeight.current = el.scrollHeight || Math.round(12 * 1.45);
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
        const wrap = editorWrapRef.current;
        const isMultiline = (wrap?.scrollHeight ?? 0) > singleLineHeight.current + 2;

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
          if (!wrappedNow && textW < compactAvailWidthRef.current * (ac?.wrap?.exitThreshold ?? 0.75)) {
            expandedModeRef.current = false;
            pendingExpansion.current = false;
            setExpandedMode(false);
            setShowButtons(true);
            if (buttonsTimerRef.current) {
              clearTimeout(buttonsTimerRef.current);
              buttonsTimerRef.current = null;
            }
          }
        }
      });
    }, [value]);

    // Scroll bubble to top so first line is always visible
    useEffect(() => {
      if (!isGlass) return;
      const wrap = editorWrapRef.current;
      if (!wrap || wrap.scrollTop === 0) return;
      const from = wrap.scrollTop;
      animate(from, 0, {
        type: "spring",
        stiffness: 280,
        damping: 28,
        mass: 0.6,
        onUpdate: (v) => { wrap.scrollTop = v; },
      });
    }, [isGlass]);

    // Reset read-more state when leaving glass
    useEffect(() => {
      if (!isGlass) {
        setIsExpanded(false);
        setIsOverflowing(false);
      } else {
        setIsAddOpen(false);
      }
    }, [isGlass]);

    // Drive bottom fade from isOverflowing state — more reliable than DOM
    // measurements in glass mode where overflow:hidden makes scrollHeight
    // unpredictable across browsers and animation frames.
    useEffect(() => {
      if (!isGlass) return;
      const clip = editorClipRef.current;
      if (!clip) return;
      if (isOverflowing && !isExpanded) {
        clip.dataset.fade = "bottom";
      } else {
        clip.removeAttribute("data-fade");
      }
    }, [isGlass, isOverflowing, isExpanded]);

    // ── Variant side effects on responding -> resting ──
    // Triggers a brief shadow pulse on the bubble (mass + baton variants)
    // and a subtle width bulge so the bubble "absorbs" the button's mass.
    useEffect(() => {
      const prev = prevState.current;
      prevState.current = state;
      if (prev !== "responding" || state !== "resting") return;

      // Detect whether the settled bubble text overflows 240px
      requestAnimationFrame(() => {
        const wrap = editorWrapRef.current;
        if (wrap) {
          textScrollHeightRef.current = wrap.scrollHeight;
          setIsOverflowing(wrap.scrollHeight > 241);
          updateFade();
        }
      });

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
    }, [state, variant, surfaceControls, updateFade]);

    const handleInput = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      internalChangeRef.current = true;
      onChange(el.textContent ?? "");
    }, [onChange]);

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!e.shiftKey && value.trim().length > 0) onSubmit(value);
          else if (e.shiftKey) document.execCommand("insertText", false, "\n");
        }
      },
      [value, onSubmit]
    );

    // Sync value prop → DOM when changed externally (e.g. clear after submit)
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      if (internalChangeRef.current) { internalChangeRef.current = false; return; }
      if (el.textContent !== value) {
        el.textContent = value;
        if (document.activeElement === el) placeCursorAtEnd(el);
      }
    }, [value]);

    return (
      <LayoutGroup id={instanceId}>
        <div
          className={styles.wrap}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <motion.div
            className={`${styles.root} ${isGlass ? styles.isGlassRoot : ""}`}
            layout
            animate={{
              filter: isAddOpen ? `blur(${ac?.addCards?.inputBlur ?? 2}px)` : "blur(0px)",
            }}
            style={{
              pointerEvents: isAddOpen ? "none" : "auto"
            }}
            transition={{
              ...bubbleSpring,
              filter: { type: "tween", duration: 0.2, ease: "easeOut" },
            }}
          >
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

              <div
                ref={editorClipRef}
                className={styles.editorClip}
                style={{ flexBasis: expandedMode ? "100%" : undefined }}
              >
                <motion.div
                  ref={editorWrapRef}
                  className={`${styles.editorWrap} ${isGlass ? styles.editorWrapGlass : ""}`}
                  animate={isGlass && isOverflowing
                    ? { maxHeight: isExpanded ? textScrollHeightRef.current : 240 }
                    : undefined
                  }
                  transition={{ type: "spring", stiffness: 300, damping: 35, mass: 0.8 }}
                >
                  <div
                    ref={editorRef}
                    className={styles.editor}
                    contentEditable={isReadOnly ? "false" : "plaintext-only"}
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    spellCheck={false}
                    role="textbox"
                    aria-multiline="true"
                    aria-label={placeholder}
                    data-placeholder={placeholder}
                  />
                </motion.div>
              </div>

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
                      initial={{ opacity: 0, scale: 0, width: 0, height: 0 }}
                      animate={{ opacity: 1, scale: 1, width: 28, height: 28 }}
                      exit={{
                        opacity: 0, scale: 0, width: 0, height: 0,
                        transition: pendingExpansion.current
                          ? { type: "tween", duration: 0.15, ease: "easeOut", delay: ac?.button?.staggerExit ?? 0.055 }
                          : undefined
                      }}
                      transition={{
                        type: "spring",
                        visualDuration: ac?.addButton?.visualDuration ?? 0.4,
                        bounce: ac?.addButton?.bounce ?? 0.5,
                        delay: ac?.button?.staggerEnter ?? 0.055,
                        opacity: { type: "tween", duration: 0.15 }
                      }}
                      style={{ display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0, position: "relative" }}
                    >
                      <AnimatePresence>
                        {!isAddOpen && (
                          <motion.div
                            key="plus-btn"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 0.12, ease: "easeOut" }}
                            style={{ position: "absolute", inset: 0 }}
                          >
                            <Button
                              variant="ghost"
                              icon={<Plus size={14} aria-hidden />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsAddOpen(true);
                              }}
                              aria-label="Add"
                              title="Add"
                              style={{ width: "100%", height: "100%" }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                  {showInlineGlyph && showButtons && (
                    <motion.div
                      key="inline-action"
                      initial={{ opacity: 0, scale: 0, width: 0, height: 0, marginLeft: 0 }}
                      animate={{ opacity: 1, scale: 1, width: 28, height: 28, marginLeft: 8 }}
                      exit={{
                        opacity: 0,
                        scale: 0,
                        width: 0,
                        height: 0,
                        marginLeft: 0,
                        transition: pendingExpansion.current
                          ? { type: "tween", duration: 0.15, ease: "easeOut" }
                          : {
                            type: "spring",
                            visualDuration: ac?.enterButton?.visualDuration ?? 0.18,
                            bounce: ac?.enterButton?.bounce ?? 0.3,
                            opacity: { type: "tween", duration: 0.15 },
                            height: bubbleSpring,
                            width: bubbleSpring,
                            marginLeft: bubbleSpring
                          }
                      }}
                      transition={{
                        type: "spring",
                        visualDuration: ac?.enterButton?.visualDuration ?? 0.4,
                        bounce: ac?.enterButton?.bounce ?? 0.5,
                        opacity: { type: "tween", duration: 0.15 }
                      }}
                      style={{ display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0, overflow: "visible", transformOrigin: "right" }}
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

          {/* Add cards overlay — appears visually over the input,
              button remains in the same layout position unblurred using FLIP. */}
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
                      // Stagger entry: bottom (Add) enters first, then Design, then Connectors
                      const enterDelay = i * sd;
                      const exitDelay = (ADD_CARDS.length - 1 - i) * sd;
                      // Angles from DialKit
                      const angles = [
                        ac?.addCards?.angle1 ?? -26,
                        ac?.addCards?.angle2 ?? -2,
                        ac?.addCards?.angle3 ?? 22
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
                            zIndex: 3 - i
                          }}
                          initial={{ opacity: 0, scale: 0.95, rotate: 0, width: 160 }}
                          animate={{
                            opacity: 1, scale: 1, rotate: angles[i], width: 160,
                            transition: { 
                              type: "spring", stiffness: ac?.addCards?.stiffness ?? 350, damping: ac?.addCards?.damping ?? 25, delay: enterDelay,
                              opacity: { duration: 0.1, delay: enterDelay }
                            },
                          }}
                          whileHover={{
                            width: 160 + hoverPull,
                            transition: { type: "spring", stiffness: 400, damping: 25 }
                          }}
                          exit={{
                            opacity: 0, scale: 0.5, rotate: 0, width: 160,
                            transition: { duration: 0.15, delay: exitDelay, ease: "easeIn" }
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
                      zIndex: 10
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

          {/* Hover-revealed actions — only on a settled (resting) bubble.
            Animates from beneath; tracks the wrap's hover so cursor can
            move from bubble to actions without dismissing. */}
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
        </div>
      </LayoutGroup>
    );
  }
);
