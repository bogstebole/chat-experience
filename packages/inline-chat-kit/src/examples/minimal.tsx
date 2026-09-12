/**
 * The smallest thing that is actually a chat.
 *
 * ## Why this is a source file and not a fenced block in the docs
 *
 * `getting-started.md` quotes this file verbatim, and a test asserts the two
 * are identical character for character. So the first code a newcomer copies
 * is compiled by `tsc -b` on every build, like everything else here — a
 * getting-started whose example no longer compiles is worse than none, because
 * it fails for somebody who has no way to tell whether the mistake is theirs.
 *
 * Nothing imports it, so the library build never reaches it and it ships
 * nothing. It exists to be typechecked and quoted.
 */
import { useCallback, useState } from "react";
import { ChatTurnRow, Conversation, useChatTurns } from "../index";

/** How far below the top edge a sent message comes to rest. */
const ANCHOR = 24;

export function MinimalChat() {
  /* Which turn to hold at the top. Kept here rather than inside the kit
     because "which message am I looking at" is the host's question: you may
     want it to follow a regenerate, a jump from a sidebar, or nothing at all. */
  const [anchored, setAnchored] = useState<string | null>(null);

  const { turns, setDraft, submit, stop, beginEdit, cancelEdit } = useChatTurns({
    /* Return a string, a promise of one, or an async iterable of deltas. The
       kit has no answers of its own — return nothing and nothing appears. */
    onSend: async (message) => `You said: ${message}`,
  });

  const send = useCallback(
    (id: string, value: string) => {
      setAnchored(id);
      submit(id, value);
    },
    [submit]
  );

  /* Held while the answer is arriving, let go when it settles — otherwise the
     question stays pinned to the top for ever and the composer, which is the
     last turn, sits below the fold. */
  const holding = turns.find((turn) => turn.id === anchored);
  const anchorId =
    holding && holding.state !== "resting" ? `turn-${holding.id}` : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <Conversation
        anchorId={anchorId}
        /* Match whatever padding sits above the conversation, or a turn
           brought to the top lands underneath it. */
        anchorOffset={ANCHOR}
        /* Room left under the composer when an answer settles. */
        endOffset={ANCHOR}
        style={{ padding: ANCHOR }}
      >
        {turns.map((turn, i) => (
          <ChatTurnRow
            key={turn.id}
            turn={turn}
            /* The last turn is the composer: this is what makes it one. */
            isActiveInput={
              i === turns.length - 1 &&
              (turn.state === "idle" || turn.state === "typing")
            }
            /* Pass the hook's own functions straight through — they are stable,
               and `ChatTurnRow` is memoised on them. An arrow made during
               render hands the memo a new prop every time. */
            onDraft={setDraft}
            onSubmit={send}
            onStop={stop}
            onEdit={beginEdit}
            onCancelEdit={cancelEdit}
            placeholder="Ask anything…"
          />
        ))}
      </Conversation>
    </div>
  );
}
