# Playground

Dev environment for [inline-chat-kit](../../packages/inline-chat-kit). Run it
from the workspace root:

```bash
npm run dev
```

`inline-chat-kit` is aliased straight to the package source (see
`vite.config.ts`), so editing a component hot-reloads here with no rebuild.

## Routes

Picked from the sidebar:

- **Chat** — the full experience: intro landing, streaming answers, marker
  highlighting, reply threads. This is what the website ships.
- **D — Inline (ref)** / **D — Inline (wip)** — a single `ChatInput` isolated
  across all four states, for comparing variants side by side.

## Tuning motion

The DialKit panel live-tweaks entrance stagger, spring stiffness, damping and
blur. Values you settle on belong in `defaultInlineAnimConfig` in
`packages/inline-chat-kit/src/ChatInput/ChatInput.tsx` — the panel does not
persist anything.

## What stays here

`src/demo/` holds everything specific to this playground — the logo, the
feature-status banner, the canned particle physics answers. None of it ships
in the package.
