import { useState } from "react";
import "./App.css";
import { Playground } from "./pages/Playground";
import { ChatExperience } from "./pages/ChatExperience";
import { SideNav, type RouteId } from "./components/SideNav";

interface PageDef {
  title: string;
  blurb: string;
  variant: "default" | "absorb" | "mass" | "baton" | "inline";
  callout?: { title: string; bullets: string[] };
}

type PlaygroundRoute = Exclude<RouteId, "chat">;

const PAGES: Partial<Record<PlaygroundRoute, PageDef>> = {
  "inline-saved": {
    title: "D — Inline (reference)",
    blurb:
      "Saved baseline before textarea / wrapping experiments. No trailing button — send/stop glyph lives inside the pill.",
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
  inline: {
    title: "D — Inline (wip)",
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
  const [route, setRoute] = useState<RouteId>("chat");

  return (
    <div className="shell">
      <SideNav active={route} onSelect={setRoute} />
      <main className="content">
        {route === "chat" ? (
          <ChatExperience key="chat" />
        ) : PAGES[route] ? (
          <Playground
            key={route}
            title={PAGES[route]!.title}
            blurb={PAGES[route]!.blurb}
            variant={PAGES[route]!.variant}
            callout={PAGES[route]!.callout}
          />
        ) : null}
      </main>
    </div>
  );
}

export default App;
