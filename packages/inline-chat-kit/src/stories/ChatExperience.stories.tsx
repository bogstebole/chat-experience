import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useMemo } from "react";
import { ChatExperience } from "../ChatExperience/ChatExperience";
import { useChatTurns } from "../useChatTurns/useChatTurns";
import type { Decision } from "../Approval/Approval";
import type { PartWriter } from "../ChatExperience/ChatExperience";
import { hostRenderer, serbianApi, serbianLabels } from "./hostCards";
import { scriptedApi, threadReply, scriptedTranscript, RUNNING_PLAN } from "../demo/scriptedApi";

/**
 * The assembled experience — every other story here is a piece of it.
 *
 * It takes the whole viewport by design: a fixed header over a scrolling
 * conversation with a composer at the end of it is a page, not a card, and
 * putting it in a 320px box would show something nobody will ever see. So the
 * stories are `fullscreen`, and what varies between them is what a host
 * actually decides — whether there is a meter, an artifact pane, openers.
 */
const meta: Meta<typeof ChatExperience> = {
  title: "Components/ChatExperience",
  component: ChatExperience,
  parameters: { layout: "fullscreen" },
  args: {
    onSend: scriptedApi,
    title: "inline chat experience",
    placeholder: "Ask me about particle physics…",
  },
};

export default meta;
type Story = StoryObj<typeof ChatExperience>;

/**
 * What a host gets for one required prop. A header with a title, a
 * conversation, a composer, and the anchor that takes a sent message to the
 * top and lets go of it when the answer settles.
 */
export const Bare: Story = {};

/** Before anybody has asked: the opening block, and the composer under it in
    the same column so the two read as one thing. */
export const Opening: Story = {
  args: {
    empty: {
      title: "Ask me about particle physics",
      description: "The Standard Model, the Higgs, and what a boson actually is.",
      suggestions: [
        "What does particle physics actually study?",
        "How big is the Higgs boson?",
        "Write me a plan for running a 5k",
      ],
    },
  },
};

/**
 * Everything switched on: the meter, the selection modes, threads, dictation,
 * and the pane beside the conversation.
 *
 * Ask for the 5k plan to open the pane — it stands *beside* the conversation
 * rather than over it, and becomes a sheet only where there is no room for a
 * column, which is what `ChatLayout` decides.
 */
export const Everything: Story = {
  args: {
    ...Opening.args,
    onTranscribe: scriptedTranscript,
    onThreadReply: threadReply,
    contextTotal: 8_000,
    contextBase: 900,
    selectionToggle: true,
    backHref: "/",
    backLabel: "Back to home",
    artifact: () => ({
      title: "5k training plan",
      meta: "8 weeks · 4 sessions a week",
      children: (
        <pre
          style={{
            margin: 0,
            fontFamily: "var(--ick-font-sans)",
            fontSize: "var(--ick-text-sm)",
            lineHeight: 1.65,
            color: "var(--ick-ink-soft)",
            whiteSpace: "pre-wrap",
          }}
        >
          {RUNNING_PLAN}
        </pre>
      ),
    }),
  },
};

/**
 * The meter as it fills. A small window, so it is worth looking at — a 200k
 * one sits at 1% all afternoon and never shows what the component does at the
 * end. Past the total, a system message says the oldest messages are dropping
 * out, and the same sentence goes to the live region once.
 */
export const NearlyFull: Story = {
  args: {
    ...Everything.args,
    contextTotal: 1_200,
    contextBase: 1_000,
  },
};

/**
 * The whole chat in Serbian, with the host's own cards, and without the
 * actions a host has no use for.
 *
 * - `labels` — one object, every piece. Anything left out stays English.
 * - `chat` — the host's own `useChatTurns`, so its cards can write back with
 *   `updatePart` after the answer has finished ("Primeni na plan" →
 *   "Primenjeno").
 * - `renderPart` — the cards: a proposed change, a request to send, a button
 *   that opens a page in the app.
 * - `headerActions={false}` and `composerMenu={false}` — no theme toggle, no
 *   Share, no "+" menu.
 */
export const Localized: Story = {
  render: function Localized() {
    const chat = useChatTurns({ onSend: serbianApi, announcements: { responding: "Stiže odgovor" } });
    const renderPart = useMemo(() => hostRenderer(chat.updatePart), [chat.updatePart]);
    const decide = useCallback(
      (write: PartWriter, turnId: string, partId: string, decision: Decision) =>
        write(turnId, { kind: "approval", id: partId, decision }),
      []
    );
    return (
      <ChatExperience
        chat={chat}
        renderPart={renderPart}
        labels={serbianLabels}
        headerActions={false}
        composerMenu={false}
        onDecideApproval={decide}
        empty={{
          title: "Kako mogu da pomognem?",
          description: "Pitaj za plan treninga, pa primeni izmene jednim klikom.",
          suggestions: ["Prilagodi mi plan za sledeću nedelju"],
        }}
      />
    );
  },
};
