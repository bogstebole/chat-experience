import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArtifactCard } from "../Artifact/ArtifactCard";
import { ArtifactPane } from "../Artifact/ArtifactPane";
import { ChatLayout } from "../Artifact/ChatLayout";
import { useArtifacts } from "../Artifact/useArtifacts";
import { Conversation } from "../Conversation/Conversation";

/**
 * What the answer produced.
 *
 * Three pieces and one decision. `<ArtifactCard>` is the line of the
 * transcript saying the thing was made; `<ArtifactPane>` holds the whole of
 * it; `useArtifacts` remembers which one is open, because the card and the
 * pane sit in different parts of the tree and both need the answer.
 *
 * The decision is that the pane is **on the right and the conversation makes
 * room** — `<ChatLayout>`. A preview pane is one of the few patterns every AI
 * chat now has, and a pattern is only worth anything if it is the same every
 * time. What is left open is what goes *in* it.
 */
const meta: Meta<typeof ArtifactCard> = {
  title: "Components/Artifact",
  component: ArtifactCard,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof ArtifactCard>;

const PLAN = `Week 1 — base
Mon  rest
Tue  4 km easy, conversational
Wed  cross-train, 30 min
Thu  5 × 400 m at 5k effort, 90 s jog between
Fri  rest
Sat  6 km easy
Sun  20 min walk

Week 2 — build
Mon  rest
Tue  5 km easy
Wed  cross-train, 35 min
Thu  6 × 400 m, 90 s jog between
Fri  rest
Sat  7 km easy, last kilometre at pace
Sun  20 min walk`;

const CODE = `def pace(distance_km: float, target: str) -> float:
    """Seconds per kilometre for a target finish time."""
    minutes, seconds = (int(part) for part in target.split(":"))
    return (minutes * 60 + seconds) / distance_km


if __name__ == "__main__":
    print(pace(5, "25:00"))`;

/** The card on its own: a window, and a way in. */
export const Card: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
      <ArtifactCard
        id="plan"
        title="5k training plan"
        meta="8 weeks"
        kind="text"
        content={PLAN}
        onOpen={() => {}}
      />
      <ArtifactCard
        id="pace"
        title="pace.py"
        meta="Python"
        kind="code"
        lang="python"
        content={CODE}
        onOpen={() => {}}
      />
    </div>
  ),
};

/**
 * Being written. The title shimmers rather than being replaced by a spinner —
 * it is the name of the thing, and a reader who cannot see the animation still
 * reads the name.
 */
export const BeingWritten: Story = {
  render: () => (
    <div style={{ maxWidth: 520 }}>
      <ArtifactCard id="plan" title="5k training plan" state="writing" kind="text" />
    </div>
  ),
};

/** The pane, with nothing in it yet — which is what opening one usually finds. */
export const PaneSkeleton: Story = {
  render: () => (
    <div style={{ height: 420, maxWidth: 420 }}>
      <ArtifactPane title="5k training plan" meta="8 weeks · being written" onClose={() => {}} />
    </div>
  ),
};

/**
 * The whole pattern: press the card, the plan opens on the right, press it
 * again and it closes.
 *
 * Narrow the Storybook viewport past 760px of *this container* and the pane
 * covers the conversation instead — same component, told it is modal, so it
 * holds focus and answers Escape.
 */
export const TheWholeThing: Story = {
  render: function TheWholeThing() {
    const artifacts = useArtifacts();

    return (
      <div style={{ height: 480, display: "flex" }}>
        <ChatLayout
          pane={({ narrow, expanded, toggleExpanded }) =>
            artifacts.openId ? (
              <ArtifactPane
                title="5k training plan"
                meta="8 weeks · 4 runs a week"
                modal={narrow}
                expanded={expanded}
                onToggleExpanded={toggleExpanded}
                onClose={artifacts.close}
              >
                <pre style={{ margin: 0, font: "inherit", whiteSpace: "pre-wrap" }}>{PLAN}</pre>
              </ArtifactPane>
            ) : null
          }
        >
          <Conversation scrollButton={false}>
            <ArtifactCard
              id="plan"
              title="5k training plan"
              meta="8 weeks"
              kind="text"
              content={PLAN}
              open={artifacts.openId === "plan"}
              onOpen={artifacts.toggle}
            />
          </Conversation>
        </ChatLayout>
      </div>
    );
  },
};
