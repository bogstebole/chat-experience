# Changelog

Dates are the day the work landed on `main`.

The versions before 1.0 follow the pre-release convention: **a breaking change
or new public API bumps the minor**, and the patch is for fixes. Anything that would break an
existing install is called out under **Breaking**, with what to do about it.

## 0.31.0 — 2026-08-31

### Changed

- **An approval is not tinted any more.** It stands on the same neutral ground
  a question group does, because it *is* a question: "may I run this" is the
  same species as "who else lives in the household" — the assistant asking,
  blocking, with an answer.

  The tint was there on the reasoning that this is the one thing in an answer
  allowed to look like a box that stops you. The reasoning is real; colour was
  the wrong instrument for it. Everywhere else in the kit the marker is a small
  mark pointed at one thing and means **this one** — the badge on the option
  you picked, the stroke you drew, a citation, a source's number. A wash across
  a whole box meaning "this kind of box" is a second job for the one accent.

  It also did not carry its weight: at 8% it was too weak to be an alarm and
  too strong to be nothing, and in the dark it came out olive, which is not in
  the palette. What says "this is unanswered" is that the box has **buttons in
  it**, and nothing else in a turn does.

  `--ick-approval-surface` is `var(--ick-ground)`. `--ick-approval-edge` is
  gone with the ring it drew.

- **Settled, nothing about the box changes** — the buttons simply leave. It
  used to shed its background and pick up a border, because the tint was the
  thing saying "unanswered" and had to stop saying it. A question card keeps
  its paper and its shadow when it folds into an answered row; this does the
  same.

- **The shield rides in a badge's box**, so the title starts on the line a
  question card's title starts on.

### Breaking

- `--ick-approval-edge` is removed. If you were overriding it to re-tint the
  ring, set `box-shadow` on the component instead — or override
  `--ick-approval-surface`, which is still the ground it stands on.

## 0.30.0 — 2026-08-31

### Changed

- **An approval is a ground holding a card, like everything else.** It was a
  tinted box with the tool call as the only thing on paper — so the title, the
  description and the three buttons sat directly on the ground. A question card
  puts its header *and* its Next button on the card; this was the same three
  surfaces in a different arrangement, which beside one read as a different
  object.

  ```
  ground 40 (tinted)  →  card 24  →  row 16
  ```

  The tool call on that card is now a **row** rather than a second card: inset,
  at the row corner, no shadow. Two cards stacked is one surface more than
  there is depth for — the same fault as two grounds, from the other end. What
  the row holds takes the corner inside that, and its fenced value is paper,
  the way a question's badge is paper on a grey row.

  Settled, the card stops floating along with the tint: nothing is being asked
  any more.

- `--ick-approval-radius` is derived from `--ick-nest-card` rather than from
  `--ick-tool-radius`. The tool's corner was standing in for the card's back
  when a tool call was the only thing on the ground.

## 0.29.1 — 2026-08-31

### Fixed

- **The card is opaque in the dark too.** `--ick-dark-card` was
  `rgb(var(--ick-ink-rgb) / 0.09)` — a wash. On the page that is
  indistinguishable from an opaque mix; on anything tinted it is not. A tool
  call inside an `<Approval>` sits on the marker at eight percent, and the card
  and the code block inside it both came out **olive** — the panel wearing its
  ground, which is the one thing "the card is paper and opaque" exists to
  prevent.

  It held in the light, where the card is `#fff`, and was never true in the
  dark, which is where it is easiest to see. `--ick-dark-card` is a
  `color-mix` of paper and ink now, and `--ick-inset` is mixed **from the
  card** rather than washed over whatever is behind it. Same colour on the
  page; committed to rather than borrowed.

  `--ick-ground` stays a wash on purpose — it is the bottom of the stack, so
  there is nothing under it to pick up but the page.

  The guard that was meant to catch this checked the **wiring** — that the card
  points at paper in the light and at its own token in the dark — and never
  looked at the value. It reads the value now.

## 0.29.0 — 2026-08-31

### Changed

- **One header for everything that folds.** `Tool`, `Reasoning`,
  `ChainOfThought`, `TaskList` and `Sources` each had a row you click to open
  something, written out five times — with two pairs byte-for-byte identical
  and the rest differing in ways nobody had decided on. The shimmer under the
  label was in two of them, twenty lines of gradient each. The reveal beneath
  was the same ten lines of `motion` props in all five.

  `DisclosureHeader` and `DisclosureBody` are internals, not exports. **Nothing
  moved on screen** — the side-by-side story is pixel-identical.

  What is *not* unified is the shape, because the difference is real. A `band`
  is a full-width row with a right edge to push the meta and the chevron to;
  `inline` is a label that hugs its own words, for a header that sits in the
  flow of an answer. An inline header's chevron pushed to a right edge 500px
  away floats alone in white space with nothing beside it.

- **`--ick-disclosure-*` replaces the per-component header tokens.** `-label`,
  `-font`, `-weight`, `-size`, `-glyph`, `-meta`. A component repoints them
  from its own root when it means something different — `Sources` and
  `TaskList` head a list so their label is ink at medium; `Tool`'s is an
  identifier so it is mono.

  Repointed rather than overridden with a class, deliberately: two `.label`
  rules in two stylesheets have equal specificity and which one wins is import
  order, which is not a thing to build on.

- **The stylesheet is 4.1 kB smaller** (72.81 kB, 12.48 kB gzip), and the entry
  is 4.2 kB smaller.

### Removed

- `--ick-reasoning-glyph` and `--ick-chain-header`, which said what
  `--ick-disclosure-glyph` and `--ick-disclosure-label` now say. The kit's
  `<Reasoning>` and `<ChainOfThought>` no longer set a `.header` of their own
  for anything to point at.

## 0.28.0 — 2026-08-31

### Added

- **`data-active-input` on the row that owns the live composer.** Which turn
  that is, is something `<ChatTurnRow>` knows and a host does not — the class
  it used to set was a hashed CSS-module name nothing outside the package could
  target, and no rule in the kit used it either, so it did nothing at all.

  The case that wanted it: a page fading its conversation off the bottom edge
  has no way to exempt the composer. This kit's composer lives at the *end of
  the feed*, because it morphs into the message it sends — so after a long
  answer it lands inside the gradient and comes out washed to nearly nothing.
  It was never actually blocked; a fade is `pointer-events: none`. It just
  looked unavailable, which is enough.

  ```css
  .feed [data-active-input] { position: relative; z-index: 6; }
  ```

