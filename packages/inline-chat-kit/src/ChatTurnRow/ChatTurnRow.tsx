"use client";

import { memo, type Ref } from "react";
import { motion } from "motion/react";
import { AnswerActions, type Verdict } from "../AnswerActions/AnswerActions";
import { Branch } from "../Branch/Branch";
import { ChatInput, type ChatInputHandle, type InlineAnimConfig } from "../ChatInput/ChatInput";
import type { Attachment } from "../Attachments/Attachments";
import { Loader } from "../Loader/Loader";
import { Reasoning } from "../Reasoning/Reasoning";
import { Tool } from "../Tool/Tool";
import { Approval, type Decision } from "../Approval/Approval";
import { TaskList } from "../TaskList/TaskList";
import { ChainOfThought } from "../ChainOfThought/ChainOfThought";
import { Sources } from "../Sources/Sources";
import { QuestionGroup, type FoldMotion } from "../QuestionGroup/QuestionGroup";
import type { Answer } from "../QuestionCard/types";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import type { ChatTurn } from "../useChatTurns/useChatTurns";
import styles from "./ChatTurnRow.module.css";

export interface ChatTurnRowProps {
  turn: ChatTurn;
  /** This row owns the live composer: the one the reader types the next question into. */
  isActiveInput?: boolean;
  inputRef?: Ref<ChatInputHandle> | null;
  placeholder?: string;
  animationConfig?: InlineAnimConfig;
  /** Overrides for a question group's fold timing. See `defaultFoldMotion`. */
  foldMotion?: Partial<FoldMotion>;
  /** Stagger for the entrance, in seconds. */
  entranceDelay?: number;
  /** Passed through to the highlighter over the answer. */
  selectionMode?: "marker" | "precise";

  /**
   * Where the composer sits in the row.
   *
   * `end` by default, because it is about to become the reader's own bubble
   * and those sit right. `stretch` fills the row instead, which is what an
   * *opening* composer wants: on an empty conversation it is not a message
   * yet, it is the thing under the openers — and a pill floating at the right
   * edge of a centred block reads as unrelated to the block.
   */
  questionAlign?: "end" | "stretch";

  /**
   * Every callback takes the turn's id rather than being closed over per row.
   *
   * Not a style choice. An inline arrow is a new function on every render, and
   * a new function prop is what makes `memo` give up — see the note on the
   * component below. Taking the id lets a consumer hoist these once.
   */
  onDraft?: (id: string, value: string) => void;
  onSubmit?: (id: string, value: string, attachments: Attachment[]) => void;
  onStop?: () => void;
  onEdit?: (id: string) => void;
  onCancelEdit?: (id: string) => void;
  /** Defaults to writing to the clipboard. */
  onCopy?: (value: string) => void;
  onHighlight?: (turnId: string, text: string) => void;
  onReplyInThread?: (text: string, rect: DOMRect) => void;

  /**
   * The row of actions under a settled answer.
   *
   * Copy is always offered once there is something to copy. Regenerate and the
   * thumbs are drawn only when there is somewhere for them to report to, so a
   * host that has no use for them is not showing a button that does nothing.
   *
   * They appear when the answer *settles*, not while it arrives: offering to
   * copy a half-written answer, or to rate one, is offering the wrong thing.
   */
  onRegenerate?: (id: string) => void;
  /** Show another of this turn's answers. Without it the control is inert, so
      it is not drawn. */
  onShowVersion?: (id: string, index: number) => void;
  onFeedback?: (id: string, verdict: Verdict | null) => void;
  feedback?: Verdict | null;
  /** Leave the row out entirely. */
  answerActions?: boolean;

  /**
   * A question the assistant asked, answered.
   *
   * The row does not keep the answer — `turn.parts` is the host's, and this is
   * how it hears that one of them changed. `useChatTurns` gives you
   * `updatePart` to write it back.
   */
  onAnswerQuestion?: (turnId: string, partId: string, questionId: string, answer: Answer) => void;
  /** Somebody asked to change an answer already given. */
  onEditQuestion?: (turnId: string, partId: string, index: number) => void;

