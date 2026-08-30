"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";
import { Check, Copy } from "lucide-react";
import { announce } from "../announce/announce";
import {
  canHighlight,
  loadHighlighter,
  loaded,
  plain,
  type Highlighter,
} from "./highlight";
import styles from "./CodeBlock.module.css";

export interface CodeBlockProps
  // `onCopy` is a DOM clipboard handler as well as a prop here, and the two
  // signatures do not agree. Ours wins: a copy button's callback should hand
  // over the code, not a ClipboardEvent nobody asked for.
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onCopy"> {
  code: string;
  /** The fence's language. Unknown ones render unhighlighted. */
  lang?: string;
  /** Shown top-left. Defaults to the language; pass `false` for no bar at all. */
  label?: string | false;
  /** Set false for a block nobody is meant to take away. */
  copyable?: boolean;
  /** Defaults to the clipboard. */
  onCopy?: (code: string) => void;
  /** How long the button stays confirmed, in ms. */
  copiedFor?: number;
}

const COPIED_FOR = 1600;

/**
 * A fenced block: language, a copy button, and code that scrolls sideways
 * rather than widening the answer.
 *
 * Deliberately not markable. The rest of an answer is split into word tokens
 * so a marker can be drawn over it; preformatted text split on whitespace
 * stops being preformatted, so this renders whole and the highlighter skips
 * it. Copy is what people want from code anyway.
 */
export function CodeBlock({
  code,
  lang,
  label,
  copyable = true,
  onCopy,
  copiedFor = COPIED_FOR,
  className,
  ...rest
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* The grammars are a dynamic import — 22.4 kB that most conversations never
     need — so the first block on a page paints plain and colours in when the
     chunk lands. `loaded()` is what stops that from being a flash on every
     block after it: once something has paid, the highlighter is there on the
     first render and the initial state is already right. */
  const [highlighter, setHighlighter] = useState<Highlighter | null>(loaded);

  useEffect(() => {
    if (highlighter || !canHighlight(lang)) return;
    let alive = true;
    void loadHighlighter().then((h) => {
      // The block can be gone by then — in a chat they unmount all the time.
      if (alive) setHighlighter(() => h);
    });
    return () => {
      alive = false;
    };
  }, [highlighter, lang]);

  const tokens = useMemo(
    () => (highlighter ? highlighter(code, lang) : plain(code)),
    [highlighter, code, lang]
  );

  // A block that unmounts while confirmed would otherwise set state on a gone
  // component, and in a chat they unmount all the time.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback(() => {
    if (onCopy) onCopy(code);
    else void navigator.clipboard?.writeText(code);

    setCopied(true);
    // The tick is a picture. Without this a screen reader is told nothing
    // happened at all, which is the same as the copy having failed.
    announce("Copied to clipboard");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), copiedFor);
  }, [code, copiedFor, onCopy]);

  const caption = label === false ? null : (label ?? lang ?? null);
  const showBar = caption !== null || copyable;

  return (
    <div className={[styles.block, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {showBar && (
        <div className={styles.bar}>
          <span className={styles.lang}>{caption}</span>
          {copyable && (
            <button
              type="button"
              className={styles.copy}
              onClick={copy}
              /* Inside an answer this sits on the highlighter's surface, where
                 a pointerdown starts drawing a marker. The click is for the
                 button, not the paragraph under it. */
              onPointerDown={(event) => event.stopPropagation()}
              aria-label={copied ? "Copied" : "Copy code"}
            >
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              <span className={styles.copyLabel}>{copied ? "Copied" : "Copy"}</span>
            </button>
          )}
        </div>
      )}

      <pre className={styles.pre}>
        <code>
          {tokens.map((token, i) =>
            token.kind ? (
              <span key={i} data-hl={token.kind}>
                {token.value}
              </span>
            ) : (
              token.value
            )
          )}
        </code>
      </pre>
    </div>
  );
}
