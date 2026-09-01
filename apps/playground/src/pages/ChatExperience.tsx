import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { useDialKit } from "dialkit";
import { Bookmark, Share, Highlighter, TextCursor, Sun, Moon } from "lucide-react";
import {
  Button,
  ChatHeader,
  ChatTurnRow,
  Context,
  announce,
  ArtifactPane,
  ChatLayout,
  Conversation,
  defaultFoldMotion,
  EmptyState,
  ReplyThreadPopup,
  SystemMessage,
  CustomCursor,
  defaultInlineAnimConfig,
  useArtifacts,
  useChatTurns,
  type Answer,
  type Attachment,
  type ChatInputHandle,
  type Decision,
} from "inline-chat-kit";
import { Logo } from "../demo/Logo";
import { InlineChatBanner } from "../demo/InlineChatBanner";
import { INLINE_CHAT_FEATURE_STATUS } from "../demo/featureStatus";
import { requestedTheme } from "../demo/showcase";
import { QUESTIONS, RUNNING_PLAN, scriptedApi, threadReply } from "../demo/scriptedApi";
import introStyles from "./IntroChatLanding.module.css";
import "./ChatExperience.css";

type Phase = "intro" | "chat";

/** A small window, so the meter is worth looking at. See `contextUsed`. */
const CONTEXT_TOTAL = 8_000;
/** What a system prompt and the tool definitions cost before anybody types. */
const CONTEXT_BASE = 900;

interface Highlight {
  turnId: string;
  text: string;
}

