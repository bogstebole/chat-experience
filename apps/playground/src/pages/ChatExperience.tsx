import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { useDialKit } from "dialkit";
import { ArrowLeft, Share, Highlighter, TextCursor } from "lucide-react";
import {
  Button,
  ReplyThreadPopup,
  CustomCursor,
  defaultInlineAnimConfig,
  useChatTurns,
  type ChatInputHandle,
} from "inline-chat-kit";
import { Logo } from "../demo/Logo";
import { InlineChatBanner } from "../demo/InlineChatBanner";
import { ChatTurnRow } from "../demo/ChatTurnRow";
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
  const [selectionMode, setSelectionMode] = useState<"marker" | "precise">("marker");
  const activeInputRef = useRef<ChatInputHandle>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const animConfig = defaultInlineAnimConfig;
  const turnCountRef = useRef(0);

  /**
   * Where a real app would call its model. The kit owns the turn state, the
   * streaming and the reveal; everything below is this demo pretending to be
   * an API, so the playground costs nothing to run.
   *
   * Yielding word by word exercises the streaming path rather than the
   * simpler "resolve a whole string" one.
   */
  const fakeApi = useCallback(async function* (): AsyncGenerator<string> {
    const response = turnCountRef.current % 2 === 0 ? AI_RESPONSE : HIGGS_RESPONSE;
    turnCountRef.current += 1;
    const words = response.join(" ").split(/(\s+)/);
    for (const word of words) {
      await new Promise((r) => setTimeout(r, 24));
      yield word;
    }
  }, []);

  const { turns, setDraft, submit, stop, beginEdit, cancelEdit } = useChatTurns({
    onSend: fakeApi,
  });

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
              {turns.map((turn, i) => (
                <ChatTurnRow
                  key={turn.id}
                  turn={turn}
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
                  placeholder="Ask me about particle physics…"
                  onDraft={setDraft}
                  onSubmit={submit}
                  onStop={stop}
                  onEdit={beginEdit}
                  onCancelEdit={cancelEdit}
                  onHighlight={handleHighlight}
                  onReplyInThread={handleReplyInThread}
                />
              ))}
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
            onSendMessage={fakeApi}
          />
        )}
      </AnimatePresence>
    </>
  );
}
