"use client";

import { useId, useState, type HTMLAttributes, type ReactNode } from "react";
import { Brain } from "lucide-react";
import { useDisclosure } from "../disclosure/useDisclosure";
import { DisclosureHeader } from "../disclosure/DisclosureHeader";
import { DisclosureBody } from "../disclosure/DisclosureBody";
import { formatDuration } from "../duration/formatDuration";
import styles from "./Reasoning.module.css";

/** Still working it out, or finished. */
export type ReasoningState = "thinking" | "done";

type Labels = Record<"thinking" | "thought" | "thoughtFor", string>;

const LABELS: Labels = {
  thinking: "Thinking",
  thought: "Thought",
  /** Followed by the duration: "Thought for 12s". */
  thoughtFor: "Thought for",
};

export interface ReasoningProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The thinking itself. Prose, not structure — see `Tool` for that. */
  children: ReactNode;
  state?: ReasoningState;
  /**
   * How long it took, in ms.
   *
   * Left out, the block times itself: it starts a clock when it begins
   * thinking and reads it when it stops. Pass one when you already know —
   * replaying a transcript, where the thinking did not happen just now.
   */
  duration?: number;
  /** Controlled. Leave it out and the block looks after itself. */
  open?: boolean;
  /** Where it starts, overruling the block's own preference. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  labels?: Partial<Labels>;
}

/**
 * What the model worked through before it answered.
 *
 * **Open while it thinks, folded away once the answer starts.** That is the
 * one detail every kit that ships this has converged on, and it is right:
 * thinking is worth watching while it is happening and worth almost nothing
 * afterwards — but it has to stay reachable, because the times it matters are
 * exactly the times the answer looks wrong.
 *
 * Folding is the block's *preference*, not something done to the reader. Open
 * it and it stays open, however many times the state changes underneath.
 */
export function Reasoning({
  children,
  state = "done",
  duration,
  open,
  defaultOpen,
  onOpenChange,
  labels,
  className,
  ...rest
}: ReasoningProps) {
  const label = { ...LABELS, ...labels };
  const bodyId = useId();
  const thinking = state === "thinking";

  const { isOpen, toggle } = useDisclosure({
    open,
    defaultOpen,
    onOpenChange,
    preferOpen: thinking,
  });

  /* Timed here rather than asked of the host, which would only be reading the
     same clock. Adjusted during render on a change of state rather than in an
     effect: an effect would mean a second pass every time the thinking stops,
     and React documents this as the way to derive state from a prop that
     changed. `was` is what makes it run once per change rather than once per
     render. */
  const [was, setWas] = useState(thinking);
  const [clock, setClock] = useState<{ from: number | null; took: number | null }>(() => ({
    from: thinking ? Date.now() : null,
    took: null,
  }));

  if (was !== thinking) {
    setWas(thinking);
    setClock((c) =>
      thinking
        ? { from: Date.now(), took: null }
        : { from: null, took: c.from === null ? null : Date.now() - c.from }
    );
  }

  const took = duration ?? clock.took;
  const time = thinking || took === null ? "" : formatDuration(took);

  return (
    <div
      className={[styles.reasoning, className ?? ""].filter(Boolean).join(" ")}
      data-state={state}
      {...rest}
    >
      {/* An aside in the flow of an answer, so the header takes the width of
          its own words rather than a band's. See `DisclosureHeader`'s `fit`. */}
      <DisclosureHeader
        fit="inline"
        open={isOpen}
        onToggle={toggle}
        controls={bodyId}
        glyph={<Brain size={14} aria-hidden />}
        label={thinking ? label.thinking : time ? `${label.thoughtFor} ${time}` : label.thought}
        pending={thinking}
      />

      <DisclosureBody id={bodyId} open={isOpen} className={styles.bodyInner}>
        {children}
      </DisclosureBody>
    </div>
  );
}
