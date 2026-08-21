import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { useDialKit } from "dialkit";
import { ArrowLeft, Share, Highlighter, TextCursor } from "lucide-react";
import {
  ChatInput,
  TextHighlighter,
  ReplyThreadPopup,
  CustomCursor,
  GlassButton,
  defaultInlineAnimConfig,
  type ChatInputState,
  type ChatInputHandle,
} from "inline-chat-kit";
import { Logo } from "../demo/Logo";
import { InlineChatBanner } from "../demo/InlineChatBanner";
import { INLINE_CHAT_FEATURE_STATUS } from "../demo/featureStatus";
import introStyles from "./IntroChatLanding.module.css";
import "./ChatExperience.css";

type Phase = "intro" | "chat";

const AI_RESPONSE = [
  "Particle physics studies the most fundamental constituents of matter and the forces that act between them.",
  "The Standard Model organises twelve fermions — six quarks and six leptons — plus the force-carrying bosons into a single coherent framework.",
  "The Higgs boson, found at CERN in 2012, completes the picture by giving elementary particles their mass through interaction with the Higgs field.",
];

const HIGGS_RESPONSE = [
  "The Higgs boson is a point particle — it has no measurable spatial extent at any scale we can currently probe.",
  "Its mass sits at roughly 125 GeV/c², about 133 times heavier than a proton.",
  "So 'how big is it' has only one honest answer: it has no size, only mass and quantum numbers.",
];

interface Turn {
  id: string;
  user: string;
  ai: string;
  state: ChatInputState;
}

interface Highlight {
  turnId: string;
  text: string;
}

