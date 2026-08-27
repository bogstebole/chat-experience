# inline-chat-kit

An inline AI chat experience for React. The input **is** the message: when you
send, the pill you typed into morphs into the bubble that holds your text, and
the answer streams in below it. No separate composer, no jump cut.

Ships the surrounding pieces too — a header for the conversation, hover
actions on each bubble, freeform marker highlighting over streamed text, and
reply-in-thread popups.

## Install

```bash
npm install inline-chat-kit motion lucide-react
```

`react`, `react-dom`, `motion` and `lucide-react` are peer dependencies — the
kit uses whatever copy your app already has.

## Use

```tsx
import { useState } from "react";
import { ChatInput, type ChatInputState } from "inline-chat-kit";
import "inline-chat-kit/styles.css";

function Composer() {
  const [value, setValue] = useState("");
  const [state, setState] = useState<ChatInputState>("idle");

  return (
    <ChatInput
      state={state}
      value={value}
      onChange={(v) => {
        setValue(v);
        setState(v ? "typing" : "idle");
      }}
      onSubmit={async (v) => {
        setState("responding");
        await send(v);
        setState("resting");
      }}
      onStop={() => setState("resting")}
      placeholder="Ask me anything…"
    />
  );
}
```

The stylesheet import is required — the components are CSS Modules and the
bundled sheet carries every class they reference.

## Wiring it to your model

`ChatInput` renders one turn. `useChatTurns` owns the conversation — the turn
list, the request in flight, and the reveal — and asks your app for the answers.

```tsx
import { useChatTurns } from "inline-chat-kit";

const { turns, setDraft, submit, stop } = useChatTurns({
  onSend: async function* (message, { signal }) {
    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
      signal,
    });
    for await (const chunk of response.body!.pipeThrough(new TextDecoderStream())) {
      yield chunk;
    }
  },
});
```

`onSend` may return a string, a promise of one, or an async iterable of deltas.
Return a string and the kit reveals it at a readable pace; return deltas and it
shows them as they land. `signal` aborts when the reader presses stop.

The kit never invents an answer. There is no canned fallback anywhere in the
package — if your handler returns nothing, nothing is what appears.

### Rendering the turns

```tsx
{turns.map((turn) => <TurnRow key={turn.id} turn={turn} onDraft={setDraft} … />)}
```

**Wrap the row in `React.memo`.** The hook already leaves untouched turns
referentially identical when it updates one of them, but that only pays off if
the rows can act on it — otherwise every turn re-renders on every frame of every
answer, and the cost grows with the length of the conversation. Measured in the
playground: without the memo, streaming one answer produced 366 DOM mutations
inside an unrelated, already-finished turn. With it, zero.

For the same reason, pass the hook's callbacks straight through rather than
wrapping them in inline arrows. They are stable; an arrow created during render
is not, and defeats the memo.

## The four states

`ChatInput` is fully controlled. You own `state` and drive the whole
choreography by moving between these values:

| `state` | What the input looks like |
| --- | --- |
| `idle` | Empty pill, placeholder showing |
| `typing` | Text in the pill, send glyph revealed |
| `responding` | Pill has become a glass bubble, glyph is a stop square |
| `resting` | Settled bubble, hover actions available |

## API

### `<ChatInput>`

| Prop | Type | Notes |
| --- | --- | --- |
| `state` | `ChatInputState` | Required. See table above |
| `value` | `string` | Required. Controlled value |
| `onChange` | `(value: string) => void` | Required |
| `onSubmit` | `(value: string) => void` | Required. Fires on Enter (Shift+Enter inserts a newline) |
| `onStop` | `() => void` | Stop button while `responding` |
| `onAdd` | `() => void` | The `+` button; opens the radial attachment fan |
| `onCopy` | `(value: string) => void` | Hover action on a resting bubble |
| `onEdit` | `(value: string) => void` | Hover action; put the turn back into `typing` |
| `onCancelEdit` | `() => void` | Paired with `isEditing` |
| `isEditing` | `boolean` | Shows save/cancel instead of send |
| `placeholder` | `string` | |
| `animationConfig` | `InlineAnimConfig` | Spring and stagger overrides — see below |
| `style` | `React.CSSProperties` | |

`ref` exposes `focus()`, `setValue(v)` and `getValue()` via `ChatInputHandle`.

### `<ChatHeader>`

The chrome above the conversation: who you are talking to, what about, and the
handful of things you can do to the whole thread.