## 0.27.0 — 2026-08-31

### Changed

- **The syntax grammars are a chunk, fetched when something needs one.**
  `lowlight` and eleven grammars were 25 kB gzipped in everybody's bundle for a
  thing most conversations never show.

  ```
  entry   60.10 kB gzip  →  35.05 kB gzip     −42%
  chunk                     25.10 kB gzip     only if an answer has a fence
  ```

  A code block paints its code plain on the first paint and colours in when the
  chunk lands. Every block after the first is coloured from its first paint,
  because the loaded highlighter is kept. No layout shift either way: the text
  is identical, only the colour arrives late.

  Call `loadHighlighter()` at start-up if that trade is wrong for you — a docs
  tool where every answer is code. Idempotent; concurrent callers share the one
  fetch. `canHighlight(lang)` still answers without loading anything.

  The grammars live in their own module with **static** imports, and the guard
  that keeps them there says why: `lowlight`'s entry re-exports `all` (190
  grammars) beside `createLowlight`, so importing the *package* dynamically
  materialises the whole namespace and nothing can shake it back out — 301 kB
  gzip, thirteen times what deferring it saves. The first attempt did exactly
  that. Static named imports inside a deferred module shake normally.

### Added

- `loadHighlighter` and `canHighlight` are public.

### Breaking

- `highlightCode(code, lang)` is gone from the module's surface; it was never
  exported from the package. The highlighter now arrives through
  `await loadHighlighter()`, which returns the same function.

- A bundler-less consumer loading the ESM directly now sees a second request
  the first time an answer contains a fence.

## 0.26.0 — 2026-08-31

### Added

- **`chain` and `sources` are turn parts.** `<ChainOfThought>` and `<Sources>`
  were in Storybook and unreachable from a conversation — nothing a stream
  could send drew them. A `SendHandler` yields
  `{ kind: "chain", id, steps, state }` and
  `{ kind: "sources", id, sources, title?, collapsible? }` now, and
  `<ChatTurnRow>` draws both.

- **`[^1]` in the prose is a citation.** The number is a position in the turn's
  `sources` part, and the marker draws as an `<InlineCitation>` carrying that
  source's title.

  This is the kit's one extension to the markdown grammar, and it exists for a
  specific reason: a citation is a component, a stream sends text. Before this,
  `<InlineCitation>` could only be written by hand in JSX — so the component
  existed and no actual conversation could reach it. GFM spells footnotes the
  same way but wants a `[^1]: …` definition in the document; a model emits the
  marker and sends its sources beside the text, never below it.

  The marker is kept **out of the tokens**, so a highlight drawn across the
  sentence — and the text a thread quotes back — do not contain a stray `[1]`.
  A marker whose source has not arrived yet still draws, and starts working
  when the list lands.

- **`<TextHighlighter>` takes `sources` and `onSelectSource`**, which is how the
  citations reach it. `<ChatTurnRow>` passes the turn's first `sources` part.

## 0.25.1 — 2026-08-30

### Fixed

- **`highlight.js` is declared.** `CodeBlock` imports eleven grammars from it
  one at a time, and the package listed only `lowlight`. It resolved because
  `lowlight` depends on `highlight.js` and npm hoists it into reach — so under
  a strict resolver, or the day `lowlight` picks a different highlighter, it is
  a consumer's build breaking on an import this package wrote. It is a
  dependency now, at the version `lowlight` already pulls.

  Nothing new is installed and the bundle does not move; it was always there.
  What changes is that it is there on purpose.

### Added

- **A test for what installing this costs.** The runtime dependencies, the
  peers, and every bare import in `src` checked against both — so an import
  cannot outrun the manifest again, and the playground's dev tooling (DialKit,
  the perf HUD) cannot cross into the package by being convenient. It found the
  `highlight.js` gap on its first run.

## 0.25.0 — 2026-08-30

### Changed

- **One nesting chain for the whole kit.** A tool call and a question card are
  the same object holding different things, and now they are built out of the
  same four numbers.

  ```
  --ick-nest-inner   8    a badge, a chip, a fenced value
  --ick-nest-row    16    an inset panel: an option, a field, a block of output
  --ick-nest-card   24    paper, lifted off the ground
  --ick-nest-ground 40    what the paper stands on
  ```

  with `--ick-nest-pad` (8) inside a card and a row, and
  `--ick-nest-ground-pad` (16) around a card on its ground.

  Each component used to derive its own. A tool call was a 6px block in a 14px
  card on a 22px ground, beside a question's 8 / 16 / 24 / 40 — both internally
  concentric and the two nothing like each other. The same three surfaces at
  two scales reads as two systems, not as one object holding different things.

  The reason the tool seeded a tighter chain was that a row folded shut is only
  40px tall, and a 24px corner on it clamps to a pill. It does. So does a
  question folded shut, which is 40px tall and carries the same 24. Both come
  out the same shape, which was the point.

- **A folded tool call is a folded question, to the pixel.** 40 tall, 16 in
  from the left, 8 from the right, and the state glyph rides in the 24px box a
  question's badge sits in — so the name and the title start on one line when
  the two are stacked. There is a story for it: **Side by side → The same row,
  twice**.

- **A tool call's ground is padded like a question group's** — 16 rather than
  8, so more of it shows around the card. Its output panels take the row corner
  (16) rather than a 6, which is what the card's 24 and its 8 of padding imply.

- **An `<Approval>` is padded like a ground**, because it is one: 16 rather than
  12, and its corner follows to 40 — the same box a question group is.

### Fixed

- **The ground in the question stories was cornered by hand** — `padding: 16,
  borderRadius: 24`, a ground padded like a ground and cornered like the card
  standing on it. It is `card + padding`, or 40. A test now walks every story
  for a hand-built ground, since a style object is not a stylesheet and the
  chain cannot reach into one.

### Breaking

- `--ick-tool-radius` is **24** (was 14), `--ick-tool-inner-radius` **16**
  (was 6), `--ick-tool-ground-pad` **16** (was 8), `--ick-approval-pad` **16**
  (was 12). Every one still resolves through the same token name, so an
  override you had set still works — but if you set one to match the old
  numbers, it is now out of step with the chain around it. Point it at
  `--ick-nest-*` instead, or move the seed and let all of it follow.

