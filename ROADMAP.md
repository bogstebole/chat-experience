# Roadmap

What is done, what is being worked on, what is left. Updated as work lands.

`[x]` done and verified · `[~]` in progress · `[ ]` not started

---

## Shipped

### Extraction — the feature became a package
`packages/inline-chat-kit` is the source of truth; the playground and the website
both consume it. One variant of `ChatInput`, not four.

### Performance — three passes, each measured before and after
| interaction | before | after |
|---|---|---|
| pointer crossing a highlight | ~28 DOM mutations | **0** |
| opening the highlight menu | 407 mutations | **67** |
| streaming an answer, cost to earlier turns | 366 mutations | **0** |

The same mistake three times: work that scales with content attached to a
per-element animation engine. Marker hover and the focus effect now run in CSS;
tokens carry no inline styles at rest (pinned by a test).

- [x] `perf/text-highlighter` — hover and focus out of React (`782b4e6`)
- [x] Perf HUD in the playground, plus three fixes to the HUD's own measurements
- [x] `test/foundation` — 68 tests + CI on every push and PR (`fab1c5d`)
- [x] `feat/chat-turns` — `useChatTurns` owns turns, streaming and the reveal (`9a5effb`)
- [x] Canned answers removed from the package; `onSendMessage` is now required
- [x] Bubble text rides the same spring as the bubble (12 → 0 frames outside the box)

---

## Now — accessibility

The component is mouse-only. For a library other people install, this is the
largest remaining gap. Phases are ordered cheapest-and-most-valuable first; each
is independently shippable.

### A1 · Announce answers to screen readers — done
Today an answer arrives with no announcement at all.
- [x] One shared `role="status"` / `aria-live="polite"` region, created lazily
      and written to on a later tick — a region inserted together with its text
      is silent
- [x] Announced **once on settle**, not per character — streaming into a live
      region makes screen readers re-read the whole answer on every frame
- [x] `aria-busy` on the turn while responding (feed and thread popup)
- [x] Spoken strings are overridable, and can be switched off entirely — the
      defaults are English and would otherwise be unusable elsewhere
- [x] 13 tests: region behaviour in the DOM, and call counts from the hook
- [x] Verified in the browser: region present with the full answer, `aria-busy`
      flipping true → absent across a turn, no console errors in a clean tab

### A2 · Honour `prefers-reduced-motion` everywhere — done
Only `TextHighlighter.module.css` respected it.
- [x] `useChatTurns` hands over the whole answer at once — a typewriter is an
      animation
- [x] `MotionConfig reducedMotion="user"` inside each exported component, not
      left to the host app: a host that forgets leaves every reader with the
      full morph. Transforms and layout snap, opacity and colour still fade.
- [x] Playground wraps its root the same way — the pattern a consumer copies
- [x] CSS: `Button` and `GlassButton` transitioned `transform`. Now they name
      their properties, so the fades stay and the movement goes. The spinner
      keeps turning — it is the only sign anything is happening.
- [x] 4 tests, including the other half of the claim: without the preference it
      really does still type
- [x] Browser: morph, streaming and reveal unchanged, no console errors.
      The reduce path itself is proven by the tests — the browser tooling here
      cannot emulate the OS setting.

### A3 · Let the keyboard select text at all — done
`user-select: none` was set permanently in marker mode, so the answer could not
be selected at all — not to highlight it, not even to copy it.
- [x] `user-select` is suppressed only while a marker is actually being drawn.
      The drag prevents its own default instead, so drawing does not drag a
      native selection along behind it.
- [x] A **word cursor**: the paragraph is focusable, left/right move by word,
      shift extends, Enter or Space commits the same highlight a drag makes,
      Escape clears. Up and down are left alone — moving by line would mean
      guessing where the lines break.
- [x] Native selections finished with the keyboard commit too, in both modes
- [x] The three routes to a highlight — drag, native selection, word cursor —
      now share one commit path instead of one each
- [x] `aria-describedby` says what the keys do, once, on focus
- [x] 18 tests
- [x] Browser: tabbed in, arrowed to a word, shift-selected four, pressed
      Enter — marker drawn, paragraph dimmed, menu opened, counter incremented.
      Mouse drawing unaffected, no console errors.

