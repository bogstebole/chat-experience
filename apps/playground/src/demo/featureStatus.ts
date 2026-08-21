export interface InlineChatFeatureStatus {
  works: string[];
  notWorking: string[];
  soon: string[];
}

export const INLINE_CHAT_FEATURE_STATUS: InlineChatFeatureStatus = {
  works: ["Send a message", "Attach a single image", "Multiline input"],
  notWorking: ["Copy", "Edit", "Other dropdown actions"],
  soon: ["Customization", "Threads", "Voice"],
};
