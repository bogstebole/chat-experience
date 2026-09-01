# Changelog

Dates are the day the work landed on `main`.

The versions before 1.0 follow the pre-release convention: **a breaking change
or new public API bumps the minor**, and the patch is for fixes. Anything that would break an
existing install is called out under **Breaking**, with what to do about it.

## 0.43.0 — 2026-09-01

### Removed

- **The shield.** It said "this is about permission" in a picture, beside a
  title that says it in words, above a card showing the thing and three buttons
  that are visibly a decision. Every other glyph in the kit carries *state* —
  queued, running, failed, allowed, denied — and pairs with a word for anybody
  the picture is not reaching. This one carried a category nothing else could be
  mistaken for.

  It was also drawn at **24 against everything else's 14**: `.glyph` set the
  badge's width and height on the icon itself rather than on a box around it,
  so the `size={15}` in the component was never what the browser used. Which is
  how it came up at all — it looked too big, and the answer to "how big should
  it be" turned out to be that it should not be there.

  `--ick-approval-glyph` goes with it, and the title now starts on the column
  directly rather than after a badge slot.

### Changed

- **The approval draws the card; the subject brings what goes in it.** A tool
  call inside one brings no surfaces of its own — not its ground, not its card,
  not its shadow.

  This is the third arrangement and the reason is worth writing down. The
  approval's card wrapping all three (title, subject, buttons) made an approval
  holding a tool call two papers for one thing. Letting the tool bring its own
  card instead left its header stranded on the ground beside the title — two
  headers over one card, and the second of them a stray row. One card, holding
  everything that belongs to the subject.

  `.subject` takes no padding, deliberately: what is inside is padded to the
  column already, so a gap there would push all of it eight pixels off the line
  the title and the buttons stand on. Measured: title, tool glyph and overview
  all at 48; chevron and the primary button both ending at 504.

## 0.42.0 — 2026-09-01

### Changed

- **`<Approval>` asks above the card and answers below it.** The title and the
  buttons are on the ground; the card between them is the subject. They are not
  part of the thing being approved — they are the asking and the answering.

  The card is gone with them, because the subject already brings one. An
  approval holding a tool call was a card inside a card: two papers, two
  shadows, one thing. That is also why the tool no longer has to be flattened
  into a row on it — an approval sets `--ick-tool-ground: transparent` and
  nothing else, so a tool call inside one is a tool call.

- **Everything lines up on the subject's own column.** The shield where the
  tool's glyph is, the buttons ending where its panels end. Measured: shield
  box, tool glyph and overview text all at 48, chevron and the primary button
  both ending at 504, against a card at [32, 520].

- **Deny is pulled back by its own padding.** A ghost button is *text* — what
  you see is the word, not the invisible box around it — and the word sat 16px
  inside the line the shield above it is on. The two that say yes are the other
  way round: filled, so the box is the visible thing and its edge is what lines
  up. A guard ties the pull-back to `Button`'s own padding rather than to a
  number that happens to look right.

### Added

- **`--ick-nest-column`**, the column a card's content starts in, stated once.
  Three components have to agree on it now — a question's rows, a tool call's
  panels, and an approval's title and buttons standing over one — so
  `--ick-question-pad`, `--ick-tool-pad` and `--ick-approval-column` all read
  it rather than three numbers happening to match.
- An approval repoints `--ick-code-pad` to that column, so a subject that is a
  bare code block lands on it too. Its own 12 would have sat four pixels inside.

### Removed

- **The approval's own `.card`.** With it goes the nesting row that checked its
  corner, and the guards that required a tool call inside one to be a row: both
  described the arrangement that caused the doubled paper.

## 0.41.0 — 2026-09-01

### Changed

- **`<Tool>` is a question group's shape now: a header on the ground, a card
  under it.** The header was the card's own top edge, which meant it had to
  move whenever the card grew, and — the reason it was raised — that everything
  in it was measured against the **card's edges**. That is what put the chevron
  hard into the corner with nothing beneath it to agree with.

  On the ground it takes `--ick-disclosure-inset`, so the glyph starts on the
  column the card's panels start on and the chevron ends where they end.
  Measured: glyph left 48 and chevron right 504, against a card at [32, 520] —
  16 in from each edge, the same column a question card uses.