## 0.24.1 — 2026-08-30

### Changed

- **A tool call gets the ground its card stands on.** The last release made it
  a card; a card needs something to be a card *on*, and on the page alone it
  was only paper with a shadow. It is a ground holding a card holding its input
  and output now — the same three the question card has, in the same order.

  `--ick-tool-ground` and `--ick-tool-ground-pad`, with the corner chain
  running through both: **inset 6 → card 14 → ground 22**.

  Inside an `<Approval>` the tool brings neither a ground nor a shadow, because
  the approval already is the ground. Two grounds is one more than there is
  depth for.

## 0.24.0 — 2026-08-30

### Changed

- **A tool call is a card, the same object a question is.** Paper, lifted off
  the page, with what it holds inset into it.

  It was the other way round — a recessed grey strip with white panels inside —
  which is the same three surfaces stacked backwards. On its own that reads
  fine; beside a question card it reads as a different system. Lined up in the
  new *Side by side* story, it was the first thing you saw.

  `--ick-tool-shadow` is new, and an `<Approval>` sets it to `none`: a card
  that already has a ground under it does not need to float off it as well.
  Which also retires the three tokens the approval was repointing — saying a
  tool call is a card is the tool's job now, not something done to it from
  outside.

- **A `Side by side` story.** Everything the kit draws, next to everything else
  it draws. Not a demo: every fault worth fixing so far was found by looking at
  two things at once, and none of them were visible in one component alone.

## 0.23.1 — 2026-08-30

### Changed

- **Three rules removed.** A tool call drew one under its header and a code
  block one under its label, so an open tool with an input and an output had
  three stacked rules in a component the size of a paragraph.

  The question card underlines nothing — a row is an inset panel with space
  around it, and that is the whole of it. Two ways of saying the same thing was
  one too many, and the surface was already saying it. A test now fails if a
  rule goes back between stacked boxes.

  A rule down the **side** is a different device and stays: `Reasoning` marks
  an aside with one, and `ChainOfThought`'s says each step follows from the one
  above it. Neither is separating stacked boxes.

## 0.23.0 — 2026-08-30

### Changed

- **The kit parses markdown itself.** `unified` + `remark-parse` +
  `remark-gfm` were 31.6 KB gzip — a third of the package — and the slowest
  thing in it. They are gone from `dependencies`; `lowlight` is the only one
  left.

  | | before | after |
  | --- | --- | --- |
  | bundle | 90.8 KB gzip | **58.2 KB gzip** |
  | parse, 1.7k chars | 1.95 ms | **0.049 ms** |
  | parse, 5.2k chars | 5.84 ms | **0.110 ms** |

  That second column is the one that mattered: parsing runs once per frame
  while an answer streams, so 5.8 ms was a third of a frame spent re-reading an
  answer that grew by one word.

  The kit only ever used a thin slice — nine block types and nine inline ones,
  walked straight into a flat token list — so it parses that slice in about
  three hundred lines. **It is not a CommonMark implementation and does not
  claim to be.**

  What makes that safe: `remark` stays a **dev** dependency, and a test parses
  a corpus of real answers through both and compares the finished documents —
  including every prefix of one, which is what streaming actually parses and
  where the two first disagreed. Three real differences came out of that and
  were resolved deliberately: trailing whitespace at the end of a paragraph
  (matched), a delimiter row that must match the header's cell count before a
  half-typed table becomes a table (matched), and short table rows, where this
  pads and `remark` leaves it to the renderer (kept, so a streaming table's
  last column does not pop in and out).

## 0.22.0 — 2026-08-30

### Changed

- **The concentric corner rule is the kit's, not the question card's.** It was
  worked out for one component and stayed there, and the same fault turned up
  immediately in a tool call inside an approval: the tool and the code block in
  it both had an 8px corner at two different insets, which is the crescent the
  rule exists to prevent.

  Read inward here rather than outward, because the outer box is short — a tool
  row folded shut is about 40px tall, and a corner derived from a generous
  inner gap would make it a pill. So the gap is tight and the block inside
  takes the small corner: **code 6 → tool 14 → approval 26**, gaps 8 and 12.

  `<CodeBlock>` now reads `--ick-code-radius`, so a box that nests one hands it
  a smaller corner the way `<Tool>` already handed it a different fill. The
  guard covers every nesting in the kit — adding a box that holds a box means
  adding a row to it.

- **One stack of surfaces, named once.** `--ick-ground`, `--ick-card`,
  `--ick-inset`: what a group sits on, an opaque panel raised on it, a row set
  into the panel. The question card had worked this out and kept it to itself.

  Which is how a tool call inside an approval came out **pale green**: the
  tool's own surface is a translucent grey, and a translucent panel on a tinted
  ground wears the tint. An approval is a ground now, so the tool on it is a
  card and the code panel in that is inset — the same three steps the question
  card uses.

- **Three weights for an approval's three answers.** Filled for the narrow yes,
  outlined for the standing one, flat for no. Two outlined buttons beside each
  other said the last two were equals, which they are not. Left to right: Deny,
  Always allow, Allow once — and Deny is still first in the DOM, so a keyboard
  lands on the safe answer without tabbing past two that say yes.

## 0.21.0 — 2026-08-30

### Added

- **`<Context>`.** How full the context window is, as a small ring.

  It is a gauge, not a feature, and it earns its place for one reason: it is
  the only honest way to explain why a long conversation starts forgetting.
  Without it the forgetting looks like the model being stupid rather than the
  window being full.

  Which is why the warning says **what happens next** rather than only that a
  number is high — "82%" tells somebody nothing they can act on. The whole
  sentence is the meter's accessible name and its `title`, so it reaches a
  pointer and a screen reader alike.

  Two colours, not three: quiet until `warnAt`, then the danger colour. A gauge
  with an amber in the middle makes somebody learn a scale to read a number
  they can already see.

  `role="meter"` with the value on it, rather than a number a screen reader has
  to find in a sentence. A total of zero reads as empty rather than full — a
  window nobody has reported yet is not a full one — and a host summing its own
  tokens is clamped at 100 rather than drawn past it.

  **This finishes the agent tier.** G1 through G7 are done.

## 0.20.1 — 2026-08-30

### Changed