```tsx
<ChatHeader
  title={firstQuestion}
  subtitle="Claude Opus 5"
  status={isStreaming ? "thinking" : null}
  backHref="/"
  actions={[
    { id: "bookmarks", label: "Saved highlights", icon: <Bookmark size={16} />, count: 3, pinned: true },
    { id: "share", label: "Share", icon: <Share2 size={16} />, onClick: share },
  ]}
>
  <YourModelPicker />
</ChatHeader>
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `ReactNode` | | What the conversation is about |
| `subtitle` | `ReactNode` | | Second line — the model, a count, a state |
| `avatar` | `ReactNode` | | Drawn before the title |
| `status` | `"online" \| "busy" \| "thinking" \| null` | `null` | A dot beside the title |
| `statusLabel` | `string` | the status word | What the dot means, spoken |
| `headingLevel` | `1`–`6` \| `false` | `2` | The level belongs to your document |
| `truncate` | `boolean` | `true` | Long titles get an ellipsis, not a second line |
| `onBack` | `() => void` | | Renders a back button |
| `backHref` | `string` | | Renders a back link instead |
| `backLabel` | `string` | `"Back"` | |
| `actions` | `ChatHeaderAction[]` | `[]` | The managed actions. These are what collapse |
| `overflowLabel` | `string` | `"More actions"` | |
| `variant` | `"plain" \| "glass" \| "bordered"` | `"plain"` | |
| `size` | `"s" \| "m" \| "l"` | `"m"` | 40 / 48 / 56px |
| `align` | `"start" \| "center"` | `"start"` | `center` is the native arrangement |
| `sticky` | `boolean` | `false` | |
| `elevateOnScroll` | `boolean` | `sticky` | Border and backdrop appear once content scrolls under |
| `collapseActionsAt` | `number \| false` | `520` | Header width, not viewport width |
| `landmark` | `boolean` | `true` | `false` inside a panel, where `banner` would be a lie |
| `children` | `ReactNode` | | Anything the kit should not manage. Never collapses |

Each action is `{ id, label, icon, onClick?, href?, count?, active?, disabled?, pinned? }`.
`label` is required because an icon has no name of its own, and `count` is
folded into that name — the badge is decorative, so a reader who cannot see it
still hears "Saved highlights, 3".

Actions are described rather than handed over as children for one reason:
`collapseActionsAt` folds them into a menu when the header is narrow, and a
header cannot summarise children it cannot read. Anything with no icon-and-label
shape — a segmented control, a model picker — goes in as `children` instead and
stays put.

### `<TextHighlighter>`

Wraps streamed text and lets the reader mark it up.

| Prop | Type | Notes |
| --- | --- | --- |
| `text` | `string` | The text to render |
| `selectionMode` | `"marker" \| "precise"` | Freeform drawn marker, or native char-level selection |
| `onHighlightComplete` | `(text: string) => void` | Fires when a highlight is drawn |
| `onReplyInThread` | `(text: string, rect: DOMRect) => void` | Reader chose "reply in thread" |

It renders block-level elements for the marker overlay, so give it a `<div>`
wrapper, not a `<p>` — a `<div>` inside a `<p>` is invalid HTML and trips a
hydration mismatch under SSR.

### `<ReplyThreadPopup>`

A focused sub-conversation anchored to a highlighted passage.

| Prop | Type | Notes |
| --- | --- | --- |
| `activeReply` | `{ text: string; rect: DOMRect }` | Pass what `onReplyInThread` gave you |
| `onClose` | `() => void` | |
| `onSave` | `() => void` | |
| `onSendMessage` | `(message, quotedText) => Promise<string> \| string` | **Provide this.** Without it the popup streams placeholder copy |

### `<CustomCursor>`

Optional. Swaps the pointer for a marker or text caret over elements carrying
`data-cursor="marker"` / `data-cursor="text"`. Mount once, near the root, and
hide the native cursor yourself:

```css
* { cursor: none; }
```

### Buttons

`Button` is one component in four materials — `primary`, `secondary`, `ghost`,
`glass` — across five sizes (`xs` `s` `m` `l` `xl`, 24 through 48px). It takes
`icon`, `iconRight` and `loading`. Icon-only needs an `aria-label`.

`GlassButton` is a deprecated wrapper around `<Button variant="glass">`, kept so
existing call sites keep working. Its `s` / `m` / `l` map to `m` / `l` / `xl`.

Neither takes a dark-mode prop: the theme is a token swap on an ancestor. See
[theming.md](./theming.md).

## Theming

The kit reads CSS custom properties, all prefixed `--ick-`. That is the whole
interface: no provider, no build step. They sit in a `@layer inline-chat-kit`
cascade layer, so **any unlayered rule in your app wins** regardless of import
order.

Colours are built from channel triplets, so a handful of lines moves everything
derived from them:

```css
:root {
  --ick-ink-rgb: 20 20 24;        /* text, hovers, borders */
  --ick-paper-rgb: 253 252 250;   /* surfaces, and the light side of glass */
  --ick-marker-rgb: 120 200 255;  /* the highlighter */
  --ick-font-sans: "Inter", system-ui, sans-serif;
  --ick-radius-xl: 12px;
}
```

Note the spaces rather than commas — they are used as
`rgb(var(--ick-ink-rgb) / 0.6)`.

If a font loader hands you a CSS variable, point the kit at it:

```css
:root {
  --ick-font-sans: var(--font-geist-sans);
  --ick-font-mono: var(--font-geist-mono);
}
```

**Dark** follows `prefers-color-scheme` on its own. Set `data-theme="light"` or
`data-theme="dark"` on the root element to pin it; `.light` and `.dark` work
too, for projects that already have them.

Overrides go on `:root` for the whole page, or on any element with
`class="ick-theme"` for a subtree — the class is what makes the derived tokens
recompute there.

[theming.md](./theming.md) has the rest — the per-component tokens, how to
adjust dark without touching light, and the two values that deliberately do not
follow the theme. The complete list, resolved live, is the first entry in
Storybook.

## Tuning the motion

`animationConfig` takes the full `InlineAnimConfig` shape — bubble and button
springs, ripple timing, the wrap thresholds that decide when a growing input
breaks to a new line, action-row stagger, and the radial fan geometry for the
`+` menu. Start from the defaults and override what you need:

```tsx
import { ChatInput, defaultInlineAnimConfig } from "inline-chat-kit";

