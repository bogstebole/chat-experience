import type { Meta, StoryObj } from "@storybook/react-vite";
import { MinimalChat } from "../examples/minimal";

/**
 * What [getting-started.md](../../getting-started.md) gives you, running.
 *
 * The page opens with one file and claims it is a working chat with no
 * backend. This is that exact file — a test asserts the page quotes it
 * character for character, `tsc -b` compiles it on every build, and this
 * renders it, so the claim is checked three ways and none of them is a
 * screenshot somebody took once.
 *
 * Type, press enter. The pill you typed into becomes the bubble holding your
 * message, travels to the top, and the answer is revealed underneath at
 * reading pace. `onSend` here echoes what you said, which is the point: there
 * is no backend, and the kit has no answers of its own.
 */
const meta: Meta<typeof MinimalChat> = {
  title: "Getting started/The whole thing",
  component: MinimalChat,
  parameters: { layout: "fullscreen" },
};

export default meta;

export const MinimalChatExample: StoryObj<typeof MinimalChat> = {
  name: "Minimal chat",
};