- **Deny moved to the left of an approval,** with the two that say yes pushed
  right. It is first in the DOM as well, so a keyboard reaches the safe answer
  without tabbing past the other two — the gap between it and the affirmative
  choices is still what stops the mis-click.

## 0.20.0 — 2026-08-30

### Added

- **`<Approval>`.** "It wants to do this. Is that all right?" — the one pattern
  from a coding agent that generalises to any agent that acts, and the only
  component here whose whole job is to slow somebody down for a moment.

  **Three answers, not two.** "Yes" and "yes forever" are not the same answer,
  and one button for both collects the wrong one. Allow once is the primary:
  the narrow permission should be the easy one to give and the standing one
  should cost a moment's thought. Deny sits at the far end and only turns red
  under the pointer.

  Decided, it stops being a set of buttons and becomes a record of what was
  decided — live controls under a decision already made invite a second one
  that contradicts the first.

- **`kind: "approval"` on `TurnPart`,** and `onDecideApproval` on
  `<ChatTurnRow>`. Data like every other part: the tool it names is drawn for
  it, unrun, rather than passed in as an element.

- **`variant="outline"` on `<Button>`.** The gap between `primary`, which is
  filled, and `secondary`, which is naked until touched: a button that looks
  like one before you reach for it.

  `secondary` reading as bold text has now caught this kit twice — the empty
  state's openers in 0.9.0, and an approval's Deny here. The second time it was
  a permission control that did not look like a control, so the gap is filled
  rather than worked around again.

- **`TurnPartUpdate`** — a part with everything optional but `kind` and `id`,
  which is what a stream and `updatePart` actually send. Saying a tool call
  finished is now `{ kind: "tool", id, state: "done" }` and nothing else.
  Repeating a field to satisfy a type is how one that was not meant to change
  gets overwritten with whatever was easiest to type — which is exactly what
  happened to an approval's title before this existed.

## 0.19.0 — 2026-08-30

### Changed

- **A question's corners nest.** A box's corner is now the corner of the thing
  inside it plus the gap between them — the rule that stops a rounded row
  inside a rounded card leaving a crescent of card between the two curves. It
  is the thing that reads as "not quite fitting" without anybody being able to
  name it.

  Measured, from the inside out. The badge seeds the chain at 8, a row is 8
  plus its own 8 of padding, a card is 16 plus the 8 it puts around its rows,
  and the group is 24 plus the 16 it puts around its cards:

  | | was | is |
  | --- | --- | --- |
  | badge | 8 | 8 |
  | option / field row | 8 | **16** |
  | card | 12 | **24** |
  | group | 24 | **40** |

  Written as arithmetic rather than as four numbers —
  `--ick-question-radius-badge` seeds it and `-row`, `-card` and `-group` are
  `calc()` off it — so the chain cannot drift when one of the paddings changes.
  A test does the same sum and reports the whole chain when a link breaks.

  The folded group row takes a card's corner, since that is what it is. The
  count beside it is a pill, which is outside the chain: a pill's corner is its
  own height, not something derived from what contains it.

## 0.18.0 — 2026-08-30

### Added

- **`<Sources>` and `<InlineCitation>`.** A numbered marker in the text and the
  list underneath.

  **The citation marker and the highlight marker are the same interaction seen
  twice**, and this is where that pays. The kit already had a way of saying
  *this run of words is picked out* — the marker somebody draws over an answer
  to ask about it. A citation is that same statement made by the answer rather
  than by the reader, so it is drawn the same way rather than in a second
  visual language nobody has learned. Give `InlineCitation` the passage as its
  children and the passage is marked, on every line it wraps onto.

  Pressing a marker **marks** the entry rather than scrolling to it. The list
  is already under the answer, and moving the page under somebody who clicked a
  marker in a sentence they were reading loses them the sentence.

  The list is open by default: sources are the difference between an answer
  somebody can check and one they have to trust. An entry is a link only where
  there is somewhere to go — a keyboard lands on every link, and one that goes
  nowhere is a stop for nothing. Same for the marker, which is a `<button>`
  only when it has an `onSelect`.

## 0.17.0 — 2026-08-30

### Added

- **`<ChainOfThought>`.** How the answer was arrived at, step by step.

  Three components now draw a sequence, and the line between them is the only
  reason there are three: `Reasoning` is prose, `TaskList` is a plan — known up
  front, fixed order, items changing state — and this is a **derivation**,
  which grows, and where each step follows from the one above it. That last
  word is what the line down the glyph column draws; a task list has no line
  between its items, because a plan's items do not follow from each other.

  A step's `body` takes anything, including a `<Tool>` when the step was a tool
  call. While it thinks, the header carries the running step's label rather
  than a count — that is the question somebody watching is asking, and the
  reason to look at a folded chain at all.

  Folds on the same terms as `Reasoning`: open while thinking, away once the
  answer starts, and overruled for good by anybody who touches it. Four
  components share `useDisclosure` now, and three share `StateGlyph`.

  The connector came out of the first screenshot as a nine-pixel stub — the
  rail was only as tall as its glyph, so there was nothing for the line to span.
  It stretches to the step now.

### Changed

- **The shimmer guard covers all three shimmers**, not two. A third copy of the
  same effect landed in `ChainOfThought`, which is exactly the drift the test
  was written for.

## 0.16.0 — 2026-08-30

### Added

- **A turn carries `parts`, and a `SendHandler` can stream them.** The agent
  tier existed and was unreachable: `Reasoning`, `Tool`, `TaskList` and
  `QuestionGroup` all worked, and nothing carried one into a conversation. An
  answer was one string, so a tool call, a plan and a block of reasoning either
  flattened into that string or never arrived.

  A streamed item is now either a string — a delta of the answer's prose, as
  before — or a `TurnPart`, merged into `turn.parts` **by its id**. The merge is
  shallow, which is what makes streaming one bearable: send the state change on
  its own and the text that arrived before it is still there.

  `<ChatTurnRow>` draws each kind with the component that owns it, in one block
  so the row's generous gap sits between the question and the answer — not
  between a tool call and the sentence it produced.

- **`updatePart(turnId, part)` on `useChatTurns`,** and `onAnswerQuestion` /
  `onEditQuestion` on `<ChatTurnRow>`. A question the assistant asked is
  answered by the person reading it, not by the stream, and that answer has to
  land somewhere. The row never keeps it — the parts are the host's.