Regression it caused, and its fix: making the paragraph focusable put a
`tabindex` on it, and `CustomCursor` used `[tabindex]` to recognise controls —
so hovering the answer drew an arrow instead of the marker. The two questions
now resolve by proximity: a button inside a marker surface still shows the
arrow, a marker surface that happens to be focusable does not. Pinned by tests
that fail against the old logic.

Two things this deliberately does **not** claim:
- The mouse still draws rather than selects in marker mode. That is the mode's
  purpose; `precise` is the pointer-selection mode.
- Shift+Arrow over plain text needs caret browsing, which almost nobody has
  switched on. That is *why* there is a word cursor — the native path alone
  would have been a checkbox, not a feature.

### A4 · Make existing highlights reachable — done
The SVG `<path>` markers behaved as buttons — press to reopen the menu — but
were not focusable and had no accessible name.
- [x] One real `<button>` per highlight, named by the words it covers
      ("Highlight: Particle physics studies the most fundamental…"), truncated
      so a screen reader is not made to read a paragraph as a label
- [x] Real buttons rather than focusable SVG paths — the platform supplies
      Enter, Space, the role and the focus behaviour, and SVG focus differs in
      every browser
- [x] Grouped and counted ("2 highlights"), so arriving there tells you what
      you have arrived at
- [x] Invisible, but focusing one lights up **its marker** at full emphasis, so
      tabbing through is visible on the page and not only to a screen reader
- [x] Escape reaches the paragraph from any control inside it; every other key
      belongs to whatever has focus, so the word cursor no longer fires while a
      button is focused
- [x] Three copies of "the words these indices cover" collapsed into one
- [x] 12 tests
- [x] Browser: tab from the paragraph lands on the first highlight, its stroke
      goes to full emphasis, activating it reopens that highlight's menu and
      dims the rest of the paragraph, Escape closes it. The group adds no
      layout — measured 0px.

Focus does not yet move **into** the menu when it opens; that is A5.

### A5 · The floating menu becomes a real menu — done
- [x] `role="menu"` named "Highlight actions", its actions `menuitem`
- [x] One tab stop for the whole menu, not one per action — a roving tabindex,
      arrows move inside it, with wrap-around and Home/End
- [x] Focus moves in when it opens **from the keyboard only**. A menu that
      takes focus from someone who just drew with a mouse is a menu that
      interrupts; someone who arrived by keyboard has no other way in.
- [x] Escape closes it and hands focus back to whatever opened it — the
      highlight's own control, or the paragraph. Deleting the highlight falls
      back to the paragraph, since the control it would return to is the one
      being removed.
- [x] Tabbing out closes it. An open menu left behind the focus ring is how a
      menu becomes somewhere to get lost.
- [x] Arrow keys inside the menu no longer move the word cursor behind it
- [x] 14 tests, plus the four A4 tests updated to the new roles
- [x] Browser: full cycle — paragraph → word cursor → Enter → focus lands on
      "Reply in thread" → arrow to "Remove highlight" (tabindex 0 follows) →
      Escape → menu gone, focus back on the paragraph. Drawing with the mouse
      opens the menu and leaves focus where it was.

Choosing "Reply in thread" does not yet move focus into the popup; that is A6.

### A6 · `ReplyThreadPopup` becomes a dialog — done
It was a modal overlay with none of the semantics of one.
- [x] `role="dialog"` and `aria-modal`, named by two nodes — a hidden "Thread
      on" for meaning, the visible passage for which thread. `aria-modal` is
      the whole claim to modality: marking the rest of the page inert would
      mean reaching into a document this component does not own.
- [x] Focus lands in the thread's input — writing a reply is the only reason
      to be there
- [x] Tab wraps at both ends, so focus cannot walk out onto a page the reader
      can no longer see
- [x] Escape closes — unless something inside used it first, so a highlight
      menu open on one of the thread's own answers does not take the whole
      thread down with it