const randomId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const newTurn = (): Turn => ({
  id: randomId(),
  user: "",
  ai: "",
  state: "idle",
});

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
  const [turns, setTurns] = useState<Turn[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showHighlightsModal, setShowHighlightsModal] = useState(false);
  const [activeReply, setActiveReply] = useState<{ text: string, rect: DOMRect } | null>(null);
  const [selectionMode, setSelectionMode] = useState<"marker" | "precise">("marker");
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const streamingRef = useRef<number | null>(null);
  const turnCountRef = useRef(0);
  const editingRef = useRef(false);
  const editSnapshotRef = useRef<{ id: string; user: string } | null>(null);
  const activeInputRef = useRef<ChatInputHandle>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const animConfig = defaultInlineAnimConfig;

  useEffect(() => {
    return () => {
      if (streamingRef.current) clearTimeout(streamingRef.current);
    };
  }, []);


  const updateTurn = (id: string, patch: Partial<Turn>) => {
    setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));
  };

  const handleStart = () => {
    setPhase("chat");
    setTurns([newTurn()]);
  };

  const handleChange = (id: string, value: string) => {
    updateTurn(id, {
      user: value,
      state: value.length > 0 ? "typing" : "idle",
    });
  };

  const handleEdit = (id: string) => {
    const turn = turns.find((t) => t.id === id);
    if (turn) editSnapshotRef.current = { id, user: turn.user };
    updateTurn(id, { state: "typing" });
  };

  const handleCancelEdit = (id: string) => {
    const snap = editSnapshotRef.current;
    editSnapshotRef.current = null;
    const patch: Partial<Turn> = { state: "resting" };
    if (snap && snap.id === id) patch.user = snap.user;
    updateTurn(id, patch);
  };

  const handleSubmit = (id: string, value: string) => {
    const trimmed = value.trim();
    // An edit is a re-submit of a turn that was already answered — it
    // already has an input below it, so we must not append another one.
    editingRef.current = turns.some((turn) => turn.id === id && turn.ai.length > 0);
    editSnapshotRef.current = null;
    // While the answer regenerates, hide the trailing input so only the
    // streaming response is visible; it re-appears once finished.
    if (editingRef.current) setEditingTurnId(id);
    updateTurn(id, { user: trimmed, state: "responding", ai: "" });

    setTimeout(() => {
      const el = document.getElementById(`turn-${id}`);
      const feed = document.querySelector('.chatFeed');
      const header = document.querySelector('.chatHeader');
      if (el && feed) {
        const headerHeight = header ? (header as HTMLElement).offsetHeight : 80;
        // Scroll so the element is exactly 16px below the bottom of the header
        feed.scrollTo({ top: el.offsetTop - headerHeight - 16, behavior: "smooth" });
      } else {
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);

    const response = turnCountRef.current % 2 === 0 ? AI_RESPONSE : HIGGS_RESPONSE;
    turnCountRef.current += 1;
    streamAi(id, response);
  };

  const streamAi = (turnId: string, response: string[]) => {
    const fullText = response.join(" ");
    let i = 0;

    const tick = () => {
      if (i >= fullText.length) {
        finishTurn(turnId);
        return;
      }
      setTurns((t) =>
        t.map((turn) =>
          turn.id === turnId ? { ...turn, ai: fullText.slice(0, i + 1) } : turn
        )
      );
      const char = fullText[i];
      i += 1;
      const delay = char === "." ? 40 : char === "," ? 18 : 3;
      streamingRef.current = window.setTimeout(tick, delay);
    };
    streamingRef.current = window.setTimeout(tick, 300);
  };

  const finishTurn = (turnId: string) => {
    streamingRef.current = null;
    setTurns((t) =>
      t.map((turn) => (turn.id === turnId ? { ...turn, state: "resting" } : turn))
    );
    // Editing an existing turn regenerates its answer in place — the
    // trailing input is already present, so don't spawn a duplicate.
    // Reveal it again now that the response is complete.
    if (editingRef.current) {
      editingRef.current = false;
      setEditingTurnId(null);
      return;
    }
    streamingRef.current = window.setTimeout(() => {
      streamingRef.current = null;
      setTurns((t) => [...t, newTurn()]);
    }, 320);
  };

  const handleStop = (turnId: string) => {
    if (streamingRef.current) {
      clearTimeout(streamingRef.current);
      streamingRef.current = null;
    }
    finishTurn(turnId);
  };

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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="8" cy="8" r="7" stroke="#111111" strokeWidth="1.2" />
                  <path d="M8 7v4" stroke="#111111" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="8" cy="5" r="0.8" fill="#111111" />
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace", fontSize: 12, lineHeight: "16px", letterSpacing: "-0.02em", color: "#111111" }}>
                    Desktop only for now
                  </span>
                  <span style={{ fontFamily: "var(--font-geist-sans), 'Geist', system-ui, sans-serif", fontSize: 12, lineHeight: "18px", color: "rgba(17,17,17,0.7)" }}>
                    Inline chat experience is built for desktop. Mobile support is on the way, check back soon.
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div variants={introItemVariants} className={introStyles.mobileButton}>
              <a href="/">
                <GlassButton size="s">Back to home</GlassButton>
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
              <GlassButton size="s" onClick={handleStart}>
                Start experience
              </GlassButton>
              <a href="/" className="secondaryBtn">
                Back to home
              </a>
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="chat"
          className="chatPage"
          initial={{ opacity: 0 }}
          animate={{
            opacity: (activeReply || showHighlightsModal) ? 0.4 : 1,
            filter: (activeReply || showHighlightsModal) ? "blur(3px)" : "blur(0px)",
            scale: (activeReply || showHighlightsModal) ? 0.9 : 1
          }}
          transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}
          onAnimationComplete={() => activeInputRef.current?.focus()}
        >
          <div className="topBlur" />
          <header className="chatHeader">
            <div className="chatHeaderLeft">
              <a href="/" className="secondaryBtn iconBtn" aria-label="Back to home">
                <ArrowLeft size={16} />
              </a>
              <span className="chatHeaderTitle">inline chat experience</span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
              {highlights.length > 0 && (
                <button 
                  className="secondaryBtn" 
                  onClick={() => setShowHighlightsModal(true)}
                >
                  Highlights ({highlights.length})
                </button>
              )}
              <button 
                className="secondaryBtn iconBtn" 
                onClick={() => navigator.share?.({ title: "Inline chat experience", url: window.location.href })}
                aria-label="Share"
              >
                <Share size={16} />
              </button>
            </div>
          </header>
          <div className="chatFeed" ref={feedRef}>
            <AnimatePresence>
              {turns.map((turn, i) => {
                const isActiveInput =
                  i === turns.length - 1 &&
                  (turn.state === "idle" || turn.state === "typing");
                // Trailing empty input hides while an earlier turn regenerates,
                // then animates back in once that response finishes.
                if (editingTurnId !== null && isActiveInput && turn.ai.length === 0) {
                  return null;
                }
                return (
                  <motion.article
                    key={turn.id}
                    id={`turn-${turn.id}`}
                    className={`chatTurn${isActiveInput ? " activeInput" : ""}`}
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                      delay: i === 0 ? dial["Chat Feed"].delay : 0
                    }}
                  >
                    <div className="userRow">
                      <ChatInput
                        ref={isActiveInput ? activeInputRef : null}
                        state={turn.state}
                        value={turn.user}
                        onChange={(v) => handleChange(turn.id, v)}
                        onSubmit={(v) => handleSubmit(turn.id, v)}
                        onStop={() => handleStop(turn.id)}
                        onCopy={(v) => navigator.clipboard.writeText(v)}
                        onEdit={() => handleEdit(turn.id)}
                        onCancelEdit={() => handleCancelEdit(turn.id)}
                        isEditing={turn.ai.length > 0 && turn.state === "typing"}
                        variant="inline"
                        animationConfig={animConfig}
                        placeholder="Ask me about particle physics…"
                      />
                    </div>
                    {turn.ai && (
                      <p className="aiText">
                        <TextHighlighter
                          text={turn.ai}
                          selectionMode={selectionMode}
                          onHighlightComplete={(text) => {
                            if (text.trim().length > 0) {
                              setHighlights(prev => [...prev, { turnId: turn.id, text: text.trim() }]);
                            }
                          }}
                          onReplyInThread={(text, rect) => {
                            setActiveReply({ text, rect });
                          }}
                        />
                      </p>
                    )}
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
          <div className="bottomBlur" />
        </motion.div>
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
              backgroundColor: "rgba(0,0,0,0.5)",
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
                backgroundColor: "var(--color-bg-page, #fff)",
                borderRadius: "24px",
                padding: "32px",
                width: "100%",
                maxWidth: "600px",
                maxHeight: "80vh",
                overflowY: "auto",
                boxShadow: "0 24px 48px rgba(0,0,0,0.1)",
                border: "1px solid rgba(0,0,0,0.05)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ margin: 0, fontFamily: "var(--font-geist-mono), monospace", fontSize: "16px", color: "var(--color-text, #111)" }}>Highlights</h2>
                <button className="secondaryBtn iconBtn" onClick={() => setShowHighlightsModal(false)}>
                  Close
                </button>
              </div>
              
              {Array.from(new Set(highlights.map(h => h.turnId))).map((turnId, index) => (
                <div key={turnId} style={{ marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "12px", color: "rgba(17,17,17,0.5)", marginBottom: "8px", fontFamily: "var(--font-geist-mono), monospace" }}>
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
                          backgroundColor: "rgba(204, 255, 0, 0.2)", 
                          borderRadius: "12px",
                          fontSize: "14px",
                          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                          lineHeight: 1.5,
                          color: "var(--color-text, #111)",
                          cursor: "pointer",
                          transition: "background-color 0.2s"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "rgba(204, 255, 0, 0.4)"}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "rgba(204, 255, 0, 0.2)"}
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
          />
        )}
      </AnimatePresence>
    </>
  );
}
