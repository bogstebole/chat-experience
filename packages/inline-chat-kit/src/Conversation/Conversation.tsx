"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ArrowDown } from "lucide-react";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./Conversation.module.css";

export interface ConversationProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /**
   * How close to the end still counts as following, in pixels. Below this the
   * view keeps up on its own; above it, the reader is reading and is left
   * alone.
   */
  threshold?: number;
  /** The button offering a way back. `false` for none. */
  scrollButton?: boolean;
  scrollButtonLabel?: string;
  /**
   * The id of an element to hold at the top of the view — a turn, usually.
   *
   * Without it the view follows the end of the content, which is what a chat
   * that stacks downwards wants. With it, the named element is brought to the
   * top and **held** there while the answer grows underneath, so a reader sees
   * their question and its answer and nothing else. Change the id and the view
   * moves to the new one.
   *
   * This needs room to scroll into: an element cannot be brought to the top of
   * a container that ends just below it. That is what a large bottom padding
   * on the viewport is for.
   */
  anchorId?: string;
  /**
   * How far below the top edge the anchor sits, in pixels. A fixed header over
   * the conversation is the usual reason — without it the turn is scrolled
   * neatly underneath and out of sight.
   */
  anchorOffset?: number;
  /**
   * How much room is left under the last turn when the view is at the end, in
   * pixels.
   *
   * Zero puts the last line flush with the bottom edge, which is right for a
   * transcript and wrong for this kit: the last turn *is* the composer — the
   * input is the message — so flush means the thing you type into is jammed
   * against the edge of the screen the moment an answer finishes. On a phone
   * that is also where the browser's own chrome lives.
   */
  endOffset?: number;
  /**
   * The empty room under the last turn, which is what lets a turn be brought
   * to the top at all.
   *
   * An element cannot be scrolled to the top of a container that ends just
   * below it — so `anchorId` only works if there is somewhere to scroll into.
   * That room used to be a guess written in the host's stylesheet, `99vh`,
   * and a guess is wrong in both directions at once: too much of it and the
   * reader can scroll a whole screen into nothing (measured: 697px of blank
   * in a 680px view, with the last turn above the top edge), too little and
   * the newest message cannot reach the top.
   *
   * `"auto"` measures it instead:
   *
   *     screen - anchorOffset - (the anchored turn's top to the end) - padding
   *
   * and the second term is the whole point. Measuring the **last turn's own
   * height** instead — which this did first — leaves everything between the
   * anchor and the end unaccounted for: the last turn is the composer, 44px
   * of it, so an answer that already filled the screen still got 536px of
   * room under it to scroll into. What the room is for is lifting the
   * anchored turn to the top, and what stands between that turn and the
   * bottom edge is the whole stack under it.
   *
   * Sized this way, the end of the scroll lands exactly where the anchored
   * turn sits at the anchor. So the view comes to rest **at** the end of the
   * scroll and there is nowhere further to go — the room is spent holding the
   * turn up, not left over underneath. It shrinks as the answer grows, which
   * is also why an answer does not have to be chased: the content grows and
   * the room shrinks by the same pixel, so the scroll height does not move
   * and neither does the turn at the top.
   *
   * Never below `endOffset`, so a turn taller than the screen still rests
   * with the composer clear of the bottom edge instead of jammed against it.
   *
   * Zero unless this conversation anchors, because the room exists for
   * anchoring. A number takes it over, in pixels; so does the
   * `--ick-conversation-tail` token, which this writes.
   */
  tail?: "auto" | number;
  /** Switch the whole thing off and it is a plain scroll container. */
  follow?: boolean;
  /**
   * For the element that actually scrolls, which is not the one `className`
   * lands on.
   *
   * There are three: a root that positions the button, the viewport that
   * scrolls, and a wrapper whose height is what "the end" is measured from.
   * `className` goes to the root, because that is the box a consumer lays out.
   * Padding has to go here instead — on the scroller — or it is not padding
   * inside the scroll at all.
   */
  viewportClassName?: string;
}

const THRESHOLD = 64;

