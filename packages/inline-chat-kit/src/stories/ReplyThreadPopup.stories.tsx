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
 *
 * **Open this in a phone viewport too.** Below 760px it stops hanging off the
 * phrase and comes up from the bottom, with a grabber and a drag to put it
 * away — the same sheet the artifact pane becomes, with the same tokens.
 * Hanging off a phrase needs somewhere to hang, and a phone has nowhere:
 * measured at 390×844 with a passage 556px down, the panel ended at 920 after
 * one reply, 76px past the bottom edge, and every message after it pushed
 * more out of reach. Not something a story can switch on — the breakpoint
 * answers to the window, not to a knob — so it is asserted in
 * `tools/mobile/reach-check.mjs`, against this story.
 */
export const Open: StoryObj<typeof ReplyThreadPopup> = {
  args: {
    activeReply: { text: "the most fundamental constituents of matter", rect: anchor() },
    onClose: () => {},
    onSendMessage: async (message: string) => `You asked: "${message}".`,
  },
};