  /**
   * Something the agent asked to do, decided.
   *
   * Same shape as the question callbacks and for the same reason: the row does
   * not keep the decision, it reports it. Write it back with `updatePart`.
   */
  onDecideApproval?: (turnId: string, partId: string, decision: Decision) => void;

  className?: string;
}

const copyToClipboard = (value: string) => {
  void navigator.clipboard?.writeText(value);
};

/**
 * One turn: the question as a composer that has become a bubble, and the
 * answer beneath it.
 *
 * Not `Message`, because it is not one. The user half is a live input that
 * morphs into its own bubble rather than a rendered record of what was typed
 * — which is the whole idea, and the reason the row is a turn.
 *
 * **Memoised, and the memo is load-bearing.** `useChatTurns` already leaves
 * untouched turns referentially identical when it rewrites one of them, but
 * that only pays off if the rows can act on it. Left inline in a `.map()`,
 * every row re-renders on every flush anyway, because the parent re-rendered.
 * Measured before this existed: streaming a second answer produced 366 DOM
 * mutations inside the first, already-finished turn.
 *
 * The two halves have to be in place together. Stable objects give React the
 * grounds to skip; `memo` is what makes it skip.
 */
export const ChatTurnRow = memo(function ChatTurnRow({
  turn,
  isActiveInput = false,
  inputRef = null,
  placeholder,
  animationConfig,
  foldMotion,
  entranceDelay = 0,
  selectionMode = "marker",
  questionAlign = "end",
  onDraft,
  onSubmit,
  onStop,
  onEdit,
  onCancelEdit,
  onCopy = copyToClipboard,
  onHighlight,
  onReplyInThread,
  onRegenerate,
  onShowVersion,
  onFeedback,
  feedback = null,
  answerActions = true,
  onAnswerQuestion,
  onEditQuestion,
  onDecideApproval,
  className,
}: ChatTurnRowProps) {
  // A row arriving is travel, and this reader has asked for less of it. The
  // fade stays: without it a turn would appear with no transition at all,
  // which reads as a glitch rather than as calm.
  const still = prefersReducedMotion();
  const offset = still ? 0 : -16;
  // A turn a host built by hand may not have any.
  const parts = turn.parts ?? [];
  const cited = parts.find((part) => part.kind === "sources")?.sources;

  return (
    <motion.article
      id={`turn-${turn.id}`}
      className={[styles.turn, className ?? ""].filter(Boolean).join(" ")}
      /* Which row is the live composer is something only this component knows,
         and a hashed CSS-module class is not something a host can target. So
         it is stated as an attribute.

         The one that needs it: a page with a gradient fading the conversation
         off the bottom edge has no way to exempt the box you type in, and a
         washed-out composer reads as one you are not allowed to use. */
      data-active-input={isActiveInput || undefined}
      aria-busy={turn.state === "responding" || undefined}
      initial={{ opacity: 0, y: offset }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: offset }}
      transition={{ duration: still ? 0.15 : 0.4, ease: [0.22, 1, 0.36, 1], delay: entranceDelay }}
    >
      <div className={styles.question} data-align={questionAlign}>
        <ChatInput
          ref={inputRef}
          /* A flex child sizes to its content, and the composer has a width of
             its own — so stretching the row is not enough on its own. */
          style={questionAlign === "stretch" ? { width: "100%" } : undefined}
          state={turn.state}
          value={turn.user}
          onChange={(v) => onDraft?.(turn.id, v)}
          onSubmit={(v, files) => onSubmit?.(turn.id, v, files)}
          /* The bubble *is* the message, so what went with it is shown by the
             same composer that held it — read-only once it is sent, because a
             sent message is a record. */
          attachments={turn.attachments}
          onStop={onStop}
          onCopy={onCopy}
          onEdit={() => onEdit?.(turn.id)}
          onCancelEdit={() => onCancelEdit?.(turn.id)}
          // An edit, rather than a first draft: there is already an answer
          // under this input, so the buttons say save and cancel.
          isEditing={turn.ai.length > 0 && turn.state === "typing"}
          animationConfig={animationConfig}
          placeholder={placeholder}
        />
      </div>

      {/* One block, so the row's generous gap sits between the question and
          everything the answer is made of — and not between a tool call and
          the sentence it produced, which belong together. */}
      <div className={styles.body}>
        {parts.map((part) => {
          switch (part.kind) {
            case "reasoning":
              return (
                <Reasoning key={part.id} state={part.state} duration={part.duration}>
                  {part.text ?? ""}
                </Reasoning>
              );
            case "tool":
              return (
                <Tool
                  key={part.id}
                  name={part.name ?? ""}
                  state={part.state}
                  summary={part.summary}
                  input={part.input}
                  output={part.output}
                  error={part.error}
                  duration={part.duration}
                />
              );
            case "tasks":
              return (
                <TaskList
                  key={part.id}
                  title={part.title}
                  tasks={part.tasks ?? []}
                  collapsible={part.collapsible}
                />
              );
            case "chain":
              return (
                <ChainOfThought
                  key={part.id}
                  steps={part.steps ?? []}
                  state={part.state}
                  duration={part.duration}
                />
              );
            case "sources":
              return (
                <Sources
                  key={part.id}
                  sources={part.sources ?? []}
                  title={part.title}
                  collapsible={part.collapsible}
                />
              );
            case "approval":
              return (
                <Approval
                  key={part.id}
                  title={part.title}
                  description={part.description}
                  decision={part.decision ?? null}
                  onDecide={(decision) => onDecideApproval?.(turn.id, part.id, decision)}
                >
                  {part.tool && (
                    <Tool
                      name={part.tool.name}
                      state="pending"
                      input={part.tool.input}
                      defaultOpen
                    />
                  )}
                </Approval>
              );
            case "question":
              return (
                <QuestionGroup
                  key={part.id}
                  id={part.id}
                  title={part.title}
                  questions={part.questions ?? []}
                  answers={part.answers ?? {}}
                  activeIndex={part.activeIndex}
                  collapsible={part.collapsible}
                  readOnly={part.readOnly}
                  foldMotion={foldMotion}
                  onCommit={(questionId, answer) =>
                    onAnswerQuestion?.(turn.id, part.id, questionId, answer)
                  }
                  onEdit={(index) => onEditQuestion?.(turn.id, part.id, index)}
                />
              );
          }
        })}

      {/* Sent, and nothing back yet. Without this the turn is a question with
          a blank space under it, which reads as nothing having happened.
          Silent on purpose: `useChatTurns` has already announced that a
          response is coming, and a second live region says it twice. */}
      {turn.state === "responding" && !turn.ai && parts.length === 0 && (
        <div className={styles.answer}>
          <Loader />
        </div>
      )}

      {turn.ai && (
        <div className={styles.answer}>
          <TextHighlighter
            text={turn.ai}
            selectionMode={selectionMode}
            /* What `[^1]` in the answer points at. The first sources part in
               the turn, because an answer stands on one list — a second would
               make the numbering ambiguous the moment both are non-empty. */
            sources={cited}
            onHighlightComplete={(text) => onHighlight?.(turn.id, text)}
            onReplyInThread={onReplyInThread}
          />

          {answerActions && turn.state === "resting" && (
            <div className={styles.actions}>
              {/* Draws nothing until there are two, so a turn answered once
                  looks exactly as it did before there were versions at all. */}
              <Branch
                total={turn.versions?.length ?? 0}
                index={turn.versionIndex ?? 0}
                onSelect={(index) => onShowVersion?.(turn.id, index)}
              />
              <AnswerActions
                text={turn.ai}
                onCopy={onCopy}
                onRegenerate={onRegenerate ? () => onRegenerate(turn.id) : undefined}
                onFeedback={onFeedback ? (verdict) => onFeedback(turn.id, verdict) : undefined}
                feedback={feedback}
              />
            </div>
          )}
        </div>
      )}
      </div>
    </motion.article>
  );
});
