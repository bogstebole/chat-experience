"use client";

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
import { AnimatePresence, LayoutGroup, MotionConfig, animate, motion, useAnimationControls, type Transition } from "motion/react";
import { Plus, X } from "lucide-react";
import { Attachments, type Attachment } from "../Attachments/Attachments";
import { Button } from "../Button/Button";
import { MorphGlyph } from "./MorphGlyph";
import { HoverActionsRow } from "./HoverActionsRow";
import { AddCardsOverlay } from "./AddCardsOverlay";
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

export interface ChatInputHandle {
  focus: (options?: FocusOptions) => void;
  setValue: (value: string) => void;
  getValue: () => string;
}

export interface ChatInputProps {
  state: ChatInputState;
  value: string;
  onChange: (value: string) => void;
  /**
   * What was typed, and what is going with it.
   *
   * The second argument is the whole reason attachments exist: before it, one
   * could be picked and shown in the composer and then quietly dropped on
   * send, which is worse than not offering it.
   */
  onSubmit: (value: string, attachments: Attachment[]) => void;
  onStop?: () => void;
  onAdd?: () => void;
  /**
   * What is attached, controlled. Leave it out and the composer keeps its own
   * — the same rule `useDisclosure` follows.
   */
  attachments?: Attachment[];
  /**
   * Files somebody picked. Given, this is called instead of the composer
   * attaching them itself — for a host that wants to upload first and attach
   * the URL it gets back.
   */
  onAttach?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
  /** Passed to the file picker. Defaults to images. */
  accept?: string;
  /** More than one at a time. Off by default. */
  multiple?: boolean;
  onCopy?: (value: string) => void;
  onEdit?: (value: string) => void;
  onCancelEdit?: () => void;
  isEditing?: boolean;
  placeholder?: string;
  animationConfig?: InlineAnimConfig;
  style?: React.CSSProperties;
}

/** Bubble spring used when no animationConfig override is supplied. */
const defaultBubbleSpring: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 21.5,
  mass: 0.2,
};

/**
 * Insert text at the caret of a contenteditable.
 *
 * `execCommand` is deprecated but remains the only way to insert into a
 * contenteditable while keeping the browser's native undo stack, so it stays
 * as the preferred path. It is absent in some environments and can refuse the
 * command, hence the range-based fallback — which the browser does not follow
 * with an `input` event, so the caller is told to sync state itself.
 *
 * Returns true when the browser handled it and an input event is coming.
 */
