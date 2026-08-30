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
| `questionAlign` | `"end" \| "stretch"` | `"end"` | Where the composer sits — see below |
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

`questionAlign` is `end` by default, because the composer is about to become
the reader's own bubble and those sit right. `stretch` fills the row instead,
which is what an *opening* composer wants: on an empty conversation it is not a
message on its way, it is the box under the openers — and a pill floating at
the right edge of a centred block reads as unrelated to the block.

Every callback is optional; a row with none of them renders and can be marked.
The row carries `id="turn-<id>"` so a host can scroll to one, and `aria-busy`
while its answer is arriving.

### Two rules everything follows

**Surfaces nest in three steps.** A **ground** is what a group of things sits
on, a **card** is an opaque panel raised on it, and an **inset** is a row set
into the card. `--ick-ground`, `--ick-card`, `--ick-inset` — a question group,
a tool call and an approval all use the same three.

The card is paper and **opaque**, which matters more than it sounds: a
translucent panel picks up whatever it is sitting on, which is how a tool call
inside an approval came out pale green. In the dark the card is a lifted grey,
because `--ick-surface` there is the page itself and a card painted with it
would sink into the ground rather than sit on it.

**Stacked boxes are separated by surface and gap, not by a rule.** A row is an
inset panel with space around it, and nothing is underlined. A tool call used
to draw a line under its header and a code block one under its label, which
with two sections open made three stacked rules in a component the size of a
paragraph — each saying again what the surface had already said.

**All three steps, every time.** A question is a group (ground) holding a card
holding rows; a tool call is a ground holding a card holding its input and
output. The tool used to be one box, and the box was the grey one — the same
three surfaces stacked backwards, which on its own reads fine and beside a
question card reads as a different system.

A component that is *given* a ground brings neither one of its own nor a
shadow: inside an `<Approval>`, the approval is the ground. Two grounds is one
more than there is depth for.

A rule down the **side** is a different device and stays: `<Reasoning>` uses one
to mark an aside, and `<ChainOfThought>`'s says each step follows from the one
above it.

**Corners are concentric.** A box's corner is the corner of the thing inside it
plus the gap between them:

```
badge 8  →  option row 16  →  card 24  →  group 40      gaps 8, 8, 16
code 6   →  tool 14        →  approval 26               gaps 8, 12
```

Get it wrong and the two curves sit at different insets with the same radius,
leaving a crescent between them — the thing that reads as "not quite fitting"
without anybody being able to name it. It is written as `calc()` off a seed
rather than as a list of numbers, so changing a padding moves the corners with
it, and a test does the same sum for every nesting in the kit.

A `<CodeBlock>` reads `--ick-code-radius`, so a box that nests one hands it a
smaller corner — the way `<Tool>` does.

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

### What a turn carries: `TurnPart`

An answer used to be one string, and everything the agent tier draws had
nowhere to live. A turn now carries `parts` alongside `ai`, and a `SendHandler`
streams them in among the prose:

```tsx
const send: SendHandler = async function* (message) {
  yield { kind: "reasoning", id: "r", text: "Two numbers matter here.", state: "thinking" };
  yield { kind: "tool", id: "t", name: "search_web", state: "running", input: { query } };
  yield { kind: "tool", id: "t", name: "search_web", state: "done", output, duration: 412 };
  yield { kind: "reasoning", id: "r", state: "done" };
  yield "The Higgs weighs about 125 GeV.";   // a delta of the answer's prose
};
```

A streamed item is either a **string** — appended to `ai`, as before — or a
**`TurnPart`**, merged into `turn.parts` **by its `id`**. The merge is shallow
and that is the point: send the state change on its own and the text that
arrived before it is still there. `<ChatTurnRow>` draws each kind with the
component that owns it.

| `kind` | Drawn as | Carries |
| --- | --- | --- |
| `reasoning` | `<Reasoning>` | `text`, `state`, `duration` |
| `tool` | `<Tool>` | `name`, `state`, `summary`, `input`, `output`, `error`, `duration` |
| `tasks` | `<TaskList>` | `title`, `tasks`, `collapsible` |
| `question` | `<QuestionGroup>` | `questions`, `answers`, `activeIndex`, `collapsible` |

A question is answered by the person reading it, not by the stream — so
`useChatTurns` also returns **`updatePart(turnId, part)`**, and `ChatTurnRow`
reports through `onAnswerQuestion` / `onEditQuestion`. The row never keeps the
answer; the parts are yours.

Parts are cleared when a turn is answered again: the tool calls that produced
the old answer are not evidence for the new one.

### `<Reasoning>`

What the model worked through before it answered.

