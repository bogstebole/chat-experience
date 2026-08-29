# inline-chat-kit

An inline AI chat experience for React. The input **is** the message: when you
send, the pill you typed into morphs into the bubble that holds your text, and
the answer streams in below it. No separate composer, no jump cut.

Ships the surrounding pieces too — a turn row, a header for the conversation,
hover actions on each bubble, copy and feedback under every answer, markdown
answers you can draw on with a marker,
syntax-highlighted code blocks, a scroll container that keeps up with an
answer, and reply-in-thread popups.

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
{turns.map((turn, i) => {
  const isActive = i === turns.length - 1 && (turn.state === "idle" || turn.state === "typing");
  return (
    <ChatTurnRow
      key={turn.id}
      turn={turn}
      isActiveInput={isActive}
      onDraft={setDraft}
      onSubmit={submit}
      onStop={stop}
      onEdit={beginEdit}
      onCancelEdit={cancelEdit}
    />
  );
})}
```

`ChatTurnRow` is already memoised, and that memo is load-bearing. The hook
leaves untouched turns referentially identical when it rewrites one of them,
but that only pays off if the rows act on it — otherwise every turn re-renders
on every frame of every answer, and the cost grows with the conversation.
Measured before the memo existed: streaming one answer produced 366 DOM
mutations inside an unrelated, already-finished turn. With it, zero.

Which is why the callbacks take the turn's id rather than being closed over per
row. Pass the hook's own functions straight through — they are stable. An arrow
created during render is not, and hands the memo a new prop every time.

If you write your own row instead, wrap it in `React.memo` and do the same.

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

### `<ChatTurnRow>`

One turn: the question as a composer that has become a bubble, and the answer
beneath it. Not `Message`, because it is not one — the user half is a live
input that morphs into its own bubble rather than a record of what was typed.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `turn` | `ChatTurn` | | Required. Straight from `useChatTurns` |
| `isActiveInput` | `boolean` | `false` | This row owns the live composer |
| `inputRef` | `Ref<ChatInputHandle>` | `null` | For `focus()` |
| `placeholder` | `string` | | |
| `animationConfig` | `InlineAnimConfig` | | Passed to the input |
| `entranceDelay` | `number` | `0` | Stagger, in seconds |
| `selectionMode` | `"marker" \| "precise"` | `"marker"` | Passed to the highlighter |
| `onDraft` | `(id, value) => void` | | |
| `onSubmit` | `(id, value) => void` | | |
| `onStop` | `() => void` | | |
| `onEdit` | `(id) => void` | | |
| `onCancelEdit` | `(id) => void` | | |
| `onCopy` | `(value) => void` | writes to the clipboard | |
| `onHighlight` | `(turnId, text) => void` | | A passage was marked |
| `onReplyInThread` | `(text, rect) => void` | | Open a thread on the marked passage |
| `onRegenerate` | `(id) => void` | | Draws the regenerate button |
| `onFeedback` | `(id, verdict) => void` | | Draws the thumbs |
| `feedback` | `"up" \| "down" \| null` | `null` | Which one is lit |
| `answerActions` | `boolean` | `true` | Leave the row out |

Every callback is optional; a row with none of them renders and can be marked.
The row carries `id="turn-<id>"` so a host can scroll to one, and `aria-busy`
while its answer is arriving.

### `<Tool>`

One tool call on the way to an answer: what was run, what with, what came
back.

```tsx
<Tool
  name="search_web"
  state="done"
  summary="3 results"
  duration={412}
  input={{ query: "weather in Belgrade", limit: 3 }}
  output={results}