const insertTextAtCaret = (text: string): boolean => {
  if (typeof document.execCommand === "function") {
    try {
      if (document.execCommand("insertText", false, text)) return true;
    } catch {
      // Fall through to the manual path.
    }
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return false;
};

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    {
      state,
      value,
      onChange,
      onSubmit,
      onStop,
      onAdd,
      attachments,
      onAttach,
      onRemoveAttachment,
      accept = "image/*",
      multiple = false,
      onCopy,
      onEdit,
      onCancelEdit,
      isEditing = false,
      placeholder = "Placeholder text...",
      animationConfig,
      style,
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

    // The timer below outlives the component otherwise. In a browser React
    // shrugs at a setState on an unmounted component; in a test environment
    // that has already been torn down it throws, which made the suite fail at
    // random depending on how long the last render happened to take.
    useEffect(
      () => () => {
        if (buttonsTimerRef.current) clearTimeout(buttonsTimerRef.current);
      },
      []
    );
    const surfaceControls = useAnimationControls();
    const prevState = useRef(state);
    const animCfgRef = useRef(animationConfig);
    animCfgRef.current = animationConfig;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [own, setOwn] = useState<Attachment[]>([]);
    const attached = attachments ?? own;
    /* Read through a ref by the keydown handler, which is memoised on things
       that do not change per keystroke. Putting the list in its deps would
       rebuild the handler on every attach for no gain. */
    const attachedRef = useRef(attached);
    attachedRef.current = attached;

    /* Every object URL this composer made, so it can hand them back.
       `URL.createObjectURL` pins the file in memory until it is revoked, and
       nothing was revoking: attaching and removing an image ten times leaked
       ten of them, and so did navigating away with one attached. */
    const madeUrls = useRef<string[]>([]);
    useEffect(
      () => () => {
        madeUrls.current.forEach((url) => URL.revokeObjectURL(url));
        madeUrls.current = [];
      },
      []
    );

    const forget = useCallback((url?: string) => {
      if (!url) return;
      const at = madeUrls.current.indexOf(url);
      // Only ours. A URL the host passed in is the host's to revoke.
      if (at === -1) return;
      URL.revokeObjectURL(url);
      madeUrls.current.splice(at, 1);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      // Cleared, so picking the same file twice in a row still fires.
      e.target.value = "";
      if (files.length === 0) return;

      if (onAttach) {
        onAttach(files);
        return;
      }

      const picked = files.map((file) => {
        const url = URL.createObjectURL(file);
        madeUrls.current.push(url);
        return {
          id: `${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          type: file.type,
          size: file.size,
          url,
        };
      });
      setOwn((current) => {
        if (multiple) return [...current, ...picked];
        // Replacing drops the old one, so its URL goes with it. Picking six
        // images in a row leaked five otherwise.
        const kept = picked.slice(-1);
        current.forEach((a) => forget(a.url));
        picked.slice(0, -1).forEach((a) => forget(a.url));
        return kept;
      });
    };

    const removeAttachment = useCallback(
      (id: string) => {
        if (onRemoveAttachment) {
          onRemoveAttachment(id);
          return;
        }
        setOwn((current) => {
          forget(current.find((a) => a.id === id)?.url);
          return current.filter((a) => a.id !== id);
        });
      },
      [onRemoveAttachment, forget]
    );

    useImperativeHandle(ref, () => ({
      focus: (options) => editorRef.current?.focus(options),
      setValue: (v) => {
        const el = editorRef.current;
        if (el) { el.textContent = v; placeCursorAtEnd(el); }
        onChange(v);
      },
      getValue: () => value,
    }), [onChange, value]);

    const isGlass = state === "responding" || state === "resting";
    const isReadOnly = isGlass;
    const hasContent = value.trim().length > 0 || attached.length > 0;
    const isInputting = state === "typing" || state === "idle";
    const showSend = isInputting && hasContent;
    const showStop = state === "responding";
    const isRestingHovered = state === "resting" && hovered;
    const showActions = isRestingHovered;
    const showReadMore = state === "resting" && isOverflowing;
    const showInlineGlyph = showSend || showStop;

    const ac = animationConfig;
    const bubbleSpring: Transition = ac
      ? { type: "spring", stiffness: ac.bubble.stiffness, damping: ac.bubble.damping, mass: ac.bubble.mass }
      : defaultBubbleSpring;

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

    useEffect(() => {
      if (state === "idle" || state === "typing") {
        editorRef.current?.focus();
      }
    }, [state]);

    useEffect(() => {
      const el = editorRef.current;
      if (el) singleLineHeight.current = el.scrollHeight || Math.round(12 * 1.45);
    }, []);

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

    useEffect(() => {
      if (!isGlass) {
        setIsExpanded(false);
        setIsOverflowing(false);
      } else {
        setIsAddOpen(false);
      }
    }, [isGlass]);

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

    useEffect(() => {
      const prev = prevState.current;
      prevState.current = state;
      if (prev !== "responding" || state !== "resting") return;

      requestAnimationFrame(() => {
        const wrap = editorWrapRef.current;
        if (wrap) {
          textScrollHeightRef.current = wrap.scrollHeight;
          setIsOverflowing(wrap.scrollHeight > 241);
          updateFade();
        }
      });

      setPulsing(true);
      const ac = animCfgRef.current;
      surfaceControls.start({
        scaleX: [1, ac?.ripple?.scaleX ?? 1.018, 1],
        transition: {
          duration: ac?.ripple?.duration ?? 0.38,
          times: [0, 0.4, 1],
          ease: [0.25, 1, 0.5, 1],
        },
      });
      const id = window.setTimeout(() => setPulsing(false), ac?.ripple?.pulseDuration ?? 260);
      return () => clearTimeout(id);
    }, [state, surfaceControls, updateFade]);

    const handleInput = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      internalChangeRef.current = true;
      onChange(el.textContent ?? "");
    }, [onChange]);

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        if (!insertTextAtCaret(text)) handleInput();
      },
      [handleInput]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!e.shiftKey && (value.trim().length > 0 || attachedRef.current.length > 0)) {
            onSubmit(value, attachedRef.current);
          } else if (e.shiftKey && !insertTextAtCaret("\n")) handleInput();
        }
      },
      [value, onSubmit, handleInput]
    );

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
      // `reducedMotion="user"` is set here rather than left to the host app,
      // because a host that never sets it leaves every reader with the full
      // morph. Motion snaps transforms and layout to their final values and
      // keeps opacity and colour, which is the right split: the input still
      // reads as changing state, it just stops travelling to get there.
      <MotionConfig reducedMotion="user">
      <LayoutGroup id={instanceId}>
        <div
          className={styles.wrap}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={style}
        >
          <motion.div
            className={`${styles.root} ${isGlass ? styles.isGlassRoot : ""}`}
            layout
            animate={{
              filter: isAddOpen ? `blur(${ac?.addCards?.inputBlur ?? 2}px)` : "blur(0px)",
            }}
            style={{
              pointerEvents: isAddOpen ? "none" : "auto",
              width: style?.width === "100%" ? "100%" : undefined,
              maxWidth: style?.maxWidth,
            }}
            transition={{
              ...bubbleSpring,
              filter: { type: "tween", duration: 0.2, ease: "easeOut" },
            }}
          >
              <motion.div
                className={`${styles.surface} ${isGlass ? styles.glass : ""} ${isRestingHovered ? styles.hovered : ""} ${pulsing ? styles.pulsed : ""}`}
                style={{
                  alignItems: "stretch",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
                transition={bubbleSpring}
                animate={surfaceControls}
                onClick={() => editorRef.current?.focus()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={accept}
                  multiple={multiple}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />

                <AnimatePresence>
                  {attached.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      style={{ overflow: "hidden", width: "100%", flexShrink: 0 }}
                    >
                      <div className={styles.attachedTray} data-glass={isGlass || undefined}>
                        {/* Read-only while the bubble is glass: the message has
                            been sent, so these are a record of what went with
                            it rather than something still being assembled. */}
                        <Attachments
                          attachments={attached}
                          onRemove={isGlass ? undefined : removeAttachment}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>



                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", flexWrap: expandedMode ? "wrap" : "nowrap", justifyContent: expandedMode ? "flex-end" : "flex-start", width: "100%", minWidth: 0, flex: 1 }}>
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
                  layout="position"
                  animate={isGlass && isOverflowing
                    ? { maxHeight: isExpanded ? textScrollHeightRef.current : 240 }
                    : undefined
                  }
                  // The text has to travel on the same spring as the box around
                  // it. Given its own — this used to be a slower, heavier one —
                  // it lags the morph and visibly slides outside the bubble
                  // before catching up, for about half a second after the
                  // bubble itself has settled. Height is a separate concern and
                  // keeps its own easing.
                  transition={{
                    ...bubbleSpring,
                    maxHeight: { type: "spring", stiffness: 300, damping: 35, mass: 0.8 },
                  }}
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
                    data-placeholder={isReadOnly ? "" : placeholder}
                  />
                </motion.div>
              </div>

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
                      <AnimatePresence mode="popLayout" initial={false}>
                        {isEditing ? (
                          <motion.div
                            key="cancel-btn"
                            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.5, rotate: -90 }}
                            transition={{ duration: 0.14, ease: "easeOut" }}
                            style={{ position: "absolute", inset: 0 }}
                          >
                            <Button
                              variant="ghost"
                              icon={<X size={14} aria-hidden />}
                              onClick={(e) => {
                                e.stopPropagation();
                                onCancelEdit?.();
                              }}
                              aria-label="Cancel edit"
                              title="Cancel edit"
                              style={{ width: "100%", height: "100%" }}
                            />
                          </motion.div>
                        ) : !isAddOpen ? (
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
                        ) : null}
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
                        icon={<MorphGlyph mode={showStop ? "stop" : isEditing ? "check" : "send"} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showStop) onStop?.();
                          else onSubmit(value, attached);
                        }}
                        aria-label={showStop ? "Stop response" : isEditing ? "Save edits" : "Send message"}
                        style={{ flexShrink: 0, width: 28 }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              </div>
            </motion.div>

          </motion.div>

          <AddCardsOverlay
            isAddOpen={isAddOpen}
            setIsAddOpen={setIsAddOpen}
            onAdd={(label) => {
              if (!label || label === "Add") {
                fileInputRef.current?.click();
              }
              onAdd?.();
            }}
            showInlineGlyph={showInlineGlyph}
            showButtons={showButtons}
            ac={ac}
          />

          <HoverActionsRow
            showActions={showActions}
            showReadMore={showReadMore}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            onCopy={onCopy}
            onEdit={onEdit}
            value={value}
            ac={ac}
          />
        </div>
      </LayoutGroup>
      </MotionConfig>
    );
  }
);
