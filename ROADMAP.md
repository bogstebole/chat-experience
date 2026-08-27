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

### D6 · Keep it that way — done
- [x] **A test that fails on a new literal colour.** It names the file and the
      line, and its exception list carries a reason per entry — currently one:
      a mask stencil, which needs an opaque value and is not a colour at all.
      Checked against a deliberately planted `#ff0000`.
- [x] **Dark wired to `prefers-color-scheme`**, now that nothing is left
      behind. Verified in all four states: system light, system dark, and
      either one overridden by an explicit `data-theme`.
- [x] The dark palette is declared **once**, as `--ick-dark-*`, and the two
      rules assign from it. Wiring up the media query would otherwise have
      meant a third copy of the same eighty lines, and three copies drift.
- [x] The playground adopts the kit's palette instead of keeping its own, so
      it follows the theme with no second set of values and no media query
- [x] Its banner too: 12 inline style blocks onto tokens
- [x] `theming.md` — the contract, the handful that matter, dark, and the two
      things that deliberately do not follow the theme

**Two real bugs found while doing it.**

The first was mine, from D4 and D5: every "dark" value I added — `--ick-recede`,
`--ick-shadow-modal`, `--ick-shadow-float`, `--ick-shadow-glass-pulse` — had
landed **inside the light `:root` block**, where it silently overrode the light
one. Light mode had been running with dark's values since D4. The restructure
is what surfaced it, and is what makes it hard to repeat.

The second was the playground's: it wrote `data-theme` on every render, even
when nobody had chosen a theme, which pinned the page and meant the media query
could never get a turn. It only writes the attribute on an explicit choice now
— which is the right advice for any host app, so the demo is showing it.

### D7 · Make it somebody else's brand — done

- [x] **Three invented brands, rendered side by side** in Storybook under
      *Design tokens → Themes*, next to the default. Six to nine tokens each,
      nothing component-specific. The claim that a handful is enough is now
      something to look at rather than something to believe.
- [x] **A theme can be applied to a subtree**, with `class="ick-theme"` on any
      element. `data-theme` works there too, so part of a light page can be
      dark.
- [x] Tests that pin the structure: every rule declaring tokens must name
      `.ick-theme` alongside `:root`, no brand may exceed a dozen tokens or
      reach for a component's own, and every token a brand sets must be one
      the kit actually defines
- [x] `theming.md` and the README updated with both

**The thing worth knowing, which was not obvious and had to be measured.**
Setting `--ick-marker-rgb` on a wrapper changes the channel and *nothing else*.
A derived token is substituted where it is **declared**, and the finished value
is what inherits — so `--ick-marker`, computed on `:root`, arrives downstream
already resolved. Overriding the channel underneath it is too late.

That is why `.ick-theme` exists: it re-declares the derived tokens on the
element carrying it, so they recompute from whatever that element inherits.
Only elements with the class pay for it. Without this the brand story could not
have shown four brands on one page — and, more to the point, a consumer
theming a panel would have found half their values silently doing nothing.

### D6b · The demo was never checked — done

Reported from a screenshot: in dark mode the answer text was black, and the
segmented toggle's tray was invisible against the page.

Both real, and both mine. D6 verified the **kit** in dark — its tokens, its
components in Storybook, the page background — and stopped there. The demo has
stylesheets of its own, and nothing had looked at them.

- [x] `.aiText { color: #000000e0 }` — the answer text, hardcoded near-black.
      Every answer was invisible in the dark theme.
- [x] The segmented toggle's dark rules hung off a **`.dark` class this app
      never sets** — it uses `data-theme`. So the dark theme was still painting
      the light values: a 4%-black tray, invisible on a dark page. Six such
      rules, all dead. Deleted.
- [x] Its active thumb was `--ick-surface`, which in dark **is the page
      colour** — it read as a hole rather than a chip. The one value here that
      cannot be derived: light wants paper on a grey tray, dark wants something
      *lighter* than its tray, which means moving towards ink. Stated per theme.
- [x] `--color-bg-page` was referenced in three gradients and **defined
      nowhere**, so all three were invalid and painted nothing. The fades under
      the sticky input bar had never worked.
- [x] The highlights modal was inline literals throughout — invisible in dark
      too, just behind a click.
- [x] The landing page and its notice, likewise.

**The guard only covered the kit.** It covers the demo now, which is what would
have caught every one of these — with two documented exemptions: the logo,
whose colours are the mark, and the perf HUD, which is deliberately the same
dark panel in either theme, because a measuring instrument that changes with
the thing it measures is a poor one.

### D5b · The spaces between words — done

Reported from a screenshot: some lines of an answer were indented by a
character and some were not.

The highlighter renders one `<span>` per token, words *and* the spaces between
them, all `display: inline-block`. Words need that — a transform does nothing
to a non-replaced inline box, and the press state scales them. Spaces do not,
and being an atomic box cost them the one thing a space does at a line break:
**hang**. A line breaking *before* a space put that space at the start of the
next line and pushed the whole line a character right. Two of six lines.