```tsx
<Reasoning state={thinking ? "thinking" : "done"}>{thoughts}</Reasoning>
```

| Prop | Type | Notes |
| --- | --- | --- |
| `children` | `ReactNode` | The thinking. Prose — see `Tool` for structure |
| `state` | `"thinking" \| "done"` | Default `"done"` |
| `duration` | `number` | In ms. Left out, the block times itself |
| `open` / `defaultOpen` / `onOpenChange` | | Controlled or not |
| `labels` | `Partial<Record<…, string>>` | `thinking`, `thought`, `thoughtFor` |

**Open while it thinks, folded away once the answer starts.** That is the one
detail every kit shipping this has converged on, and it is right: thinking is
worth watching while it happens and worth almost nothing afterwards — but it
has to stay reachable, because the times it matters are exactly the times the
answer looks wrong.

Folding is the block's *preference*, not something done to the reader. Open it
and it stays open, however many times the state changes underneath.

Without a `duration` it times itself, from the moment it starts thinking to the
moment it stops. Pass one when you already know — replaying a transcript, where
the thinking did not happen just now.

While it thinks the word shimmers, which is how this kit says "provisional"
everywhere. It is a real word in the button rather than a `<Loader>`: the loader
is decorative and marks itself `aria-hidden`, and hiding this one would leave a
control with nothing to call it.

### `<Context>`

How full the context window is.

```tsx
<ChatHeader title="Higgs boson" subtitle="14 turns">
  <Context used={840_000} total={1_000_000} label={false} />
</ChatHeader>
```

| Prop | Type | Notes |
| --- | --- | --- |
| `used` / `total` | `number` | In tokens, or whatever unit you count in |
| `warnAt` | `number` | Fraction. Default `0.8` |
| `label` | `ReactNode \| false` | The percentage by default; `false` for the ring alone |
| `labels` | `Partial<Record<…, string>>` | `name`, `of`, `tokens`, `nearlyFull` |

Small on purpose. It is a gauge, not a feature, and it earns its place for one
reason: **it is the only honest way to explain why a long conversation starts
forgetting.** Without it the forgetting looks like the model being stupid
rather than the window being full.

Which is why the warning says *what happens next* rather than only that a
number is high — `"82%"` tells somebody nothing they can act on. The whole
sentence is the meter's accessible name and its `title`, so it reaches a
pointer and a screen reader alike.

Two colours, not three: quiet until `warnAt`, then the danger colour. A gauge
with an amber in the middle makes somebody learn a scale to read a number they
can already see.

### `<Approval>`

"It wants to do this. Is that all right?"

```tsx
<Approval
  title="Run a command in your shell"
  description="It removes the generated screenshots. Nothing else is touched."
  decision={decision}
  onDecide={setDecision}
>
  <Tool name="bash" state="pending" input={{ command: "rm -rf Shots/" }} defaultOpen />
</Approval>
```

| Prop | Type | Notes |
| --- | --- | --- |
| `title` | `ReactNode` | What is being asked. Names the region |
| `description` | `ReactNode` | Why, or what it will touch |
| `children` | `ReactNode` | The thing itself — usually a `<Tool>` or a `<CodeBlock>` |
| `decision` | `"once" \| "always" \| "denied" \| null` | `null` while it is still asking |
| `onDecide` | `(decision) => void` | |
| `readOnly` | `boolean` | A record of a decision made elsewhere |

**Three answers, not two.** "Yes" and "yes forever" are not the same answer,
and a UI offering one button for both collects the wrong one. **Allow once is
the primary**: the narrow permission is the one that should be easiest to give,
and the standing one should cost a moment's thought. Deny sits alone on the left with
the two that say yes pushed right — a destructive choice flush against an
affirmative one is a mis-click waiting to happen — and it is first in the DOM
too, so a keyboard reaches the safe answer without tabbing past the other two.
It turns red only under the pointer, because a permanently red button is the
first thing the eye lands on.

Give it something to show. An approval with nothing under it is asking for a
signature on a blank page.

Decided, it stops being a set of buttons and becomes a record of what was
decided. Live controls under a decision already made invite a second one that
contradicts the first.

As a `TurnPart` it is `{ kind: "approval", id, title, description?, tool?,
decision? }` — data, like every part, so the tool it names is drawn for it
rather than passed in as an element. `<ChatTurnRow>` reports through
`onDecideApproval`.

### `<Sources>` and `<InlineCitation>`

A numbered marker in the text, and the list underneath.

```tsx
<p>
  The Higgs is a point particle, so{" "}
  <InlineCitation index={1} source={sources[0]} onSelect={(_, s) => setActive(s.id)}>
    it has no measurable spatial extent
  </InlineCitation>.
</p>
<Sources sources={sources} activeId={active} />
```

