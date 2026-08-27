# Changelog

Dates are the day the work landed on `main`.

The versions before 1.0 follow the pre-release convention: **a breaking change
or new public API bumps the minor**, and the patch is for fixes. Anything that would break an
existing install is called out under **Breaking**, with what to do about it.

## 0.3.0 — 2026-08-27

Additive. Nothing in 0.2.0 changes behaviour.

### Added

- **`<ChatHeader>`.** The chrome above a conversation: title, subtitle, status
  dot, back, and a row of actions. Three materials (`plain`, `glass`,
  `bordered`), three sizes (40 / 48 / 56px), and a centred arrangement for the
  native/mobile pattern.

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

- **Header and status tokens.** `--ick-header-*` for height, padding, backdrop,
  title, subtitle and badge; `--ick-status-online` / `-busy` / `-thinking` for
  the dot, built on two new channels (`--ick-live-rgb`, `--ick-warn-rgb`) that
  do not invert with the theme, only lift.

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