- **The card says something when it is shut.** One row — the call's summary, or
  the state in words when it has no summary — padded to the card's column and
  40 tall, which is a folded question group's row exactly, so a stack of the
  two lines up.

  It stays when the call opens, and that is a deliberate difference from the
  question group. There the two bodies swap, and because both are anchored to
  the same top edge they want the same band and cannot be crossfaded without
  drawing one over the other. Here nothing swaps: the summary is the card's
  first row in both states and the detail opens underneath it. Same shape, one
  fewer thing to go wrong.

- **No hover wash on a tool's header**, for the reason a question group has
  none: the wash is a rounded box the width of the header, and on a ground
  there is nothing under it for that shape to agree with.

### Removed

- **`DisclosureHeader`'s `filled` variant.** `<Tool>` was its only consumer, so
  moving the header onto the ground left the prop, two CSS rules and a guard
  that "guarded" a variant nothing rendered. The guard now makes the same
  claim — a tool shut is a folded question's row — against the row that
  actually draws it.

### Added

- `--ick-tool-pad`, the column a tool card's content starts in, the same job
  and the same number as `--ick-question-pad`. A guard computes it from how the
  card actually reaches that column — its own padding plus a panel's — so if
  either moves this fails rather than quietly meaning something else, and
  requires it to equal the question card's. One rule, not two that agree.

## 0.40.0 — 2026-09-01

### Fixed

- **The two bodies are never drawn over each other.** Recorded and looked at
  frame by frame, what read as a flicker was a superimposition: the folded row
  and the first card are anchored to the same top edge, so they always want the
  same 40px band, and crossfading them put

  ```
  3 answers   About them · Household · Support needed
  1  About them        Milica Stevanović  84  +1
  ```

  on top of each other at half opacity each. No timing fixes that, because the
  overlap **is** the crossfade — a dissolve between two different sentences is
  mush whatever its duration.

  The arriving body waits for the leaving one to be gone. Measured across both
  directions: the two never carry ink at the same time. What carries the eye
  across the handover is the box, which is growing throughout — so the pause
  costs nothing, and there is no bare frame at real speed.

### Added

- **`FoldMotion.fadeInDelay`**, back with a job this time: it is what holds the
  two bodies apart, not a stylistic pause. `fadeOut` is 0.08 and the delay
  matches it. A guard requires `fadeInDelay >= fadeOut`.

### Changed

- **`FoldingSlowly` scales every number measured in seconds**, derived from
  `defaultFoldMotion` rather than listed by hand. Listing them is how the story
  started lying: it scaled the two fades and not the delay between them, so it
  showed a long crossfade the component does not do. A slowed-down story that
  shows something else is worse than none, because it is the one you trust to
  see the detail — and it disagreed with the instrumented measurement, which is
  how it was caught.

- Two fold guards match loosely on the source instead of pinning the exact
  spelling of a call. Both broke on a refactor that changed nothing about the
  behaviour, which is a guard failing on a rename while it would pass on a
  wrong number. The number they were standing in for is asserted directly now.

## 0.39.0 — 2026-09-01

### Changed

- **Collapsing is expanding run backwards.** A row leaving was a plain tween
  while a row arriving was sprung, and the two bodies staggered in opposite
  directions — last out, first in. The reverse is right when something is being
  *dismissed*, because it unwinds the way it was built; this is not a
  dismissal, it is one body replaced by another on the same edge, holding the
  same answers. One spring builder now serves both states, and both stagger
  forwards.

  Sampled frame by frame in both directions: the first row leads either way,
  and `y` runs 0 → -10 on the way out exactly as it runs -10 → 0 on the way in.

- **`rowBounce` is 0.12**, down a third from 0.18. Measured, `y` no longer
  passes its target at all on the way in — it settles rather than arriving and
  correcting.

## 0.38.4 — 2026-08-31

### Fixed

- **Text beside a badge takes the badge's line box.** A badge is 24 tall with
  `line-height: 1`; text beside it inherited whatever line height its type
  gave it, and two line boxes of different heights, both centred in the same
  row, land half a pixel apart. Measured with a `Range` over the text itself,
  the folded group's summary sat at 86.5 against the count's 87.

  `.title` and `.optionTitle` had the rule already — the line box takes the
  badge's height rather than the badge taking a margin, because a margin is a
  guess that has to be re-guessed whenever the type changes. `.summaryList`,
  `.collapsedTitle` and `.upcomingLabel` take it now too, and a guard walks all
  five.

  Only `.summaryList` moved: the card's own rows were already baseline-aligned,
  the badge and the title simply being different type sizes. The rule is stated
  on all of them so the next one does not have to be found by eye.