export function ChatExperience() {
  const dial = useDialKit("Animation Setup", {
    "Entrance Animation": {
      staggerDelay: [0.07, 0, 0.5],
      stiffness: [100, 50, 800],
      damping: [36, 5, 100],
      yOffset: [-10, -100, 100],
      blur: [10, 0, 50],
    },
    "Start Experience": {
      staggerDelay: [0.07, 0, 0.5],
      duration: [0.28, 0, 1],
      yOffset: [-10, -100, 100],
      blur: [10, 0, 50],
    },
    "Chat Feed": {
      delay: [0.3, 0, 1.5],
    },
    /* The question group's fold. `visualDuration` is how long the box *looks*
       like it takes — Motion solves the spring for it — and `bounce` is how
       far it overshoots. Two numbers you can answer a question with, rather
       than a stiffness and a damping that between them describe the same
       spring without telling you how long it is.

       The row numbers are the same idea one level down: rows arrive one after
       the next, each a little above its place and settling into it. `fadeIn`
       and `fadeOut` are tweens on purpose — opacity is bounded, so a spring on
       it overshoots into a clamp and spends the overshoot sitting still. */
    "Question Fold": {
      visualDuration: [defaultFoldMotion.visualDuration, 0.1, 1.2],
      bounce: [defaultFoldMotion.bounce, 0, 0.8],
      rowDuration: [defaultFoldMotion.rowDuration, 0.1, 1.2],
      rowBounce: [defaultFoldMotion.rowBounce, 0, 0.8],
      rowOffset: [defaultFoldMotion.rowOffset, -60, 60],
      stagger: [defaultFoldMotion.stagger, 0, 0.25],
      fadeIn: [defaultFoldMotion.fadeIn, 0, 0.6],
      fadeOut: [defaultFoldMotion.fadeOut, 0, 0.6],
      fadeInDelay: [defaultFoldMotion.fadeInDelay, 0, 0.4],
    },
  });

  // Force light mode for the chat experience
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    if (wasDark) {
      document.documentElement.classList.remove("dark");
    }
    return () => {
      if (wasDark) {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);

  const introContainerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: dial["Entrance Animation"].staggerDelay,
      },
    },
    exit: {
      transition: {
        staggerChildren: dial["Start Experience"].staggerDelay,
        staggerDirection: -1 as const,
      },
    },
  };

  const introItemVariants: Variants = {
    hidden: { 
      opacity: 0, 
      filter: `blur(${dial["Entrance Animation"].blur}px)`, 
      y: dial["Entrance Animation"].yOffset 
    },
    visible: { 
      opacity: 1, 
      filter: "blur(0px)", 
      y: 0,
      transition: { 
        type: "spring", 
        stiffness: dial["Entrance Animation"].stiffness, 
        damping: dial["Entrance Animation"].damping 
      }
    },
    exit: {
      opacity: 0,
      filter: `blur(${dial["Start Experience"].blur}px)`,
      y: dial["Start Experience"].yOffset,
      transition: { duration: dial["Start Experience"].duration, ease: [0.4, 0, 1, 1] as const },
    },
  };

  const [phase, setPhase] = useState<Phase>("intro");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showHighlightsModal, setShowHighlightsModal] = useState(false);
  const [activeReply, setActiveReply] = useState<{ text: string, rect: DOMRect } | null>(null);

  /**
   * The theme, set the way any host app sets it: `data-theme` on the root
   * element — but only once somebody has actually chosen one. Until then the
   * attribute stays off and the kit follows the system preference, which is
   * what it is there for.
   */
  const [chosen, setChosen] = useState<"light" | "dark" | null>(requestedTheme);
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const theme = chosen ?? (systemDark ? "dark" : "light");
  useEffect(() => {
    if (chosen) document.documentElement.setAttribute("data-theme", chosen);
    else document.documentElement.removeAttribute("data-theme");
  }, [chosen]);
  const [selectionMode, setSelectionMode] = useState<"marker" | "precise">("marker");
  const activeInputRef = useRef<ChatInputHandle>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const animConfig = defaultInlineAnimConfig;

  const { turns, setDraft, submit, showVersion, stop, beginEdit, cancelEdit, updatePart } =
    useChatTurns({
    onSend: scriptedApi,
  });

  /* The answers to a question the assistant asked.
     
     Held in a ref rather than in state, and read only inside the handler: the
     row is memoised, and a callback rebuilt on every render is what makes
     `memo` give up. Keyed by the part's id, so two questionnaires in one
     conversation do not share answers. */
  const answersRef = useRef<Record<string, Record<string, Answer>>>({});

  const handleAnswerQuestion = useCallback(
    (turnId: string, partId: string, questionId: string, answer: Answer) => {
      const given = { ...(answersRef.current[partId] ?? {}), [questionId]: answer };
      answersRef.current[partId] = given;

      const next = QUESTIONS.findIndex((q) => q.id === questionId) + 1;
      const finished = next >= QUESTIONS.length;
      updatePart(turnId, {
        kind: "question",
        id: partId,
        title: "Setting up the run",
        questions: QUESTIONS,
        answers: given,
        activeIndex: finished ? null : next,
        // Once every question is answered the whole step folds to one row.
        collapsible: finished,
      });
    },
    [updatePart]
  );

  /* A decision the agent asked for. Recorded on the part it was asked on, and
     then the thing it asked about either happens or does not — which in a demo
     with no shell is one more part rather than a command. */
  const handleDecideApproval = useCallback(
    (turnId: string, partId: string, decision: Decision) => {
      updatePart(turnId, { kind: "approval", id: partId, decision });
      if (decision === "denied") return;

      updatePart(turnId, {
        kind: "tool",
        id: `${partId}-ran`,
        name: "bash",
        state: "running",
        summary: "Removing Shots/",
        input: { command: "rm -rf Shots/" },
      });
      window.setTimeout(() => {
        updatePart(turnId, {
          kind: "tool",
          id: `${partId}-ran`,
          name: "bash",
          state: "done",
          summary: "42 files removed",
          duration: 380,
          output: "removed 42 files, 3 directories",
        });
      }, 1100);
    },
    [updatePart]
  );

  const handleEditQuestion = useCallback(
    (turnId: string, partId: string, index: number) => {
      updatePart(turnId, {
        kind: "question",
        id: partId,
        questions: QUESTIONS,
        answers: answersRef.current[partId] ?? {},
        activeIndex: index,
        collapsible: false,
      });
    },
    [updatePart]
  );

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

  /* What the conversation has spent so far. A real app reads this off the
     API's `usage`; here it is counted off the text, four characters to the
     token, which is close enough for a meter and costs nothing. The window is
     small on purpose — a 200k one would sit at 1% all afternoon and never show
     what the component does when it fills. */
  const contextUsed =
    CONTEXT_BASE +
    Math.round(
      turns.reduce(
        (n, turn) => n + turn.user.length + turn.ai.length + JSON.stringify(turn.parts ?? []).length,
        0
      ) / 4
    );

  /* Which artifact the pane is showing. Held here rather than in either the
     card or the pane, because they are in different parts of the tree and both
     need the answer. */
  const artifacts = useArtifacts();

  /* And when it actually fills, something says so.

     The meter warns from 80% and then goes quiet at the moment it matters:
     the oldest messages start dropping out and nothing in the conversation
     mentions it, which makes the model look forgetful rather than the window
     look full. A host places this by hand — the other way in is a `notice`
     part off a stream, and nothing here streams one. */
  const windowFull = contextUsed >= CONTEXT_TOTAL;
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
    turns.find((turn) => turn.state !== "idle" && turn.state !== "typing" && turn.user.trim())
      ?.user.trim() ?? "inline chat experience";

  const handleStart = () => {
    setPhase("chat");
  };

  const handleHighlight = useCallback((turnId: string, text: string) => {
    if (text.trim().length > 0) {
      setHighlights((prev) => [...prev, { turnId, text: text.trim() }]);
    }
  }, []);

  const handleReplyInThread = useCallback((text: string, rect: DOMRect) => {
    setActiveReply({ text, rect });
  }, []);


  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `* { cursor: none !important; }` }} />
      <CustomCursor />
      <AnimatePresence mode="wait">
      {phase === "intro" ? (
        <motion.div
          key="intro"
          className={introStyles.page}
          variants={introContainerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className={introStyles.container}>
            <div className={introStyles.infoContainer}>
              <motion.div variants={introItemVariants}>
                <Logo />
              </motion.div>
              <div className={introStyles.content}>
                <div className={introStyles.introContent}>
                  <motion.div className={introStyles.nameContent} variants={introItemVariants}>
                    <span className={introStyles.welcome}>Welcome</span>
                    <span className={introStyles.title}>This is inline chat experience</span>
                  </motion.div>
                  <motion.span className={introStyles.version} variants={introItemVariants}>v1.0.0</motion.span>
                </div>
                <motion.p className={introStyles.description} variants={introItemVariants}>
                  Exploration of having the input be the same as response. Or better said input
                  morphing into chat bubble and maintains the continuous experience.
                </motion.p>
              </div>
            </div>

            <motion.div variants={introItemVariants} className={introStyles.mobileNotice}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingInline: 4, paddingBottom: 4 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, marginTop: 1, color: "var(--ick-ink)" }}>
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M8 7v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="8" cy="5" r="0.8" fill="currentColor" />
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace", fontSize: 12, lineHeight: "16px", letterSpacing: "-0.02em", color: "var(--ick-ink)" }}>
                    Desktop only for now
                  </span>
                  <span style={{ fontFamily: "var(--font-geist-sans), 'Geist', system-ui, sans-serif", fontSize: 12, lineHeight: "18px", color: "var(--ick-ink-soft)" }}>
                    Inline chat experience is built for desktop. Mobile support is on the way, check back soon.
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div variants={introItemVariants} className={introStyles.mobileButton}>
              <a href="/">
                <Button variant="glass" size="m">Back to home</Button>
              </a>
            </motion.div>

            <motion.div variants={introItemVariants} className={introStyles.bannerWrapper}>
              <InlineChatBanner status={INLINE_CHAT_FEATURE_STATUS} />
            </motion.div>

            {/* Invisible elements to consume stagger slots and create a pause before the button animates */}
            <motion.div variants={introItemVariants} style={{ display: "none" }} />
            <motion.div variants={introItemVariants} style={{ display: "none" }} />
            <motion.div variants={introItemVariants} style={{ display: "none" }} />

            <motion.div variants={introItemVariants} className={introStyles.buttonWrapper}>
              <Button variant="glass" size="m" onClick={handleStart}>
                Start experience
              </Button>
              <a href="/" className="secondaryBtn">
                Back to home
              </a>
            </motion.div>
          </div>
        </motion.div>
      ) : (
        /* The pane is a page-level thing: it stands beside the chat column,
           not inside it. Wrapped around `.chatPage` instead, `ChatLayout` was
           656px wide — under its own breakpoint — so the pane went modal and
           covered a conversation it was meant to sit next to. Measured, not
           guessed; it is the sort of thing that looks right in a component's
           own story and wrong the moment it is in a page. */
        <ChatLayout
          key="chat"
          className="chatWorkspace"
          pane={({ narrow }) =>
            artifacts.openId ? (
              <ArtifactPane
                title="5k training plan"
                meta="8 weeks · 4 sessions a week"
                modal={narrow}
                onClose={artifacts.close}
              >
                {/* The host's, not the kit's. A plan here, a document or a
                    table somewhere else — which is the whole reason the pane
                    takes children rather than content. */}
                <pre className="planText">{RUNNING_PLAN}</pre>
              </ArtifactPane>
            ) : null
          }
        >
        <motion.div
          className="chatPage"
          initial={{ opacity: 0 }}
          animate={{
            opacity: (activeReply || showHighlightsModal) ? 0.4 : 1,
            filter: (activeReply || showHighlightsModal) ? "blur(3px)" : "blur(0px)",
            scale: (activeReply || showHighlightsModal) ? 0.9 : 1
          }}
          transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}
          onAnimationComplete={() => {
            // Only when nobody is anywhere. This fires whenever the page
            // settles — including after a thread closes, where the dialog has
            // just handed focus back to the highlight it came from. Taking it
            // unconditionally undid that and dropped the reader in the
            // composer instead.
            if (document.activeElement && document.activeElement !== document.body) return;
            activeInputRef.current?.focus();
          }}
        >
          <div className="topBlur" />
          <ChatHeader
            className="chatHeader"
            /* The first question, so a reader arriving mid-conversation can
               see what it is about. `truncate` is what makes that safe: a
               question is a sentence, not a label. */
            title={conversationTitle}
            backHref="/"
            backLabel="Back to home"
            /* The page already has its own gradient doing this job. */
            elevateOnScroll={false}
            collapseActionsAt={480}
            actions={[
              ...(highlights.length > 0
                ? [
                    {
                      id: "bookmarks",
                      label: "Saved highlights",
                      icon: <Bookmark size={16} aria-hidden />,
                      count: highlights.length,
                      pinned: true,
                      onClick: () => setShowHighlightsModal(true),
                    },
                  ]
                : []),
              {
                id: "theme",
                label: theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme",
                icon: theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />,
                active: theme === "dark",
                onClick: () => setChosen(theme === "dark" ? "light" : "dark"),
              },
              {
                id: "share",
                label: "Share",
                icon: <Share size={16} aria-hidden />,
                onClick: () =>
                  navigator.share?.({
                    title: "Inline chat experience",
                    url: window.location.href,
                  }),
              },
            ]}
          >
            {/* What the conversation has spent. A real app reads this off the
                API's usage; here it grows with the turns, which is enough to
                see the meter fill and to see it warn.

                With its percentage, not without. `label={false}` leaves a bare
                ring in a header, and a bare ring beside a row of icons reads
                as a spinner — something loading, not something measured. The
                sentence is in the tooltip either way, but a tooltip is not
                where anybody finds out what a thing is. */}
            <Context className="headerContext" used={contextUsed} total={CONTEXT_TOTAL} />

            {/* The kit does not manage this one: a segmented control has no
                icon-and-label shape to fold into a menu. */}
            <div className="selectModeToggle" role="group" aria-label="Selection mode">
              <button
                type="button"
                data-active={selectionMode === "marker"}
                onClick={() => setSelectionMode("marker")}
                aria-label="Freeform marker"
                title="Freeform marker"
              >
                <Highlighter size={15} />
              </button>
              <button
                type="button"
                data-active={selectionMode === "precise"}
                onClick={() => setSelectionMode("precise")}
                aria-label="Precise text selection"
                title="Precise text selection"
              >
                <TextCursor size={15} />
              </button>
            </div>
          </ChatHeader>
          <Conversation
            ref={feedRef}
            viewportClassName="chatFeed"
            anchorId={anchorTurnId ? `turn-${anchorTurnId}` : undefined}
            /* Matches the viewport's own `padding-top`, so a turn brought to
               the top lands where the first one already sits rather than
               under the fixed header. */
            anchorOffset={100}
          >
            {isEmpty && (
              <EmptyState
                /* The opening block and the composer under it share one
                   column, so they read as one thing. See `.opening`. */
                className="opening"
                title="Ask me about particle physics"
                description="The Standard Model, the Higgs, and what a boson actually is."
                /* One opener per branch of `scriptedApi`, so everything the
                   kit can draw is reachable by pressing something rather than
                   by knowing what to type. */
                suggestions={[
                  "What does particle physics actually study?",
                  "How big is the Higgs boson?",
                  "Write me a plan for running a 5k",
                  "How do you know — show me your sources",
                  "What would you do first — give me a plan",
                  "Set up a double-slit experiment",
                  "Delete the screenshots",
                ]}
                /* Sent rather than typed into the box. An opener that only
                   fills the input asks somebody to press send on a sentence
                   they did not write. */
                onSuggestion={(text) => handleSubmit(turns[0].id, text)}
              />
            )}

            <AnimatePresence>
              {turns.map((turn, i) => (
                <ChatTurnRow
                  key={turn.id}
                  turn={turn}
                  /* Nothing has been asked yet, so this is not a message on
                     its way — it is the box under the openers, and it lines up
                     with them. */
                  questionAlign={isEmpty && i === 0 ? "stretch" : "end"}
                  className={isEmpty && i === 0 ? "opening" : undefined}
                  isActiveInput={
                    i === turns.length - 1 && (turn.state === "idle" || turn.state === "typing")
                  }
                  inputRef={
                    i === turns.length - 1 && (turn.state === "idle" || turn.state === "typing")
                      ? activeInputRef
                      : null
                  }
                  entranceDelay={i === 0 ? dial["Chat Feed"].delay : 0}
                  selectionMode={selectionMode}
                  animationConfig={animConfig}
                  foldMotion={dial["Question Fold"]}
                  openArtifactId={artifacts.openId}
                  onOpenArtifact={(_turnId, id) => artifacts.toggle(id)}
                  placeholder="Ask me about particle physics…"
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
                  onReplyInThread={handleReplyInThread}
                  onAnswerQuestion={handleAnswerQuestion}
                  onEditQuestion={handleEditQuestion}
                  onDecideApproval={handleDecideApproval}
                />
              ))}
            </AnimatePresence>
            {windowFull && (
              <SystemMessage>
                The oldest messages are dropping out of the window.
              </SystemMessage>
            )}
          </Conversation>
          <div className="bottomBlur" />
        </motion.div>
        </ChatLayout>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {showHighlightsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "var(--ick-scrim)",
              backdropFilter: "blur(4px)",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px"
            }}
            onClick={() => setShowHighlightsModal(false)}
          >
            <motion.div
              initial={{ y: 20, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "var(--ick-surface-raised)",
                borderRadius: "24px",
                padding: "32px",
                width: "100%",
                maxWidth: "600px",
                maxHeight: "80vh",
                overflowY: "auto",
                boxShadow: "var(--ick-shadow-modal)",
                border: "1px solid var(--ick-border)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ margin: 0, fontFamily: "var(--font-geist-mono), monospace", fontSize: "16px", color: "var(--ick-ink)" }}>Highlights</h2>
                <button className="secondaryBtn iconBtn" onClick={() => setShowHighlightsModal(false)}>
                  Close
                </button>
              </div>
              
              {Array.from(new Set(highlights.map(h => h.turnId))).map((turnId, index) => (
                <div key={turnId} style={{ marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "12px", color: "var(--ick-ink-faint)", marginBottom: "8px", fontFamily: "var(--font-geist-mono), monospace" }}>
                    Paragraph {index + 1}
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {highlights.filter(h => h.turnId === turnId).map((h, i) => (
                      <div 
                        key={i} 
                        onClick={() => {
                          setShowHighlightsModal(false);
                          setTimeout(() => {
                            const el = document.getElementById(`turn-${turnId}`);
                            const feed = document.querySelector('.chatFeed');
                            const header = document.querySelector('.chatHeader');
                            if (el && feed) {
                              const headerHeight = header ? (header as HTMLElement).offsetHeight : 80;
                              feed.scrollTo({ top: el.offsetTop - headerHeight - 16, behavior: "smooth" });
                            } else {
                              el?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }
                          }, 100);
                        }}
                        style={{ 
                          padding: "12px 16px", 
                          backgroundColor: "var(--ick-marker-tint)", 
                          borderRadius: "12px",
                          fontSize: "14px",
                          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                          lineHeight: 1.5,
                          color: "var(--ick-ink)",
                          cursor: "pointer",
                          transition: "background-color 0.2s"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--ick-marker)"}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "var(--ick-marker-tint)"}
                      >
                        {h.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeReply && (
          <ReplyThreadPopup
            key="thread-popup"
            activeReply={activeReply}
            onClose={() => setActiveReply(null)}
            /* Prose only: a thread is a follow-up on a passage, and a tool
               call inside a popover over the answer would be absurd. */
            onSendMessage={threadReply}
          />
        )}
      </AnimatePresence>
    </>
  );
}
