import { ChatExperience } from "./pages/ChatExperience";
import { PerfHud } from "./demo/PerfHud";
import { isShowcase } from "./demo/showcase";

export default function App() {
  return (
    <>
      <ChatExperience />
      {!isShowcase() && <PerfHud />}
    </>
  );
}