## 0.38.3 — 2026-08-31

### Fixed

- **A folding row gets a compositor layer while it moves, and gives it back.**
  Motion animates `y` as an independent transform, and an independent transform
  does not promote the element on its own — sampled through a whole fold, every
  row read `will-change: auto`. Motion's own guidance is to name the properties
  being animated and then take the hint away again, since a permanent hint is a
  permanent layer. `[data-moving]` on the ground is on for the length of one
  fold: measured, the layers exist from the click to about 460ms and are gone
  by 500.

  The taking-away needed care. Both bodies report completion and the leaving
  one finishes first, so clearing on the first report took the layers back at
  165ms with the rows still travelling until 300. It clears on the *arriving*
  body now.

### Changed

- The stylesheet guards look up a rule by its selector at the start of a line.
  A plain substring found `.summary` inside `.group[data-moving] .summary` and
  read a `will-change` rule when it wanted the padding one.

## 0.38.2 — 2026-08-31

### Fixed

- **Every badge in a question card is one size.** `--ick-chip-height` was 22
  against the badge's 24 — measured across every state the card has, the chip
  was the only box in it that was not 24, two pixels shorter than the numbered
  badge at the other end of its own row. It points at `--ick-badge-size` now,
  so a host that resizes one resizes both.

## 0.38.1 — 2026-08-31

### Fixed

- **An answer chip corners like the badge beside it.** New `--ick-chip-radius`,
  pointed at `--ick-nest-inner` — the chain's innermost corner, the one a badge
  already takes. They sit in the same row, the number at one end and the answer
  at the other, and a fully round pill beside an 8px badge is two shapes for one
  level of the nesting. `--ick-radius-pill` still means pill; buttons and the
  composer are what want one.

## 0.38.0 — 2026-08-31

### Changed

- **The fold's bodies arrive on springs, one row at a time.** 0.37.0 fixed the
  distortion and left the swap itself a crossfade — two blocks dissolving
  through each other. A dissolve is what you reach for when two things are
  unrelated, and the summary row and the stack of cards are the same answers in
  two states. It read as the box moving while the content sat there bleeding
  through itself.

  Rows now enter a little above their place and settle into it, one after the
  next, and leave the same way; the ground follows them. Both sides of the fold
  are lists of rows, even the folded side that holds one, so both arrive by the
  same rule.

- **Springs for what travels, a tween for opacity.** Not a preference. A spring
  describes where a thing is going and how it arrives, and opacity has nowhere
  to go — bounded at 0 and 1, so a spring with any bounce overshoots into a
  clamp and spends the overshoot sitting still. Position and size have no
  ceiling, which is what makes them worth springing.

### Breaking

- **`FoldMotion` lost `fadeInDelay` and gained four.** `rowDuration`,
  `rowBounce`, `rowOffset` and `stagger` describe a row arriving; the delay is
  gone because the stagger is what sequences them now. `visualDuration`,
  `bounce`, `fadeIn` and `fadeOut` are unchanged in meaning.

  Passing the old shape still type-checks for every key it kept and the rest
  fall back to `defaultFoldMotion`, so nothing breaks silently — a `fadeInDelay`
  in an override is simply ignored.

### Fixed

- **`package.json` was published empty in 0.37.0.** A `open(path, "w")` in the
  script that bumped the version truncated the file before the read that was
  supposed to fill it. Restored from 0.36.1 with the version applied.

## 0.37.0 — 2026-08-31

### Fixed

- **The question group's fold no longer distorts everything inside it.** Motion
  animates a size the only way it can: it puts the new one in the DOM and
  scales the box back. Everything in that box that is not itself a layout child
  rides the scale — and the section title was a plain `<div>`. Sampled frame by
  frame over one open: the header went from 23px to **11.67 in a single frame**
  and stretched back over the next 450ms, the title with it, the cards too.
  The header wrapper and the body are `layout="position"` now, on the ground's
  own transition, and the header measures a flat 23 through the whole thing.

- **The leaving body stays where it was.** `AnimatePresence mode="popLayout"`
  makes it `position: absolute`, and with no positioned parent it resolved
  **67px down the page** and faded out somewhere it had never been. The body is
  `position: relative`.

- **And it stays inside the ground.** While the ground shrank, the popped-out
  list stayed pinned at full height and hung three rows out of the bottom over
  whatever was underneath. The ground clips; its own 16 of padding is more than
  the float shadow reaches, so card shadows are unaffected.

