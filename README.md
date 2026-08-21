# AI Chat Experience

Home of **[inline-chat-kit](packages/inline-chat-kit)** — a drop-in inline AI
chat component for React — and the playground it's designed in.

```
packages/inline-chat-kit/   the shippable library
apps/playground/            Vite dev environment + demo
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

The DialKit panel in the corner live-tweaks the entrance springs, stagger and
blur. Numbers you settle on go into `defaultInlineAnimConfig` in
`packages/inline-chat-kit/src/ChatInput/ChatInput.tsx`.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Playground on :5173 |
| `npm run dev:kit` | Rebuild the package on every change |
| `npm run build` | Build package, then playground |
| `npm run build:kit` | Build the package only |
| `npm run pack:kit` | Build **and** repack `inline-chat-kit.tgz` for the website |

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
