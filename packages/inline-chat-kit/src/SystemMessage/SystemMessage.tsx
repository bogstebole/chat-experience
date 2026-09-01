"use client";

import type { HTMLAttributes, ReactNode } from "react";
import styles from "./SystemMessage.module.css";

/**
 * Two, not three.
 *
 * `Context` settled this already: an amber in the middle makes somebody learn
 * a scale to read a state they can already read in words. Something either
 * went wrong or it did not.
 */
export type SystemTone = "notice" | "danger";

export interface SystemMessageProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  tone?: SystemTone;
}

/**
 * The conversation itself saying something — not the reader, not the agent.
 *
 * "The oldest messages are dropping out of the window." "The model changed
 * partway through this answer." "You went offline." Things that happened *to*
 * the conversation, which until now had nowhere to be said: `Context` warns
 * that the window is nearly full and then nothing speaks when it fills.
 *
 * **No glyph**, deliberately, and for the reason the approval's shield came
 * off an hour before this was written. Every picture in this kit carries a
 * state the words beside it also carry — queued, running, failed, allowed — so
 * that a reader the picture does not reach loses nothing. An icon here would
 * carry "something is being announced", next to a sentence announcing it. The
 * tint says which of the two tones it is and the sentence says the rest, which
 * is the only part anybody can act on.
 *
 * **No dismiss, and no action.** It is a line of the transcript rather than a
 * toast: dismissing one would be editing what happened. A host that needs a
 * button under it composes one, which costs them a line and costs this
 * component a whole API.
 *
 * **No live region either.** The kit has one, shared and written to on a later
 * tick — see `announce`. A second one says everything twice, which is the
 * fault that region exists to have fixed.
 */
export function SystemMessage({
  children,
  tone = "notice",
  className,
  ...rest
}: SystemMessageProps) {
  return (
    <div
      className={[styles.message, className ?? ""].filter(Boolean).join(" ")}
      data-tone={tone}
      {...rest}
    >
      {children}
    </div>
  );
}