- **The fold is a crossfade, not a relay.** The arriving body waited 100ms for
  the leaving one — a tenth of a second of grown, empty box, which is most of
  what read as the flicker. Measured at the midpoint, the two now sum to about
  0.9 of an opaque body; they summed to 0.4.

### Added

- **`defaultFoldMotion` and a `foldMotion` prop** on `<QuestionGroup>`, passed
  through `<ChatTurnRow>`. Five numbers: `visualDuration` and `bounce` for the
  box, and `fadeIn` / `fadeInDelay` / `fadeOut` for the bodies.

  `visualDuration` rather than stiffness and damping on purpose. The two of
  them describe the same spring without either one answering "how long is
  this", which is the only question anybody tuning it is asking.

- **A `FoldingSlowly` story**, the same fold at a quarter speed — because
  everything that goes wrong in it goes wrong in about eighty milliseconds.
- `src/__tests__/foldMotion.test.ts` — the four rules above, each verified to
  fail by putting the fault back.

## 0.36.1 — 2026-08-31

### Fixed

- **The count on a folded question group is a badge.** It stands in the badge
  column, on a card, one fold away from the numbered badges it stands in for —
  and it was a pill: 2px of padding, the smallest type in the kit and the
  ground's fill, which came out about half their height. Same box now, and only
  the width differs, because this one holds words rather than a numeral.

## 0.36.0 — 2026-08-31

### Changed

- **The dark theme's ground goes down now.** `--ick-ground` is a wash of ink,
  and ink in the dark is white — so the recess a group of cards sits in came
  out *lighter* than the page, with the card lighter again. Three surfaces
  stacked on the same side of the page, and a card that read as a slightly
  different patch of its own ground.

  It never showed up as a number, because the number was fine: ground to card
  measured 1.11 in the light and 1.115 in the dark, which is as matched as two
  themes get. What the light has and the dark cannot is the shadow. A dark
  shadow on a white ground is plainly visible and does half the work of lifting
  a card; the same shadow on a near-black ground does almost nothing. So in the
  dark the tone has to carry both jobs, and 1.11 is one job's worth.

  New `--ick-dark-ground`, a shade rather than a wash of ink, which puts the
  ground at 10 against the card's 38 and the pair at 1.32. Every ground in the
  kit reads it — question groups, tool calls, approvals.

- **A section title stands on the column its cards' words start on.** It was
  sixteen pixels left of the numbers under it, and its chevron four pixels off
  the pencils. New `--ick-disclosure-inset` moves a header's own content inward
  from both ends at once; `<QuestionGroup>` sets it to `--ick-question-pad`.

- **A disclosure header's box is its container's content column**, widened by
  its own padding so only the hover wash reaches past it. It was `width: 100%`
  pulled back on the left alone, which left the chevron six pixels shy of an
  edge every other row in the kit sits on. Affects every header that folds —
  `<Tool>`, `<Reasoning>`, `<ChainOfThought>`, `<TaskList>`, `<Sources>`.

- **A question's folded rows are padded to the same column on both sides.** The
  right was 8 against the left's 16, so the pencil sat half a column nearer its
  edge than the badge sat to its own. New `--ick-question-pad` names that
  column, and the rows, the summary and the title all read it.

- **No wash under a section title on hover.** It is a rounded box the width of
  the header and there is nothing under it for that shape to agree with, so it
  read as a stray highlight off the card grid. The chevron lights up instead —
  which every header now does, wash or no wash. New `--ick-disclosure-hover`,
  set to `transparent` by `<QuestionGroup>`.

### Added

- `src/__tests__/alignment.test.ts` — the columns, with the browser's own
  arithmetic done on them rather than a check that particular tokens were
  spelled a particular way. Two rows can reach the same column through
  different tokens and both be right.
- A surfaces guard that composites the dark ground over the page, takes its
  contrast against the card, and requires more of it than the light theme has —
  because the light theme has a shadow helping and the dark does not.

## 0.35.0 — 2026-08-31

### Added

- **`<QuestionGroup>` takes a `title`** — what the step is about, at the top of
  the group — and `TurnPart` of kind `question` carries it through.

### Changed

