import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReplyThreadPopup } from "../ReplyThreadPopup/ReplyThreadPopup";

const anchor = () =>
  ({
    x: 160, y: 220, width: 320, height: 22,
    top: 220, left: 160, right: 480, bottom: 242,
    toJSON: () => ({}),
  }) as DOMRect;

const meta: Meta<typeof ReplyThreadPopup> = {
  title: "Components/ReplyThreadPopup",
  component: ReplyThreadPopup,
  parameters: { layout: "fullscreen" },
};

export default meta;

/**
 * A dialog: focus lands in the input, tab wraps at both ends, escape closes.
 * The reply comes from `onSendMessage` — the package has no answers of its own.
 */
export const Open: StoryObj<typeof ReplyThreadPopup> = {
  args: {
    activeReply: { text: "the most fundamental constituents of matter", rect: anchor() },
    onClose: () => {},
    onSendMessage: async (message: string) => `You asked: "${message}".`,
  },
};
