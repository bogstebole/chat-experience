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

/* Conversation surface */
export { ReplyThreadPopup } from "./ReplyThreadPopup/ReplyThreadPopup";
export type { ReplyThreadPopupProps, Turn } from "./ReplyThreadPopup/ReplyThreadPopup";
export { TextHighlighter } from "./TextHighlighter/TextHighlighter";
export type { TextHighlighterProps } from "./TextHighlighter/TextHighlighter";
export { CustomCursor } from "./CustomCursor/CustomCursor";

/* Buttons */
export { Button } from "./Button/Button";
export type { ButtonProps, ButtonVariant } from "./Button/Button";
export { default as GlassButton } from "./GlassButton/GlassButton";
export type { GlassButtonProps, GlassButtonSize } from "./GlassButton/GlassButton";
