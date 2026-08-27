"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Playground-only performance probe.
 *
 * Deliberately observes from the outside — it reads the DOM and the
 * performance timeline, and never touches inline-chat-kit. Nothing here ships
 * in the package.
 *
 * The live readout writes through refs straight into the DOM rather than
 * through React state. A component re-rendering every frame would show up in
 * the very numbers it is trying to report.
 */

// A frame is only "dropped" relative to the display's own cadence, and rAF
// timestamps jitter by a millisecond or so. Counting everything over one frame
// interval flags healthy 60Hz frames as drops, so the bar is 1.5 intervals.
const DROP_FACTOR = 1.5;
const BAD_FACTOR = 2.5;
const FALLBACK_INTERVAL_MS = 16.7;
// Startup noise: the click that begins a capture lands in the first frames.
const WARMUP_MS = 600;
// A menu's dim animation keeps writing styles after the click that opened it.
// Without this tail the tail lands in the hover bucket.
const MENU_SETTLE_MS = 800;

interface Mark {
  at: number;
  frameMs: number;
  note: string;
}

interface SlowEvent {
  name: string;
  duration: number;
  at: number;
}

interface LongTask {
  duration: number;
  at: number;
}

const flash = () => {
  const el = document.getElementById("perfhud-flash");
  if (!el) return;
  el.style.opacity = "1";
  window.setTimeout(() => {
    el.style.opacity = "0";
  }, 220);
};

