import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { DialRoot } from "dialkit";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/geist-mono/600.css";
import "dialkit/styles.css";
import "./index.css";
import App from "./App";
import { isShowcase } from "./demo/showcase";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* What a host app should do: one provider at the root, and every Motion
        animation in the tree honours the reader's system setting. The kit sets
        it internally for its own components too, so a host that forgets is not
        left with the full morph. */}
    <MotionConfig reducedMotion="user">
      <App />
      {!isShowcase() && <DialRoot />}
    </MotionConfig>
  </StrictMode>
);