| `Sources` | Type | Notes |
| --- | --- | --- |
| `sources` | `Source[]` | `{ id, title, url?, origin?, quote? }` |
| `title` | `ReactNode` | Defaults to `labels.title` |
| `collapsible` | `boolean` | `false` |
| `activeId` | `string \| null` | The one arrived at from a marker |
| `onSelect` | `(source, index) => void` | |

| `InlineCitation` | Type | Notes |
| --- | --- | --- |
| `index` | `number` | 1-based, and it has to match the entry's place |
| `source` | `Source` | Named in the marker's accessible name |
| `children` | `ReactNode` | The passage this citation speaks for — marked, if given |
| `onSelect` | `(index, source?) => void` | Without one the marker is not a control |

**The citation marker and the highlight marker are the same interaction seen
twice.** The kit already had a way of saying *this run of words is picked out*
— the marker somebody draws over an answer to ask about it. A citation is that
same statement made by the answer rather than by the reader, so it is drawn the
same way rather than in a second visual language nobody has learned. Give
`InlineCitation` the passage as `children` and the passage is marked; give it
none and the marker stands on its own after whatever precedes it.

Pressing a marker **marks** the entry it points at rather than scrolling to it.
The list is already under the answer, and moving the page under somebody who
clicked a marker in a sentence they were reading loses them the sentence.

The list is open by default. Sources are the difference between an answer
somebody can check and one they have to trust, and folding that away by default
says the opposite of what a citation is for.

### `<ChainOfThought>`

How the answer was arrived at, step by step.

```tsx
<ChainOfThought
  state={thinking ? "thinking" : "done"}
  duration={4200}
  steps={[
    { id: "a", label: "The question is about size, not mass", body: "A point particle has none." },
    { id: "b", label: "Checked the measured value", body: <Tool name="search_web" … /> },
  ]}
/>
```

| Prop | Type | Notes |
| --- | --- | --- |
| `steps` | `Thought[]` | `{ id, label, body?, state? }` |
| `state` | `"thinking" \| "done"` | `thinking` holds it open and narrates the running step |
| `duration` | `number` | In ms, for the whole chain |
| `open` / `defaultOpen` / `onOpenChange` | | Controlled or not |
| `labels` | `Partial<Record<…, string>>` | `through`, `step`, `steps`, `thinking` |

**Three components in this kit draw a sequence, and the line between them is
the only reason there are three:**

| | What it is | Shape |
| --- | --- | --- |
| `Reasoning` | The model talking to itself | Prose, unstructured |
| `TaskList` | A plan | Known up front, fixed order, items change state |
| `ChainOfThought` | A derivation | Grows; each step follows from the one above |

That last word is what the line down the glyph column draws. A task list has no
line between its items, because a plan's items do not follow from each other —
they are a set, in an order somebody chose.

A step's `body` is whatever you put there: prose, or a `<Tool>` if the step was
a tool call. While the chain is thinking its header carries the running step's
label rather than a count — that is the question somebody watching is asking,
and the reason to look at a folded chain at all.

### `<TaskList>`

What the agent means to do, what it is doing, and what it has finished.

```tsx
<TaskList
  title="Plan"
  collapsible
  tasks={[
    { id: "read", label: "Read the care plan", state: "done", detail: "42 lines" },
    { id: "gaps", label: "Find the gaps in the weekly cover", state: "running" },
    { id: "draft", label: "Draft the questions for the family" },
  ]}
/>
```

| Prop | Type | Notes |
| --- | --- | --- |
| `tasks` | `Task[]` | `{ id, label, state?, detail? }` |
| `title` | `ReactNode` | Gives it a row to fold into. Without one there is no row |
| `collapsible` | `boolean` | `false` |
| `open` / `defaultOpen` / `onOpenChange` | | Controlled or not |
| `labels` | `Partial<Record<…, string>>` | The four states, and `progress` (`"{done} of {total}"`) |

A task is `pending`, `running`, `done` or `error` — the same four as a tool
call, and the same glyphs, because they are the same four states and naming
them differently in two places buys nothing.

**The order never changes.** A list that sorted itself as work progressed would
move the line somebody is reading out from under them, and the sequence is half
of what the list is saying — these steps, in this order. Only the glyphs change.

`collapsible` folds it away once every task is done: a plan is worth watching
while it runs and worth little afterwards. Anybody reading it can overrule
that, in either direction, for good.

The one being worked on carries `aria-current="step"`, so a screen reader can
jump to "where is it up to" rather than counting down the list.

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