/>
```

| Prop | Type | Notes |
| --- | --- | --- |
| `name` | `string` | Set in mono: it is an identifier, not prose |
| `state` | `"pending" \| "running" \| "done" \| "error"` | Default `"done"` |
| `summary` | `ReactNode` | A sentence for what it did |
| `input` / `output` | `unknown` | See below |
| `error` | `ReactNode` | Drawn instead of the output |
| `duration` | `number` | In ms. Shown once it has finished |
| `open` / `defaultOpen` / `onOpenChange` | | Controlled or not |
| `labels` | `Partial<Record<…, string>>` | `input`, `output`, `error`, and a word per state |

**Shut by default**, because most of the time nobody cares — and **open when it
failed**, because an error nobody can see has not been reported. That is
derived from the state rather than forced by an effect, so a call that fails
later opens itself, while one somebody deliberately shut stays shut.

**What you give it decides how it is drawn.** A string is text — wrapping
`"Belgrade, 24°C"` in a fence puts it in quotes with its newlines spelled out,
which is worse than reading it. An object is JSON, in a `CodeBlock` with its
copy button. An element is left alone, so anything you want drawn some other
way you draw yourself.

The state is never carried by colour alone: the glyph changes shape, and the
row says which state it is in in words only a screen reader hears.

### `<QuestionCard>` and `<QuestionGroup>`

A structured question inside a conversation: the assistant asks something with
a shape to it, and the answer is picked or typed rather than written out.

```tsx
<QuestionGroup
  id="about-them"
  questions={questions}
  answers={answers}
  activeIndex={activeIndex}
  collapsible={done && questions.length >= FOLDABLE_FROM}
  onCommit={(id, answer) => setAnswers((all) => ({ ...all, [id]: answer }))}
  onEdit={setEditing}
/>
```

A `Question` is one of three shapes — `inputs` (type something), `single` (pick
one), `multi` (pick several, optionally with a "something else" field). Each
carries a `shortTitle`, which is what it is called once it folds into a row.

A card is in one of three states, and morphs between them:

| state | what it is |
| --- | --- |
| `upcoming` | one dim row, waiting its turn |
| `active` | the question, open, being answered |
| `collapsed` | one row: the short title, the answer as chips, and a way back in |

`QuestionGroup` holds a step's worth and folds the whole thing to a single
summary row once the conversation has moved past it — not a peek at the list,
because a peek costs more height than the answers it shows.

Two decisions carried over from the original, both worth keeping: `single`
waits a beat after a choice before committing, or the card is gone before
anyone sees what they picked; and the "something else" row is a `<label>`, not
a button, because an input inside a button is not reliably focusable.

Two changed. The collapsed row is a single `<button>` naming what it does
(`"Edit answer: Household"`) rather than a click handler on a `<div>` with
another button inside it — that could be clicked but not tabbed to. And the
letter badges are `aria-hidden`: the letter is a visual index, and left in the
tree it turns a field called "Their name" into one called "a Their name".

#### Composing a fourth kind of question

Three shapes are not the only three. The parts a card is built from are
exported, so a shape the kit does not ship is a composition rather than a fork
— and it arrives already wearing the same tokens, focus behaviour and ARIA as
the ones that do.

```tsx
<QuestionShell
  number={3}
  title="How soon do they need this?"
  subtitle="Roughly is fine"
  footer={<Button variant="secondary" size="m" onClick={commit}>Next</Button>}
>
  {levels.map((level, i) => (
    <QuestionOptionRow
      key={level.id}
      letter={"abc"[i]}
      title={level.title}
      description={level.description}
      selected={picked === level.id}
      onClick={() => setPicked(level.id)}
    />
  ))}
  <QuestionFieldRow
    letter="d"
    label="Anything we should know"
    value={note}
    onChange={setNote}
  />
