import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bookmark, Share, Highlighter, TextCursor, Sun, Moon } from "lucide-react";

import { ChatHeader, type ChatHeaderAction } from "../ChatHeader/ChatHeader";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import { Context } from "../Context/Context";
import { announce } from "../announce/announce";
import { ArtifactPane } from "../Artifact/ArtifactPane";
import { ChatLayout } from "../Artifact/ChatLayout";
import { useArtifacts } from "../Artifact/useArtifacts";
import { Conversation } from "../Conversation/Conversation";
import { EmptyState } from "../EmptyState/EmptyState";
import { ReplyThreadPopup, type ReplyThreadPopupProps } from "../ReplyThreadPopup/ReplyThreadPopup";
import { SystemMessage } from "../SystemMessage/SystemMessage";
import { CustomCursor } from "../CustomCursor/CustomCursor";
import { useChatTurns, type UseChatTurnsOptions } from "../useChatTurns/useChatTurns";
import { type FoldMotion } from "../QuestionGroup/QuestionGroup";
import { type InlineAnimConfig, type ChatInputHandle } from "../ChatInput/ChatInput";
import { type TranscribeHandler } from "../voice/useVoiceInput";
import { type TurnPartUpdate } from "../turnParts/turnParts";
import { type Answer } from "../QuestionCard/types";
import { type Decision } from "../Approval/Approval";
import { type Attachment } from "../Attachments/Attachments";
import { useThemeAttribute } from "../theme/useThemeAttribute";
import styles from "./ChatExperience.module.css";

/**
 * The whole thing, assembled.
 *
 * ## Why this is in the kit and not in your page
 *
 * Every other export here is a piece: a header, a scroll container, a turn, a
 * pane. Putting them together is a page's job right up until two pages do it,
 * and then it is a copy — which is exactly what happened. The playground's
 * page and the website's page were 865 and 890 lines of ~90% identical code,
 * along with 537 identical lines of scripted answers and 300 of stylesheet.
 *
 * That copy is where the last three reported faults lived. Not in the kit: in
 * the fact that a fix went into one page and the other kept the old one. The
 * header rendered see-through because the second copy never defined `--bg`.
 * The empty state snapped out of existence because the second copy never got
 * the `AnimatePresence`. The sent message stayed pinned to the top for the
 * rest of the session because the second copy never got the released anchor.
 *
 * So the assembly lives here, where a fix is made once and arrives everywhere
 * by `npm install`. What stays a host's: the answers, the copy, the artifact's
 * contents, the logo, where "back" goes. Content and identity — the two things
 * a library cannot know and should not guess.
 *
 * ## What it does that a page would have to remember to
 *
 * Holds the sent turn at the top while its answer is written and lets go when
 * it settles. Keeps a title from the first question actually asked rather than
 * from the first keystroke. Announces a full context window once, through the
 * kit's own live region rather than a second one. Places the artifact pane
 * *beside* the conversation rather than inside it, which is the difference
 * between a pane and a modal. Asks whether there is a pointer before drawing a
 * cursor for it.
 */

/** The opening block, before anybody has asked anything. */
export interface ChatExperienceEmpty {
  title: string;
  description?: string;
  /** One opener per branch of your `onSend`, ideally: everything the kit can
      draw becomes reachable by pressing something rather than by knowing what
      to type. Sent, not typed into the box — an opener that only fills the
      input asks somebody to press send on a sentence they did not write. */
  suggestions?: string[];
}

/** What the pane shows while an artifact is open. The kit draws the pane; what
    is inside it is the host's, which is why this returns children. */
export interface ChatExperienceArtifact {
  title: string;
  meta?: string;
  children: ReactNode;
}

/** A part the host drives, handed the writer for the turn it belongs to. */
export type PartWriter = (turnId: string, part: TurnPartUpdate) => void;

export interface ChatExperienceProps {
  /** Where answers come from. Return a string, a promise of one, or an async
      iterable of deltas — see `useChatTurns`. */
  onSend: UseChatTurnsOptions["onSend"];
  /** Speech to text. The kit records; the host transcribes. Omit and the
      microphone does not appear. */
  onTranscribe?: TranscribeHandler;
  /** A follow-up asked on a passage. Omit and replying in a thread is off. */
  onThreadReply?: ReplyThreadPopupProps["onSendMessage"];

  /** Shown in the header until a question has actually been asked. */
  title?: string;
  /** Where the back control goes. */
  backHref?: string;
  backLabel?: string;
  /** Extra header actions, added after the ones this manages. */
  actions?: ChatHeaderAction[];

  placeholder?: string;
  empty?: ChatExperienceEmpty;

