import { useState } from "react";
import "./App.css";
import { Playground } from "./pages/Playground";
import { SideNav, type RouteId } from "./components/SideNav";

interface PageDef {
  title: string;
  blurb: string;
  variant: "default" | "absorb" | "mass" | "baton" | "inline";
  callout?: { title: string; bullets: string[] };
}

const PAGES: Record<RouteId, PageDef> = {
  original: {
    title: "Original",
    blurb:
      "Single morphing element across four states. The pill, leading icon, editor, and trailing button persist as the same DOM nodes — only their layout, fill, and shadow change.",
    variant: "default",
  },
  absorb: {
    title: "A — Absorb",
    blurb:
      "When the AI finishes responding, the stop button slides into the bubble while shrinking. The bubble's right edge naturally pulls over and gives a tiny scale bulge, as if it received the button's mass.",
    variant: "absorb",
    callout: {
      title: "What's different on responding → resting",
      bullets: [
        "Action button exit: x: -28, scale: 0 (slides INTO the bubble center).",
        "Bubble layout spring: stiffness 260 / damping 26 / mass 1.2 — slightly heavier feel.",
        "Bubble plays a 1.5% scaleX overshoot on receipt, then settles.",
      ],
    },
  },
  mass: {
    title: "B — Heavy bubble",
    blurb:
      "Differentiated mass: the button is light and snappy, the bubble is heavy and overshoots into place. A brief shadow pulse on the bubble marks the moment of impact.",
    variant: "mass",
    callout: {
      title: "What's different on responding → resting",
      bullets: [
        "Button exit spring: stiffness 520, damping 32, mass 0.55 — fast and weightless.",
        "Bubble spring: stiffness 180, damping 14, mass 1.6 — visibly overshoots.",
        "Bubble's inner highlight pulses bright for ~260ms (the impact frame).",
      ],
    },
  },
  baton: {
    title: "C — Baton pass",
    blurb:
      "The clearest single-element story: the stop square morphs back into a circle, slides hard left into the bubble center, and the bubble's inner glass pulses outward as it dissolves — a visible hand-off.",
    variant: "baton",
    callout: {
      title: "What's different on responding → resting",
      bullets: [
        "Stop glyph reverts square → circle on exit (suggests releasing the trail).",
        "Action button slides further left: x: -42 (deep into the bubble center).",
        "Bubble shadow pulses simultaneously — reads as the energy dispersing.",
      ],
    },
  },
  inline: {
    title: "D — Inline",
    blurb:
      "No trailing button. As soon as you type, the ↵ enter glyph appears inside the input, right-aligned with the text. Press Enter — the same arrow → L → U → square morph plays in place. Everything happens within one pill.",
    variant: "inline",
    callout: {
      title: "What's different",
      bullets: [
        "No external send/stop button. Glyph lives inside the pill, next to the text.",
        "Same continuous morph (↵ → L → U → square), 400ms snappy ease-out.",
        "All four states stay inside one element — input never has anything beside it.",
      ],
    },
  },
};

function App() {
  const [route, setRoute] = useState<RouteId>("original");
  const page = PAGES[route];

  return (
    <div className="shell">
      <SideNav active={route} onSelect={setRoute} />
      <main className="content">
        <Playground
          key={route}
          title={page.title}
          blurb={page.blurb}
          variant={page.variant}
          callout={page.callout}
        />
      </main>
    </div>
  );
}

export default App;
