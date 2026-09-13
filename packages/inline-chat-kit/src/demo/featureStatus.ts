export interface InlineChatFeatureStatus {
  works: string[];
  notWorking: string[];
  soon: string[];
}

/**
 * What this demo can actually do, checked rather than remembered.
 *
 * It had drifted in both directions at once: threads sat under "Soon" while
 * working, and copy sat under "Not working" while putting 434 characters on
 * the clipboard. A list nobody trusts is worse than no list, because the one
 * thing it is for is telling a visitor what to try.
 *
 * Everything under `works` was driven in a browser before it was written here.
 * Everything under `notWorking` is simulated on purpose — this page has no
 * model behind it and says so above. `soon` is tier I of the roadmap.
 */
export const INLINE_CHAT_FEATURE_STATUS: InlineChatFeatureStatus = {
  works: [
    "Send, stop, edit",
    "Multiline input",
    "Attach an image",
    "Dictate a message",
    "Copy an answer",
    "Rate an answer",
    "Regenerate and compare",
    "Highlight a passage",
    "Reply in a thread",
    "Answer questions inline",
    "Approve a tool call",
    "Open a plan in a pane",
    "Reasoning and tools",
    "Sources and citations",
    "Light and dark",
  ],
  notWorking: [
    "Real model answers",
    "Real speech to text",
  ],
  soon: [
    "Mobile",
    "A fixed composer",
    "Queue a message",
    "Saved conversations",
  ],
};