  /** The context meter. Leave `contextTotal` off and there is no meter. A real
      app reads this off its API's usage; a demo can count it off the text. */
  contextTotal?: number;
  /** What a system prompt and the tool definitions cost before anybody types. */
  contextBase?: number;

  /** The pane beside the conversation, asked for the artifact that is open. */
  artifact?: (openId: string) => ChatExperienceArtifact | null;

  /** The theme, if the host keeps it. Left off, this manages its own and puts
      a toggle in the header; `data-theme` on the root element either way, and
      unset until somebody chooses, so the kit follows the system preference —
      which is what it is there for. */
  theme?: "light" | "dark" | null;
  onThemeChange?: (theme: "light" | "dark") => void;

  /** The pointer-following cursor, and the rule that hides the real one. Only
      ever where there is a pointer to replace. */
  cursor?: boolean;
  /** The freeform-marker / precise-selection pair in the header. */
  selectionToggle?: boolean;

  /** How far below the top edge a sent message comes to rest. Sets the
      conversation's own top padding too — the two have to agree, so one number
      writes both. */
  anchorOffset?: number;
  /** Room left under the composer once an answer settles. */
  endOffset?: number;

  /** Motion, opened up so a tuning panel can reach it. */
  animationConfig?: InlineAnimConfig;
  foldMotion?: FoldMotion;
  /** How long the feed waits before its first row arrives. */
  feedDelay?: number;

  /* The structured parts, each handed the writer first so a host can answer a
     questionnaire or run what an approval approved without this component
     having to know what either means. */
  onAnswerQuestion?: (
    write: PartWriter,
    turnId: string,
    partId: string,
    questionId: string,
    answer: Answer
  ) => void;
  onEditQuestion?: (write: PartWriter, turnId: string, partId: string, index: number) => void;
  onDecideApproval?: (
    write: PartWriter,
    turnId: string,
    partId: string,
    decision: Decision
  ) => void;

  className?: string;
}

interface Highlight {
  turnId: string;
  text: string;
}