- **The fold control is that header, and it does not move.** It was the summary
  card itself: folded, a card at the top; expanded, a row at the bottom. One
  control in two places, so opening the group meant one shape leaving and
  another arriving somewhere else, and both directions read badly however the
  animation was tuned.

  A header that stays put turns the whole thing into one control with two
  bodies — the questions, or the one row they fold into. Which is also the
  shape `<Tool>`, `<TaskList>` and `<Sources>` already fold in, so the kit has
  one folding idiom rather than two.

  Without a title, a foldable group names its control with the count. Without
  either, there is no header and the group is the list, as before.

### Removed

- `labels.hide` on `<QuestionGroup>`. It worded a pill that no longer exists —
  the header carries the section's name in both states, so there is nothing
  left to word.

## 0.34.0 — 2026-08-31

### Fixed

- **Shadows are dark in the dark.** `--ick-shadow-1`, `-2`, `-3` and `-inset`
  are built on `--ick-ink-rgb`, which is near-black in the light and
  `245 245 245` in the dark — so every `primary` and `secondary` button was
  casting a **white glow**. Measured: the outer layer of `shadow-2` lifted the
  page from 18 to 40, brighter than the card it sat on.

  Four `--ick-dark-shadow-*` counterparts, made of the shade, which is black in
  both themes. The light values are untouched. A test now says every ink-based
  shadow needs a dark counterpart and every dark one is made of the shade — it
  found `-3` on its first run, which nothing in the kit draws with and which
  would have been wrong the day somebody reached for it.

- **`<QuestionGroup>` folds with one control instead of two.** It had a
  full-width card when folded and a centred pill underneath the list when
  expanded — two shapes for one job, so the fold cross-faded a button through a
  div and neither knew where the other had been.

  The same element now, kept mounted in both states, so Motion moves it rather
  than replacing it. Label left, chevron hard right, and the chevron **turns**
  rather than being swapped for a second glyph.

- **The chevron had no gap.** It was passed as a child, so it landed inside the
  button's label span rather than in the trailing icon slot — "Hide answers⌃"
  with the caret against the word. There is no `<Button>` there at all now, but
  the same mistake is worth naming: `iconRight` is the slot.

## 0.33.2 — 2026-08-31

### Fixed

- **A badge sits in the middle of the line it belongs to.** The badge is 24
  tall and a title line was 16, both top-aligned — which put the number **four
  pixels** below the middle of the question, and a letter **two** below the
  middle of its option. Measured in a browser; at four pixels it reads as wrong
  long before anybody can name it.

  The text's line box takes the badge's height, so the two centre together and
  stay centred if the type changes — rather than a margin on the badge, which
  is a number that has to be re-guessed every time either side moves. Field
  rows were the only ones already right, because `.fieldLabel` had been doing
  exactly this all along.

  On the first line, deliberately: a question long enough to wrap keeps its
  badge on the line it starts on.

- **The corner stops breathing during a morph.** A `layout` animation does not
  resize a box, it **scales** one — and a browser scaling a box scales the
  corner with it. Measured on a group opening a card: `scaleY` ran 0.932 → 1
  while `border-radius` stayed a flat 40px, painting a 40 × 37 ellipse that
  eased back to a circle.

  Motion has a corrector for this and it was not running: it only touches
  values Motion is *managing*, and a radius living in a CSS class is invisible
  to it. The number is now read off the element and handed back through
  `style`, where Motion can see it — read rather than hard-coded, since the
  corner is a token a host may retune. Both `<QuestionGroup>` and
  `<QuestionCard>` do it; the card is the one that scales furthest, morphing
  between a tall card and a 40px row.

## 0.33.1 — 2026-08-31

### Fixed

- **The float shadow is softer in the dark.** It was black at 50% and 35% — six
  times the light theme's alpha, on the reasoning that a shadow in the dark has
  to darken something already dark. It overshot: measured on a rendered frame,
  the ground under a card is `26 26 26` and the shadow's core was taking it to
  **13**, half its brightness. That is not a card lifted off a page, it is a
  card cut out of one, and the ring around it was the first thing you saw.

  At 0.28 and 0.18 the core lands at **22** — a four-level dip, the same read
  the light theme gets going 255 → 235. `<Tool>` and `<Approval>` take the same
  token, so all three lift the same way again.

## 0.33.0 — 2026-08-31

### Added