- **`mergeParts`** is exported, for a host folding parts into state of its own.

### Breaking

- **`ChatTurn` now has a required `parts` field.** Turns from `useChatTurns`
  always have it; code that builds a `ChatTurn` literal — a test, a story, a
  host's own state — needs `parts: []`.

- **`SendHandler`'s iterable widened** to `AsyncIterable<string | TurnPart>`.
  A handler that only yields strings is unaffected.

## 0.15.0 — 2026-08-30

### Added

- **`<TaskList>`.** What the agent means to do, what it is doing, and what it
  has finished.

  **The order never changes.** A list that sorted itself as work progressed
  would move the line somebody is reading out from under them, and the sequence
  is half of what the list is saying — these steps, in this order. Only the
  glyphs change.

  A list rather than a box, which is the difference from `Tool`: that is a
  record of one thing that ran and gets a surface; this is a sequence, and a
  surface around it would make it a thing beside the answer rather than part of
  it. Three inks down the list — what is finished recedes, what is queued is
  quieter still, and the one being worked on is the answer to "where is it up
  to".

  `collapsible` folds it once every task is done, on the same terms as
  `Reasoning`: the list's preference, overruled for good by anybody who touches
  it. The running task carries `aria-current="step"`, so a screen reader can
  jump to it rather than counting down the list.

### Breaking

- **`--ick-tool-glyph`, `--ick-tool-glyph-done`, `--ick-tool-glyph-error`,
  `--ick-tool-spinner`, `--ick-tool-spinner-track` and
  `--ick-tool-glyph-size` are gone.** The four states are shared with
  `TaskList` now, and so are their colours: `--ick-state-pending`,
  `--ick-state-running`, `--ick-state-done`, `--ick-state-error`,
  `--ick-state-track` and `--ick-state-size`. If you had restyled a tool call's
  glyph, the new names do the same job for both components.

  Two copies of one drawing is how the two start to disagree — which the
  shimmer had already demonstrated one release earlier.

## 0.14.1 — 2026-08-30

### Fixed

- **The shimmer stood still for two thirds of every cycle.** With the gradient
  two and a half times the element and swept from `150%` to `-50%`, the bright
  point travels from one element-width left of the words to two widths right of
  them — so it is on the text for a third of the pass and off it for the rest.
  A shimmer that spends most of its time as a static grey line is doing the
  opposite of its job.

  Sampled frame by frame over one period to confirm it rather than guess: two
  in every three frames were the word standing still.

  It is `200%` swept `110%` → `-10%` now, which puts the bright stop on the
  left edge at one end and the right edge at the other, so it crosses the words
  and little else. 1.8s rather than 2.4.

  Both `Loader`'s shimmer and `Reasoning`'s had it, and both are fixed. A test
  compares the two, since nothing else would make the next person fixing one of
  them look at the other.

## 0.14.0 — 2026-08-30

### Added

- **`<Reasoning>`.** What the model worked through before it answered. Open
  while it thinks, folded away once the answer starts — the one detail every
  kit shipping this has converged on, and it is right: thinking is worth
  watching while it happens and worth almost nothing afterwards, but it has to
  stay reachable, because the times it matters are exactly the times the answer
  looks wrong.

  Folding is the block's preference, not something done to the reader. Open it
  and it stays open, however many times the state changes underneath.

  It times itself when no `duration` is given — adjusted during render on a
  change of state rather than in an effect, which would mean a second pass
  every time the thinking stopped.

  Prose, not a panel, which is the difference between this and `Tool`: a tool
  call is a record of something that ran and gets a box; this is the model
  talking to itself, and a box would give it a weight it has not earned next to
  the answer it is only explaining. A rule down the side says "aside" and stays
  out of the way.

  The shimmering word is a real word in the button rather than a `<Loader>`.
  The loader is decorative and marks itself `aria-hidden`; drawn that way the
  button had no accessible name at all. Caught by the tests before it shipped,
  and three axe cases keep it that way.

### Changed

- **`formatDuration` moved out of `Tool`** into its own module, and both it and
  `Reasoning` read it from there.

- **`useDisclosure`** holds the open/shut rule both blocks share: the host if it
  is controlling the row, then whoever clicked it, then the row's own
  preference. Derived rather than an effect, which is what lets a reader's
  decision outlive every state change after it.

## 0.13.0 — 2026-08-29

### Added

- **`questionAlign` on `<ChatTurnRow>`.** `end` by default — the composer is
  about to become the reader's own bubble, and those sit right. `stretch` fills
  the row instead, which is what an *opening* composer wants: on an empty
  conversation it is not a message on its way, it is the box under the openers,
  and a pill floating at the right edge of a centred block reads as unrelated
  to the block.

  A flex child sizes to its content, so the input is told to fill as well —
  stretching the row on its own does nothing.

### Changed

- **The badge on a chosen option is the accent taken down towards ink.** At
  full strength it was a shade off the tint under it: two yellows that close
  are not a badge on a row, they are one yellow with a rounded hole in it.
  Paper was tried first and was no better — pale on pale.

  `--ick-marker-deep` mixes the marker with ink rather than stating a colour
  per theme, which is the point: ink is near-black in the light and near-white
  in the dark, so it comes out darker than the row in one and lighter in the
  other. One requirement — separate from the row — answered correctly twice.

  Measured rather than eyeballed. 55% marker put the letter at 3.5:1; 45% is
  the first that clears 4.5. It ships at 40%: the letter reads 5.6:1 in the
  light and 16.3:1 in the dark, and the badge 5.1:1 and 4.0:1 against the row
  it sits on.

## 0.12.1 — 2026-08-29

### Fixed

- **Picking an option no longer draws a focus ring around it.** The option row
  rang on `:focus-within`, and a mouse click focuses a button — so choosing one
  outlined it, which is the exact thing `:focus-visible` exists to avoid.
  Measured: after a real click, `:focus-visible` was `false` and
  `:focus-within` `true`, with a 2px outline computed.

  `:focus-within` was there for the "something else" row, which is a label
  around an input and so has no `:focus-visible` of its own. It is scoped to
  that row now. A keyboard still rings every row, and the row still lights up
  when its input is focused.

## 0.12.0 — 2026-08-29

### Added

