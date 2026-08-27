# Theming

The kit reads CSS custom properties. That is the whole interface — no provider,
no build step, no JavaScript API. Set them on `:root` and you are done.

```css
:root {
  --ick-ink-rgb: 20 20 24;
  --ick-paper-rgb: 253 252 250;
  --ick-marker-rgb: 120 200 255;
  --ick-font-sans: "Inter", system-ui, sans-serif;
  --ick-radius-xl: 12px;
}
```

Everything the kit paints is derived from those, so a handful of lines moves
the whole thing. You do not have to override a hundred tokens to look like
yourself, and there is no specificity fight: the kit's defaults sit in a named
cascade layer, and any unlayered rule in your app beats them whatever the
import order.

## The ones worth knowing

Colours are built from **channel triplets** rather than finished colours, so
one line moves every tint and every alpha step derived from it.

| Token | What it moves |
|---|---|
| `--ick-ink-rgb` | every shade of text, every hover wash, every border |
| `--ick-paper-rgb` | surfaces, and the light side of glass |
| `--ick-marker-rgb` | the highlighter — its stroke, its glow, its keyboard selection |
| `--ick-font-sans` | the interface font |
| `--ick-font-mono` | labels and the glass buttons |
| `--ick-radius-pill` … `--ick-radius-xs` | how round everything is |
| `--ick-glass-rim-rgb` / `--ick-glass-shade-rgb` | what glass is lit by, and lit against |

Write triplets **without commas** — `20 20 24`, not `20, 20, 24` — because
they are used as `rgb(var(--ick-ink-rgb) / 0.6)`.

## A brand, in practice

Three invented ones live in Storybook under **Design tokens → Themes**, side by
side with the default. They set between six and nine tokens each and nothing
component-specific — which is the claim, rendered rather than asserted:

```css
/* "Ledger": warm, editorial, and a highlighter that looks like one. */
:root {
  --ick-ink-rgb: 38 32 26;
  --ick-paper-rgb: 250 246 238;
  --ick-marker-rgb: 255 176 46;
  --ick-font-sans: "Iowan Old Style", Georgia, serif;
  --ick-font-mono: "SF Mono", ui-monospace, monospace;
  --ick-radius-xl: 10px;
  --ick-radius-lg: 8px;
  --ick-radius-pill: 8px;
}
```

## Theming part of a page

Put the overrides on `:root` for the whole document, or on any element with
**`class="ick-theme"`** for a subtree:

```html
<div class="ick-theme" style="--ick-marker-rgb: 255 64 160">
  <!-- the kit is pink in here, and unchanged everywhere else -->
</div>
```

The class is required, and the reason is worth knowing because it is not
obvious. A derived token like `--ick-marker` is substituted where it is
*declared*, and the finished value is what inherits — so setting
`--ick-marker-rgb` on a wrapper without the class changes the channel and
nothing else. `.ick-theme` re-declares the derived tokens on that element, so
they recompute from whatever it inherits. Only elements carrying the class pay
for it.

`data-theme` works on such an element too, so a subtree can be dark on a light
page.

## Everything else

The complete list, with every value resolved live in the current theme, is the
first entry in Storybook:

```bash
npm run storybook --workspace packages/inline-chat-kit
```

It is read out of the stylesheets rather than written by hand, so it cannot
drift from what the components actually use.

## Dark

Three states, and you choose how much of it you want:

- **Nothing set** — the kit follows `prefers-color-scheme`.
- **`data-theme="light"` or `.light`** on the root — pinned light, whatever
  the system says.
- **`data-theme="dark"` or `.dark`** — pinned dark. `.dark` is there because
  Tailwind projects already have it.

The dark palette is one block of `--ick-dark-*` values; both rules assign from
it rather than restating it. To adjust dark without touching light, override
those:

```css
:root {
  --ick-dark-ink-rgb: 240 238 235;
  --ick-dark-paper-rgb: 24 22 28;
}
```

## Two things that deliberately do not follow the theme

Not an oversight in either case:

- **The cursor** (`--ick-cursor-fill`, `--ick-cursor-ink`) is drawn over
  content the kit does not control. It keeps a light body and a dark outline in
  both themes for the same reason road signs do — it has to stay legible
  against anything.
- **Text on the marker** (`--ick-marker-ink`). The marker is the same colour in
  the dark, so words sitting on it stay dark or they stop being readable.

One value that is not a colour but does change: `--ick-recede`, how far the
rest of a paragraph falls back while one highlight has the floor. It is `0.15`
in light and `0.32` in dark, because 15% of near-black on white is a legible
grey and 15% of near-white on black is very nearly nothing.

## Per component

Each component names its own handful, defaulting to the semantic layer. Change
these to move one thing without moving its neighbours:

```css
:root {
  --ick-input-h: 44px;              /* a taller composer */
  --ick-input-radius: 12px;         /* squarer, without touching other radii */
  --ick-input-fill: transparent;    /* an input with no fill at all */
}
```

## Motion

`--ick-ease`, `--ick-ease-overshoot`, and the `--ick-duration-*` scale. The kit
already honours `prefers-reduced-motion` on its own: transforms and layout snap
to their final values while opacity and colour still fade, so state stays
legible without travelling.
