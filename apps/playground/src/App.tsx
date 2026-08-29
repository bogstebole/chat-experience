import { ChatExperience } from "./pages/ChatExperience";
import { PerfHud } from "./demo/PerfHud";
import { showDevTools } from "./demo/showcase";

export default function App() {
  return (
    <>
      <ChatExperience />
      {showDevTools() && <PerfHud />}
    </>
  );
}
