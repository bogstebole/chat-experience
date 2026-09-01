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

`npm run dev -- --open '/?dev'`, or add `?dev` to the URL, and the playground
puts two panels on screen: a **DialKit** panel for live-tweaking the entrance
springs, stagger and blur, and a **perf HUD**. Numbers you settle on in the dial
go into `defaultInlineAnimConfig` in
`packages/inline-chat-kit/src/ChatInput/ChatInput.tsx` — the panel persists
nothing.

Both are **the playground's, not the kit's**. `dialkit` is a dependency of
`apps/playground` and of nothing else; no file under `packages/inline-chat-kit`
imports it, it is not in the package's `dependencies` or `peerDependencies`, and
none of it reaches the tarball the website installs. A test asserts all of that,
because a dev tool that quietly becomes a runtime dependency is the kind of
thing nobody notices until somebody else installs the package.

### The Motion AI Kit

`.claude/skills/motion/` and `.claude/agents/motion-reviewer.md` are Motion's
own animation guidance, installed by `npx motion-ai` and **committed on
purpose**. The comments and guards around the question group's fold cite those
rules directly — "Motion's own guidance is to set `will-change` and remove it
once the animation finishes" is a quotation, not a paraphrase — and a citation
whose source is not in the repo points at nothing. Committed, the advice the
code was written against is pinned, and `npx motion-ai@latest` shows in a diff
what changed about it.

`.mcp.json` registers Motion's two hosted MCP servers. The open one needs
nothing; `motion-plus` needs a sign-in from the editor's MCP settings and
unlocks the MotionScore audit methodology and example source. Neither is
required to read the skill, which is self-contained — it is what found that
Motion does not set `will-change` for independent transforms, and that we
therefore had to.

The runtime audit needs no account at all:

```
npx motionscore http://localhost:6006/iframe.html?id=components-questioncard--folding --agent
```

Like DialKit, none of this reaches the package. It is guidance for whoever is
writing the animations.

## Scripts

`npm run verify` is **everything CI runs**, in CI's order: lint, tests, both
builds, Storybook, and a dry-run pack. Run it before pushing.

It exists because `tsc --noEmit -p apps/playground/tsconfig.json` is not the
same check as the `tsc -b` in the playground's own build — the second follows
project references into the kit's sources and typechecks the tests as well. Two
type errors reached `main` through that gap on the same afternoon.

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

Recordings land in `Videos/` and `Shots/`, both gitignored — they are outputs,
not sources.

## Shipping a change to the website

The website depends on a packed tarball rather than a symlink — Turbopack
refuses to resolve a linked package living outside its project root, and
widening that root makes it scan every sibling project.

```bash
npm run pack:kit
```

Then, in the website repo:

```bash
npm install
```

Both steps are needed: the first rebuilds and repacks, the second unpacks the
new tarball into the website's `node_modules`. The tarball filename is stable,
so the website's `package.json` never has to change.

## What lives where

Anything reusable by a third party belongs in the package. Anything specific to
this playground — the logo, the feature-status banner, the canned particle
physics answers, the intro landing — stays in `apps/playground/src/demo` and
`apps/playground/src/pages`.

**Tooling is playground-side, always.** DialKit and the perf HUD exist to build
the kit, not to ship with it. The package's runtime dependencies are two, both
for the same job — `lowlight` and `highlight.js`, syntax highlighting in a code
block — plus four peers a host app already has: `react`, `react-dom`, `motion`,
`lucide-react`. Adding a third is a decision, not a convenience, and the test
that pins the list is where you make it.

## Releasing

Before 1.0 a breaking change bumps the minor. `CHANGELOG.md` records what broke
and what to do about it; `theming.md` and the changelog both ship in the
tarball.

The package is **not published to npm yet**. Until it is, consumers install the
packed tarball — which is what the README tells them to do.
