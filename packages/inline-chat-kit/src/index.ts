// ─────────────────────────────────────────────
//  inline-chat-kit — public API
// ─────────────────────────────────────────────

import "./styles/tokens.css";

/* Core input */
export { ChatInput, defaultInlineAnimConfig } from "./ChatInput/ChatInput";
export type {
  ChatInputProps,
  ChatInputHandle,
  ChatInputState,
  InlineAnimConfig,
} from "./ChatInput/ChatInput";

/* Input internals — exported so consumers can recompose the input */
export { AddCardsOverlay } from "./ChatInput/AddCardsOverlay";
export type { AddCardsOverlayProps } from "./ChatInput/AddCardsOverlay";
export { HoverActionsRow } from "./ChatInput/HoverActionsRow";
export type { HoverActionsRowProps } from "./ChatInput/HoverActionsRow";
export { MorphGlyph } from "./ChatInput/MorphGlyph";
export type { MorphGlyphProps } from "./ChatInput/MorphGlyph";

/* Turn state, streaming and the reveal — the half a host app owns */
export { useChatTurns } from "./useChatTurns/useChatTurns";
export type {
  ChatAnnouncements,
  ChatTurn,
  SendContext,
  SendHandler,
  UseChatTurnsOptions,
  UseChatTurnsResult,
} from "./useChatTurns/useChatTurns";

/* Screen-reader announcements. `useChatTurns` speaks through this already;
   exported so a host app can announce its own errors into the same region
   rather than adding a competing one. */
export { announce } from "./announce/announce";
export type { Politeness } from "./announce/announce";

/* The chrome above the conversation */
export { ChatHeader } from "./ChatHeader/ChatHeader";
export type {
  ChatHeaderAction,
  ChatHeaderProps,
  ChatHeaderSize,
  ChatHeaderStatus,
  ChatHeaderVariant,
} from "./ChatHeader/ChatHeader";

/* Conversation surface */
export { ReplyThreadPopup } from "./ReplyThreadPopup/ReplyThreadPopup";
export type { ReplyThreadPopupProps, Turn } from "./ReplyThreadPopup/ReplyThreadPopup";
export { TextHighlighter } from "./TextHighlighter/TextHighlighter";
export type { TextHighlighterProps } from "./TextHighlighter/TextHighlighter";
export { CustomCursor } from "./CustomCursor/CustomCursor";

/* Buttons — one component, four materials */
export { Button } from "./Button/Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button/Button";
/** @deprecated Use `<Button variant="glass">`. A wrapper, not a component. */
export { default as GlassButton } from "./GlassButton/GlassButton";
export type { GlassButtonProps, GlassButtonSize } from "./GlassButton/GlassButton";
