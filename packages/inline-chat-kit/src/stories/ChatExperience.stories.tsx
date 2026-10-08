import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChatExperience, type ChatExperienceProps } from "../ChatExperience/ChatExperience";
import { useChatTurns, type SendHandler, type UseChatTurnsResult } from "../useChatTurns/useChatTurns";
import { ArtifactPane } from "../Artifact/ArtifactPane";
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

/**
 * The host draws the pane.
 *
 * `pane="none"` keeps the kit out of the way — no pane, no room made for one —
 * and `openArtifactId` / `onOpenArtifactChange` put which one is open in the
 * host's state. The host's column holds an `<ArtifactPane>` keyed by id. Ask
 * for the 5k plan and press its card; the conversation does not move.
 */
export const HostDrawnPane: Story = {
  render: function HostDrawnPane(args) {
    const [openId, setOpenId] = useState<string | null>(null);
    return (
      /* The page is the ground; the chat and the host's pane are two cards on
         it, with the same ring of space around both. */
      <div style={{ display: "flex", height: "100vh", background: "var(--ick-page)" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
          <ChatExperience
            {...args}
            {...Opening.args}
            pane="none"
            surface="panes"
            openArtifactId={openId}
            onOpenArtifactChange={setOpenId}
          />
        </div>
        {openId && (
          <div
            style={{
              width: 380,
              flexShrink: 0,
              /* No divider: the gap is what says these are two panes. The
                 chat's own ring of space is `--ick-chat-pane-inset`, so the
                 host's card keeps the same on the three sides it owns. */
              padding: "var(--ick-chat-pane-inset) var(--ick-chat-pane-inset) var(--ick-chat-pane-inset) 0",
              boxSizing: "border-box",
              display: "flex",
            }}
          >
            <ArtifactPane
              key={openId}
              title="The host's own column"
              meta={`openArtifactId = "${openId}"`}
              onClose={() => setOpenId(null)}
            >
              <p style={{ margin: 0, color: "var(--ick-ink-soft)" }}>
                Drawn by the host, next to a ChatExperience that made no room for it.
              </p>
            </ArtifactPane>
          </div>
        )}
      </div>
    );
  },
};

/**
 * Two panes, drawn by the kit.
 *
 * `surface="panes"` makes the conversation a card of its own, so the artifact
 * pane beside it is a second surface rather than a strip cut off the same one.
 * Ask for the 5k plan and open its card.
 */
export const TwoPanes: Story = {
  args: {
    ...Everything.args,
    surface: "panes",
  },
};

/**
 * Everything the host has no use for, off.
 *
 * All of it is decided in code rather than offered in the interface — a
 * product either marks passages or it does not, and a switch for it is a
 * question nobody asked. `highlights={false}` draws answers as prose and
 * takes the saved highlights and the selection-mode pair with it;
 * `headerActions={false}` drops the theme toggle and Share;
 * `composerMenu={false}` takes the "+" away; no `onThreadReply`, no threads.
 */
export const Stripped: Story = {
  args: {
    ...Opening.args,
    composer: "docked",
    highlights: false,
    headerActions: false,
    composerMenu: false,
  },
};

/**
 * The composer at the bottom, the way most chats keep it.
 *
 * `composer="docked"`: the conversation stacks above the box, the view follows
 * the answer being written, and the box is always there — the next question
 * can be typed while this one is answered, and the send waits. Sent, the
 * message still becomes its bubble: the same element travels up into the
 * conversation and a fresh composer takes its place.
 */
export const Docked: Story = {
  args: {
    ...Opening.args,
    composer: "docked",
    onTranscribe: scriptedTranscript,
  },
};

/** Docked, and a pane of its own beside it. */
export const DockedTwoPanes: Story = {
  args: {
    ...Everything.args,
    composer: "docked",
    surface: "panes",
  },
};

/**
 * Embedded in a host's shell, the way nearly every product places a chat.
 *
 * `fill="container"`: the chat is as tall as the card it is in, not the
 * window. The card here is inset 12px top and bottom and clips what overflows
 * it — which is exactly where `"window"` hung 24px past the card and cut a
 * docked composer in half.
 */
export const Embedded: Story = {
  render: function Embedded(args) {
    return (
      <HostShell>
        <ChatExperience {...args} {...Opening.args} fill="container" composer="docked" />
      </HostShell>
    );
  },
};

/** A host's shell: its own navigation, and a card inset 12px that clips. */
function HostShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        boxSizing: "border-box",
        padding: "12px 12px 12px 0",
        background: "var(--ick-ground)",
      }}
    >
      <nav
        aria-label="The host's own navigation"
        style={{ width: 200, flexShrink: 0, padding: 16, color: "var(--ick-ink-soft)" }}
      >
        Host app
      </nav>
      <div
        data-host-card=""
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          borderRadius: "var(--ick-chat-pane-radius)",
          background: "var(--ick-page)",
          boxShadow: "var(--ick-chat-pane-shadow)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A model that says nothing for 2.5 seconds, then the whole answer at once.
 *
 * Most real APIs look like this from the composer — a request, a wait, a
 * response — and the demo's script never did: it starts talking the moment it
 * is asked, and a view that only moves when the answer grows cannot be told
 * from one that moves when the message is sent.
 */
const thinksFirst: SendHandler = async function* () {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  yield "Here is what I would change this week. Two small things, and one that matters.";
  yield { kind: "notice", id: "saved", text: "Saved to the plan." };
};

const silentOpening = {
  title: "How can I help?",
  suggestions: ["What is waiting on me?", "She walks with a frame now"],
};

/**
 * Sent, the message goes to the top at once — not when the answer arrives.
 * Seconds of silence are when a reader most needs to see what they asked.
 */
export const ThinksFirst: Story = {
  render: function ThinksFirst(args) {
    return (
      <HostShell>
        <ChatExperience
          {...args}
          onSend={thinksFirst}
          empty={silentOpening}
          fill="container"
          composer="docked"
        />
      </HostShell>
    );
  },
};

/**
 * The host keeps the chat in a store and publishes it from an effect, so only
 * the chat redraws for every streamed frame — which hands the kit the turns a
 * render after the press. The sent message still goes to the top at once.
 */
export const ChatInAStore: Story = {
  render: function ChatInAStore(args) {
    const [store] = useState(createChatStore);
    return (
      <HostShell>
        <StoreSource store={store} />
        <StoreChat store={store} {...args} />
      </HostShell>
    );
  },
};

function createChatStore() {
  let value: UseChatTurnsResult | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: UseChatTurnsResult) => {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
type ChatStore = ReturnType<typeof createChatStore>;

/* Where the hook lives: mounted once, drawing nothing, publishing its result. */
function StoreSource({ store }: { store: ChatStore }) {
  const chat = useChatTurns({ onSend: thinksFirst, nextTurn: "at-send" });
  useEffect(() => {
    store.set({ ...chat });
    // The hook's functions are stable; what changes is the turns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, chat.turns, chat.isStreaming]);
  return null;
}

function StoreChat({ store, ...args }: { store: ChatStore } & ChatExperienceProps) {
  const chat = useSyncExternalStore(store.subscribe, store.get);
  if (!chat) return null;
  return (
    <ChatExperience
      {...args}
      onSend={undefined}
      chat={chat}
      empty={silentOpening}
      fill="container"
      composer="docked"
    />
  );
}
