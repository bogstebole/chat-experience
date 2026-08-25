"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback, useId } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { Button } from "../Button/Button";
import styles from "./TextHighlighter.module.css";
import { MessageCircle, Trash2 } from "lucide-react";

const SKEW_ANGLE = -20;
const TAN_ANGLE = Math.tan((SKEW_ANGLE * Math.PI) / 180);
const MARKER_COLOR = "rgba(204, 255, 0, 0.7)"; // #CCFF00 at 70% opacity

interface PathData {
  id: string;
  points: { x: number; y: number }[];
  highlightedIndices: Set<number>;
}

interface SelectionHighlight {
  id: string;
  rects: { x: number; y: number; w: number; h: number }[]; // container-relative
  text: string;
  highlightedIndices: Set<number>;
}

export interface TextHighlighterProps {
  text: string;
  selectionMode?: "marker" | "precise";
  onHighlightComplete?: (highlightedText: string) => void;
  onReplyInThread?: (text: string, rect: DOMRect) => void;
}

/* Pure geometry helpers — hoisted so memoised values can depend on them. */

const makePathString = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return "";
  const start = points[0];
  let d = `M ${start.x} ${start.y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
};
// Menu position: horizontal center + top edge of the highlight (in container coords).
// Points store skew-corrected x, so reapply the skew (visualX = x + TAN_ANGLE * y) to get the rendered x.
const getMenuPosition = (points: { x: number; y: number }[]) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  points.forEach((p) => {
    const visualX = p.x + TAN_ANGLE * p.y;
    if (visualX < minX) minX = visualX;
    if (visualX > maxX) maxX = visualX;
    if (p.y < minY) minY = p.y;
  });
  return { x: (minX + maxX) / 2, y: minY };
};
// Same idea for precise-mode rect highlights (container-relative rects).
const getRectsMenuPosition = (rects: { x: number; y: number; w: number; h: number }[]) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  rects.forEach((r) => {
    if (r.x < minX) minX = r.x;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y < minY) minY = r.y;
  });
  return { x: (minX + maxX) / 2, y: minY };
};
/**
 * The words a set of token indices covers, gaps included.
 *
 * A fast drag skips tokens — the pointer lands on "the" and "matter" without
 * ever being over the space between them — so the run is filled in from the
 * first index to the last rather than joining only what was touched.
 */
const textFromIndices = (indices: Set<number>, tokens: string[]) => {
  if (indices.size === 0) return "";
  const sorted = [...indices].sort((a, b) => a - b);
  let out = "";
  for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) out += tokens[i];
  return out.trim();
};

/** Long passages make unusable labels; a screen reader reads every character. */
const shorten = (text: string, max = 60) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

const getSelectionPathString = (rects: { x: number; y: number; w: number; h: number }[]) => {
  let d = "";
  rects.forEach(r => {
    const centerY = r.y + r.h / 2;
    const startX = r.x - centerY * TAN_ANGLE;
    const endX = (r.x + r.w) - centerY * TAN_ANGLE;
    d += `M ${startX} ${centerY} L ${endX} ${centerY} `;
  });
  return d.trim();
};

export function TextHighlighter({ text, selectionMode = "marker", onHighlightComplete, onReplyInThread }: TextHighlighterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<PathData[]>([]);
  const [selections, setSelections] = useState<SelectionHighlight[]>([]);
  const [currentPath, setCurrentPath] = useState<PathData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  // `viaKeyboard` decides whether focus moves into the menu when it opens.
  // Pulling focus out from under someone who just drew with a mouse would be
  // an interruption; for someone who arrived by keyboard it is the only way in.
  const [menuAnchor, setMenuAnchor] = useState<{
    x: number | string;
    y: number;
    pathId: string;
    kind: "path" | "selection";
    viaKeyboard?: boolean;
  } | null>(null);
  /** Which action the menu's roving tabindex is currently on. */
  const [menuIndex, setMenuIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Where focus goes when a keyboard-opened menu is dismissed. */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [pressedPathId, setPressedPathId] = useState<string | null>(null);
  // Which highlight the keyboard is currently on. Drives the same emphasis the
  // open menu does, so tabbing through them is visible on the page and not
  // only to a screen reader.
  const [focusedMarkerId, setFocusedMarkerId] = useState<string | null>(null);

  type MenuAnchor = NonNullable<typeof menuAnchor>;

  /** Open the menu, remembering how it was opened and what focus came from. */
  const openMenu = useCallback((anchor: MenuAnchor) => {
    if (anchor.viaKeyboard) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
    }
    setMenuIndex(0);
    setMenuAnchor(anchor);
  }, []);

  /**
   * Close the menu, and decide what focus does next.
   *
   * "restore" hands it back to whatever opened the menu — a highlight's button,
   * or the paragraph. "container" is for when that thing is about to stop
   * existing, as when the highlight itself is deleted. "none" is for the
   * pointer, where moving focus at all would be an interruption.
   */
  const dismissMenu = useCallback((focus: "restore" | "container" | "none" = "none") => {
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    setMenuAnchor(null);
    if (focus === "none") return;
    if (focus === "restore" && target?.isConnected) target.focus();
    else containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleGlobalPointerDown = (e: PointerEvent) => {
      if (menuAnchor && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dismissMenu();
      }
    };
    window.addEventListener("pointerdown", handleGlobalPointerDown);
    return () => window.removeEventListener("pointerdown", handleGlobalPointerDown);
  }, [menuAnchor, dismissMenu]);

  // Split text by words and keep spaces separate so we can render them properly
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);




  // Live values for the stable document listener (avoids re-registering on every
  // render). Written after commit — the listener only reads them from event
  // handlers, which run well after paint.
  const selectionModeRef = useRef(selectionMode);
  const selectionsRef = useRef(selections);
  const onHighlightCompleteRef = useRef(onHighlightComplete);
  const menuAnchorRef = useRef(menuAnchor);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
    selectionsRef.current = selections;
    onHighlightCompleteRef.current = onHighlightComplete;
    menuAnchorRef.current = menuAnchor;
  });


  // Rebuilding these path strings on every hover was a large part of the cost.
  const allMarkers = useMemo(
    () => [
      ...paths.map((p) => ({
        id: p.id,
        d: makePathString(p.points),
        kind: "path" as const,
        item: p,
        text: textFromIndices(p.highlightedIndices, tokens),
      })),
      ...selections.map((sel) => ({
        id: sel.id,
        d: getSelectionPathString(sel.rects),
        kind: "selection" as const,
        item: sel,
        text: sel.text,
      })),
    ],
    [paths, selections, tokens]
  );

  type Marker = (typeof allMarkers)[number];

  /** Where the menu sits for a marker, in container coordinates. */
  const openMenuFor = (marker: Marker, viaKeyboard = false) => {
    const pos =
      marker.kind === "path"
        ? getMenuPosition((marker.item as PathData).points)
        : getRectsMenuPosition((marker.item as SelectionHighlight).rects);
    openMenu({ x: pos.x, y: pos.y, pathId: marker.id, kind: marker.kind, viaKeyboard });
  };

  /**
   * Turn a DOM Range into a committed highlight.
   *
   * Three routes arrive at a range — a drag in precise mode, a native
   * selection finished with the keyboard, and the word cursor below. They
   * differ only in how the range is arrived at, so everything after it is
   * shared.
   */
  const commitRange = useCallback((range: Range, rawText: string, viaKeyboard = false) => {
    const container = containerRef.current;
    const text = rawText.trim();
    if (!container || !text) return;

    const highlightedIndices = new Set<number>();
    container.querySelectorAll("span[data-index]").forEach((span) => {
      if (range.intersectsNode(span)) {
        highlightedIndices.add(parseInt(span.getAttribute("data-index")!, 10));
      }
    });

    // Reported before the geometry, and regardless of it. Somebody highlighted
    // this text; whether a marker can be drawn over it is a separate question,
    // and one the host app has no stake in.
    onHighlightCompleteRef.current?.(text);

    const cRect = container.getBoundingClientRect();
    const rawRects = Array.from(range.getClientRects())
      .map((r) => ({ x: r.left - cRect.left, y: r.top - cRect.top, w: r.width, h: r.height }))
      .filter((r) => r.w > 0 && r.h > 0);
    if (rawRects.length === 0) return;

    // The browser returns a separate rect for each text node. Merge them by
    // line, so the marker is one continuous stroke per line rather than one
    // stroke per word.
    const lines: { [y: string]: { x: number; y: number; w: number; h: number }[] } = {};
    rawRects.forEach((r) => {
      // Group rects that share roughly the same Y coordinate (within 5px)
      const lineY = Object.keys(lines).find((yStr) => Math.abs(parseFloat(yStr) - r.y) < 5);
      if (lineY) lines[lineY].push(r);
      else lines[r.y.toString()] = [r];
    });

    const rects = Object.values(lines).map((lineRects) => {
      const minX = Math.min(...lineRects.map((r) => r.x));
      const maxX = Math.max(...lineRects.map((r) => r.x + r.w));
      const minY = Math.min(...lineRects.map((r) => r.y));
      const maxH = Math.max(...lineRects.map((r) => r.h));
      return { x: minX, y: minY, w: maxX - minX, h: maxH };
    });

    const id = Date.now().toString();
    setSelections((prev) => [...prev, { id, rects, text, highlightedIndices }]);
    const pos = getRectsMenuPosition(rects);
    openMenu({ x: pos.x, y: pos.y, pathId: id, kind: "selection", viaKeyboard });
  }, [openMenu]);

  /**
   * A selection the reader made themselves.
   *
   * The pointer half only applies in precise mode, where native selection owns
   * the pointer. The keyboard half applies in both modes: dragging a marker
   * has no keyboard equivalent, so refusing keyboard selection in marker mode
   * would leave that mode with no way in at all.
   */
  useEffect(() => {
    const capture = (fromKeyboard: boolean) => {
      if (menuAnchorRef.current) return;
      const container = containerRef.current;
      if (!container) return;
      if (!fromKeyboard && selectionModeRef.current !== "precise") return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !sel.toString().trim()) return;

      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return; // not this paragraph

      commitRange(range, sel.toString(), fromKeyboard);
      // Clear the native selection on the next frame so it doesn't linger as blue.
      requestAnimationFrame(() => window.getSelection()?.removeAllRanges());
    };

    const onMouseUp = () => capture(false);
    const onKeyUp = (e: KeyboardEvent) => {
      // Only keys that can have changed a selection. Anything else would
      // re-commit the same range on every keystroke.
      const selectAll = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a";
      if (!e.shiftKey && !selectAll) return;
      capture(true);
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [commitRange]);

  // Close any open menu when switching selection mode.
  const [lastSelectionMode, setLastSelectionMode] = useState(selectionMode);
  if (lastSelectionMode !== selectionMode) {
    setLastSelectionMode(selectionMode);
    setMenuAnchor(null);
  }

  /**
   * The word cursor — how this works without a mouse.
   *
   * Dragging a marker has no keyboard equivalent, and native selection is not
   * a way in either: browsers give no caret to non-editable text unless caret
   * browsing is switched on, which almost nobody has. So the paragraph owns a
   * cursor of its own, moving over the word tokens that are already there for
   * hit-testing.
   *
   * Left and right move it, shift extends, Enter commits the same kind of
   * highlight a drag would have made. Up and down are deliberately left alone:
   * moving by line would need to know where the lines break, and guessing that
   * would be worse than letting the page scroll.
   */
  const wordIndices = useMemo(
    () => tokens.map((token, i) => (token.trim() ? i : -1)).filter((i) => i >= 0),
    [tokens]
  );
  const [caret, setCaret] = useState<number | null>(null);
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const hintId = useId();

  const cursorRange = useMemo(() => {
    if (caret === null || anchorIndex === null) return null;
    return { from: Math.min(anchorIndex, caret), to: Math.max(anchorIndex, caret) };
  }, [caret, anchorIndex]);

  const clearCursor = () => {
    setCaret(null);
    setAnchorIndex(null);
  };

  const commitCursor = () => {
    const container = containerRef.current;
    if (!container || !cursorRange) return;
    const first = container.querySelector(`span[data-index="${cursorRange.from}"]`);
    const last = container.querySelector(`span[data-index="${cursorRange.to}"]`);
    if (!first || !last) return;

    const range = document.createRange();
    range.setStartBefore(first);
    range.setEndAfter(last);

    let text = "";
    for (let i = cursorRange.from; i <= cursorRange.to; i++) text += tokens[i];
    commitRange(range, text, true);
    clearCursor();
  };

  const menuItems = () => [
    ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];

  /**
   * Focus follows the roving tabindex — but only once focus is already in the
   * menu, or the menu was opened by someone who has no other way in. A menu
   * that grabs focus from a reader who opened it with a mouse is a menu that
   * interrupts.
   */
  useEffect(() => {
    if (!menuAnchor) return;
    const items = menuItems();
    if (items.length === 0) return;
    const inside = menuRef.current?.contains(document.activeElement);
    if (menuAnchor.viaKeyboard || inside) items[Math.min(menuIndex, items.length - 1)]?.focus();
  }, [menuAnchor, menuIndex]);

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const count = menuItems().length;
    if (count === 0) return;

    const step = (delta: number) => {
      e.preventDefault();
      // Stopped here so the paragraph's own arrow keys do not also move the
      // word cursor behind the open menu.
      e.stopPropagation();
      setMenuIndex((i) => (i + delta + count) % count);
    };

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        return step(1);
      case "ArrowLeft":
      case "ArrowUp":
        return step(-1);
      case "Home":
        e.preventDefault();
        return setMenuIndex(0);
      case "End":
        e.preventDefault();
        return setMenuIndex(count - 1);
      default:
        return;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Something inside has focus — a highlight's button, or a menu action.
    // Only Escape is still ours; the rest belongs to whatever is focused.
    if (e.target !== e.currentTarget && e.key !== "Escape") return;
    if (wordIndices.length === 0) return;

    const move = (direction: 1 | -1, extend: boolean) => {
      e.preventDefault();
      const at = caret === null ? -1 : wordIndices.indexOf(caret);
      const next =
        at === -1
          ? wordIndices[direction === 1 ? 0 : wordIndices.length - 1]
          : wordIndices[Math.min(wordIndices.length - 1, Math.max(0, at + direction))];
      setCaret(next);
      // Without shift the selection collapses onto the cursor, which is what
      // makes an unextended move feel like moving rather than selecting.
      if (!extend || anchorIndex === null) setAnchorIndex(next);
    };

    const jump = (to: number) => {
      e.preventDefault();
      setCaret(to);
      if (!e.shiftKey || anchorIndex === null) setAnchorIndex(to);
    };

    switch (e.key) {
      case "ArrowRight":
        return move(1, e.shiftKey);
      case "ArrowLeft":
        return move(-1, e.shiftKey);
      case "Home":
        return jump(wordIndices[0]);
      case "End":
        return jump(wordIndices[wordIndices.length - 1]);
      case "Enter":
      case " ":
        if (!cursorRange) return;
        e.preventDefault();
        return commitCursor();
      case "Escape":
        if (!menuAnchor && caret === null) return; // let the host app have it
        e.preventDefault();
        dismissMenu("restore");
        return clearCursor();
      default:
        return;
    }
  };

  const checkHighlight = (clientX: number, clientY: number, indices: Set<number>) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (el && el.hasAttribute("data-index")) {
      const idx = parseInt(el.getAttribute("data-index")!, 10);
      indices.add(idx);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (menuAnchor) {
      dismissMenu();
      return;
    }

    if (selectionMode === "precise") return; // native selection handles this mode
    // Only left click / main touch
    if (e.button !== 0 && e.pointerType === "mouse") return;

    // Text is selectable now, so the drag would otherwise start a native
    // selection underneath the marker. Preventing the default here suppresses
    // the compatibility mouse events that would begin one.
    e.preventDefault();

    setIsDrawing(true);
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);

    const rect = target.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const correctedX = mouseX - mouseY * TAN_ANGLE;
    const newPath: PathData = {
      id: Date.now().toString(),
      points: [{ x: correctedX, y: mouseY }],
      highlightedIndices: new Set<number>(),
    };
    setCurrentPath(newPath);
    dismissMenu(); // Hide menu when starting a new highlight
    checkHighlight(e.clientX, e.clientY, newPath.highlightedIndices);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (selectionMode === "precise") return;
    if (!currentPath) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const correctedX = mouseX - mouseY * TAN_ANGLE;

    setCurrentPath((prev) => {
      if (!prev) return prev;
      const newIndices = new Set(prev.highlightedIndices);
      checkHighlight(e.clientX, e.clientY, newIndices);
      return {
        ...prev,
        points: [...prev.points, { x: correctedX, y: mouseY }],
        highlightedIndices: newIndices,
      };
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (selectionMode === "precise") return;
    setIsDrawing(false);
    if (!currentPath) return;
    const target = e.currentTarget as HTMLDivElement;
    target.releasePointerCapture(e.pointerId);

    setPaths((prev) => [...prev, currentPath]);
    
    if (currentPath.highlightedIndices.size > 0) {
      const pos = getMenuPosition(currentPath.points);
      openMenu({ x: pos.x, y: pos.y, pathId: currentPath.id, kind: "path" });
    }

    if (onHighlightComplete && currentPath.highlightedIndices.size > 0) {
      onHighlightComplete(textFromIndices(currentPath.highlightedIndices, tokens));
    }
    
    setCurrentPath(null);
  };

  const getHighlightedText = (pathId: string) => {
    const pathData = paths.find((p) => p.id === pathId);
    return pathData ? textFromIndices(pathData.highlightedIndices, tokens) : "";
  };

  const removeHighlight = (id: string) => {
    const viaKeyboard = menuAnchor?.viaKeyboard;
    if (menuAnchor?.kind === "selection") {
      setSelections(prev => prev.filter(s => s.id !== id));
    } else {
      setPaths(prev => prev.filter(p => p.id !== id));
    }
    // The control focus would return to is the one being deleted, so focus
    // goes back to the paragraph instead of nowhere.
    dismissMenu(viaKeyboard ? "container" : "none");
  };

  const replyInThread = () => {
    // Focus goes back to the highlight *before* the host app opens its thread,
    // so whatever the thread captures as its return target is the highlight
    // and not a menu item that is about to stop existing.
    const viaKeyboard = menuAnchor?.viaKeyboard;
    if (menuAnchor && onReplyInThread) {
      if (menuAnchor.kind === "selection") {
        const sel = selections.find(s => s.id === menuAnchor.pathId);
        const container = containerRef.current;
        if (sel && container) {
          // Build a viewport-space union rect from the container-relative rects.
          const cRect = container.getBoundingClientRect();
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          sel.rects.forEach(r => {
            minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
            maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
          });
          const rect = new DOMRect(cRect.left + minX, cRect.top + minY, maxX - minX, maxY - minY);
          onReplyInThread(sel.text, rect);
        }
      } else {
        const text = getHighlightedText(menuAnchor.pathId);
        const el = document.getElementById(`highlight-path-${menuAnchor.pathId}`);
        if (el) {
          onReplyInThread(text, el.getBoundingClientRect());
        }
      }
    }
    dismissMenu(viaKeyboard ? "restore" : "none");
  };

  return (
    // See the note in ChatInput: the kit sets this itself rather than relying
    // on the host app to.
    <MotionConfig reducedMotion="user">
    <motion.div
      ref={containerRef}
      data-cursor={selectionMode === "precise" ? "text" : "marker"}
      data-cursor-active={isDrawing ? "true" : "false"}
      animate={{
        scale: 1,
        y: 0,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{
        position: "relative",
        // Suppressed only while a marker is being drawn. It used to be off
        // permanently in marker mode, which meant the answer could not be
        // selected at all — not to highlight it, not even to copy it.
        userSelect: isDrawing ? "none" : "text",
        WebkitUserSelect: isDrawing ? "none" : "text",
        touchAction: "none", // Prevent scrolling while highlighting on touch devices
        display: "block", // to wrap the text tightly
        zIndex: menuAnchor ? 10 : 1, // elevate above other paragraphs
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={styles.surface}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={clearCursor}
      aria-describedby={hintId}
    >
      {/* Referenced by aria-describedby, so it is read on focus and nowhere
          else — a directly referenced node is used even when hidden. Without
          this, the keys exist but nothing tells anyone they do. */}
      <span id={hintId} className={styles.srOnly} aria-hidden="true">
        Left and right arrow keys move by word. Hold shift to select. Enter
        highlights the selection, Escape clears it.
      </span>

      {/* Proximity Hitbox: proširuje zonu "hvatanja" miša za 20px bez pomeranja layouta */}
      <div 
        style={{
          position: "absolute",
          top: -20,
          left: -20,
          right: -20,
          bottom: -20,
          zIndex: 0,
        }}
      />

      {/* Underlying text */}
      <span
        className={styles.tokens}
        style={{ position: "relative", zIndex: 1 }}
        data-focus={!!menuAnchor || undefined}
      >
        {tokens.map((token, i) => {
          // Both freeform (path) and precise (selection) highlights dim the surrounding tokens.
          const isHighlightActive = !!menuAnchor;
          let isPartOfActiveHighlight = false;

          if (isHighlightActive) {
            if (menuAnchor.kind === "path") {
              const activePath = paths.find(p => p.id === menuAnchor.pathId);
              isPartOfActiveHighlight = activePath?.highlightedIndices?.has(i) ?? false;
            } else if (menuAnchor.kind === "selection") {
              const activeSel = selections.find(s => s.id === menuAnchor.pathId);
              isPartOfActiveHighlight = activeSel?.highlightedIndices?.has(i) ?? false;
            }
          }

          let isPartOfPressed = false;
          if (pressedPathId) {
            const pressedPath = paths.find(p => p.id === pressedPathId);
            if (pressedPath) {
              isPartOfPressed = pressedPath.highlightedIndices?.has(i) ?? false;
            } else {
              const pressedSel = selections.find(s => s.id === pressedPathId);
              if (pressedSel) {
                isPartOfPressed = pressedSel.highlightedIndices?.has(i) ?? false;
              }
            }
          }

          return (
            <span
              key={i}
              data-index={i}
              className={styles.token}
              data-active={isPartOfActiveHighlight || undefined}
              data-pressed={isPartOfPressed || undefined}
              data-kbd-cursor={caret === i || undefined}
              data-kbd-selected={
                (cursorRange && i >= cursorRange.from && i <= cursorRange.to) || undefined
              }
            >
              {token}
            </span>
          );
        })}
      </span>

      {/* SVG Canvas overlay */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          mixBlendMode: "multiply",
          zIndex: 2,
          overflow: "visible", // allows stroke to go slightly outside bounds
        }}
      >
        <g transform={`skewX(${SKEW_ANGLE})`}>
          {allMarkers.map((marker) => (
            <React.Fragment key={marker.id}>
              <path
                id={`highlight-${marker.kind}-${marker.id}`}
                className={styles.marker}
                d={marker.d}
                fill="none"
                stroke={MARKER_COLOR}
                strokeLinejoin="round"
                strokeLinecap="butt"
                data-cursor="pointer"
                data-pressed={pressedPathId === marker.id || undefined}
                data-active={
                  menuAnchor?.pathId === marker.id || focusedMarkerId === marker.id || undefined
                }
                data-dimmed={(menuAnchor && menuAnchor.pathId !== marker.id) || undefined}
                style={{ pointerEvents: isDrawing ? "none" : "stroke" }}
                onPointerDown={(e) => {
                  if (isDrawing) return;
                  e.stopPropagation();
                  setPressedPathId(marker.id);
                }}
                onPointerUp={(e) => {
                  if (pressedPathId === marker.id) {
                    e.stopPropagation();
                    openMenuFor(marker);
                    setPressedPathId(null);
                  }
                }}
                onPointerLeave={() => setPressedPathId(null)}
                onPointerCancel={() => setPressedPathId(null)}
              />
              {/* Sibling of the marker so CSS can drive it off :hover. Mounted
                  once and paused, rather than added and removed per crossing. */}
              <path
                className={styles.shimmer}
                d={marker.d}
                pathLength={1}
                data-active={
                  menuAnchor?.pathId === marker.id || focusedMarkerId === marker.id || undefined
                }
              />
            </React.Fragment>
          ))}
          {currentPath && (
            <path
              d={makePathString(currentPath.points)}
              fill="none"
              stroke={MARKER_COLOR}
              strokeWidth="20px"
              strokeLinejoin="round"
              strokeLinecap="butt"
            />
          )}
        </g>
      </svg>

      {/* Every committed highlight, as something the keyboard can reach.
          Real buttons rather than focusable SVG paths — focus on SVG elements
          behaves differently in every browser and is not a fight worth having.
          They are invisible, but focusing one lights up the marker it belongs
          to, so tabbing through them is visible on the page and not only to a
          screen reader. */}
      {allMarkers.length > 0 && (
        <div
          role="group"
          aria-label={`${allMarkers.length} highlight${allMarkers.length === 1 ? "" : "s"}`}
        >
          {allMarkers.map((marker) => (
            <button
              key={marker.id}
              type="button"
              className={styles.srOnly}
              onPointerDown={(e) => e.stopPropagation()} // must not start a new drawing
              onFocus={() => setFocusedMarkerId(marker.id)}
              onBlur={() => setFocusedMarkerId(null)}
              onClick={(e) => {
                e.stopPropagation();
                // These are invisible, so they can only have been activated
                // from the keyboard.
                openMenuFor(marker, true);
              }}
            >
              {`Highlight: ${shorten(marker.text)}`}
            </button>
          ))}
        </div>
      )}

      {/* Floating Action Menu */}
      <AnimatePresence>
        {menuAnchor && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label="Highlight actions"
            onKeyDown={handleMenuKeyDown}
            onBlur={(e) => {
              // Tab out and the menu goes with you. Leaving one open behind
              // the focus ring is how a menu becomes a thing to get lost in.
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) dismissMenu();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { staggerChildren: 0.05 } }}
            exit={{ opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: -1 } }}
            style={{
              position: "absolute",
              left: menuAnchor.x,
              top: menuAnchor.y,
              transform: "translate(-50%, calc(-100% - 16px))",
              zIndex: 10000,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              pointerEvents: "auto",
            }}
            onPointerDown={(e) => e.stopPropagation()} // Sprečava da klik na dugme započne novo crtananje
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 25 } }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
            >
              <Button
                variant="primary"
                role="menuitem"
                tabIndex={menuIndex === 0 ? 0 : -1}
                icon={<MessageCircle size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  replyInThread();
                }}
                title="Reply in thread"
              >
                Reply in thread
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 25 } }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
            >
              <Button
                variant="primary"
                role="menuitem"
                tabIndex={menuIndex === 1 ? 0 : -1}
                icon={<Trash2 size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  removeHighlight(menuAnchor.pathId);
                }}
                title="Remove highlight"
                aria-label="Remove highlight"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </MotionConfig>
  );
}