</QuestionShell>
```

| Part | What it is |
| --- | --- |
| `QuestionShell` | The card: header, the column the rows sit in, a right-aligned footer |
| `QuestionOptionRow` | A row that picks. A `<button>` with `aria-pressed` |
| `QuestionFieldRow` | A row that is typed into. A `<label>`, so the whole row focuses the input |
| `QuestionOtherRow` | The "something else" row: reads as an option, is a text field |
| `QuestionBadge` | The 24px square with the letter or the number |

Each takes a `className` that is **added** to its own rather than replacing it,
spreads the rest of its props onto the element it ends in, and forwards its ref
to the thing worth having one for — the input, in the two rows that have one.
On the two rows that take one, `className` styles the row and everything else
goes to the input.

`QuestionShell` paints the card — background, radius, shadow — unless you pass
`card={false}`, which is what `QuestionCard` does: the box that morphs between
the three states is its own, and two would nest.

`letter` is optional on all three rows. Left out, the row starts at its title.
`onEnter` fires on Enter unless your own `onKeyDown` called `preventDefault`
first, which is how a handler says it has dealt with the key.

### `<EmptyState>` and `<Loader>`

The two ends of a conversation that has not happened yet: what is on screen
before anybody asks, and the gap between sending and the first word.

| `EmptyState` | Type | Notes |
| --- | --- | --- |
| `icon` / `title` / `description` | `ReactNode` | Each optional; nothing is drawn in place of what you leave out |
| `suggestions` | `string[]` | Openers |
| `onSuggestion` | `(text: string) => void` | Without it, no openers are drawn |
| `suggestionsLabel` | `string` | Names the group. Default `"Suggestions"` |

`title` renders as text, not a heading. This sits inside a conversation the
host already owns, and claiming a level in their document is not ours to do —
pass `<h2>…</h2>` if it should be one.

| `Loader` | Type | Notes |
| --- | --- | --- |
| `variant` | `"dots" \| "shimmer"` | Default `"dots"` |
| `children` | `ReactNode` | The words the shimmer runs through |
| `label` | `string \| null` | Default `null` — see below |

The loader is **silent by default**. `useChatTurns` already announces that a
response is coming, and a second live region saying the same thing means
hearing it twice. Pass `label` only when nothing else is speaking for you.

`ChatTurnRow` shows it between the question being sent and the first word
landing, so a sent question is never a blank space.

### `<AnswerActions>`

Copy, regenerate and a verdict, under a settled answer. `ChatTurnRow` renders
it for you; it is exported for anyone composing their own row.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `text` | `string` | | Required. What copy takes |
| `onCopy` | `(text: string) => void` | writes to the clipboard | |
| `onRegenerate` | `() => void` | | Omit and the button is not drawn |
| `onFeedback` | `(verdict: "up" \| "down" \| null) => void` | | Omit and the thumbs are not drawn |
| `feedback` | `"up" \| "down" \| null` | `null` | Controlled |
| `busy` | `boolean` | `false` | While regenerating |
| `reveal` | `boolean` | `false` | Invisible until hovered or focused |
| `labels` | `Partial<Record<…, string>>` | | |
| `children` | `ReactNode` | | Your own controls, after the built-in ones |

Only what has somewhere to report is drawn: no `onRegenerate`, no regenerate
button. A control that calls nothing looks like a feature and behaves like a
dead end.

Pressing the verdict already given reports `null` — that is how somebody takes
it back.

Inside a turn they appear when the answer **settles**. Offering to copy a
half-written answer, or to rate one, is offering the wrong thing.

### `<Conversation>`

The scroll container. It keeps up with an answer as it arrives and stops the
instant the reader scrolls away, with a button offering the way back.

```tsx
<Conversation>
  {turns.map((turn) => <ChatTurnRow key={turn.id} turn={turn} … />)}
</Conversation>
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `anchorId` | `string` | | Hold this element at the top instead of following the end |
| `anchorOffset` | `number` | `0` | How far below the top edge it sits — leave room for a fixed header |
| `threshold` | `number` | `64` | How close still counts as following |
| `scrollButton` | `boolean` | `true` | The way back |
| `scrollButtonLabel` | `string` | `"Jump to the latest"` | |
| `follow` | `boolean` | `true` | `false` makes it a plain scroll container |
| `className` | `string` | | Goes on the root, which is the box you lay out |
| `viewportClassName` | `string` | | Goes on the element that scrolls — padding belongs here |