- [x] Focus returns to the highlight that opened the thread, and the menu now
      hands focus back *before* the thread opens, so what the dialog captures
      is the highlight rather than a menu item about to be removed
- [x] 11 tests
- [x] Browser: opened from the word cursor, dialog named "Thread on Particle
      physics studies", focus in the input, 12 tabs forward and 6 back never
      left it, Escape closed it and focus returned to the paragraph.

Two bugs the tests caught, both real:
- the focusable selector looked for `contenteditable="true"`, but the input is
  `plaintext-only` — the trap was excluding the one control that matters
- the outgoing focus was read in an effect. A child's effects run before its
  parent's, and the input focuses itself in one of them, so the dialog was
  recording *itself* as the place to return to. Read during the first render
  instead.

And one in the demo, which is the reference consumers copy: the playground
refocused its composer whenever the page settled, undoing the dialog's focus
return and dropping the reader in the input instead of back at the highlight.
It now claims focus only when nothing else holds it.

### A7 · Automated coverage — automated half done
- [x] `axe-core` over every exported component: buttons in each variant and
      disabled, the input in all four states, the highlighter plain, in precise
      mode, and with a highlight and its menu open, and the thread dialog
- [x] CI runs it — the workflow already runs the suite, and these are in it
- [x] Two rule groups switched off, both because they would measure nothing:
      page-level rules (these are fragments; the host owns landmarks and
      heading order) and colour contrast (jsdom does not paint, so axe would
      compare colours it cannot see and pass everything)
- [x] It found one real bug immediately — see below

**The bug:** `GlassButton` while loading announced as a button with *no name*.
The label was hidden with `visibility: hidden`, which removes it from the
accessibility tree, and the spinner is `aria-hidden` — so nothing was left.
Now hidden with opacity: identical to look at, same space, and with `aria-busy`
it reads as "Continue, busy", which is what is true. Pinned by its own test as
well as by axe.

Not verified in the browser: the demo never puts a `GlassButton` into its
loading state, so there was nothing to look at. The change swaps one
space-preserving way of hiding for another.

### A7b · The manual pass — done, with VoiceOver on macOS
Run by the author, since no number of green axe runs answers whether any of
this is usable and that part needs ears.

- [x] **The answer reads as prose.** This was the open risk: the text is split
      into one `<span>` per word for the focus effect, and some screen readers
      pause between elements, which would have turned every answer into a
      word. list. like. this. It does not. The per-word structure stays, and
      with it the focus effect.
- [x] The highlighted passage is read back
- [x] The key hint is heard on focus, Escape included
- [x] Surrounding structure — controls, counts — reads sensibly

Worth knowing rather than fixing: the hint is three sentences, and it is heard
on every answer paragraph you land on. In a long conversation that is a lot of
repetition. Left as it is — the author heard it and judged it fine, and a
shorter hint trades a known instruction for a discoverable one.

---

## Now — the design system

An audit before starting: 11 tokens existed, against roughly 290 hardcoded
colour values. The architecture was right — CSS Modules, and a named cascade
layer so a host's unlayered rules win automatically — but almost nothing went
through it.

| file | hardcoded | via `var()` |
|---|---|---|
| GlassButton.module.css | 197 | 27 |
| ChatInput.module.css | 71 | 7 |
| Button.module.css | 17 | 10 |
| TextHighlighter.module.css | 7 | 6 |

`ReplyThreadPopup` had no stylesheet at all — 17 inline `style={{}}` blocks —
so nothing about it could be themed. No spacing, radius, shadow or type scale.
One easing curve retyped thirteen times. Ten different z-index literals. And
216 lines of dead CSS for social icon buttons no component renders.

### D1 · The token file — done
- [x] Three tiers: primitive → semantic → component. A component reads the
      third; only the token file reads the first.
- [x] Everything prefixed `--ick-`. The old names sat on the host's `:root` as
      `--ink`, `--surface-hover`, `--font-sans` — a host that defines any of
      those silently repaints the kit. The playground defines **four of them**,
      which is the collision arriving on schedule rather than in theory.
