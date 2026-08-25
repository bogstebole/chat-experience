"use client";

import { useState, useRef, useEffect } from "react";
import { motion, MotionConfig } from "motion/react";
import { X, Save } from "lucide-react";
import { ChatInput, defaultInlineAnimConfig, type ChatInputHandle } from "../ChatInput/ChatInput";
import { useChatTurns, type ChatTurn, type SendContext } from "../useChatTurns/useChatTurns";

/** @deprecated Use `ChatTurn`. Kept so existing imports keep resolving. */
export type Turn = ChatTurn;
import { Button } from '../Button/Button';

export interface ReplyThreadPopupProps {
  activeReply: { text: string; rect: DOMRect };
  onClose: () => void;
  onSave?: () => void;
  /**
   * Produce the reply to a message sent inside the thread. Receives the
   * message and the passage the thread hangs off. Required — the popup has no
   * answers of its own to fall back on.
   */
  onSendMessage: (
    message: string,
    quotedText: string,
    context: SendContext
  ) => AsyncIterable<string> | Promise<string> | string;
}

export function ReplyThreadPopup({ activeReply, onClose, onSave, onSendMessage }: ReplyThreadPopupProps) {
  const [threadFade, setThreadFade] = useState<"none" | "top" | "bottom" | "both">("none");
  const threadActiveInputRef = useRef<ChatInputHandle>(null);
  const threadFeedRef = useRef<HTMLDivElement>(null);
  const animConfig = defaultInlineAnimConfig;

  // Turn state, streaming and the reveal are the same problem here as in the
  // main feed, so they come from the same place rather than being written
  // twice. The quoted passage is closed over and handed to the host app.
  const quoted = activeReply.text;
  const {
    turns: threadTurns,
    setDraft,
    submit,
    stop,
    beginEdit,
  } = useChatTurns({
    onSend: (message, context) => onSendMessage(message, quoted, context),
  });

  const updateThreadFade = () => {
    const wrap = threadFeedRef.current;
    if (!wrap) return;
    
    // Strict max height check: only allow fade if container has physically hit max height bounds
    const isAtMaxHeight = wrap.clientHeight >= 630; // Small tolerance for borders/rounding
    const overflowAmount = wrap.scrollHeight - wrap.clientHeight;
    const hasOverflow = isAtMaxHeight && overflowAmount > 2;
    
    if (!hasOverflow) { 
      setThreadFade("none"); 
      return; 
    }
    
    const atTop = wrap.scrollTop <= 2;
    const atBottom = wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 2;
    if (!atTop && !atBottom) setThreadFade("both");
    else if (!atTop) setThreadFade("top");
    else if (!atBottom) setThreadFade("bottom");
    else setThreadFade("none");
  };

  useEffect(() => {
    const wrap = threadFeedRef.current;
    if (!wrap) return;
    
    const handleScroll = () => updateThreadFade();
    wrap.addEventListener("scroll", handleScroll, { passive: true });
    
    const resizeObserver = new ResizeObserver(() => {
      updateThreadFade();
    });
    
    resizeObserver.observe(wrap);
    if (wrap.firstElementChild) {
      resizeObserver.observe(wrap.firstElementChild);
    }
    
    updateThreadFade(); 
    return () => {
      wrap.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [threadTurns]);

  // Keep the newest turn in view as the answer grows.
  useEffect(() => {
    const feed = threadFeedRef.current;
    if (!feed) return;
    feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  }, [threadTurns]);

  let replyTargetX = 0;
  let replyTargetY = 0;
  let replyTargetWidth = 480;
  
  if (typeof window !== "undefined") {
    const screenWidth = window.innerWidth;
    replyTargetWidth = Math.max(activeReply.rect.width + 80, 480);
    replyTargetX = activeReply.rect.left + activeReply.rect.width / 2 - replyTargetWidth / 2;
    const padding = 24;
    if (replyTargetX < padding) replyTargetX = padding;
    if (replyTargetX + replyTargetWidth > screenWidth - padding) replyTargetX = screenWidth - padding - replyTargetWidth;
    
    replyTargetY = activeReply.rect.top - 24;
  }


  return (
    // See the note in ChatInput: the kit sets this itself rather than relying
    // on the host app to.
    <MotionConfig reducedMotion="user">
    <div 
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 200,
        display: "block",
        pointerEvents: "auto",
      }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ 
        left: activeReply.rect.left, 
        top: activeReply.rect.top, 
        width: activeReply.rect.width, 
        borderRadius: 12,
        opacity: 0
      }}
      animate={{ 
        left: replyTargetX, 
        top: replyTargetY, 
        width: replyTargetWidth, 
        borderRadius: 28,
        opacity: 1,
        backgroundColor: "#F3F3F3",
        boxShadow: "0px 12px 31px -9px rgba(0,0,0,0.2)"
      }}
      exit={{ 
        opacity: 0,
        scale: 0.95,
        filter: "blur(4px)"
      }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      style={{
        position: "absolute",
        padding: "4px",
        overflow: "hidden",
        transformOrigin: "center center",
        zIndex: 50
      }}
    >
      <div style={{ width: replyTargetWidth - 8, display: "flex", flexDirection: "column" }}>
        <div style={{ alignItems: 'center', alignSelf: 'stretch', borderRadius: '16px', display: 'flex', gap: '4px', justifyContent: 'center', paddingBottom: 12, paddingInline: '16px', paddingTop: 6 }}>
          <div style={{ alignItems: 'center', display: 'flex', flex: 1, gap: 4 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" style={{ width: '16px', height: 'auto', overflow: 'visible', flexShrink: '0' }}>
              <path d="m85.1 21c1.5-2.2 4.6-6.7 5.8-11 0.7-2.5 0.3-4.7-1.6-6.1-1.6-1.4-4.3-1.7-7.3-0.4-3.2 1.2-7.3 4.6-12 9.1l-0.2 0.2c-0.9-0.3-1.9-0.6-2.9-0.7-7.9-1.2-14.7 0-20 3.6-6.8 4.6-10.8 12.3-9.5 22.6 0.1 1.4 1.2 2.4 2.7 2.3 1.4 0 2.6-1.4 2.4-2.8-1.1-6.8 1-12.9 6.5-16.9 3.9-2.9 9.1-4.8 16.5-3.9l-35.4 39.5c0 0.3 4.1 2.8 4.2 2.8 1-0.9 4-4.4 5.2-5.7l27.2-30.6c-0.4 3.3 0.6 5.8 5.6 5.1-8.4 9.4-25.2 25.2-33.5 33.7 0.5 0.5 4 2 4.8 2.3 7.8-7.2 25.4-24 34.8-34.5l3.5-4.6c4.1 3.7 11.7 11.9 11.7 24.7 0 9.6-6 20-20 22.7-8.2 1.2-17.3 0.1-26.4-3.5-8.5-3.1-15.7-7.8-22.3-13.1-7-6-13.3-13.5-14.9-21.8-0.9-4.9 0.2-9.7 4.1-12.9 2.8-2.4 6.5-4.2 12-4.3 3.8-0.1 7.3 0.4 11.9 2.1 1.2 0.6 2.8 0.4 3.4-0.8 0.8-1.1 0.2-3.2-1.1-3.6-5.2-1.9-9-2.9-14-2.9-5.7 0.1-10.7 1.5-14.9 4.9-4.7 3.8-8.5 10.3-5.8 20 2.4 9.2 9.5 17.3 19.5 25.4l-20.8 27.8c-1.4 1.7-2.3 2.8-2.3 3.9-0.2 1.5 0.6 2.7 1.6 3.3 1.3 0.8 3.4 0.6 4.7-0.3 3.4-2.2 15.8-13.1 29.7-26.7 6.5 3 16.5 7 27.9 7.8 5.6 0.2 10.7-0.2 15.4-1.9 10.8-3.5 17.2-13 17.1-25.8 0-11.9-6.7-22.3-13.3-29zm-73.3 65.7 17.5-21.9 4.1 2.5c-5.8 5.2-13.6 12.4-21.6 19.4zm64.9-63.3c-1.7 0.7-4.7 2-6.6 1.9-0.7-0.4 1.5-6.5 1.7-6.5 2.1 0.9 4.7 2 6.1 3.1l-1.2 1.5zm4.2-5.5c-1.6-1.1-3.7-2.3-5.5-3.2 2.1-1.9 4.7-4 6.3-5.1 1.4-0.9 3.2-0.5 3 1.4-0.3 2-3 5.8-3.8 6.9z" fill="#11111180" />
            </svg>
            <p style={{ color: '#11111180', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.01em', lineHeight: '14px', margin: 0 }}>
              Replying in a thread
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="primary"
              icon={<Save size={16} />}
              onClick={onSave}
            >
              Save
            </Button>
            <Button
              variant="secondary"
              icon={<X size={16} />}
              onClick={onClose}
              aria-label="Close thread"
            />
          </div>
        </div>

        <div style={{
          position: "relative",
          borderRadius: "24px",
          overflow: "hidden"
        }}>
          {/* Top White Gradient Overlay */}
          <div 
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, height: "48px",
              background: "linear-gradient(to bottom, #FFFFFF 0%, rgba(255,255,255,0) 100%)",
              pointerEvents: "none",
              zIndex: 10,
              opacity: (threadFade === "top" || threadFade === "both") ? 1 : 0,
              transition: "opacity 0.2s ease"
            }} 
          />
          {/* Bottom White Gradient Overlay */}
          <div 
            style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0, height: "48px",
              background: "linear-gradient(to top, #FFFFFF 0%, rgba(255,255,255,0) 100%)",
              pointerEvents: "none",
              zIndex: 10,
              opacity: (threadFade === "bottom" || threadFade === "both") ? 1 : 0,
              transition: "opacity 0.2s ease"
            }} 
          />
          <div 
            ref={threadFeedRef}
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderRadius: '24px', 
              maxHeight: '640px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
            }}>
            <style>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            <div style={{
              display: 'flex', 
              flexDirection: 'column', 
              padding: '16px',
              alignItems: 'start'
            }}>
            <div style={{ color: '#111111', display: 'inline-block', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif', fontSize: '13px', letterSpacing: '0.01em', lineHeight: '150%' }}>
              {activeReply.text}
            </div>
            
            {threadTurns.map((turn, i) => {
              const isActiveInput =
                i === threadTurns.length - 1 &&
                (turn.state === "idle" || turn.state === "typing");
              
              const isInputMode = turn.state === "idle" || turn.state === "typing";
              
              return (
                <motion.div
                  key={turn.id}
                  id={`thread-turn-${turn.id}`}
                  aria-busy={turn.state === "responding" || undefined}
                  initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.8 }}
                  style={{ display: "flex", flexDirection: "column", width: "100%", gap: "40px", marginTop: 40 }}
                >
                  <div style={{ 
                    alignSelf: isInputMode ? "stretch" : "flex-end", 
                    display: "flex", 
                    justifyContent: isInputMode ? "stretch" : "flex-end", 
                    maxWidth: "100%",
                    width: isInputMode ? "100%" : "auto"
                  }}>
                    <ChatInput
                      ref={isActiveInput ? threadActiveInputRef : null}
                      state={turn.state}
                      value={turn.user}
                      onChange={(v) => setDraft(turn.id, v)}
                      onSubmit={(v) => submit(turn.id, v)}
                      onStop={stop}
                      onCopy={() => navigator.clipboard.writeText(turn.ai)}
                      onEdit={() => beginEdit(turn.id)}
                      animationConfig={animConfig}
                      placeholder="Ask me about this text..."
                      style={isInputMode ? { width: "100%", maxWidth: "100%" } : {}}
                    />
                  </div>
                  
                  {turn.ai && (
                    <div style={{ color: '#111111', display: 'inline-block', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif', fontSize: '13px', letterSpacing: '0.01em', lineHeight: '150%' }}>
                      {turn.ai}
                    </div>
                  )}
                </motion.div>
              );
            })}
            </div>
          </div>
        </div>
      </div>
      </motion.div>
    </div>
    </MotionConfig>
  );
}
