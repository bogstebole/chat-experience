# Changelog

Dates are the day the work landed on `main`.

The versions before 1.0 follow the pre-release convention: **a breaking change
or new public API bumps the minor**, and the patch is for fixes. Anything that would break an
existing install is called out under **Breaking**, with what to do about it.

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