- [x] Colours built from channel triplets — `rgb(var(--ick-ink-rgb) / 0.6)`,
      not `rgba(17, 17, 17, 0.6)`. Dark mode is then two lines instead of two
      hundred.
- [x] Dark mode in three states: system preference unless an explicit light
      choice was made, and `[data-theme="dark"]` or `.dark` over both
- [x] Scales for space, radius, elevation, motion, type and z-index
- [x] Old names kept as aliases so nothing breaks mid-migration; they go when
      the last component stops reading them
- [x] Fixed a pre-existing leak found on the way: `ChatInput` left a timer
      running past unmount, which failed the suite at random depending on how
      long the previous render took

Caught by checking rather than assuming: the first version had
`--ick-font-sans` read `var(--font-geist-sans, …)` while aliasing
`--font-geist-sans` back to it. CSS resolves a cycle by discarding both, so
every font silently became the browser default. Stated outright now.

**Dark mode is not true yet** — it is true for the parts that read tokens, and
almost nothing does until D2–D5 land.

### D2 · One button — done
- [x] `GlassButton` merged into `Button` as `variant="glass"`. **907 lines
      became 390.** Two components, two size scales and two sets of states,
      doing one job and disagreeing about all of it.
- [x] One size scale — xs 24, s 28, m 32, l 40, xl 48. Both old sets of values
      survive; only the glass names moved up a step, which is what the
      deprecated wrapper absorbs so no existing call site changes.
- [x] Dead CSS gone: `.socialIconBtn` and `.iconSpan` (216 lines, nothing
      rendered them), plus `.sizeXs`, `.ghost` and the `.hovered`/`.pressed`
      state classes, all unreachable from the component
- [x] **Not one literal colour** in the new stylesheet — the only `#fff` left
      are mask stencils, where any opaque value does
- [x] All 27 `:global(.dark)` rules deleted. The theme lives in the token
      layer now, so the component has no dark block at all.
- [x] `GlassButton` kept as a deprecated wrapper, since the website installs
      the packed tarball
- [x] The `ChatInput` call site was forcing `GlassButton` to 28×28 with inline
      styles — fighting to be the other component. Now `<Button variant="glass"
      size="s" icon={…} />` with no overrides.
- [x] Verified in both themes; light is pixel-unchanged apart from one
      deliberate difference: the 32px glass label goes 12px → 13px, so the type
      scale stops going backwards between 28 and 32.

Two changes I made and reverted, because the existing tests were right:
`pointer-events: none` on disabled (the glass button had it; `disabled`
already refuses activation, and switching off hit-testing only removes the
hover feedback and any tooltip saying why), and dropping `aria-busy` when
idle (stating "not busy" is the contract that was already there).

**Dark mode is opt-in only for now.** It was briefly wired to the system
preference, and the first look showed why that was wrong: `ChatInput` still
carries light-theme literals, so its text stayed a hardcoded near-black on
what had become a dark page — unreadable. Shipping that to everyone whose OS
is dark is worse than not shipping dark at all. `[data-theme="dark"]` and
`.dark` work today; the media query goes back in D6, once nothing is left
behind.

### D2b · Somewhere to look at it — done
- [x] Storybook on port 6006, stories reading the kit's **source**, so what is
      on screen is what the next commit ships
- [x] A theme switch in the toolbar that sets `data-theme` on the root element
      — the same mechanism a host app uses, so if it works here it works there
- [x] Stories for `Button` (variants, the whole size scale, states),
      `ChatInput` (interactive, and all four states side by side),
      `TextHighlighter` (both modes) and `ReplyThreadPopup`
- [x] **A live token table.** Not a hand-written list — it reads every
      `--ick-` declaration out of the stylesheets and resolves it against the
      current theme. A table kept in step by hand is wrong within a month;
      this one cannot drift, and it re-reads itself when the theme changes.
- [x] A theme toggle in the playground too, so dark can be judged in the real
      thing and not only in isolation
- [x] Stories excluded from the published package, same as the tests

### The rule, from here on
**Storybook is the source of truth for what this package looks like.** A
component change is not finished until its story shows it.