- [x] Spaces are marked and stay `display: inline`
- [x] Lines are flush left, measured — and the paragraph breaks later, because
      atomic space boxes had been constraining where it could break at all
- [x] Marker drawing, the word cursor and the selection tint all still span
      the gaps; checked with a real drag
- [x] Two tests: that the spaces are marked, and that a rule keeps them inline.
      The second reads the stylesheet and fails if `inline-block` comes back.

## Now — components

### E1 · ChatHeader — done

The kit had every part of a conversation except the one that says what the
conversation *is*. The demo had a hand-rolled header with a hardcoded label
and a `Highlights (3)` text button.

Surveyed nine kits first. Two findings shaped the API: shadcn's own chat
components (June 2026) ship **no header at all**, and Stream — the one kit
that made it props-driven — has since **removed** `live` and `MenuIcon`. So:
props for the common case, one slot for everything else, and nothing named
after a specific button.

- [x] Title, subtitle, avatar, back, actions
- [x] Three materials, three sizes (40/48/56), start and centre alignment
- [x] `headingLevel`, because the level belongs to the host's document, and
      `landmark`, because a header inside a panel is not the page's banner
- [x] **Actions are described, not passed in.** `{ id, label, icon, … }` is
      what makes `collapseActionsAt` possible: a header cannot fold children
      into a menu when it has no idea what any of them are. Anything with no
      icon-and-label shape — the selection toggle — goes in as `children` and
      never collapses.
- [x] Overflow menu: one tab stop, arrows and Home/End, Escape returns focus
      to the trigger, Tab away closes it. A toggle in it is a
      `menuitemcheckbox`, since `menuitem` takes no pressed state.
- [x] `count` is folded into the accessible name. The badge is `aria-hidden`,
      so without that a reader is told "Saved highlights" and never learns
      there are three.
- [x] Thirteen new tokens, none literal, all `--ick-header-*`.
- [x] 29 tests, 3 more axe cases, 7 stories, README and theming.md. `0.3.0`.

One bug the tests caught, and it was not a test artifact: `elevateOnScroll`
told window from element with `instanceof Window`, which is a realm check —
false under jsdom, and false in a browser the moment the node is in an iframe.
`"scrollTop" in window` is no better: jsdom answers true. It compares identity
against the object `scrollParent` just returned.

### E2 · The demo header

- [x] `Highlights (3)` is a bookmark icon with a badge, as asked
- [x] The title is the **first question actually asked**, not a fixed label —
      matched on turn state, because the turn's text is written on every
      keystroke and matching on text alone retitled the page letter by letter
- [x] Two dead CSS rules removed; the page now says only where the header sits

### E3 · The status dot, removed

Shipped in E1 as a `status` prop and taken out the same day, unasked for and
unused. A green dot is standard in a *messaging* header, where it says the
other person is there; in an AI chat there is nobody to be online, and the one
honest reading — an answer is streaming — is already carried by the answer
appearing. Surface nobody asked for is surface somebody later has to support.

- [x] `status`, `statusLabel`, `ChatHeaderStatus` and the dot gone
- [x] With them, five tokens and two colour channels: the palette no longer
      carries a green and an amber for one dot
- [x] `.srOnly` went too — it existed to name the dot and nothing else

## Later

- [x] **Touch — done.** `touch-action: none` on every answer meant a finger
      anywhere on the text could not scroll the page: on a phone the whole
      conversation was a dead zone. It is `pan-y` now, which separates the two
      gestures cleanly — strokes are horizontal, scrolling is vertical.

      That exposed a second bug. `pointercancel` was wired to the same handler
      as `pointerup`, so a gesture the browser took over for scrolling was
      *committed* as a highlight — every scroll starting on an answer left a
      marker on whatever word the finger landed on. Cancelling discards now.

      Measured through Chrome's own gesture pipeline: a sideways drag gives
      pointerdown, ten moves, pointerup and a marker; a downward drag gives
      pointerdown, one move, `pointercancel`, and no marker. Still worth a
      minute on a real phone for feel, but the behaviour is settled.
- [x] **Versioning — done.** `0.2.0`, a `CHANGELOG` with the breaking changes
      and what to do about each, and a release section in the README. Before
      1.0 a breaking change bumps the minor. `CHANGELOG.md` and `theming.md`
      ship in the tarball; `files` was `dist` only, so neither would have
      reached anyone installing it.
- [x] **README — done.** The theming section was still documenting the old
      unprefixed tokens, which had been wrong since D1. Rewritten, plus a
      worked Next.js example: a route handler that streams from a model, the
      `onSend` that reads it, and the same shape for a thread with its quoted
      passage. The contributing section said 53 tests; there are 167.
- [x] **Pushed.** The remote was HTTPS with no credential helper, so it is SSH
      now. CI runs on GitHub for the first time as of this push.
