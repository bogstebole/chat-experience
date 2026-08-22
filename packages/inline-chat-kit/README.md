# inline-chat-kit

An inline AI chat experience for React. The input **is** the message: when you
send, the pill you typed into morphs into the bubble that holds your text, and
the answer streams in below it. No separate composer, no jump cut.

Ships the surrounding pieces too — hover actions on each bubble, freeform
marker highlighting over streamed text, and reply-in-thread popups.

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

`Button` (icon button, `primary` / `secondary` / `ghost`) and `GlassButton`
(`s` / `m` / `l`, with `loading`, `iconLeft`, `iconRight`) are exported because
the kit uses them internally — reuse them or ignore them.

`GlassButton` has a dark treatment, switched by an ancestor rather than a prop:
put `class="dark"` on any wrapper (or `<html>`) and the buttons beneath it
follow.

## Theming

Every colour, font and surface the kit reads is defined in a
`@layer inline-chat-kit` cascade layer, so **any unlayered rule in your app
overrides it** regardless of import order. Redefine what you want on `:root`:

```css
:root {
  --font-sans: "Inter", system-ui, sans-serif;
  --ink: #0a0a0a;
  --ink-soft: rgba(10, 10, 10, 0.6);
  --ink-faint: rgba(10, 10, 10, 0.4);
  --surface-hover: rgba(10, 10, 10, 0.04);
  --surface-active: rgba(10, 10, 10, 0.06);
  --surface-press: rgba(10, 10, 10, 0.1);
  --color-text-glass: rgba(0, 0, 0, 0.72);
}
```

The kit also reads `--font-geist-sans`, `--font-geist-mono` and
`--font-jetbrains-mono`; point them at your own stacks, or at the CSS variables
a font loader hands you.

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

## License

MIT
