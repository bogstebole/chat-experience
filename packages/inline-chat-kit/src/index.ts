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
  ChatHeaderVariant,
} from "./ChatHeader/ChatHeader";

/* One turn: the question as a composer that became a bubble, and the answer */
export { ChatTurnRow } from "./ChatTurnRow/ChatTurnRow";
export type { ChatTurnRowProps } from "./ChatTurnRow/ChatTurnRow";

/* What you can do to an answer once it has arrived */
export { AnswerActions } from "./AnswerActions/AnswerActions";
export type { AnswerActionsProps, Verdict } from "./AnswerActions/AnswerActions";

/* What the agent did on the way to the answer, and what it thought */
export { Tool } from "./Tool/Tool";
export type { ToolProps, ToolState } from "./Tool/Tool";
export { Reasoning } from "./Reasoning/Reasoning";
export type { ReasoningProps, ReasoningState } from "./Reasoning/Reasoning";
export { TaskList } from "./TaskList/TaskList";
export type { Task, TaskListProps, TaskState } from "./TaskList/TaskList";

/* Structured questions inside a conversation */
export { QuestionCard, answerChips } from "./QuestionCard/QuestionCard";
export type { QuestionCardProps } from "./QuestionCard/QuestionCard";
export type {
  Answer,
  Question,
  QuestionField,
  QuestionOption,
  QuestionState,
} from "./QuestionCard/types";
export { QuestionGroup, FOLDABLE_FROM } from "./QuestionGroup/QuestionGroup";
export type { QuestionGroupProps } from "./QuestionGroup/QuestionGroup";

/* The parts a card is built from — exported so a fourth kind of question is a
   composition rather than a fork of this one. */
export {
  QuestionBadge,
  QuestionFieldRow,
  QuestionOptionRow,
  QuestionOtherRow,
  QuestionShell,
} from "./QuestionCard/parts";
export type {
  QuestionBadgeProps,
  QuestionFieldRowProps,
  QuestionOptionRowProps,
  QuestionOtherRowProps,
  QuestionShellProps,
} from "./QuestionCard/parts";
export { Chip } from "./Chip/Chip";
export type { ChipProps } from "./Chip/Chip";

/* Before anybody has asked, and while the first word is on its way */
export { EmptyState } from "./EmptyState/EmptyState";
export type { EmptyStateProps } from "./EmptyState/EmptyState";
export { Loader } from "./Loader/Loader";
export type { LoaderProps, LoaderVariant } from "./Loader/Loader";

/* The scroll container that keeps up with an answer, and lets go */
export { Conversation } from "./Conversation/Conversation";
export type { ConversationProps } from "./Conversation/Conversation";

/* Fenced code inside an answer, and on its own */
export { CodeBlock } from "./CodeBlock/CodeBlock";
export type { CodeBlockProps } from "./CodeBlock/CodeBlock";

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