- **`<Tool>`.** One tool call: what was run, what with, what came back, and
  which of four states it is in — queued, running, done, failed. Shut by
  default, because most of the time nobody cares.

  **It opens itself when it failed**, since an error nobody can see has not
  been reported. Derived from the state rather than forced by an effect, so a
  call that fails later opens while one somebody deliberately shut stays shut —
  reopening a row under a reader's hands to show them something they dismissed
  is not help.

  What it was given decides how it is drawn. A string is text: wrapping
  `"Belgrade, 24°C"` in a fence puts it in quotes with its newlines spelled
  out, which is worse than reading it. An object is JSON, in a `CodeBlock` with
  its copy button, which is most of why anybody opens the row. An element is
  somebody having decided for themselves, so it is left alone. A value JSON
  cannot hold prints something unhelpful rather than throwing.

  The state is not carried by colour: the glyph changes shape, and the row says
  which state it is in in words that only a screen reader hears.

- **`--ick-danger`.** The first hue past ink, paper and the marker. The marker
  already means "this one", so a failed call wearing the accent for choice
  would say the wrong thing. A channel triplet like the rest, lifted in the
  dark, where the light red was nearly black on a near-black page.

### Changed

- **`--ick-tool-code-fill`** points a fenced value inside a tool row at paper
  rather than at the sunken surface the row itself uses — otherwise the two are
  one grey with a hairline through them. Lighter than the row in the light,
  darker in the dark; different in both, which is the requirement.

## 0.11.1 — 2026-08-29

### Fixed

- **Every badge in a question sits on one vertical line.** The number over a
  question was 12px from the card's edge and the a/b/c beside its rows were
  16, so the two did not line up. The rows already answered and the ones still
  to come were at 12 as well. All four are at 16 now.

- **A field row's focus edge stopped taking up room.** It was a 1px border,
  and a border is part of the box — which put every field row's badge a pixel
  to the right of every option row's. It is an inset shadow now: the same
  edge, drawn in no space.

  A test does the sum the browser does — jsdom lays nothing out — and fails if
  any of the four rules drifts again.

### Changed

- **A question still to come shows its number rather than an asterisk.** It is
  question three whether or not anybody has reached it, and saying so is what
  makes the list read as a list. White, since an upcoming row has no card
  under it: the badge is what stands off the group's own surface.

## 0.11.0 — 2026-08-29

### Added

- **The parts a question is built from are public.** `QuestionShell`,
  `QuestionOptionRow`, `QuestionFieldRow`, `QuestionOtherRow` and
  `QuestionBadge`.

  The kit ships three question shapes, and three is not all of them. A fourth —
  pick one *and* say something, say — is now a composition rather than a fork,
  and it arrives already wearing the same tokens, focus behaviour and ARIA as
  the three that ship. Exporting the rows without the shell would have been
  half of it: the box, the header and the footer would still have been
  hand-rolled out of numbers that were tokens ten minutes earlier.

  Being public API changed them. Each takes a `className` that is added to its
  own rather than replacing it, spreads the rest of its props onto the element
  it ends in, and forwards its ref to the thing worth having one for — the
  input, in the two rows that have one. `letter` is optional everywhere. And
  they are named for what they are from outside rather than for where they sat
  inside the card.

  `QuestionShell` paints the card by default, since a shell standing on its own
  is the reason it is exported. `QuestionCard` passes `card={false}` — the box
  that morphs between the three states is its own, and two would nest. The card
  is now built out of the shell rather than repeating it, so the shipped
  component is the proof the exported one works.

### Fixed

- **Two field rows with the same label no longer share an id.** The input's id
  was built out of the letter and the label, which is unique inside one card
  and not across two — and two inputs holding one id means the second row's
  label focuses the first row's input. It is `useId()` now, and an `id` of your
  own still wins.

- **The option row's tap no longer scales under reduced motion.** A 1% squash,
  but it was the one animation in the question rows that was not asking.

## 0.10.1 — 2026-08-29

### Fixed

- **A question card was clipping its own contents.** `.active` had padding and
  a 100% width but no `box-sizing`, so the padding was added *outside* the
  width and every option row and the Next button lost 16px to the card's
  `overflow: hidden`. Measured: rows 488px wide inside a 488px card, starting
  8px in.

  This package has no global `box-sizing` reset — one written inside a CSS
  module leaks into the host's page — so every box with padding has to say it
  itself. A test now reads the rules and fails if one stops.

- **The card is white.** `--ick-question-card` was `--ick-surface-raised`, a 5%
  mix, which put it within three percent of the ground it sits on: the same
  surface in a slightly different shade rather than a card. It is `--ick-surface`
  now, with the ground moved down to meet it. Dark keeps a raised value, since
  `--ick-surface` there is the page itself and a card painted with it would
  sink into the ground instead of sitting on it.

## 0.10.0 — 2026-08-29

### Added

- **`<QuestionCard>`, `<QuestionGroup>` and `<Chip>`.** A structured question
  inside a conversation — the assistant asks something with a shape to it, and
  the answer is picked or typed rather than written out. Three question shapes
  (`inputs`, `single`, `multi`), three card states that morph between each
  other, and a group that folds to one summary row once it is done with.

  Brought across from another project and rebuilt on this kit's tokens, type
  and buttons. The accent doing the work is the marker yellow, on the badge of
  whatever is chosen and on the border of the field being typed into.

  Two behaviours kept because they were right: a single-select waits a beat
  before committing, or the card is gone before anyone sees what they picked;
  and the "something else" row is a `<label>`, not a button, because an input
  inside a button is not reliably focusable.

  Two changed. The collapsed row is one `<button>` naming what it does rather
  than a click handler on a `<div>` with another button inside it — clickable
  but not reachable by keyboard, and two tab stops for one action. And the
  letter badges are `aria-hidden`: the letter is a visual index, and in the
  tree it turns a field called "Their name" into "a Their name".

- **Question and chip tokens.** `--ick-question-*` for the three stacked
  surfaces, `--ick-badge-*`, `--ick-chip-*`.

## 0.9.0 — 2026-08-29

### Added

- **`<EmptyState>`.** What is on screen before anybody has asked: an icon, a
  title, a description and a row of openers, each optional and none drawn in
  place of what is left out. Openers need an `onSuggestion` — a chip that
  reports nowhere is a button that does nothing.

  `title` renders as text rather than a heading. It sits inside a conversation
  the host already owns, and claiming a level in their document is not ours.

