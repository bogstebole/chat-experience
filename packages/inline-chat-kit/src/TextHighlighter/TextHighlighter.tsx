"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  const [menuAnchor, setMenuAnchor] = useState<{ x: number | string, y: number, pathId: string, kind: "path" | "selection" } | null>(null);
  const [pressedPathId, setPressedPathId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalPointerDown = (e: PointerEvent) => {
      if (menuAnchor && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuAnchor(null);
      }
    };
    window.addEventListener("pointerdown", handleGlobalPointerDown);
    return () => window.removeEventListener("pointerdown", handleGlobalPointerDown);
  }, [menuAnchor]);

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
      ...paths.map((p) => ({ id: p.id, d: makePathString(p.points), kind: "path" as const, item: p })),
      ...selections.map((sel) => ({ id: sel.id, d: getSelectionPathString(sel.rects), kind: "selection" as const, item: sel })),
    ],
    [paths, selections]
  );

  // Precise (native) selection capture — char-level. Registered once; reads refs.
  useEffect(() => {
    const handleMouseUp = () => {
      if (menuAnchorRef.current) return;

      const container = containerRef.current;
      if (!container) return;
      const sel = window.getSelection();

      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !sel.toString().trim()) {
        return;
      }

      if (selectionModeRef.current !== "precise") return;

      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return; // selection not in this paragraph

      const text = sel.toString().trim();
      const cRect = container.getBoundingClientRect();
      const rawRects = Array.from(range.getClientRects())
        .map((r) => ({ x: r.left - cRect.left, y: r.top - cRect.top, w: r.width, h: r.height }))
        .filter((r) => r.w > 0 && r.h > 0);
      if (rawRects.length === 0) return;

      // Browser returns a separate rect for each text node / span.
      // We must merge them by line so the highlight path is continuous per line.
      const lines: { [y: string]: { x: number; y: number; w: number; h: number }[] } = {};
      rawRects.forEach(r => {
        // Group rects that share roughly the same Y coordinate (within 5px)
        const lineY = Object.keys(lines).find(yStr => Math.abs(parseFloat(yStr) - r.y) < 5);
        if (lineY) {
          lines[lineY].push(r);
        } else {
          lines[r.y.toString()] = [r];
        }
      });

      const rects = Object.values(lines).map(lineRects => {
        const minX = Math.min(...lineRects.map(r => r.x));
        const maxX = Math.max(...lineRects.map(r => r.x + r.w));
        const minY = Math.min(...lineRects.map(r => r.y));
        const maxH = Math.max(...lineRects.map(r => r.h));
        return { x: minX, y: minY, w: maxX - minX, h: maxH };
      });

      const id = Date.now().toString();
      
      const highlightedIndices = new Set<number>();
      const tokenSpans = container.querySelectorAll("span[data-index]");
      tokenSpans.forEach((span) => {
        if (sel.containsNode(span, true)) {
          highlightedIndices.add(parseInt(span.getAttribute("data-index")!, 10));
        }
      });

      setSelections((prev) => [...prev, { id, rects, text, highlightedIndices }]);
      const pos = getRectsMenuPosition(rects);
      setMenuAnchor({ x: pos.x, y: pos.y, pathId: id, kind: "selection" });
      onHighlightCompleteRef.current?.(text);
      // Clear the native selection on the next frame so it doesn't linger as blue.
      requestAnimationFrame(() => window.getSelection()?.removeAllRanges());
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // Close any open menu when switching selection mode.
  const [lastSelectionMode, setLastSelectionMode] = useState(selectionMode);
  if (lastSelectionMode !== selectionMode) {
    setLastSelectionMode(selectionMode);
    setMenuAnchor(null);
  }

  const checkHighlight = (clientX: number, clientY: number, indices: Set<number>) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (el && el.hasAttribute("data-index")) {
      const idx = parseInt(el.getAttribute("data-index")!, 10);
      indices.add(idx);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (menuAnchor) {
      setMenuAnchor(null);
      return;
    }

    if (selectionMode === "precise") return; // native selection handles this mode
    // Only left click / main touch
    if (e.button !== 0 && e.pointerType === "mouse") return;

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
    setMenuAnchor(null); // Hide menu when starting a new highlight
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
      setMenuAnchor({ x: pos.x, y: pos.y, pathId: currentPath.id, kind: "path" });
    }

    if (onHighlightComplete && currentPath.highlightedIndices.size > 0) {
      // Reconstruct highlighted text by filling in any gaps (e.g., spaces missed by fast mouse movement)
      const sortedIndices = Array.from(currentPath.highlightedIndices).sort((a, b) => a - b);
      const minIdx = sortedIndices[0];
      const maxIdx = sortedIndices[sortedIndices.length - 1];
      
      let highlightedText = "";
      for (let i = minIdx; i <= maxIdx; i++) {
        highlightedText += tokens[i];
      }
      onHighlightComplete(highlightedText.trim());
    }
    
    setCurrentPath(null);
  };

  const getHighlightedText = (pathId: string) => {
    const pathData = paths.find(p => p.id === pathId);
    if (!pathData || pathData.highlightedIndices.size === 0) return "";
    const sortedIndices = Array.from(pathData.highlightedIndices).sort((a, b) => a - b);
    const minIdx = sortedIndices[0];
    const maxIdx = sortedIndices[sortedIndices.length - 1];
    
    let highlightedText = "";
    for (let i = minIdx; i <= maxIdx; i++) {
      highlightedText += tokens[i];
    }
    return highlightedText.trim();
  };

  const removeHighlight = (id: string) => {
    if (menuAnchor?.kind === "selection") {
      setSelections(prev => prev.filter(s => s.id !== id));
    } else {
      setPaths(prev => prev.filter(p => p.id !== id));
    }
    setMenuAnchor(null);
  };

  const replyInThread = () => {
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
    setMenuAnchor(null);
  };

  return (
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
        userSelect: (selectionMode === "precise" && !menuAnchor) ? "text" : "none",
        WebkitUserSelect: (selectionMode === "precise" && !menuAnchor) ? "text" : "none",
        touchAction: "none", // Prevent scrolling while highlighting on touch devices
        display: "block", // to wrap the text tightly
        zIndex: menuAnchor ? 10 : 1, // elevate above other paragraphs
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >

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
                data-active={menuAnchor?.pathId === marker.id || undefined}
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
                    const pos = marker.kind === "path"
                      ? getMenuPosition((marker.item as PathData).points)
                      : getRectsMenuPosition((marker.item as SelectionHighlight).rects);
                    setMenuAnchor({ x: pos.x, y: pos.y, pathId: marker.id, kind: marker.kind });
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
                data-active={menuAnchor?.pathId === marker.id || undefined}
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

      {/* Floating Action Menu */}
      <AnimatePresence>
        {menuAnchor && (
          <motion.div
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
  );
}