<ChatInput
  {...props}
  animationConfig={{
    ...defaultInlineAnimConfig,
    bubble: { stiffness: 520, damping: 24, mass: 0.2 },
  }}
/>;
```

## Next.js

Works in the App Router as-is — the bundle carries a `"use client"` directive.
Import the stylesheet from a client component or your root layout.

A route handler that streams, and the `onSend` that reads it:

```ts
// app/api/chat/route.ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const { message, quotedText } = await request.json();

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    // The passage a thread hangs off, when there is one.
    system: quotedText
      ? `The reader highlighted this passage and is asking about it:\n\n${quotedText}`
      : undefined,
    messages: [{ role: "user", content: message }],
  });

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(new TextEncoder().encode(event.delta.text));
          }
        }
        controller.close();
      },
    }),
    { headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}
```

```tsx
"use client";

const { turns, setDraft, submit, stop } = useChatTurns({
  onSend: async function* (message, { signal }) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
      signal,
    });
    if (!response.ok) throw new Error(`chat failed: ${response.status}`);
    // `signal` aborts the request when the reader presses stop, which ends
    // this loop and settles the turn with whatever had already arrived.
    yield* response.body!.pipeThrough(new TextDecoderStream());
  },
});
```

`ReplyThreadPopup` takes the same shape with the quoted passage as a second
argument:

```tsx
<ReplyThreadPopup
  activeReply={activeReply}
  onClose={() => setActiveReply(null)}
  onSendMessage={async function* (message, quotedText, { signal }) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, quotedText }),
      signal,
    });
    yield* response.body!.pipeThrough(new TextDecoderStream());
  }}
/>
```

## Contributing

```bash
npm install
npm test              # 167 tests, jsdom
npm run lint
npm run build
npm run storybook --workspace packages/inline-chat-kit
```

**Storybook is the source of truth for what this looks like.** A component
change is not finished until its story shows it — and that is enforced rather
than remembered: one test fails when something is exported without a story, and
CI builds Storybook so a story that has drifted out of step fails there.

A second guard fails when a literal colour appears anywhere outside
`styles/tokens.css`. Its exception list carries a reason per entry, because a
list of paths to ignore becomes a list of things nobody looks at.

The tests stop at the edge of what jsdom can honestly answer. It has no layout
engine and does not implement contenteditable editing, so the wrap thresholds,
the overflow fade and the marker's hit-testing are not asserted there — a
passing tick for those would be a lie about untested code. They live in the
playground, with a real pointer and a real display.

`TextHighlighter` carries one regression guard worth knowing about: token spans
must have no inline styles at rest. Motion writes styles onto elements it
drives, so if that test fails, per-word animation has come back — and it cost
350 style writes per menu open the last time.

### Releasing

Versions before 1.0 follow the pre-release convention: a breaking change bumps
the **minor**, a fix bumps the patch.

```bash
npm version minor --workspace packages/inline-chat-kit
npm run pack:kit
```

Write the entry in [CHANGELOG.md](./CHANGELOG.md) first, and put anything that
would break an existing install under **Breaking** with what to do about it.

## License

MIT