export function ChatExperience({
  onSend,
  onTranscribe,
  onThreadReply,
  title = "Chat",
  backHref,
  backLabel,
  actions,
  placeholder,
  empty,
  contextTotal,
  contextBase = 0,
  artifact,
  theme: themeProp,
  onThemeChange,
  cursor = false,
  selectionToggle = false,
  anchorOffset = 100,
  endOffset = 120,
  animationConfig,
  foldMotion,
  feedDelay = 0,
  onAnswerQuestion,
  onEditQuestion,
  onDecideApproval,
  className,
}: ChatExperienceProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showHighlights, setShowHighlights] = useState(false);
  const [activeReply, setActiveReply] = useState<{ text: string; rect: DOMRect } | null>(null);
  const [selectionMode, setSelectionMode] = useState<"marker" | "precise">("marker");
  const activeInputRef = useRef<ChatInputHandle>(null);

  /* The theme, set the way any host app sets it: `data-theme` on the root
     element — but only once somebody has actually chosen one. Until then the
     attribute stays off and the kit follows the system preference. */
  const controlled = themeProp !== undefined;
  const [ownTheme, setOwnTheme] = useState<"light" | "dark" | null>(null);
  const chosen = controlled ? themeProp : ownTheme;
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const theme = chosen ?? (systemDark ? "dark" : "light");
  useThemeAttribute(chosen);
  const setTheme = useCallback(
    (next: "light" | "dark") => {
      if (!controlled) setOwnTheme(next);
      onThemeChange?.(next);
    },
    [controlled, onThemeChange]
  );

  const { turns, setDraft, submit, showVersion, stop, beginEdit, cancelEdit, updatePart } =
    useChatTurns({ onSend });

  /* The turn the view is held on.

     Sending a message takes you to it, and it stays there while the answer
     arrives underneath — so what is on screen is your question and its answer,
     rather than the whole conversation pushed up from below. Recorded on
     submit because that is the moment it means: `useChatTurns` has no notion
     of "the one just sent", and inferring it from state would pick up an edit
     of an old turn as well. */
  const [anchorTurnId, setAnchorTurnId] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (id: string, value: string, attachments?: Attachment[]) => {
      setAnchorTurnId(id);
      submit(id, value, attachments);
    },
    [submit]
  );

  /* And let go of it once the answer has settled.

     Held and never released, the view stays pinned to that question for the
     rest of the session — and the composer, which in this kit is the *next*
     turn, sits below the fold permanently. You could finish reading an answer
     and have nowhere visible to type.

     Derived rather than cleared by an effect. An effect that calls `setState`
     is a second render to undo the first, and the answer is a function of what
     the turn already is: `resting` is set once, when an answer stops arriving,
     and only then. Releasing on `typing` would let go while somebody was still
     editing the question. */
  const anchoredTurn = anchorTurnId ? (turns.find((t) => t.id === anchorTurnId) ?? null) : null;
  const heldAnchor = anchoredTurn && anchoredTurn.state !== "resting" ? anchorTurnId : null;

  /* Regenerating is the same submit: `useChatTurns` rewrites a turn that
     already has an answer in place rather than starting a new one. */
  const handleRegenerate = useCallback(
    (id: string) => {
      setAnchorTurnId(id);
      submit(id);
    },
    [submit]
  );

  /* Nothing asked yet: one turn, and it is still blank. */
  const isEmpty = turns.length === 1 && !turns[0].user && !turns[0].ai;

  /* What the conversation has spent so far, counted off the text at four
     characters to the token — close enough for a meter and costing nothing. */
  const contextUsed =
    contextBase +
    Math.round(
      turns.reduce(
        (n, turn) =>
          n + turn.user.length + turn.ai.length + JSON.stringify(turn.parts ?? []).length,
        0
      ) / 4
    );

  /* And when it actually fills, something says so.

     The meter warns from 80% and then goes quiet at the moment it matters:
     the oldest messages start dropping out and nothing in the conversation
     mentions it, which makes the model look forgetful rather than the window
     look full. */
  const windowFull = contextTotal !== undefined && contextUsed >= contextTotal;
  const announcedFull = useRef(false);
  useEffect(() => {
    if (!windowFull) {
      announcedFull.current = false;
      return;
    }
    if (announcedFull.current) return;
    announcedFull.current = true;
    /* Through the kit's own region. The component deliberately opens none of
       its own — two live regions say everything twice. */
    announce("The oldest messages are dropping out of the window.");
  }, [windowFull]);

  /* Which artifact the pane is showing. Held here rather than in either the
     card or the pane, because they are in different parts of the tree and both
     need the answer. */
  const artifacts = useArtifacts();

  /* Kept per turn rather than as one value, or rating a second answer would
     silently un-rate the first. */
  const [verdicts, setVerdicts] = useState<Record<string, "up" | "down" | null>>({});
  const handleFeedback = useCallback((id: string, verdict: "up" | "down" | null) => {
    setVerdicts((all) => ({ ...all, [id]: verdict }));
  }, []);

  /* What the header shows. The first question actually asked, so someone
     arriving at a conversation already in progress can see what it is about —
     falling back to the name of the thing before anyone has asked anything.

     `state` is what makes it the first question rather than the first draft:
     the turn's text is written on every keystroke, so matching on the text
     alone retitled the page letter by letter as somebody typed. */
  const conversationTitle =
    turns
      .find((turn) => turn.state !== "idle" && turn.state !== "typing" && turn.user.trim())
      ?.user.trim() ?? title;

  const handleHighlight = useCallback((turnId: string, text: string) => {
    if (text.trim().length > 0) {
      setHighlights((prev) => [...prev, { turnId, text: text.trim() }]);
    }
  }, []);

  const handleReplyInThread = useCallback((text: string, rect: DOMRect) => {
    setActiveReply({ text, rect });
  }, []);

  /* Bound to `updatePart` here so the host's handler keeps the plain shape it
     would have had in a page, and stays stable across renders — `ChatTurnRow`
     is memoised, and a callback rebuilt every render is what makes `memo` give
     up. */
  const answerQuestion = useMemo(
    () =>
      onAnswerQuestion
        ? (turnId: string, partId: string, questionId: string, answer: Answer) =>
            onAnswerQuestion(updatePart, turnId, partId, questionId, answer)
        : undefined,
    [onAnswerQuestion, updatePart]
  );
  const editQuestion = useMemo(
    () =>
      onEditQuestion
        ? (turnId: string, partId: string, index: number) =>
            onEditQuestion(updatePart, turnId, partId, index)
        : undefined,
    [onEditQuestion, updatePart]
  );
  const decideApproval = useMemo(
    () =>
      onDecideApproval
        ? (turnId: string, partId: string, decision: Decision) =>
            onDecideApproval(updatePart, turnId, partId, decision)
        : undefined,
    [onDecideApproval, updatePart]
  );

  /* Whether this reader has a pointer at all. Read once and watched, because a
     tablet with a trackpad plugged in changes its answer. */
  const [finePointer, setFinePointer] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia ||
      window.matchMedia("(pointer: fine)").matches
  );
  useEffect(() => {
    if (!cursor) return;
    const query = window.matchMedia("(pointer: fine)");
    const read = () => setFinePointer(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, [cursor]);

  const headerActions: ChatHeaderAction[] = [
    ...(highlights.length > 0
      ? [
          {
            id: "bookmarks",
            label: "Saved highlights",
            icon: <Bookmark size={16} aria-hidden />,
            count: highlights.length,
            pinned: true,
            onClick: () => setShowHighlights(true),
          },
        ]
      : []),
    {
      id: "theme",
      label: theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme",
      icon: theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />,
      active: theme === "dark",
      onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
    },
    {
      id: "share",
      label: "Share",
      icon: <Share size={16} aria-hidden />,
      onClick: () =>
        navigator.share?.({ title: conversationTitle, url: window.location.href }),
    },
    ...(actions ?? []),
  ];

  const open = artifacts.openId ? artifact?.(artifacts.openId) : null;

  const chat = (
    <motion.div
      className={[styles.page, "ick-chat-page", className].filter(Boolean).join(" ")}
      style={{ "--ick-experience-anchor": `${anchorOffset}px` } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{
        opacity: activeReply || showHighlights ? 0.4 : 1,
        filter: activeReply || showHighlights ? "blur(3px)" : "blur(0px)",
        scale: activeReply || showHighlights ? 0.9 : 1,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}
      onAnimationComplete={() => {
        /* Only when nobody is anywhere. This fires whenever the page settles —
           including after a thread closes, where the dialog has just handed
           focus back to the highlight it came from. Taking it unconditionally
           undid that and dropped the reader in the composer instead. */
        if (document.activeElement && document.activeElement !== document.body) return;
        activeInputRef.current?.focus();
      }}
    >
      <div className={styles.topBlur} />
      <ChatHeader
        className={`${styles.header} ick-chat-header`}
        /* The first question, so a reader arriving mid-conversation can see
           what it is about. `truncate` is what makes that safe: a question is
           a sentence, not a label. */
        title={conversationTitle}
        backHref={backHref}
        backLabel={backLabel}
        /* The page already has its own gradient doing this job. */
        elevateOnScroll={false}
        collapseActionsAt={480}
        actions={headerActions}
      >
        {contextTotal !== undefined && (
          /* With its percentage, not without. `label={false}` leaves a bare
             ring in a header, and a bare ring beside a row of icons reads as a
             spinner — something loading, not something measured. */
          <Context className={styles.context} used={contextUsed} total={contextTotal} />
        )}

        {selectionToggle && (
          /* The kit does not manage this one through `actions`: a segmented
             control has no icon-and-label shape to fold into a menu. */
          <div className={styles.selectMode} role="group" aria-label="Selection mode">
            <button
              type="button"
              data-active={selectionMode === "marker"}
              onClick={() => setSelectionMode("marker")}
              aria-label="Freeform marker"
              title="Freeform marker"
            >
              <Highlighter size={16} />
            </button>
            <button
              type="button"
              data-active={selectionMode === "precise"}
              onClick={() => setSelectionMode("precise")}
              aria-label="Precise text selection"
              title="Precise text selection"
            >
              <TextCursor size={16} />
            </button>
          </div>
        )}
      </ChatHeader>

      <Conversation
        viewportClassName={`${styles.feed} ick-chat-feed`}
        anchorId={heldAnchor ? `turn-${heldAnchor}` : undefined}
        /* `anchorOffset` has to match the viewport's own `padding-top`, or a
           turn brought to the top lands under the fixed header — so the same
           number sets both, and the stylesheet reads it back out of the custom
           property. Two places that must agree, written once. */
        anchorOffset={anchorOffset}
        /* Room under the composer once an answer settles. The last turn is the
           input, and flush against the bottom edge of a phone is where the
           browser's own chrome sits, so this is about a composer's height of
           air under it. */
        endOffset={endOffset}
      >
        {isEmpty && empty && (
          <EmptyState
            /* The opening block and the composer under it share one column, so
               they read as one thing. See `.opening`. */
            className={styles.opening}
            title={empty.title}
            description={empty.description}
            suggestions={empty.suggestions}
            onSuggestion={(text) => handleSubmit(turns[0].id, text)}
          />
        )}

        <AnimatePresence>
          {turns.map((turn, i) => {
            const live =
              i === turns.length - 1 && (turn.state === "idle" || turn.state === "typing");
            return (
              <ChatTurnRow
                key={turn.id}
                turn={turn}
                /* Nothing has been asked yet, so this is not a message on its
                   way — it is the box under the openers, and it lines up with
                   them. */
                questionAlign={isEmpty && i === 0 ? "stretch" : "end"}
                className={isEmpty && i === 0 ? styles.opening : undefined}
                onTranscribe={onTranscribe}
                isActiveInput={live}
                inputRef={live ? activeInputRef : null}
                entranceDelay={i === 0 ? feedDelay : 0}
                selectionMode={selectionMode}
                animationConfig={animationConfig}
                foldMotion={foldMotion}
                openArtifactId={artifacts.openId}
                onOpenArtifact={(_turnId, id) => artifacts.toggle(id)}
                placeholder={placeholder}
                onDraft={setDraft}
                onSubmit={handleSubmit}
                onRegenerate={handleRegenerate}
                onShowVersion={showVersion}
                onFeedback={handleFeedback}
                feedback={verdicts[turn.id] ?? null}
                onStop={stop}
                onEdit={beginEdit}
                onCancelEdit={cancelEdit}
                onHighlight={handleHighlight}
                onReplyInThread={onThreadReply ? handleReplyInThread : undefined}
                onAnswerQuestion={answerQuestion}
                onEditQuestion={editQuestion}
                onDecideApproval={decideApproval}
              />
            );
          })}
        </AnimatePresence>

        {windowFull && (
          <SystemMessage>The oldest messages are dropping out of the window.</SystemMessage>
        )}
      </Conversation>
      <div className={styles.bottomBlur} />
    </motion.div>
  );

  return (
    <>
      {cursor && (
        <>
          {/* Hidden from the mouse, and there is no mouse on a phone. Left on,
              the rule hides a cursor nobody has while the component keeps
              listening for pointer moves that only ever arrive as taps. */}
          <style
            dangerouslySetInnerHTML={{
              __html: `@media (pointer: fine) { * { cursor: none !important; } }`,
            }}
          />
          {finePointer && <CustomCursor />}
        </>
      )}

      {/* The pane is a page-level thing: it stands beside the chat column, not
          inside it. Wrapped around the page instead, `ChatLayout` was 656px
          wide — under its own breakpoint — so the pane went modal and covered
          a conversation it was meant to sit next to. */}
      <ChatLayout
        className={styles.workspace}
        /* On a phone the pane is a sheet, and a sheet's ways out belong to the
           layout: dragged down, or the conversation behind it pressed. */
        onDismiss={artifacts.close}
        pane={({ narrow, expanded, toggleExpanded }) =>
          open ? (
            <ArtifactPane
              title={open.title}
              meta={open.meta}
              modal={narrow}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              onClose={artifacts.close}
            >
              {open.children}
            </ArtifactPane>
          ) : null
        }
      >
        {chat}
      </ChatLayout>

      <AnimatePresence>
        {showHighlights && (
          <motion.div
            className={styles.scrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHighlights(false)}
          >
            <motion.div
              className={styles.sheet}
              role="dialog"
              aria-label="Saved highlights"
              initial={{ y: 20, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.sheetHead}>
                <h2 className={styles.sheetTitle}>Highlights</h2>
                <button className={styles.close} onClick={() => setShowHighlights(false)}>
                  Close
                </button>
              </div>

              {Array.from(new Set(highlights.map((h) => h.turnId))).map((turnId, index) => (
                <div key={turnId} className={styles.group}>
                  <h3 className={styles.groupTitle}>Paragraph {index + 1}</h3>
                  <div className={styles.marks}>
                    {highlights
                      .filter((h) => h.turnId === turnId)
                      .map((h, i) => (
                        <button
                          key={i}
                          type="button"
                          className={styles.mark}
                          onClick={() => {
                            setShowHighlights(false);
                            /* After the sheet has gone, so the scroll is not
                               competing with an exit animation for the frame. */
                            setTimeout(() => {
                              const el = document.getElementById(`turn-${turnId}`);
                              const feed = document.querySelector(".ick-chat-feed");
                              const header = document.querySelector(".ick-chat-header");
                              if (el && feed) {
                                const top = header ? (header as HTMLElement).offsetHeight : 80;
                                feed.scrollTo({ top: el.offsetTop - top - 16, behavior: "smooth" });
                              } else {
                                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                              }
                            }, 100);
                          }}
                        >
                          {h.text}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeReply && onThreadReply && (
          <ReplyThreadPopup
            key="thread-popup"
            activeReply={activeReply}
            onClose={() => setActiveReply(null)}
            /* Prose only: a thread is a follow-up on a passage, and a tool call
               inside a popover over the answer would be absurd. */
            onSendMessage={onThreadReply}
          />
        )}
      </AnimatePresence>
    </>
  );
}