`ref` is forwarded to the **viewport**, not the root: anyone reaching for a ref
here wants to scroll something, and the root does not scroll.

Three things worth knowing.

**`anchorId` is the one that changes the feel.** Without it the view follows
the end of the content, which is what a chat that stacks downwards wants. With
it, the named element is brought to the top and *held* there while the answer
grows underneath — so a reader sees their question and its answer, and not the
whole conversation pushed up from below with the composer ending past the fold.
Point it at the turn that was just submitted:

```tsx
const [anchor, setAnchor] = useState<string | null>(null);
const send = (id: string, value: string) => { setAnchor(id); submit(id, value); };

<Conversation anchorId={anchor ? `turn-${anchor}` : undefined} anchorOffset={100}>
```

This needs room to scroll into — an element cannot be brought to the top of a
container that ends just below it. A large `padding-bottom` on the viewport is
what provides it.

Without an anchor it follows the **end of the content**, not the bottom of the
container, and those are only the same when nothing is padded below. A chat
with a screen-height pad beneath it would otherwise scroll the answer off the
screen to sit in front of a blank space.

And it reads the reader's intent from the **input**, not from the scroll event.
A component that watches scrolling cannot tell its own from theirs, and ends up
either dragging them back down mid-sentence or never following at all. A wheel
upwards, a page key, a drag away from the end: any of those and it lets go.

### `<CodeBlock>`

A fenced block: the language, a copy button, and code that scrolls sideways
rather than widening the answer. The markdown renderer uses it for every
fence, and it is exported for use on its own.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `code` | `string` | | Required |
| `lang` | `string` | | The fence's language. Unknown ones render unhighlighted |
| `label` | `string \| false` | the language | `false` drops the caption |
| `copyable` | `boolean` | `true` | `false` with `label={false}` removes the bar entirely |
| `onCopy` | `(code: string) => void` | writes to the clipboard | |
| `copiedFor` | `number` | `1600` | How long the button stays confirmed, in ms |

**Ten languages** are registered: TypeScript, JavaScript, HTML/XML, CSS, JSON,
YAML, Bash, Python, SQL, Markdown and diff — plus the aliases people actually
type (`ts`, `tsx`, `js`, `sh`, `py`, `yml`, …). `lowlight/common` is 37
languages and 51.6 KB gzipped; these cost a quarter of that and cover what a
chat actually shows. A language outside the list renders unhighlighted rather
than throwing.

The scheme is ink at four weights rather than a syntax palette — this kit is
ink, paper and one acid yellow, and twelve colours dropped into it read as
somebody else's component. Six tokens (`--ick-code-keyword`, `-string`,
`-comment`, `-name`, `-number`, `-attr`) turn it into whatever palette you
already own.

A block is **not markable**. Preformatted text split into word tokens stops
being preformatted, so the highlighter skips it; copy is what people want from
code anyway.

### `<ChatHeader>`

The chrome above the conversation: who you are talking to, what about, and the
handful of things you can do to the whole thread.

```tsx
<ChatHeader
  title={firstQuestion}
  subtitle="Claude Opus 5"
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

**The text is markdown.** Headings, emphasis, links, lists, blockquotes, code,
tables and strikethrough (GFM) all render. Raw HTML in the input is dropped
rather than rendered — model output is untrusted, and there is no version of
injecting it into the host's page that is worth the surface it opens.

The marker does not care about any of it. Internally the words stay a **flat
array of tokens addressed by index**, and markdown only decides which element
each token is drawn inside — so a stroke that starts in plain text and ends
inside `**bold**` is one run of indices like any other. Fenced code blocks are
the exception: they are preformatted, so they are not tokenised and cannot be
marked.

Parsing costs about 0.9 ms per 1000 characters, and runs once per frame while
an answer streams. Fine for an ordinary answer; see the roadmap for where it
stops being fine.

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
