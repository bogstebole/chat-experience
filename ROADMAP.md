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

### A1 · Announce answers to screen readers
Today an answer arrives with no announcement at all.
- [ ] `role="status"` region per turn, `aria-live="polite"`
- [ ] Announce **once on settle**, not per character — streaming into a live
      region makes screen readers re-read the whole answer on every frame
- [ ] `aria-busy` on the turn while responding
- [ ] Test: region receives the full text exactly once

### A2 · Honour `prefers-reduced-motion` everywhere
Only `TextHighlighter.module.css` respects it today.
- [ ] `useChatTurns` reveal publishes the full answer immediately under reduce
- [ ] `ChatInput` morph springs collapse to no animation
- [ ] Entrance/exit transitions in the playground rows likewise
- [ ] Test: reveal is instant when the media query matches

### A3 · Let the keyboard select text at all
`user-select: none` is set permanently on the highlighter in marker mode, so a
keyboard user cannot select the answer text — not to highlight it, not to copy it.
- [ ] Apply `user-select: none` only while the pointer is down
- [ ] Commit a highlight from a **native** selection made with Shift+Arrow —
      the `precise` path already builds highlights from a Range, but it only
      listens for `mouseup`. Listen for keyboard-completed selections too.
- [ ] Test: Shift+Arrow selection produces a highlight and fires
      `onHighlightComplete`

### A4 · Make existing highlights reachable
The SVG `<path>` markers behave as buttons — press to reopen the menu — but they
are not focusable and have no accessible name.
- [ ] A focusable control per highlight, named by its passage
      ("Highlight: the first few words…")
- [ ] Enter/Space opens that highlight's menu
- [ ] Rendered as real buttons rather than focusable SVG paths — SVG focus
      behaviour differs across browsers and is not worth fighting
- [ ] Test: tab reaches every committed highlight; Enter opens the menu

### A5 · The floating menu becomes a real menu
- [ ] Focus moves to the first action when it opens
- [ ] Arrow keys move between actions
- [ ] Escape closes it and returns focus to the highlight that opened it
      (today only an outside pointer-down closes it — Escape does nothing)
- [ ] Test: full open → navigate → escape → focus-returned cycle

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
