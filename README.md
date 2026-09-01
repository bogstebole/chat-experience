# inline-chat-kit

An inline AI chat interface for React.

The input **is** the message. The pill you type into morphs into the bubble that
holds your text, and the answer streams in underneath it — no separate
composer, no jump cut between what you wrote and what got sent.

Around that it ships the rest of what a chat with a model turns out to need:
streaming answers you can draw on with a marker, tool calls, reasoning, plans
that open in a side pane, structured questions the model asks you, approvals,
attachments, code blocks, and a scroll container that keeps up with an answer
and lets go when you scroll back.

MIT. React 18 or 19.

---

## Install

**Not on npm yet.** Build the tarball out of this repo and install that:

```bash
git clone git@github.com:bogstebole/chat-experience.git
cd chat-experience && npm install && npm run pack:kit
```

That writes `packages/inline-chat-kit/inline-chat-kit.tgz`. In your own project:

```bash
npm install /path/to/chat-experience/packages/inline-chat-kit/inline-chat-kit.tgz motion lucide-react
```

`react`, `react-dom`, `motion` and `lucide-react` are peer dependencies — the
kit uses the copy your app already has. Its own runtime dependencies are two,
both for syntax highlighting in a code block.

## Quick start

A working chat is the hook, a scroll container and a row per turn.

```tsx
import { useChatTurns, Conversation, ChatTurnRow } from "inline-chat-kit";
import "inline-chat-kit/styles.css";

export function Chat() {
  const { turns, setDraft, submit, stop, beginEdit, cancelEdit } = useChatTurns({
    onSend: async function* (message, { signal }) {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
        signal,
      });
      const stream = res.body!.pipeThrough(new TextDecoderStream());
      for await (const chunk of stream) yield chunk;
    },
  });

  return (
    <Conversation>
      {turns.map((turn, i) => (
        <ChatTurnRow
          key={turn.id}
          turn={turn}
          isActiveInput={
            i === turns.length - 1 && (turn.state === "idle" || turn.state === "typing")
          }
          onDraft={setDraft}
          onSubmit={submit}
          onStop={stop}
          onEdit={beginEdit}
          onCancelEdit={cancelEdit}
        />
      ))}
    </Conversation>
  );
}
```

The stylesheet import is required. The components are CSS Modules and the
bundled sheet carries every class they reference.

Pass the hook's own callbacks straight through rather than wrapping them in
arrows. `ChatTurnRow` is memoised and that memo is load-bearing: a fresh arrow
per render defeats it, and every turn then re-renders on every frame of every
answer.

### What `onSend` may return

A string, a promise of one, or an async iterable of deltas. Return a string and
the kit reveals it at a readable pace; yield deltas and it shows them as they
land. `signal` aborts when the reader presses stop.

The kit never invents an answer. There is no canned fallback anywhere in the
package — if your handler returns nothing, nothing is what appears.

## What's in the box

Everything is a named export from the package root.

**The conversation**
`ChatInput` · `ChatTurnRow` · `Conversation` · `ChatHeader` · `EmptyState` ·
`Loader` · `AnswerActions` · `Branch` · `Attachments` · `useChatTurns`

**What the model did on the way to the answer**
`Reasoning` · `Tool` · `TaskList` · `ChainOfThought` · `Sources` ·
`InlineCitation` · `Context`

**What it needs back from the reader**
`Approval` — "it wants to run this, is that all right?"
`QuestionCard` and `QuestionGroup` — structured questions, answered inline,
each one folding into the answer it became

**What it produced**
`ArtifactCard` · `ArtifactPane` · `ChatLayout` · `useArtifacts` — a plan or a
document too big for the transcript gets a card, and pressing the card opens it
in a pane beside the conversation

**The surface**
`TextHighlighter` — draw a marker across an answer with the pointer or the
keyboard
`ReplyThreadPopup` — ask about the passage you marked, with it quoted
`CodeBlock` · `SystemMessage` · `Chip` · `Button`

A turn carries `parts` alongside its prose, and a `SendHandler` streams those
in with the text — which is how the reasoning, tools and questions above reach
the screen without a second channel.

## Theming

Every colour, radius, duration and space is a CSS custom property under
`--ick-`. Rebranding is overriding a handful of them, not forking a stylesheet:

```css
:root {
  --ick-marker-rgb: 255 90 0;
  --ick-radius-pill: 12px;
  --ick-font-sans: "Your Face", system-ui, sans-serif;
}
```

Dark mode is a token swap — set `data-theme="dark"` on any ancestor and the
whole tree repaints from two channel triplets. `theming.md` in the package has
the full list and the three tiers behind it.

## Accessibility

Not a pass that happened at the end. Answers are announced to screen readers,
`prefers-reduced-motion` is honoured everywhere, every highlight is reachable
and removable from the keyboard, the marker menu is a real menu and the thread
popup a real dialog. There is an automated axe pass in the test suite, and a
manual one was done with VoiceOver.

## Documentation

| | |
| --- | --- |
| [Full API reference](packages/inline-chat-kit/README.md) | every component, every prop, and why each one is shaped the way it is |
| [`theming.md`](packages/inline-chat-kit/theming.md) | the token system |
| [`CHANGELOG.md`](packages/inline-chat-kit/CHANGELOG.md) | breaking changes and what to do about each |
| [`ROADMAP.md`](ROADMAP.md) | what is built, what is not, and what was deliberately left out |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | the monorepo, the dev environment and the release |

Storybook is the source of truth for how anything looks:

```bash
npm run storybook --workspace packages/inline-chat-kit
```

## License

MIT.