/**
 * How far down the scroll an element's top sits, in layout coordinates.
 *
 * `offsetTop` is measured from the nearest **positioned** ancestor, which here
 * is the root — the viewport itself is not positioned, so every turn and the
 * wrapper around them all report against the same origin. Adding the
 * wrapper's own `offsetTop` to a turn's, as this used to, counts the
 * viewport's padding twice: measured in the demo, a conversation ending at
 * 729 was read as ending at 829, and the composer came to rest 100px higher
 * than the `endOffset` it was given.
 *
 * `offsetTop` rather than a rect on purpose. Turns animate in, and a rect
 * reads the transform mid-flight; this is layout, which does not move.
 */
const flowTop = (el: HTMLElement, view: HTMLElement): number => el.offsetTop - view.offsetTop;

/** The turn the room is measured against, if it is still on the page. */
const held0 = (view: HTMLElement, id: string | null): HTMLElement | null =>
  id ? view.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null;

/** Written only when it changes, so an answer does not touch the DOM per frame. */
const write = (inner: HTMLElement, applied: { current: number }, room: number): void => {
  if (room === applied.current) return;
  applied.current = room;
  inner.style.setProperty("--ick-conversation-tail", `${Math.round(room)}px`);
};

/**
 * The scroll container: it keeps up with an answer as it arrives, and stops
 * the instant the reader scrolls away.
 *
 * **It follows the end of the content, not the bottom of the container**, and
 * those are only the same thing when nothing is padded below. This kit's demo
 * carries a screen-height bottom padding so a turn can be pulled to the top,
 * and scrolling to the true bottom there would push the answer off the screen
 * to sit in front of a blank space. Measuring the content instead makes one
 * behaviour correct for both.
 *
 * The other half is not fighting the reader. A naive version listens to the
 * scroll event, cannot tell its own scrolling from theirs, and either drags
 * them back down while they are reading or lets go entirely. This reads intent
 * from the input — a wheel, a drag, a page key — and uses the scroll event
 * only to measure where things ended up.
 */
