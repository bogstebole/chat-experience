import type { Meta, StoryObj } from "@storybook/react-vite";
import { SystemMessage } from "../SystemMessage/SystemMessage";
import { Context } from "../Context/Context";
import { Tool } from "../Tool/Tool";

/**
 * The conversation saying something about itself.
 *
 * `Context` warns that the window is nearly full and then nothing speaks when
 * it fills — the meter goes red and the oldest messages start dropping out in
 * silence. This is what says so.
 *
 * There is no icon, and that is the point of the component rather than an
 * omission from it: every picture in this kit carries a state the words beside
 * it also carry, so a reader the picture does not reach loses nothing. An icon
 * here would say "something is being announced" next to a sentence announcing
 * it.
 */
const meta: Meta<typeof SystemMessage> = {
  title: "Components/SystemMessage",
  component: SystemMessage,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof SystemMessage>;

/** Two tones, because `Context` already settled that three is one too many. */
export const Tones: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
      <SystemMessage>The oldest messages are dropping out of the window.</SystemMessage>
      <SystemMessage tone="danger">
        Lost the connection. Nothing since your last message was saved.
      </SystemMessage>
    </div>
  ),
};

/** Long enough to wrap, since a sentence that says what happens next usually is. */
export const ItWraps: Story = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <SystemMessage>
        The model changed partway through this answer, so the first half and the second half were
        not written by the same one.
      </SystemMessage>
    </div>
  ),
};

/**
 * What it is for: the meter has been red for a while, and this is the moment
 * the window actually filled.
 *
 * Beside a folded tool call, because that is the height it was built to match
 * — both are one row on a recessed surface at the row corner.
 */
export const InAConversation: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
      <Context used={7960} total={8000} />
      <SystemMessage>The oldest messages are dropping out of the window.</SystemMessage>
      <Tool name="search_web" summary="3 results" duration={412} input={{ query: "belgrade" }} />
    </div>
  ),
};