That is enforced, not remembered:
- [x] A test fails when something is exported with no story. The exemption
      list needs a reason per entry, and a second test fails when an exemption
      outlives its export — a stale exemption hides a gap as well as a real one.
- [x] CI builds Storybook, so a story that has drifted out of step with its
      component fails there rather than on somebody's machine a month later
- [x] Stories written for the four components that were exported and
      undocumented: `MorphGlyph`, `HoverActionsRow`, `AddCardsOverlay` and
      `CustomCursor`. They are exported so a consumer can recompose the input
      instead of forking it, which makes them public API — and public API
      nobody can look at is public API nobody uses correctly.

### D3 · `ChatInput` on tokens — done
- [x] **71 colour literals → 4**, and those four are mask stencils, where a
      mask needs an opaque value and any one does
- [x] Three 13-layer glass shadow stacks were copies of `GlassButton`'s,
      pasted, and had drifted from them. They are token references now, so the
      bubble and the buttons are made of the same glass by construction
      rather than by somebody remembering to update both.
- [x] Inline styles out of the TSX: the attached-image tray and the overlay's
      close button became classes, and `MorphGlyph` inherits `currentColor`
      instead of being handed `#111` at the call site
- [x] `--slot` deleted — declared in the stylesheet, read by nothing
- [x] Component variables prefixed and derived (`--ick-input-h`,
      `--ick-input-fill`, `--ick-input-text`), so a host can make the input
      taller or rounder without touching anything else
- [x] New tokens for what genuinely had no home: `--ick-shadow-glass-pulse`
      (the one-shot flash when the action button is absorbed),
      `--ick-shadow-float` and `--ick-scrim`
- [x] Dark mode is readable: the editor text was
      `rgba(17, 17, 17, 0.6)` on a dark page and is now
      `rgba(245, 245, 245, 0.6)`. Verified in the playground and in Storybook,
      all four states.
- [x] Light unchanged

One deliberate unification: the bubble's hover edge had slightly different
alphas from the button's. They share `--ick-glass-edge` now — a difference
too small to see and too easy to drift.

### D4 · `ReplyThreadPopup` gets a stylesheet — done
- [x] **17 inline `style={{}}` blocks → 0.** It had no stylesheet at all, so
      nothing about it could be themed and none of it read the tokens the rest
      of the kit reads.
- [x] The background and shadow were being *animated* in by Motion alongside
      the panel's own opacity — the same picture with two more properties to
      keep in step, and two more colours that could not come from a token.
      They are CSS now; Motion keeps the geometry.
- [x] Two new tokens: `--ick-surface-raised`, mixed from the ink and paper
      channels so the panel stays one step off the page in either theme, and
      `--ick-shadow-modal`, which has to bite harder against a dark page
- [x] `width: replyTargetWidth - 8` computed in JavaScript became `width: 100%`
      inside a padded box, which is the same number without the arithmetic
- [x] Dark verified in the browser: panel, feed, header and text all follow

**A bug found on the way, and it was leaving the package.** The component
rendered a `<style>` element containing `div::-webkit-scrollbar { display: none }`
— unscoped, so for as long as a thread was open it hid the scrollbar on
**every div in the host application**. It is a scoped rule in the module now.

### D5 · The highlighter — done
- [x] `#CCFF00` is gone from the TSX. It could not simply move to the
      stylesheet as an SVG `stroke` attribute — an attribute cannot read a
      custom property — so the stroke is a CSS property now and the colour
      comes from `--ick-marker`.
- [x] Easings onto `--ick-ease` and `--ick-ease-overshoot`; the z-indexes
      (1, 2, 10, 10000) onto the layer scale
- [x] Five inline style blocks became classes — the surface, the proximity
      hitbox, the token span, the SVG canvas and the menu. What is left inline
      is the menu's position, which is the one thing that genuinely changes
      per render.
- [x] `CustomCursor` too: its SVG fills and strokes read
      `--ick-cursor-fill` / `--ick-cursor-ink`, which deliberately do **not**
      flip with the theme — it is drawn over content the kit does not control
      and has to stay legible against anything, the way a road sign does.
