import { ChatExperience } from "./pages/ChatExperience";
import { PerfHud } from "./demo/PerfHud";
import { showDevTools } from "./demo/showcase";
import { useNoFocusZoom } from "./useNoFocusZoom";

export default function App() {
  /* The host's job, not the kit's — it rewrites this document's viewport meta
     while a field has focus, and only then. See the hook. */
  useNoFocusZoom();

  return (
    <>
      <ChatExperience />
      {showDevTools() && <PerfHud />}
    </>
  );
}
