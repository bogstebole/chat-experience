"use client";

import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "../Button/Button";
import { announce } from "../announce/announce";
import styles from "./AnswerActions.module.css";

export type Verdict = "up" | "down";

export interface AnswerActionsProps
  // Ours hands over the answer; the DOM's hands over a ClipboardEvent.
  extends Omit<HTMLAttributes<HTMLDivElement>, "onCopy"> {
  /** The answer these act on. Copy takes it; the callbacks receive it. */
  text: string;
  /** Defaults to the clipboard. */
  onCopy?: (text: string) => void;
  /** Omit and no regenerate button is drawn. */
  onRegenerate?: () => void;
  /**
   * Omit and no thumbs are drawn. Called with `null` when a verdict is taken
   * back — pressing the one already given is how somebody undoes it.
   */
  onFeedback?: (verdict: Verdict | null) => void;
  /** Controlled, for a host that stores the verdict. */
  feedback?: Verdict | null;
  /** Anything else, after the built-in controls. */
  children?: ReactNode;
  /**
   * Invisible until hovered or focused. It still occupies its space and still
   * hit-tests, so nothing shifts and nothing is unreachable — `:focus-within`
   * brings it back for anyone arriving by keyboard.
   */
  reveal?: boolean;
  /** While an answer is being regenerated. */
  busy?: boolean;
  labels?: Partial<Record<"copy" | "copied" | "regenerate" | "up" | "down", string>>;
}

const DEFAULT_LABELS = {
  copy: "Copy answer",
  copied: "Copied",
  regenerate: "Regenerate",
  up: "Good answer",
  down: "Bad answer",
} as const;

const COPIED_FOR = 1600;

/**
 * What you can do to an answer once it has arrived.
 *
 * The input has had a hover row since the beginning; the answer had nothing,
 * which is backwards — the answer is the part worth keeping.
 */
export function AnswerActions({
  text,
  onCopy,
  onRegenerate,
  onFeedback,
  feedback = null,
  children,
  reveal = false,
  busy = false,
  labels,
  className,
  ...rest
}: AnswerActionsProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = { ...DEFAULT_LABELS, ...labels };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback(() => {
    if (onCopy) onCopy(text);
    else void navigator.clipboard?.writeText(text);

    setCopied(true);
    // The tick is a picture. Without this a reader is told nothing happened,
    // which is indistinguishable from the copy having failed.
    announce(label.copied);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FOR);
  }, [label.copied, onCopy, text]);

  /** Pressing the verdict already given takes it back. */
  const vote = (verdict: Verdict) => onFeedback?.(feedback === verdict ? null : verdict);

  return (
    <div
      className={[styles.row, reveal ? styles.reveal : "", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      <Button
        variant="ghost"
        icon={copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        onClick={copy}
        aria-label={copied ? label.copied : label.copy}
        title={copied ? label.copied : label.copy}
      />

      {onRegenerate && (
        <Button
          variant="ghost"
          icon={<RotateCcw size={14} aria-hidden />}
          onClick={onRegenerate}
          disabled={busy}
          loading={busy}
          aria-label={label.regenerate}
          title={label.regenerate}
        />
      )}

      {onFeedback && (
        <>
          <Button
            variant="ghost"
            icon={<ThumbsUp size={14} aria-hidden />}
            onClick={() => vote("up")}
            aria-pressed={feedback === "up"}
            aria-label={label.up}
            title={label.up}
          />
          <Button
            variant="ghost"
            icon={<ThumbsDown size={14} aria-hidden />}
            onClick={() => vote("down")}
            aria-pressed={feedback === "down"}
            aria-label={label.down}
            title={label.down}
          />
        </>
      )}

      {children}
    </div>
  );
}
