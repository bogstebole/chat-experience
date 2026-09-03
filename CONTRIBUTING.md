# Contributing

This is the repo `inline-chat-kit` is built in. If you are here to *use* the
component, the [README](README.md) is the front door and none of this concerns
you.

```
packages/inline-chat-kit/   the shippable library
apps/playground/            Vite dev environment + demo
tools/                      screenshot and video recorders
```

This repo is the single source of truth for the chat feature. The personal
website consumes the built package; it holds no copy of the source.

## Develop

```bash
npm install
npm run dev
```

The playground aliases `inline-chat-kit` straight to the package source, so
editing a component hot-reloads immediately — no rebuild step while iterating.

### Storybook is the source of truth for appearance

```bash
npm run storybook --workspace packages/inline-chat-kit
```

A component's story is updated in the same commit as the component. Two guards
in the test suite enforce it.

### Dev chrome

Add `?dev` to the playground's URL and you get a **DialKit** panel for tuning
the entrance springs, stagger and blur, plus a **perf HUD**. Numbers you settle
on go into `defaultInlineAnimConfig` in `ChatInput.tsx`; the panel persists
nothing.

Two of its groups drive the composer: **Composer Buttons** (how the
microphone, the plus and the send glyph leave for a second line and come back)
and **Composer Bubble** (the pill's spring, which the text rides by way of a
`layout="position"`). Both were unreachable until the demo stopped handing the
composer a frozen `defaultInlineAnimConfig` — the panel could move everything
around the input and nothing in it.

Both belong to the playground. A test asserts `dialkit` never becomes a
dependency of the package.

### Animation notes

`.claude/` holds Motion's own animation guidance (`npx motion-ai`), committed
because the comments around the question group's fold quote it — a citation
whose source is not in the repo points at nothing. `.mcp.json` registers
Motion's hosted servers; nothing here is needed to build or run the kit.

## Scripts

`npm run verify` is **everything CI runs**, in CI's order: lint, tests, both
builds, Storybook, and a dry-run pack. Run it before pushing — a narrower check
misses type errors that CI catches, because `tsc -b` follows project references
into the kit's sources and a plain `--noEmit` on one tsconfig does not.

| Command | Does |
| --- | --- |
| `npm run dev` | Playground on :5173 |
| `npm run dev:kit` | Rebuild the package on every change |
| `npm run build` | Build package, then playground |
| `npm run build:kit` | Build the package only |
| `npm run pack:kit` | Build **and** repack `inline-chat-kit.tgz` |
| `npm run verify` | Everything CI runs |
| `npm run showcase` | Re-record the showcase video (dev server must be up) |
| `npm run showcase:questions` | Re-record the question-card showcase |
| `npm run shots` | Re-capture the stills |
| `node tools/voice/check.mjs` | The microphone button's states, in a real browser |
| `npm run visual-qa` | Geometry rules over every story, in a real browser |
| `npm run visual-qa:dark` | The same, in the dark theme |
| `npm run visual-qa:self-test` | Proves the rules can still fail |

Recordings land in `Videos/` and `Shots/`, both gitignored — they are outputs,
not sources.

## Visual QA

```bash
npm run build-storybook --workspace packages/inline-chat-kit
npm run visual-qa
```

Rules, not screenshots. A pixel snapshot fails on every intentional change and
on a different font renderer, and all it can say is that something moved; a
rule says which rule broke and by how much. Three so far — a box that declares
it centres its content and does not, a row of icon buttons at two sizes, and a
child clipped by the box around it.

Every rule reads the author's own CSS before it measures, so it can only fire
where the intent was declared. That is why the list is short enough to read.

`npm run visual-qa:self-test` runs the rules against three deliberately broken
layouts and one correct one. A pass reporting nothing is worth nothing until it
has been seen reporting something, and a geometry rule that silently matches
nothing looks exactly like a clean bill of health.

## Consuming the tarball

Any app that installs the packed tarball rather than a published version needs
both halves: `npm run pack:kit` here, then `npm install` there. The filename is
stable, so the consumer's `package.json` never changes.

(The tarball rather than a symlink, in the one case that exists today, because
Turbopack will not resolve a linked package outside its project root.)

## What lives where

Anything reusable by a third party belongs in the package. Anything specific to
this playground — the logo, the feature-status banner, the canned answers, the
intro landing — stays in `apps/playground/src/demo` and `apps/playground/src/pages`.

**Tooling is playground-side, always.** The package's runtime dependencies are
two, both for syntax highlighting, plus four peers a host app already has.
Adding a third is a decision, not a convenience, and the test that pins the
list is where you make it.

## Releasing

Before 1.0 a breaking change bumps the minor. `CHANGELOG.md` records what broke
and what to do about it; `theming.md` and the changelog both ship in the
tarball.

The package is on npm as [`inline-chat-kit`](https://www.npmjs.com/package/inline-chat-kit).
Publishing needs a granular access token with 2FA bypass — the account's 2FA is
a security key, and a security key cannot produce the OTP `npm publish` asks
for:

```bash
npm publish --workspace packages/inline-chat-kit
```

`prepare` builds first, so what goes out is always fresh. Check the dry run
before a real one — it is what caught two stray filesystem copies sitting in
`dist`.