- **`<Branch>`, and regenerating no longer throws the old answer away.**
  Re-submitting a turn overwrote `ai` and `parts` — so the answer you were
  comparing against was gone the moment the second one started, and comparing
  is the only reason anybody presses regenerate.

  - `ChatTurn.versions: TurnVersion[]` and `versionIndex`, both optional, so a
    turn a host built by hand still renders.
  - `useChatTurns` returns **`showVersion(id, index)`**. Out of range is
    ignored rather than clamped: asking for version 7 of a turn with two is a
    bug, and quietly showing the last one hides it.
  - `<ChatTurnRow>` takes `onShowVersion` and draws the control beside the
    answer actions.

  `<Branch>` draws **nothing** below two answers. A control reading "1 of 1"
  offers to take you nowhere, so a turn answered once looks exactly as it did.

  `ai`/`parts` are still the answer on screen and stay equal to
  `versions[versionIndex]` through one function that both writers — the batched
  stream flush and the turn patcher — go through. The first version of this had
  two, and the archive stayed empty while the screen filled.

## 0.32.2 — 2026-08-31

### Fixed

- **A tool call's sections all start on one column.** A fenced value is a
  `CodeBlock` — its own panel, with its own inner padding. A string value was a
  bare stack: no surface, no padding of its own, so its label and its text sat
  flush at the body's 8px while the block's sat 12px inside the block. Two
  sections of one tool call at two left edges.

  A text section is the same panel now, and both read `--ick-code-pad`. `Tool`
  repoints that to 8, so every label, every value and the code itself land
  **16 from the card's edge** — the column the header's glyph is in. It was 20,
  which is the kind of four-pixel near-miss that reads as wrong without being
  nameable.

- **A failed section is that panel tinted, not a second panel inside it.** The
  error box sat inside the section's box, at a third inset again.

### Added

- `--ick-code-pad`, the inner padding of a `<CodeBlock>` — its label's left
  edge and its code's. A box that nests one repoints it, the way it already
  repoints the fill and the corner.

## 0.32.1 — 2026-08-31

### Fixed

- **The composer's attachment section is back.** Making attachments survive
  the send should not have touched how they look, and it did: the tray lost its
  surface and its corner and became a bare padded row. It is a section at the
  top of the composer again — its own paper, its own corner, and transparent
  once the bubble goes glass, which is how it has looked since it held one
  image. The thumbnail keeps its `--ick-radius-md` corner and its lift.

  `--ick-attachment-radius` names that corner so it is a token rather than a
  number somebody has to remember not to change.

## 0.32.0 — 2026-08-31

### Added

- **`<Attachments>`, and attachments that survive the send.** The composer
  could already pick an image and show it. It could not send it: `onSubmit`
  took the text and nothing else, so the message went and the picture did not.
  Offering an attach button and then losing what it attached is worse than not
  offering one.

  - `onSubmit` is `(value, attachments)`.
  - `SendContext` carries `attachments`, so a handler gets the file and the
    sentence together.
  - `ChatTurn.attachments`, and `<ChatTurnRow>` hands them back to the composer
    — the bubble *is* the message, so the same component that held them shows
    them afterwards, read-only.
  - A picture on its own is a message: an empty box with something attached
    still sends.

  `<Attachments>` draws them. An image with a `url` shows itself; everything
  else gets a glyph, its name and its size, because a thumbnail of a PDF at
  64px is a grey rectangle with a corner turned down. `onRemove` is the whole
  difference between the composer's copy and the sent message's.

- **`<ChatInput>` takes `attachments`, `onAttach`, `onRemoveAttachment`,
  `accept` and `multiple`.** Controlled if given, its own otherwise — the rule
  `useDisclosure` already follows. `onAttach` is for a host that wants to
  upload first and attach the URL it gets back.

### Fixed

- **The object URLs are revoked.** `createObjectURL` pins the file in memory
  until it is, and nothing was revoking: attaching and removing an image ten
  times leaked ten of them, replacing one leaked the one it replaced, and
  navigating away with one attached leaked that. Now on remove, on replace, and
  on unmount — and only the ones the composer made, since a URL the host passed
  in is the host's.

## 0.31.1 — 2026-08-31

### Fixed

- **A citation in a sentence takes the width of its number.** It was the same
  16px square the source list uses — right in a list, where the numbers sit in
  a column and have to line up, and wrong in running prose. A single digit is
  about five pixels wide, so five and a half pixels of empty badge sat either
  side of it and whatever followed — a comma, most often — came after that gap
  and read as detached from the number it belongs to.

  Padding in `em` so it tracks the number, and no minimum: what makes it a
  badge is a fill, a corner and the line's height, not a width. The one in the
  list keeps its square.

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