export const Conversation = forwardRef<HTMLDivElement, ConversationProps>(function Conversation(
  {
    children,
    anchorId,
    anchorOffset = 0,
    endOffset = 0,
    tail = "auto",
    threshold = THRESHOLD,
    scrollButton = true,
    scrollButtonLabel = "Jump to the latest",
    follow = true,
    className,
    viewportClassName,
    onScroll,
    ...rest
  },
  ref
) {
  const viewport = useRef<HTMLDivElement | null>(null);
  /* The forwarded ref is the *viewport*, not the root. Anyone reaching for a
     ref here wants to scroll something, and the root does not scroll. */
  useImperativeHandle(ref, () => viewport.current as HTMLDivElement, []);
  const content = useRef<HTMLDivElement | null>(null);
  const [following, setFollowing] = useState(true);
  /**
   * The tail this component last wrote, so it can tell it apart from content
   * and so an unchanged measurement does not touch the DOM on every frame of
   * an answer. `-1` because no measurement can produce it: a real one of zero
   * still has to be written down the first time.
   */
  const applied = useRef(-1);
  /**
   * The turn the room is measured against: the last one anchored, held on to
   * after the host lets go.
   *
   * A boolean would not do, and neither would reading `anchorId` live. The
   * demo drops the anchor when an answer settles — holding it for ever is
   * what pinned the composer below the fold — so a measurement that needed a
   * live anchor would lose its subject at the end of every answer and the
   * room would collapse under the reader. Which turn was last brought to the
   * top does not stop being true in between messages.
   */
  const anchors = useRef<string | null>(null);
  /**
   * Whether the room was actually measured against a turn that is on the page.
   *
   * Not the same question as whether this conversation anchors. A host can
   * name an anchor that is not there — a turn removed, an id that never
   * matched — and then there was nothing to size the room against and the end
   * of the scroll means nothing in particular. The end of the *content* is
   * the honest answer in that case.
   */
  const sized = useRef(false);

  /**
   * Where the last pixel of the last *turn* sits flush with the bottom edge.
   *
   * The last child rather than the wrapper, because the wrapper carries the
   * tail — the empty room under the conversation that lets a turn reach the
   * top. Measuring the wrapper would count that room as content and park the
   * reader a screen below the thing they are reading.
   */
  const endOfContent = useCallback(() => {
    const view = viewport.current;
    const inner = content.current;
    if (!view || !inner) return 0;

    /* When the kit sized the room, the end of the scroll is where the room
       was **aimed** — the anchored turn at the top — so that is where coming
       to rest means something.
    
       Measuring the end of the content instead only agrees with it while the
       answer is longer than the screen. Below that the room is bigger than
       the floor, the end of the scroll moves down with it, and resting at the
       end of the *content* leaves the difference unspent: measured in a
       1400px window, 585px and 551px of it after the second and third
       answers, with the turn that had just been sent left in the middle of
       the view instead of at the top. The first fix for this was checked
       only against answers longer than the screen, where the two numbers are
       the same and nothing shows. */
    if (tail === "auto" && sized.current) {
      return Math.max(0, view.scrollHeight - view.clientHeight);
    }

    const last = inner.lastElementChild as HTMLElement | null;
    const bottom = last
      ? flowTop(last, view) + last.offsetHeight
      : /* No element to measure — a consumer whose children are bare text.
           The wrapper stands in, less the tail, which is padding this
           component put there itself and is emphatically not content. */
        flowTop(inner, view) + inner.offsetHeight - applied.current;
    return Math.max(0, bottom + endOffset - view.clientHeight);
  }, [endOffset, tail]);

  /**
   * The tail, measured rather than guessed. See the `tail` prop.
   *
   * Written as the token the stylesheet already reads, so there is one
   * mechanism rather than two, and written **on the wrapper** — a scroll
   * container cannot be shorter than its own padding, which is how a 99vh pad
   * once made a 773px scroller inside a 680px page.
   */
  const fitTail = useCallback(() => {
    const view = viewport.current;
    const inner = content.current;
    if (!view || !inner) return;
    if (tail !== "auto") return write(inner, applied, Math.max(0, tail));

    /* The conversation's own bottom padding is room under the last turn too,
       and it is already inside `scrollHeight`. Counting it twice puts the end
       of the scroll below the anchor by exactly that much, which is somewhere
       to scroll and nothing to see there. */
    const pad = parseFloat(getComputedStyle(view).paddingBottom) || 0;
    /* Never less than the end gap, so a turn taller than the screen still
       comes to rest with the composer clear of the bottom edge rather than
       jammed against it. */
    const floor = Math.max(0, endOffset - pad);

    const last = inner.lastElementChild as HTMLElement | null;
    const held = held0(view, anchors.current);
    sized.current = !!last && !!held;
    if (!sized.current || !last || !held) return write(inner, applied, floor);

    /* **From the anchored turn to the end of the conversation** — not the last
       turn's own height, which is what this measured first and is wrong by
       everything in between. The last turn is the composer, 44px of it, so an
       answer that already filled the screen still got a screen of room under
       it: 536px of nothing to scroll into after every answer.
    
       What the room is for is lifting the anchored turn to the top, and what
       stands between it and the bottom edge is the whole stack under it. So
       that is what comes off. */
    const stack = flowTop(last, view) + last.offsetHeight - flowTop(held, view);
    write(inner, applied, Math.max(floor, view.clientHeight - anchorOffset - stack - pad));
  }, [tail, anchorOffset, endOffset]);

  /**
   * Where the view wants to be: the anchor's top — unless holding it there
   * would push the anchored turn's own bottom off the screen.
   *
   * The second half is what this was missing. An anchor pins the turn you sent
   * to the top and holds it there while the answer is written underneath,
   * which is right and is the whole point of anchoring. It stops being right
   * the moment the turn is longer than the screen: the anchor does not move,
   * so the target does not move, and every line after the first screenful is
   * written below the fold with nothing to bring it back.
   *
   * So the anchor holds the top only while its own end is still in view, and
   * gives way to that end when it is not. The handover lands exactly where it
   * should, because the two are the same number at the moment the turn grows
   * to the height of the viewport.
   *
   * Note what this is **not**: the end of the *conversation*. Taking that
   * would follow whatever came after the anchored turn, and anchoring an older
   * turn — a jump to a message further up — would snap straight back to the
   * bottom. Only the anchored turn's own bottom is allowed to overrule its
   * top.
   */
  const target = useCallback(() => {
    const view = viewport.current;
    if (!view) return 0;

    if (anchorId) {
      const el = view.querySelector<HTMLElement>(`[id="${CSS.escape(anchorId)}"]`);
      if (el) {
        const max = Math.max(0, view.scrollHeight - view.clientHeight);
        const from = flowTop(el, view);
        const top = from - anchorOffset;
        // Where the anchored turn's last pixel sits flush with the bottom.
        const end = from + el.offsetHeight - view.clientHeight;
        return Math.max(0, Math.min(Math.max(top, end), max));
      }
    }
    return endOfContent();
  }, [anchorId, anchorOffset, endOfContent]);

  /**
   * True while the way-back button's own scroll is still travelling.
   *
   * Without it that scroll never happened. `jump` asks for `behavior: smooth`
   * and then sets `following`, which re-runs the effect below, whose first act
   * is `view.scrollTop = target()` — an assignment, which cancels a smooth
   * scroll on the spot. Measured: the view went from 0 to 1088 inside 80ms,
   * so the button teleported instead of travelling and a reader lost their
   * place with nothing to follow.
   *
   * A ref rather than state: nothing renders differently for it, and a render
   * in the middle of a scroll is the last thing this wants.
   */
  const travelling = useRef(false);

  const jump = useCallback(
    (smooth: boolean) => {
      const view = viewport.current;
      if (!view) return;
      const gentle = smooth && !prefersReducedMotion();
      travelling.current = gentle;
      view.scrollTo({ top: target(), behavior: gentle ? "smooth" : "auto" });
      setFollowing(true);
    },
    [target]
  );

  /* ── The room to move into ─────────────────────────────────────────────
     Declared before the effect that keeps up, and that ordering is the point:
     observers fire in registration order, so the tail is the right size
     before anything reads where the end of the scroll now is. */
  useLayoutEffect(() => {
    /* Latched rather than read live. The demo lets go of the anchor once an
       answer settles — holding it for ever is what pinned the composer below
       the fold — so a tail that existed only while `anchorId` was set would
       collapse at the end of every answer and take the view with it. What is
       true is that this conversation *anchors*, and that does not stop being
       true between messages. */
    if (anchorId) anchors.current = anchorId;
    const view = viewport.current;
    const inner = content.current;
    fitTail();
    if (!view || !inner || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fitTail);
    // The wrapper for the last turn's height, the viewport for the screen's.
    observer.observe(inner);
    observer.observe(view);
    return () => observer.disconnect();
  }, [anchorId, fitTail]);

  /* ── Keeping up ────────────────────────────────────────────────────────
     Layout effect, and the reason matters: run after paint and the answer is
     drawn one frame lower before the scroll catches up, which reads as a
     shudder on every frame of every answer. */
  useLayoutEffect(() => {
    /* An anchor is an instruction, not a preference: the host has said which
       turn to hold, so it is honoured whether or not the reader was following
       the end. Gating it on `following` meant that pressing anything — which
       now releases the follow, see below — also stopped the next message from
       being taken to the top. */
    if (!follow || (!following && !anchorId)) return;
    const view = viewport.current;
    const inner = content.current;
    if (!view || !inner || typeof ResizeObserver === "undefined") return;

    const keepUp = () => {
      const want = target();
      /* Let the way-back button's scroll finish rather than snapping past it —
         and notice here when it has arrived, rather than waiting for a scroll
         event. jsdom fires none, so a flag cleared only by that event stays
         set for ever and the view stops keeping up with the answer entirely.
         A test said so. */
      if (travelling.current) {
        if (Math.abs(view.scrollTop - want) > 1) return;
        travelling.current = false;
      }
      view.scrollTop = want;
    };
    keepUp();

    const observer = new ResizeObserver(keepUp);
    observer.observe(inner);
    return () => observer.disconnect();
    /* `anchorId` is in here on purpose: a new turn means the view moves to it,
       and it moves whether or not the reader had scrolled away from the last
       one. Sending a message is asking to be taken to it. */
  }, [follow, following, target, anchorId]);

  /* ── Letting go ────────────────────────────────────────────────────────
     Intent, read from the input rather than inferred from the scroll event.
     A wheel or a drag upwards means the reader wants to be somewhere else,
     and that is true before the scroll has even happened. */
  useEffect(() => {
    if (!follow) return;
    const view = viewport.current;
    if (!view) return;

    const away = () => {
      // A reader who touches the view during the journey has taken it over.
      travelling.current = false;
      if (Math.abs(view.scrollTop - target()) > threshold) setFollowing(false);
    };

    const onWheel = (event: WheelEvent) => {
      // Upwards means "not here" only when the place to be is above. With an
      // anchor held at the top, scrolling up is often how a reader returns to
      // it, so the distance decides rather than the direction.
      if (anchorId) away();
      else if (event.deltaY < 0) setFollowing(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home", "ArrowDown", "PageDown", "End"].includes(event.key)) {
        // Same reasoning: with an anchor, any key that moves the view is only
        // "away" if it lands somewhere else.
        if (anchorId) requestAnimationFrame(away);
        else if (["ArrowUp", "PageUp", "Home"].includes(event.key)) setFollowing(false);
      }
    };

    /**
     * And a press inside the conversation, which is the one this was missing.
     *
     * Everything that folds open — a tool call, the reasoning, the sources —
     * grows the content, and growth is what makes the view keep up. So opening
     * one while sitting at the end pinned the *end* and dragged the thing you
     * had just opened up and off the top: measured, `scrollTop` 29 to 131 and
     * the header from 160px down the view to 58, which reads as the panel
     * opening upwards. With a long panel the header leaves the screen
     * entirely, and the control to shut it again with it.
     *
     * A press on **something that folds** is intent in exactly the way a wheel
     * is — you reached for this, here — so it lets go of the end and the
     * browser's own scroll anchoring keeps what you pressed where it was.
     *
     * Only those. The first cut released on any press at all, and that is too
     * much: clicking into the composer released it too, so when the answer
     * settled there was nothing left to bring the view back — and settling is
     * also when the reasoning block folds itself away, so the content shrank
     * by its height and everything above dropped into view. It read as the
     * conversation jumping to show an older message. A control that folds is
     * the one press that changes the layout under the reader, and it is the
     * only one that has to be answered this way.
     */
    const pressed = (event: PointerEvent) => {
      const on = event.target;
      if (on instanceof Element && on.closest("[aria-expanded]")) setFollowing(false);
    };

    view.addEventListener("wheel", onWheel, { passive: true });
    view.addEventListener("touchmove", away, { passive: true });
    view.addEventListener("keydown", onKey);
    view.addEventListener("pointerdown", pressed, { passive: true });
    return () => {
      view.removeEventListener("wheel", onWheel);
      view.removeEventListener("touchmove", away);
      view.removeEventListener("keydown", onKey);
      view.removeEventListener("pointerdown", pressed);
    };
  }, [follow, threshold, target, anchorId]);

  /** Back at the end by any route — dragging the bar, momentum, the button. */
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      onScroll?.(event);
      if (!follow) return;
      const view = viewport.current;
      if (!view) return;
      if (Math.abs(view.scrollTop - target()) <= threshold) {
        // Arrived. Following resumes and the effect may set the scroll again.
        travelling.current = false;
        setFollowing(true);
      }
    },
    [follow, onScroll, threshold, target]
  );

  const detached = follow && !following;

  return (
    <div className={[styles.root, className ?? ""].filter(Boolean).join(" ")}>
      <div
        ref={viewport}
        className={[styles.viewport, viewportClassName ?? ""].filter(Boolean).join(" ")}
        onScroll={handleScroll}
        {...rest}
      >
        <div ref={content} className={styles.content}>
          {children}
        </div>
      </div>

      {scrollButton && (
        <button
          type="button"
          className={styles.jump}
          data-shown={detached || undefined}
          /* Out of the tab order while it is not offering anything, rather
             than merely invisible: a hidden control that still takes focus is
             a dead stop in the middle of a page. */
          tabIndex={detached ? 0 : -1}
          aria-hidden={detached ? undefined : true}
          onClick={() => jump(true)}
          aria-label={scrollButtonLabel}
        >
          <ArrowDown size={15} aria-hidden />
        </button>
      )}
    </div>
  );
});
