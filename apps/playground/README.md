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

## Measuring performance

A HUD sits bottom-left. It observes from the outside — it reads the DOM and the
performance timeline and never touches the kit, so it cannot change what it
measures. Its own readout writes straight to the DOM instead of through React
state, for the same reason.

### Capturing a problem

1. Reproduce the setup first — send a message, draw the highlight, get the
   screen into the state that misbehaves.
2. Hit **record**.
3. Do the thing that feels bad, for 5–10 seconds. Move at your normal speed;
   the cost is per pointer event, so a slow deliberate sweep measures something
   different from a real one.
4. Press **M** every time it feels bad. Each press timestamps the moment and
   records what the frame was doing, which is what pins a subjective "it
   stuttered here" to a number.
5. Hit **stop**, then **copy report**, and paste it into the conversation.

Keep the window focused for the whole capture. The browser throttles timing for
background tabs, so those frames are excluded — the HUD shows `paused` and the
report says how many times it happened.

### What the readout means

| Row | Watch for |
| --- | --- |
| `fps` | Should sit at your display's refresh rate |
| `worst frame (1s)` | Anything over ~16ms is a dropped frame at 60Hz |
| `dropped frames` | Counts frames over 16.7ms since recording started |
| `pointermove rate` | How many events your hand actually generates — 300–1000/s is normal |
| `.aiText mutations` | DOM churn inside the answer, a proxy for TextHighlighter re-renders |
| `scene` | Highlights on screen, and whether the hover shimmer is running |

If `dropped frames` climbs while `.aiText mutations` stays flat, the cost is in
paint or compositing, not React. If both climb together, it is re-rendering.
That single distinction decides which fix is the right one.

### When the HUD is not enough

The HUD sees the main thread. If it says everything is fine and it still feels
bad, the cost is on the compositor, and that needs DevTools:

- **Rendering panel** (⌘⇧P → "Show Rendering"): turn on *Paint flashing* and
  hover the text. Large green repaints over the whole paragraph point at the
  blend modes; small ones at the marker only are fine.
- **Frame rendering stats** in the same panel shows the real GPU frame rate.
- **Performance panel**: record while hovering, then use the *Export profile*
  button. That `.json` is the most complete thing you can hand over.

## What stays here

`src/demo/` holds everything specific to this playground — the logo, the
feature-status banner, the canned particle physics answers. None of it ships
in the package.