- **`<Loader>`.** `dots` for the gap between sending and the first word,
  `shimmer` for words standing in for something.

  Silent by default: `useChatTurns` already announces that a response is
  coming, and a second live region means hearing it twice. `label` opts in.

- **`ChatTurnRow` shows the loader** between the question being sent and the
  first word landing. A sent question with a blank space under it reads as
  nothing having happened.

- **Two tokens**, `--ick-loader-dot` and `--ick-empty-pad`.

## 0.8.0 — 2026-08-29

### Added

- **`<AnswerActions>`.** Copy, regenerate and a verdict, under a settled
  answer. The input has had a hover row since the beginning and the answer had
  nothing, which is backwards — the answer is the part worth keeping.

  Only what has somewhere to report is drawn. A control that calls nothing
  looks like a feature and behaves like a dead end. Pressing the verdict
  already given reports `null`, which is how somebody takes it back.

  Copy confirms and announces itself, for the same reason the code block's
  does: a tick is a picture, and a reader who cannot see it is told nothing
  happened.

  `reveal` makes the row invisible until hovered or focused — invisible, not
  absent: it keeps its space so nothing shifts, still hit-tests at zero
  opacity, and `:focus-within` brings it back for anyone arriving by keyboard.

- **`ChatTurnRow` renders it**, with `onRegenerate`, `onFeedback`, `feedback`
  and `answerActions`. They appear when the answer settles rather than while it
  arrives.

## 0.7.1 — 2026-08-28

### Added

- **`<Conversation anchorId>` and `anchorOffset`.** Hold an element at the top
  of the view instead of following the end of the content.

  0.7.0 only did the second, which is wrong for the way this kit works: a
  submitted message has to go to the top and stay there while the answer
  arrives underneath, so what is on screen is the question and its answer.
  Following the end stacks everything downwards instead, and the composer that
  appears when the answer settles ends up past the fold.

  Point it at the turn that was just sent. It needs room to scroll into — an
  element cannot be brought to the top of a container that ends just below it —
  which is what a large bottom padding on the viewport is for.

  With an anchor above the reader, scrolling *up* is how they return to it, so
  letting go is decided by distance rather than direction.

## 0.7.0 — 2026-08-28

### Added

- **`<Conversation>`.** The scroll container: it keeps up with an answer as it
  arrives, lets go the instant the reader scrolls away, and offers a button
  back. Three tokens for the gap and padding.

  It follows the **end of the content**, not the bottom of the container.
  Those are only the same thing when nothing is padded below, and this kit's
  demo carries a screen-height pad so a turn can be pulled to the top —
  scrolling to the bottom there parks the answer above the fold in front of a
  blank screen. Measuring the content makes one behaviour right for both.

  It reads intent from the **input** rather than the scroll event. A component
  watching scrolling cannot tell its own from the reader's, and ends up either
  dragging them back down mid-sentence or never following at all. A wheel
  upwards, `PageUp`, `Home`, or a drag away from the end, and it stops.

  `ref` is forwarded to the viewport rather than the root, because a ref here
  is for scrolling and the root does not scroll. `viewportClassName` styles the
  scroller; `className` styles the box you lay out.

## 0.6.0 — 2026-08-28

### Added

- **`<CodeBlock>`.** The language, a copy button that confirms and announces
  itself, and code that scrolls sideways rather than widening the answer. The
  markdown renderer uses it for every fence; it is exported for use on its own.

  Ten languages, chosen and measured: `lowlight/common` is 37 grammars and
  51.6 KB gzipped — nearly the size of everything else here — for languages a
  chat will almost never show. These cost a quarter of that. A language outside
  the list renders unhighlighted rather than throwing.

  The scheme is ink at four weights rather than a syntax palette, because this
  kit is ink, paper and one acid yellow. Six tokens make it a palette for
  anyone who wants one.

- **Code tokens.** `--ick-code-size`, `-leading`, `-comment`, `-keyword`,
  `-string`, `-number`, `-name`, `-attr`, `-addition`, `-deletion`.

### Fixed

- **A code block keeps its own font.** `pre` and `code` are two of the elements
  a host app or docs tool styles without thinking about it, and an inherited
  family loses to any direct declaration — so the family is stated on the
  elements themselves. Ligatures are off with it: `--ick-font-mono` is a token,
  and a brand setting Fira Code would otherwise get `npm run dev -- --port`
  drawn as `dev —— ——port` while the clipboard hands over the real characters.

### Dependencies

- `lowlight` and ten `highlight.js` grammars. 56.6 KB → 81.6 KB gzip.

## 0.5.1 — 2026-08-28

### Fixed

- **`<ChatHeader variant="bordered">` is opaque.** It was transparent with a
  hairline under it, so a sticky header had the conversation scrolling visibly
  through its own title. It now sits on `--ick-surface`, which is also what
  separates it from `glass`: a panel with a line under it, rather than a
  frosted pane.

  Found by fixing the Storybook story rather than the component. The three
  materials were being shown on a blank page with nothing under them, where
  all three look identical — so the story now scrolls real content beneath a
  sticky header, and the bug was in the first frame of it.

  Three tests read the rules out of the stylesheet, since jsdom does not paint
  and this is the kind of thing that comes back once nobody is looking.

## 0.5.0 — 2026-08-28

### Breaking

