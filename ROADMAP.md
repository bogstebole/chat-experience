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

### A6 · `ReplyThreadPopup` becomes a dialog
It is a modal overlay with none of the semantics of one.
- [ ] `role="dialog"`, `aria-modal`, labelled by the quoted passage
- [ ] Focus moves in on open, is trapped while open, returns to the highlight
      on close
- [ ] Escape closes
- [ ] Test: focus enters, cannot escape by tabbing, returns on close

### A7 · Automated coverage
- [ ] `axe-core` assertion over each component's rendered output
- [ ] CI runs it alongside the existing suite
- [ ] Manual VoiceOver pass — in particular whether splitting the answer into
      per-word spans makes it read choppily. Automated tools will not catch this.

---

## Later

- [ ] **Touch:** the highlighter sets `touch-action: none` on every answer, so a
      finger on the text cannot scroll the page. Needs a real device to settle.
- [ ] **Versioning:** no `CHANGELOG`, no release process, no published version
- [ ] **README:** no worked example against a real API (Next.js App Router route
      handler → `onSend`)
- [ ] **Push to origin** — nothing has been pushed yet