- [x] Text on the marker got its own token. It must not follow the theme
      either: the marker is the same yellow in the dark, so the words on it
      stay dark or they stop being readable.
- [x] **`--ick-recede`**, the depth the rest of a paragraph falls to while one
      highlight has the floor. It was a flat `opacity: 0.15`, which is not
      symmetric: 15% of near-black on white is a legible grey, 15% of
      near-white on black is very nearly nothing. Dark gets 0.32, and the
      paragraph comes back.

**The kit now has no colour literals outside the token file.** What remains in
`Button` and `ChatInput` are four mask stencils each, where a mask needs an
opaque value and any one does.

### D6 · Keep it that way
- [ ] Wire dark back to `prefers-color-scheme`, once nothing is left behind
- [ ] The playground's own banner still paints itself white
- [ ] A test that fails when a new hardcoded colour appears in a stylesheet —
      the same kind of guard as the one pinning tokens free of inline styles
- [ ] `theming.md`: the tokens a host can set, and what each one moves

### D7 · Make it somebody else's brand
Not started, and deliberately after D3–D6: a theming system laid over
stylesheets that still contain literals would be a theming system that lies.

The shape it should take:

- **One surface, and only one.** A client sets `--ick-` custom properties on
  `:root`. No build step, no provider, no JavaScript API to learn. The cascade
  layer already means their unlayered rules win without fighting specificity.
- **A brand tier above the primitives.** Most brands should need under a dozen
  values — the channel triplets for ink, paper and marker, two font stacks,
  the radius scale, and the glass rim and shade. Everything else derives from
  those and needs no attention. The rest of the tokens stay reachable as an
  escape hatch, but nobody should have to touch them to look like themselves.
- **Prove it rather than claim it.** A "Themes" story applying two or three
  invented brands live, so the claim that a dozen values are enough either
  holds on screen or visibly does not.
- **`theming.md`**: every token, what it moves, and which ones are the dozen.
- Depends on D6's guard: a stylesheet that can still hide a literal is a
  stylesheet where a brand colour will not reach everywhere it should.

### Showcase recording
- [x] `npm run showcase` (and `node tools/showcase/record.mjs dark`) drives the
      **real playground** through the whole story — ask, morph, stream,
      highlight, thread — and records it. Driving the real thing rather than a
      mock means the video cannot show something the component does not do,
      and re-running it after a change is how the video stops going stale.
- [x] `?showcase` hides the perf HUD and the dial panel; `?theme=dark` sets
      the starting theme. Useful for showing the demo live, not only for
      recording.
- [x] The demo questions were rewritten to fit the fixed answers. A video
      where the answer does not address the question reads as broken however
      good the animation is.
- [x] Playwright is deliberately not a dependency — browsers are a heavy
      install for everyone and this is a marketing tool. The script resolves a
      global install and says how to get one if it is missing.

Captured through CDP rather than Playwright's own recorder, after measuring
why the first cut looked soft: the built-in recorder writes VP8 at a bitrate it
does not expose — around 340 kb/s at 1280×680, which smears text — and asking
for a larger `recordVideo.size` does not help, it pads the canvas rather than
scaling the page. A screencast hands over JPEG frames and leaves the encoding
to us: **340 kb/s → 2000 kb/s**, and the text reads.

Frames arrive only when something changes, so they are resampled onto a steady
30fps clock before encoding. Two plumbing bugs found on the way, both of which
hid the real error: writing to a pipe ffmpeg had already closed surfaced as a
bare `EPIPE`, and awaiting a `drain` from a dead process left a promise nothing
could settle — which exits node **silently, with a success code**.

Output is webm. mp4 would need a real `ffmpeg`: the one Playwright ships can
mux webm and nothing else, and macOS's `avconvert` cannot read VP8.

## Later

- [ ] **Touch:** the highlighter sets `touch-action: none` on every answer, so a
      finger on the text cannot scroll the page. Needs a real device to settle.
- [ ] **Versioning:** no `CHANGELOG`, no release process, no published version
- [ ] **README:** no worked example against a real API (Next.js App Router route
      handler → `onSend`)
- [ ] **Push to origin** — nothing has been pushed yet