const pct = (sorted: number[], p: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function PerfHud() {
  const [recording, setRecording] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Everything sampled during a run lives in refs — no renders while measuring.
  const framesRef = useRef<number[]>([]);
  const frameAtRef = useRef<number[]>([]);
  const marksRef = useRef<Mark[]>([]);
  const slowEventsRef = useRef<SlowEvent[]>([]);
  const longTasksRef = useRef<LongTask[]>([]);
  const pointerMovesRef = useRef(0);
  const peakMoveRateRef = useRef(0);
  const mutationsRef = useRef(0);
  const shimmerSeenRef = useRef(false);
  const maxMarkersRef = useRef(0);
  const startedAtRef = useRef(0);
  const recordingRef = useRef(false);
  const lastFrameMsRef = useRef(0);
  const hiddenEventsRef = useRef(0);
  const skipNextFrameRef = useRef(false);
  const intervalRef = useRef(0);
  // Drawing a highlight and hovering one are different code paths with very
  // different costs. Lumping their DOM churn together hides which is which.
  const drawingRef = useRef(false);
  const mutHoverRef = useRef(0);
  const mutDrawRef = useRef(0);
  const crossingsRef = useRef(0);
  const mutMenuRef = useRef(0);
  const menuSettleUntilRef = useRef(0);

  const fpsElRef = useRef<HTMLSpanElement>(null);
  const worstElRef = useRef<HTMLSpanElement>(null);
  const droppedElRef = useRef<HTMLSpanElement>(null);
  const rateElRef = useRef<HTMLSpanElement>(null);
  const rendersElRef = useRef<HTMLSpanElement>(null);
  const stateElRef = useRef<HTMLSpanElement>(null);

  // ── Frame sampling ────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let windowStart = last;
    let windowFrames = 0;
    let windowWorst = 0;
    let movesAtWindowStart = 0;
    const recentRef: number[] = [];

    const tick = (now: number) => {
      const delta = now - last;
      last = now;

      // rAF is throttled while the tab is backgrounded, so a frame spanning a
      // hidden period measures the tab switch, not the page. Drop it, and drop
      // the first frame after returning too.
      if (document.hidden || skipNextFrameRef.current) {
        skipNextFrameRef.current = document.hidden;
        if (document.hidden && fpsElRef.current) fpsElRef.current.textContent = "paused";
        raf = requestAnimationFrame(tick);
        return;
      }

      lastFrameMsRef.current = delta;

      if (recordingRef.current) {
        framesRef.current.push(delta);
        frameAtRef.current.push(now - startedAtRef.current);
      }

      windowFrames += 1;
      if (delta > windowWorst) windowWorst = delta;

      recentRef.push(delta);
      if (recentRef.length > 120) recentRef.shift();
      if (recentRef.length >= 20) {
        const med = [...recentRef].sort((a, b) => a - b)[Math.floor(recentRef.length / 2)];
        intervalRef.current = med;
      }

      // Refresh the readout ~4x/sec, not every frame.
      const elapsed = now - windowStart;
      if (elapsed >= 250) {
        const fps = (1000 * windowFrames) / elapsed;
        const moves = pointerMovesRef.current - movesAtWindowStart;
        const moveRate = (1000 * moves) / elapsed;
        if (moveRate > peakMoveRateRef.current) peakMoveRateRef.current = moveRate;

        if (fpsElRef.current) fpsElRef.current.textContent = fps.toFixed(0);
        if (worstElRef.current) worstElRef.current.textContent = `${windowWorst.toFixed(1)}ms`;
        if (rateElRef.current) rateElRef.current.textContent = `${moveRate.toFixed(0)}/s`;
        if (droppedElRef.current) {
          const interval = intervalRef.current || FALLBACK_INTERVAL_MS;
          droppedElRef.current.textContent = recordingRef.current
            ? String(framesRef.current.filter((d) => d > interval * DROP_FACTOR).length)
            : "—";
        }
        if (rendersElRef.current) {
          rendersElRef.current.textContent = recordingRef.current
            ? String(mutationsRef.current)
            : "—";
        }
        if (stateElRef.current) {
          const markers = document.querySelectorAll('path[id^="highlight-"]').length;
          // Hover moved from React state to CSS, so ask the DOM directly
          // whether a marker is under the pointer.
          const shimmer = !!document.querySelector('path[id^="highlight-"]:hover');
          if (markers > maxMarkersRef.current) maxMarkersRef.current = markers;
          if (shimmer) shimmerSeenRef.current = true;
          stateElRef.current.textContent = `${markers} hl${shimmer ? " · shimmer" : ""}`;
        }

        windowStart = now;
        windowFrames = 0;
        windowWorst = 0;
        movesAtWindowStart = pointerMovesRef.current;
      }

      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      skipNextFrameRef.current = true;
      if (document.hidden && recordingRef.current) hiddenEventsRef.current += 1;
    };
    document.addEventListener("visibilitychange", onVisibility);

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // ── Input and main-thread observers ───────────────────────────────
  useEffect(() => {
    const onMove = () => {
      pointerMovesRef.current += 1;
    };
    const onDown = () => {
      drawingRef.current = true;
    };
    const onUp = () => {
      drawingRef.current = false;
    };
    // A "crossing" is the pointer entering or leaving a marker's stroke. This
    // is the thing hover used to re-render on, so it is the denominator that
    // matters.
    const onOverOut = (e: Event) => {
      const t = e.target as Element | null;
      if (t && t.id && t.id.startsWith("highlight-")) crossingsRef.current += 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true, capture: true });
    window.addEventListener("pointerdown", onDown, { passive: true, capture: true });
    window.addEventListener("pointerup", onUp, { passive: true, capture: true });
    window.addEventListener("pointercancel", onUp, { passive: true, capture: true });
    window.addEventListener("pointerover", onOverOut, { passive: true, capture: true });
    window.addEventListener("pointerout", onOverOut, { passive: true, capture: true });

    const observers: PerformanceObserver[] = [];
    const observe = (
      type: string,
      cb: (entries: PerformanceEntryList) => void,
      opts: PerformanceObserverInit = {}
    ) => {
      try {
        const po = new PerformanceObserver((list) => cb(list.getEntries()));
        po.observe({ type, buffered: true, ...opts } as PerformanceObserverInit);
        observers.push(po);
      } catch {
        // Type unsupported in this browser — the report says so.
      }
    };

    // Input latency: how long the browser took to handle a pointer event.
    observe(
      "event",
      (entries) => {
        if (!recordingRef.current) return;
        for (const e of entries) {
          slowEventsRef.current.push({
            name: e.name,
            duration: e.duration,
            at: e.startTime - startedAtRef.current,
          });
        }
      },
      { durationThreshold: 16 } as PerformanceObserverInit
    );

    // Main-thread blocking.
    observe("longtask", (entries) => {
      if (!recordingRef.current) return;
      for (const e of entries) {
        longTasksRef.current.push({
          duration: e.duration,
          at: e.startTime - startedAtRef.current,
        });
      }
    });

    return () => {
      const cap = { capture: true } as EventListenerOptions;
      window.removeEventListener("pointermove", onMove, cap);
      window.removeEventListener("pointerdown", onDown, cap);
      window.removeEventListener("pointerup", onUp, cap);
      window.removeEventListener("pointercancel", onUp, cap);
      window.removeEventListener("pointerover", onOverOut, cap);
      window.removeEventListener("pointerout", onOverOut, cap);
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  // ── Re-render proxy: DOM churn inside the answer text ─────────────
  useEffect(() => {
    let mo: MutationObserver | null = null;
    const attach = () => {
      /* The highlighter's own root, not the wrapper around it.
         `.aiText` was a plain class in this app until the turn row moved into
         the package, where it became a hashed CSS-module name — a selector
         that matches nothing and reports zero mutations forever, which is the
         worst way for a measuring instrument to fail. `data-cursor-active` is
         part of the kit's DOM contract: `CustomCursor` reads it, and it is
         there in both selection modes. */
      const target = document.querySelector("[data-cursor-active]");
      if (!target || mo) return;
      mo = new MutationObserver((recs) => {
        if (!recordingRef.current) return;
        mutationsRef.current += recs.length;
        const menuOpen =
          !!document.querySelector('path[id^="highlight-"][data-active="true"]') ||
          performance.now() < menuSettleUntilRef.current;
        if (menuOpen) menuSettleUntilRef.current = performance.now() + MENU_SETTLE_MS;
        if (drawingRef.current) mutDrawRef.current += recs.length;
        else if (menuOpen) mutMenuRef.current += recs.length;
        else mutHoverRef.current += recs.length;
      });
      mo.observe(target, { subtree: true, childList: true, attributes: true, characterData: true });
    };
    attach();
    const poll = window.setInterval(attach, 1000);
    return () => {
      window.clearInterval(poll);
      mo?.disconnect();
    };
  }, []);

  // ── Marking the moment it felt bad ────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if (typing) return;

      if (e.key === "m" || e.key === "M") {
        if (!recordingRef.current) return;
        marksRef.current.push({
          at: performance.now() - startedAtRef.current,
          frameMs: lastFrameMsRef.current,
          note: "felt bad here",
        });
        flash();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const start = () => {
    framesRef.current = [];
    frameAtRef.current = [];
    marksRef.current = [];
    slowEventsRef.current = [];
    longTasksRef.current = [];
    pointerMovesRef.current = 0;
    peakMoveRateRef.current = 0;
    mutationsRef.current = 0;
    shimmerSeenRef.current = false;
    maxMarkersRef.current = 0;
    hiddenEventsRef.current = 0;
    mutHoverRef.current = 0;
    mutDrawRef.current = 0;
    crossingsRef.current = 0;
    mutMenuRef.current = 0;
    menuSettleUntilRef.current = 0;
    drawingRef.current = false;
    startedAtRef.current = performance.now();
    recordingRef.current = true;
    setReport(null);
    setRecording(true);
  };

  const stop = () => {
    recordingRef.current = false;
    setRecording(false);
    setReport(buildReport());
  };

  const buildReport = () => {
    const firstKept = frameAtRef.current.findIndex((t) => t > WARMUP_MS);
    const from = firstKept > 0 ? firstKept : 1;
    const frames = framesRef.current.slice(from);
    const frameAts = frameAtRef.current.slice(from);
    const warmupSkipped = from - 1;
    const wallMs = performance.now() - startedAtRef.current;
    // Frames from hidden periods are excluded, so wall-clock would understate
    // the rate. Rate has to come from the time actually sampled.
    const sampledMs = frames.reduce((a, b) => a + b, 0);
    const sorted = [...frames].sort((a, b) => a - b);
    const interval = pct(sorted, 0.5) || FALLBACK_INTERVAL_MS;
    const dropAt = interval * DROP_FACTOR;
    const badAt = interval * BAD_FACTOR;
    const long = frames.filter((d) => d > dropAt);
    const bad = frames.filter((d) => d > badAt);

    // Worst frames with when they happened, so marks can be correlated.
    const worst = frames
      .map((d, i) => ({ d, at: frameAts[i] ?? 0 }))
      .sort((a, b) => b.d - a.d)
      .slice(0, 8);

    const byEvent = new Map<string, { n: number; worst: number; total: number }>();
    for (const e of slowEventsRef.current) {
      const cur = byEvent.get(e.name) ?? { n: 0, worst: 0, total: 0 };
      cur.n += 1;
      cur.total += e.duration;
      if (e.duration > cur.worst) cur.worst = e.duration;
      byEvent.set(e.name, cur);
    }

    const lt = longTasksRef.current;
    const nav = navigator as Navigator & { deviceMemory?: number };

    const lines: string[] = [];
    lines.push("## inline-chat-kit perf capture");
    lines.push("");
    lines.push("### Environment");
    lines.push(`- UA: ${navigator.userAgent}`);
    lines.push(`- Cores: ${navigator.hardwareConcurrency ?? "?"} · Memory: ${nav.deviceMemory ?? "?"}GB`);
    lines.push(`- DPR: ${window.devicePixelRatio} · Viewport: ${innerWidth}x${innerHeight} · Screen: ${screen.width}x${screen.height}`);
    lines.push(
      `- prefers-reduced-motion: ${matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduce" : "no-preference"}`
    );
    lines.push("");
    lines.push("### Frames");
    lines.push(
      `- Captured ${r2(sampledMs / 1000)}s of visible time (${r2(wallMs / 1000)}s wall clock) · ${frames.length} frames · ${sampledMs > 0 ? r2((1000 * frames.length) / sampledMs) : 0} fps avg`
    );
    lines.push(`- Frame ms — median ${r2(pct(sorted, 0.5))} · p95 ${r2(pct(sorted, 0.95))} · p99 ${r2(pct(sorted, 0.99))} · worst ${r2(sorted[sorted.length - 1] ?? 0)}`);
    lines.push(
      `- Display cadence: ${r2(interval)}ms/frame (${Math.round(1000 / interval)}Hz) · dropped >${r2(dropAt)}ms: ${long.length} of ${frames.length} (${r2((100 * long.length) / Math.max(1, frames.length))}%) · badly >${r2(badAt)}ms: ${bad.length}`
    );
    if (warmupSkipped > 0) lines.push(`- Skipped ${warmupSkipped} warm-up frames in the first ${WARMUP_MS}ms`);
    lines.push(`- Worst frames (ms @ s): ${worst.map((w) => `${r2(w.d)}@${r2(w.at / 1000)}`).join(", ") || "none"}`);
    lines.push("");
    lines.push("### Input");
    lines.push(`- pointermove events: ${pointerMovesRef.current} · peak ${Math.round(peakMoveRateRef.current)}/s`);
    if (byEvent.size === 0) {
      lines.push("- No event-timing entries over 16ms (or unsupported in this browser)");
    } else {
      for (const [name, v] of [...byEvent.entries()].sort((a, b) => b[1].worst - a[1].worst)) {
        lines.push(`- ${name}: ${v.n} slow · worst ${r2(v.worst)}ms · total ${r2(v.total)}ms`);
      }
    }
    lines.push("");
    lines.push("### Main thread");
    lines.push(
      lt.length
        ? `- Long tasks: ${lt.length} · total ${r2(lt.reduce((s, t) => s + t.duration, 0))}ms · worst ${r2(Math.max(...lt.map((t) => t.duration)))}ms`
        : "- Long tasks: none"
    );
    lines.push(`- DOM mutations inside the answer: ${mutationsRef.current} total`);
    lines.push(
      `  - while drawing (button down): ${mutDrawRef.current} — expected, the path grows on every move`
    );
    lines.push(
      `  - while a marker menu was open or settling: ${mutMenuRef.current} — the dim animation on every token`
    );
    lines.push(
      `  - while only hovering: ${mutHoverRef.current} over ${crossingsRef.current} marker crossings` +
        (crossingsRef.current > 0
          ? ` = ${r2(mutHoverRef.current / crossingsRef.current)} per crossing`
          : "")
    );
    lines.push("");
    lines.push("### Scene");
    lines.push(`- Highlights on screen (max): ${maxMarkersRef.current}`);
    lines.push(
      `- Tab backgrounded during capture: ${hiddenEventsRef.current === 0 ? "no" : `${hiddenEventsRef.current}x (those frames excluded)`}`
    );
    lines.push(`- Pointer was over a marker at some point: ${shimmerSeenRef.current ? "yes" : "no"}`);
    lines.push("");
    lines.push("### Marks (pressed M)");
    lines.push(
      marksRef.current.length
        ? marksRef.current.map((m) => `- ${r2(m.at / 1000)}s — frame was ${r2(m.frameMs)}ms`).join("\n")
        : "- none"
    );
    return lines.join("\n");
  };

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      // Clipboard blocked — the textarea below is selectable as a fallback.
    }
  };

  const mono = "ui-monospace, SFMono-Regular, 'Geist Mono', monospace";

  return (
    <>
      <div
        id="perfhud-flash"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(204,255,0,0.18)",
          opacity: 0,
          transition: "opacity 120ms ease",
          pointerEvents: "none",
          zIndex: 2147483646,
        }}
      />
      <div
        style={{
          position: "fixed",
          left: 12,
          bottom: 12,
          zIndex: 2147483647,
          font: `11px/1.5 ${mono}`,
          color: "#e8e8e8",
          background: "rgba(17,17,17,0.92)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10,
          padding: collapsed ? "6px 10px" : "10px 12px",
          width: collapsed ? "auto" : 260,
          // The panel must not intercept the pointer — that would change the
          // very hover behaviour being measured. Controls opt back in.
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <strong style={{ fontWeight: 600, letterSpacing: "0.04em" }}>PERF</strong>
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={{ ...btn, pointerEvents: "auto" }}
          >
            {collapsed ? "show" : "hide"}
          </button>
        </div>

        {!collapsed && (
          <>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 2 }}>
              <span style={dim}>fps</span>
              <span ref={fpsElRef}>—</span>
              <span style={dim}>worst frame (1s)</span>
              <span ref={worstElRef}>—</span>
              <span style={dim}>dropped frames</span>
              <span ref={droppedElRef}>—</span>
              <span style={dim}>pointermove rate</span>
              <span ref={rateElRef}>—</span>
              <span style={dim}>answer mutations</span>
              <span ref={rendersElRef}>—</span>
              <span style={dim}>scene</span>
              <span ref={stateElRef}>—</span>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <button
                onClick={recording ? stop : start}
                style={{
                  ...btn,
                  pointerEvents: "auto",
                  background: recording ? "#cf3b3b" : "#ccff00",
                  color: recording ? "#fff" : "#111",
                  borderColor: "transparent",
                }}
              >
                {recording ? "stop" : "record"}
              </button>
              {report && (
                <button onClick={copy} style={{ ...btn, pointerEvents: "auto" }}>
                  copy report
                </button>
              )}
            </div>

            <p style={{ ...dim, margin: "8px 0 0", lineHeight: 1.5 }}>
              {recording
                ? "Recording. Move over the highlighted text as you normally would. Press M whenever it feels bad."
                : "Press record, reproduce the lag, stop, then copy the report."}
            </p>
            <p style={{ ...dim, margin: "6px 0 0", lineHeight: 1.5 }}>
              Reads &quot;paused&quot; when the tab is not visible — the browser throttles
              timing there, so those frames are excluded rather than counted as jank.
            </p>

            {report && (
              <textarea
                readOnly
                value={report}
                onFocus={(e) => e.currentTarget.select()}
                style={{
                  pointerEvents: "auto",
                  userSelect: "text",
                  marginTop: 8,
                  width: "100%",
                  height: 120,
                  font: `10px/1.4 ${mono}`,
                  color: "#e8e8e8",
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 6,
                  padding: 6,
                  resize: "vertical",
                }}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

const btn: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "3px 8px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.18)",
  fontSize: 10,
  letterSpacing: "0.02em",
};

const dim: React.CSSProperties = { color: "rgba(232,232,232,0.5)" };
