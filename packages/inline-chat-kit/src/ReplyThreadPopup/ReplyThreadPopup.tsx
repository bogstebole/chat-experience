"use client";

import { useState, useRef, useEffect, useId } from "react";
import { motion, MotionConfig } from "motion/react";
import { X, Save } from "lucide-react";
import { ChatInput, defaultInlineAnimConfig, type ChatInputHandle } from "../ChatInput/ChatInput";
import { useChatTurns, type ChatTurn, type SendContext } from "../useChatTurns/useChatTurns";

/** @deprecated Use `ChatTurn`. Kept so existing imports keep resolving. */
export type Turn = ChatTurn;
import { Button } from '../Button/Button';
import styles from "./ReplyThreadPopup.module.css";

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

/** Everything inside the panel that can take focus, in tab order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';

export function ReplyThreadPopup({ activeReply, onClose, onSave, onSendMessage }: ReplyThreadPopupProps) {
  const [threadFade, setThreadFade] = useState<"none" | "top" | "bottom" | "both">("none");
  const threadActiveInputRef = useRef<ChatInputHandle>(null);
  const threadFeedRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /**
   * Where focus came from. Read during the first render rather than in an
   * effect: a child's effects run before its parent's, and the thread's input
   * focuses itself in one of them — so by the time an effect here could look,
   * the answer would already be "the input", and closing would restore focus
   * to an element that no longer exists.
   */
  const [returnFocusTo] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)
  );
  const labelId = useId();
  const quoteId = useId();
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

  /**
   * A dialog owns focus while it is open, and gives it back when it closes.
   *
   * Without the first half, someone who opened this from the keyboard is left
   * behind on a page they can no longer see. Without the second, closing it
   * drops them at the top of the document with no idea where they were.
   */
  useEffect(() => {
    // The input, not the panel: writing a reply is the only reason to be here.
    if (threadActiveInputRef.current) threadActiveInputRef.current.focus();
    else panelRef.current?.focus();

    return () => {
      if (returnFocusTo?.isConnected) returnFocusTo.focus();
    };
  }, [returnFocusTo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // Something inside may have wanted it first — a highlight menu open on
      // one of the thread's own answers, for instance. Those mark the event as
      // handled; this only acts on what is left.
      if (e.defaultPrevented) return;
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key !== "Tab") return;
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    // Wrap at both ends, so tab cannot walk out of the dialog onto a page the
    // reader can no longer see.
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

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
      className={styles.backdrop}
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        // Named by both: the phrase gives it meaning, the passage says which
        // thread. `aria-modal` is the whole claim to modality — marking the
        // rest of the page inert would mean reaching outside this component,
        // into a document it does not own.
        aria-labelledby={`${labelId} ${quoteId}`}
        tabIndex={-1}
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
      }}
      exit={{ 
        opacity: 0,
        scale: 0.95,
        filter: "blur(4px)"
      }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className={styles.panel}
    >
      <div className={styles.column}>
        <div className={styles.header}>
          <div className={styles.headerLabel}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" className={styles.headerIcon} aria-hidden>
              <path d="m85.1 21c1.5-2.2 4.6-6.7 5.8-11 0.7-2.5 0.3-4.7-1.6-6.1-1.6-1.4-4.3-1.7-7.3-0.4-3.2 1.2-7.3 4.6-12 9.1l-0.2 0.2c-0.9-0.3-1.9-0.6-2.9-0.7-7.9-1.2-14.7 0-20 3.6-6.8 4.6-10.8 12.3-9.5 22.6 0.1 1.4 1.2 2.4 2.7 2.3 1.4 0 2.6-1.4 2.4-2.8-1.1-6.8 1-12.9 6.5-16.9 3.9-2.9 9.1-4.8 16.5-3.9l-35.4 39.5c0 0.3 4.1 2.8 4.2 2.8 1-0.9 4-4.4 5.2-5.7l27.2-30.6c-0.4 3.3 0.6 5.8 5.6 5.1-8.4 9.4-25.2 25.2-33.5 33.7 0.5 0.5 4 2 4.8 2.3 7.8-7.2 25.4-24 34.8-34.5l3.5-4.6c4.1 3.7 11.7 11.9 11.7 24.7 0 9.6-6 20-20 22.7-8.2 1.2-17.3 0.1-26.4-3.5-8.5-3.1-15.7-7.8-22.3-13.1-7-6-13.3-13.5-14.9-21.8-0.9-4.9 0.2-9.7 4.1-12.9 2.8-2.4 6.5-4.2 12-4.3 3.8-0.1 7.3 0.4 11.9 2.1 1.2 0.6 2.8 0.4 3.4-0.8 0.8-1.1 0.2-3.2-1.1-3.6-5.2-1.9-9-2.9-14-2.9-5.7 0.1-10.7 1.5-14.9 4.9-4.7 3.8-8.5 10.3-5.8 20 2.4 9.2 9.5 17.3 19.5 25.4l-20.8 27.8c-1.4 1.7-2.3 2.8-2.3 3.9-0.2 1.5 0.6 2.7 1.6 3.3 1.3 0.8 3.4 0.6 4.7-0.3 3.4-2.2 15.8-13.1 29.7-26.7 6.5 3 16.5 7 27.9 7.8 5.6 0.2 10.7-0.2 15.4-1.9 10.8-3.5 17.2-13 17.1-25.8 0-11.9-6.7-22.3-13.3-29zm-73.3 65.7 17.5-21.9 4.1 2.5c-5.8 5.2-13.6 12.4-21.6 19.4zm64.9-63.3c-1.7 0.7-4.7 2-6.6 1.9-0.7-0.4 1.5-6.5 1.7-6.5 2.1 0.9 4.7 2 6.1 3.1l-1.2 1.5zm4.2-5.5c-1.6-1.1-3.7-2.3-5.5-3.2 2.1-1.9 4.7-4 6.3-5.1 1.4-0.9 3.2-0.5 3 1.4-0.3 2-3 5.8-3.8 6.9z" />
            </svg>
            <p className={styles.headerText}>Replying in a thread</p>
          </div>
          <div className={styles.headerActions}>
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

        <div className={styles.feedClip}>
          <div
            className={`${styles.fade} ${styles.fadeTop}`}
            data-visible={threadFade === "top" || threadFade === "both" || undefined}
          />
          <div
            className={`${styles.fade} ${styles.fadeBottom}`}
            data-visible={threadFade === "bottom" || threadFade === "both" || undefined}
          />
          <div ref={threadFeedRef} className={styles.feed}>
            <div className={styles.feedInner}>
            <span id={labelId} className={styles.srOnly}>
              Thread on
            </span>
            <div id={quoteId} className={styles.quote}>
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
                  className={styles.turn}
                >
                  <div className={styles.turnRow} data-editing={isInputMode || undefined}>
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
                    />
                  </div>
                  
                  {turn.ai && (
                    <div className={styles.answer}>{turn.ai}</div>
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