- **`TextHighlighter` renders its text as markdown.** An answer containing
  `*`, `#`, `` ` `` or `-` at the start of a line now renders as emphasis, a
  heading, code or a list rather than as those characters. If you were passing
  markdown and relying on it staying literal, escape it.

  Raw HTML in the input is dropped rather than rendered. Model output is
  untrusted text, and there is no version of injecting it into the host's page
  that is worth the surface it opens.

### Added

- **Markdown, inside the highlighter rather than around it.** Headings,
  emphasis, strikethrough, links, inline and fenced code, lists, blockquotes,
  tables, images and rules.

  The design constraint was the marker. Internally the words stay a **flat
  array of tokens addressed by index** — hit-testing reads an index off the
  span under the pointer, the keyboard cursor walks the indices, a highlight's
  text is a run of them joined back. Markdown only decides which element each
  token is drawn inside, so a stroke that starts in plain text and ends inside
  `**bold**` is one run of indices like any other.

  Fenced blocks are the exception: preformatted, so not tokenised, so not
  markable. `CodeBlock` will own them properly.

- **Markdown tokens.** `--ick-md-gap`, `-item-gap`, `-heading-space`,
  `-indent`, `-quote-indent`, `-rule` and `-code-fill`. The gaps are in `em`
  so they scale with the answer rather than drifting away from it.

### Dependencies

- `unified`, `remark-parse` and `remark-gfm`, bundled rather than left to the
  consumer. The package went from 18.9 KB to 56.6 KB gzip; that is the price
  of markdown working on install with nothing to configure.

  `react-markdown` was the obvious choice and is not used. Its feature is
  swapping *components*, and what this needs is every **text node** split into
  indexed spans — text nodes are strings, not components. It also parses
  inside its own render, which hands back the tokens a render too late for the
  keyboard cursor that needs them.

## 0.4.0 — 2026-08-27

Additive.

### Added

- **`<ChatTurnRow>`.** One turn: the question as a composer that has become a
  bubble, and the answer under it. It existed all along in the playground,
  which meant anyone installing the package had to rewrite the one thing the
  package is about — the README could only tell them to, and explain the memo
  they would need.

  Not named `Message`. The user half is a live input that morphs into its own
  bubble, not a rendered record of what was typed, and that is the whole idea.

  Memoised, and the memo is load-bearing: `useChatTurns` leaves untouched turns
  referentially identical, which only pays off if the rows act on it. Every
  callback takes the turn's id rather than being closed over per row, so a
  consumer can hoist them and not hand the memo a new prop each render.

- **Turn tokens.** `--ick-turn-gap`, and `--ick-answer-size` / `-leading` /
  `-tracking` / `-measure` for the answer. The measure is in `ch` rather than
  pixels, so a comfortable line length follows whatever font a brand sets.

## 0.3.0 — 2026-08-27

Additive. Nothing in 0.2.0 changes behaviour.

### Added

- **`<ChatHeader>`.** The chrome above a conversation: title, subtitle, avatar,
  back, and a row of actions. Three materials (`plain`, `glass`, `bordered`),
  three sizes (40 / 48 / 56px), and a centred arrangement for the native/mobile
  pattern.

  Actions are described rather than passed as children:

  ```tsx
  actions={[{ id: "share", label: "Share", icon: <Share2 size={16} />, onClick: share }]}
  ```

  which is what lets `collapseActionsAt` fold them into a keyboard-navigable
  overflow menu when the header is narrow — a header cannot summarise children
  it cannot read. Anything with no icon-and-label shape goes in as `children`
  and stays put.

  `label` is required, and a `count` is folded into it: the badge on the glyph
  is `aria-hidden`, so without that a reader would never learn the number.

- **Header tokens.** `--ick-header-*` for height, padding, gap, backdrop, blur,
  border, title, subtitle and the count badge — twelve, plus one that restates
  the backdrop for the dark theme, where a lighter wash still shows the text
  scrolling underneath.

## 0.2.0 — 2026-08-26

The package became something other people can install: it has tests, it can be
themed, and it can be used without a mouse.

### Breaking

- **`ReplyThreadPopup` requires `onSendMessage`.** It used to be optional, and
  without it the component streamed placeholder copy about the Higgs boson —
  shipped to every consumer. A component has no answers of its own; that is the
  host app's job.
  ```tsx
  <ReplyThreadPopup
    onSendMessage={(message, quotedText, { signal }) => callYourApi(message, quotedText, signal)}
    …
  />
  ```
- **`ChatInput` has no `variant` prop.** There were four; three had no call
  sites. Remove the prop.
- **Components read `--ick-` custom properties.** The old unprefixed names
  (`--ink`, `--surface-hover`, `--font-geist-sans`, …) still resolve, as
  aliases, but they will go. A host that loads its own fonts should say so:
  ```css
  :root {
    --ick-font-sans: var(--font-geist-sans);
    --ick-font-mono: var(--font-geist-mono);
  }
  ```
- **The kit now responds to a `.dark` class or `data-theme="dark"` on the root
  element,** and to `prefers-color-scheme` when neither is set. An app that
  already uses `.dark` for its own theme will find the kit following it. Pin it
  with `data-theme="light"` if that is not wanted.
- `GlassButton` is deprecated in favour of `<Button variant="glass">`. It still
  works and renders identically — the wrapper translates the old size names.

### Added

- `useChatTurns` — turn state, streaming and the reveal, in one hook. Takes an
  `onSend` returning a string, a promise or an async iterable, and hands back
  an `AbortSignal`.
- A design token layer: three tiers, all prefixed `--ick-`, with a dark theme.
  See [theming.md](./theming.md).
- Dark mode, following `prefers-color-scheme` unless told otherwise.
- Keyboard operation throughout — a word cursor for making highlights, reachable
  controls for the ones already made, an escapable menu, and a real dialog.
- Screen-reader announcements when an answer arrives, and `prefers-reduced-motion`
  honoured across the kit.
- `announce()` — the shared live region, exported so a host can speak its own
  errors into it rather than adding a competing one.

### Fixed

- **A finger could not scroll past an answer.** `touch-action: none` on every
  paragraph made the conversation a dead zone on a phone. Related: a scroll the
  browser took over was committed as a highlight, leaving a marker behind on
  whatever word the finger landed on.
- **The package was styling the host's document.** `ReplyThreadPopup` rendered
  a `<style>` element with an unscoped `div::-webkit-scrollbar` rule, which hid
  the scrollbar on every div on the page for as long as a thread was open.
- **`GlassButton` had no accessible name while loading.** The label was hidden
  with `visibility: hidden`, which removes it from the accessibility tree, and
  the spinner is `aria-hidden` — so it announced as a button called nothing.
- `ChatInput` left a timer running past unmount.
- Three performance passes, each measured: pointer crossings over a highlight
  went from ~28 DOM mutations to 0, opening the menu from 407 to 67, and
  streaming an answer stopped touching the turns above it at all (366 to 0).

### Internal

- 167 tests and CI: lint, tests, build, a Storybook build and a dry-run pack.
- Storybook, with a token table read live from the stylesheets.
- Two guards that fail rather than rely on memory: one when a component is
  exported without a story, one when a literal colour appears outside the token
  file.

## 0.1.0

Extracted from the website into a package.
