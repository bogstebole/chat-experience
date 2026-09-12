# Getting started

Ten minutes, one file, a chat that works with no backend. Then one paragraph to
point it at your model.

If you are looking for what each component takes, that is the
[README](./README.md); for colours and sizes, [theming.md](./theming.md). This
page is only the shortest path to something running.

## Install

```bash
npm install inline-chat-kit motion lucide-react
```

`react`, `react-dom`, `motion` and `lucide-react` are peer dependencies — the
kit uses whatever copy your app already has. React 18 or 19.

## The whole thing

```tsx
import { useCallback, useState } from "react";
import { ChatTurnRow, Conversation, useChatTurns } from "inline-chat-kit";
import "inline-chat-kit/styles.css";

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
```

That is a working chat: type, press enter, the pill you typed into becomes the
bubble holding your message, it travels to the top, and the answer is revealed
underneath it at reading pace. The last turn is always the composer for the
next message — that is what `isActiveInput` marks, and it is the whole idea.

**This file is compiled on every build of this package and a test asserts it
matches this page character for character.** If it does not work, that is a
bug here, not a mistake you made.

## Point it at your model

One property changes. `onSend` may return a string, a promise of one, or an
async iterable of deltas — return a string and the kit reveals it at a readable
pace, return deltas and it shows them as they land.

```tsx
const { turns, setDraft, submit, stop, beginEdit, cancelEdit } = useChatTurns({
  onSend: async function* (message, { signal }) {
    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
      signal,
    });
    const stream = response.body!.pipeThrough(new TextDecoderStream());
    for await (const chunk of stream) yield chunk;
  },
});
```

`signal` aborts when the reader presses stop. The kit never invents an answer:
there is no canned fallback anywhere in the package, so if your handler returns
nothing, nothing is what appears.

## Three things that are easy to get wrong

**The stylesheet is not optional.** The components are CSS Modules and the
bundled sheet carries every class they reference. Without
`import "inline-chat-kit/styles.css"` you get an unstyled page, and it looks
like the package is broken rather than unstyled. This bit the demo in this very
repository: a bare side-effect import inside the kit's entry survived the dev
server and was dropped from the production build, and every colour read as
transparent.

**`anchorOffset` has to match whatever sits above the conversation.** It is how
far below the top edge a sent message comes to rest. Put a fixed header over
the feed and leave this at zero, and the message is scrolled neatly underneath
it.

**Pass the hook's own functions straight through.** `ChatTurnRow` is memoised
and that memo is load-bearing: the hook leaves untouched turns referentially
identical when it rewrites one of them, which only pays off if the rows act on
it. Measured before the memo existed: streaming one answer produced 366 DOM
mutations inside an unrelated, already-finished turn. An arrow function created
during render hands the memo a new prop every time and undoes it.

## Where to go next

| | |
| --- | --- |
| everything a turn can contain — tools, reasoning, sources, tables, code, questions, approvals | [README](./README.md#what-a-turn-carries-turnpart) |
| colours, sizes, dark mode, one brand | [theming.md](./theming.md) |
| the side pane for documents the answer produces | [`<ArtifactCard>`, `<ArtifactPane>`, `<ChatLayout>`](./README.md) |
| what it looks like before the first message | [`<EmptyState>`](./README.md) |
| where this is meant to run, and where it is not | [README](./README.md#where-it-is-meant-to-run) |
