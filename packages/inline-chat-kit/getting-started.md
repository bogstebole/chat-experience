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
import { ChatExperience } from "inline-chat-kit";
import "inline-chat-kit/styles.css";

export function MinimalChat() {
  return (
    <ChatExperience
      /* The one thing that has to be yours. Return a string, a promise of one,
         or an async iterable of deltas — the kit has no answers of its own. */
      onSend={async (message) => `You said: ${message}`}
      /* Shown in the header until a question has been asked; after that the
         header carries the first question, so somebody arriving at a
         conversation in progress can see what it is about. */
      title="Chat"
      placeholder="Ask anything…"
      /* Before anybody has asked. The openers are sent rather than typed into
         the box: one that only fills the input asks somebody to press send on
         a sentence they did not write. */
      empty={{
        title: "Ask me anything",
        description: "Or press one of these.",
        suggestions: ["What can you do?", "Write me a haiku"],
      }}
    />
  );
}
```

That is a working chat. Type, press enter, and the pill you typed into becomes
the bubble holding your message; it travels to the top of the view and stays
there while the answer is written underneath it, then lets go so the composer
for your next message is back on screen. The last turn is always that composer
— which is the whole idea, and the reason a message does not appear to move so
much as to *become* the thing that was sent.

`ChatExperience` is the assembly. Everything it draws is also exported on its
own — `Conversation`, `ChatHeader`, `ChatTurnRow`, `useChatTurns` — so you can
put the pieces together yourself when your app needs a shape this one does not
have. Reach for that second; there is more to remember than it looks, and the
kit has already been caught getting it wrong in a page that did.

**This file is compiled on every build of this package and a test asserts it
matches this page character for character.** If it does not work, that is a bug
here, not a mistake you made.

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
