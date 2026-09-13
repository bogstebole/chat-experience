// ─────────────────────────────────────────────
//  inline-chat-kit/demo — the scripted showcase
// ─────────────────────────────────────────────
//
//  Not the library's surface; that is `inline-chat-kit`. This is the demo two
//  apps were each keeping their own copy of — a landing page, a chat wired to
//  scripted answers, and the answers themselves. Behind its own entry point,
//  so an app that never imports it never carries a byte of it.

export { ChatExperienceDemo } from "./ChatExperienceDemo";
export type { ChatExperienceDemoProps } from "./ChatExperienceDemo";

export { IntroLanding } from "./IntroLanding";
export type { IntroLandingProps, IntroMotion } from "./IntroLanding";

export { InlineChatBanner } from "./InlineChatBanner";
export { INLINE_CHAT_FEATURE_STATUS } from "./featureStatus";
export type { InlineChatFeatureStatus } from "./featureStatus";

/* The answers themselves, for anyone assembling the demo differently. */
export {
  QUESTIONS,
  RUNNING_PLAN,
  scriptedApi,
  threadReply,
  scriptedTranscript,
} from "./scriptedApi";
