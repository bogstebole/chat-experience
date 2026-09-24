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
import {
  useChatTurns,
  type UseChatTurnsOptions,
  type UseChatTurnsResult,
} from "../useChatTurns/useChatTurns";
import { type FoldMotion } from "../QuestionGroup/QuestionGroup";
import {
  defaultInlineAnimConfig,
  type InlineAnimConfig,
  type ChatInputHandle,
} from "../ChatInput/ChatInput";
import { type TranscribeHandler } from "../voice/useVoiceInput";
import {
  type CustomPart,
  type CustomPartContext,
  type TurnPartUpdate,
} from "../turnParts/turnParts";
import { type ComposerMenuItem } from "../ChatInput/AddCardsOverlay";
import { LabelsProvider, fill, useLabels, type ChatLabels } from "../labels/labels";
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

/** The header's built-in actions, by id. */
export type ChatExperienceHeaderAction = "theme" | "share";

export interface ChatExperienceProps {
  /** Where answers come from. Return a string, a promise of one, or an async
      iterable of deltas — see `useChatTurns`. Required unless `chat` is
      given, which brings its own. */
  onSend?: UseChatTurnsOptions["onSend"];

  /**
   * The conversation, held by the host.
   *
   * Left out, this component calls `useChatTurns` itself and nothing outside
   * can reach the turns. Pass what your own `useChatTurns` returned and the
   * host has the same handle this does — `updatePart` in particular, which is
   * how a card in an answer changes after the answer has finished ("Apply" →
   * "Applied"). `onSend` is ignored then; the hook you called has one.
   */
  chat?: UseChatTurnsResult;

  /**
   * Draws the host's own `{ kind: "custom" }` parts. See `ChatTurnRow`. Keep
   * it stable — outside the component or in `useCallback` — or every row
   * re-renders on every frame of an answer arriving.
   */
  renderPart?: (part: CustomPart, context: CustomPartContext) => ReactNode;

  /**
   * Every word the chat says, grouped by the component that says it. Partial:
   * anything left out stays English. Reaches every piece through context, so
   * an inline object costs nothing — it is compared by content.
   */
  labels?: ChatLabels;

  /**
   * The header's built-in actions. `true` (the default) is the theme toggle
   * and Share; `false` is neither; a list keeps only those named. The saved
   * highlights button is not one of these — it appears only once there is a
   * highlight, and it is the only way back to them. `actions` still adds your
   * own after whatever is left.
   */
  headerActions?: boolean | ChatExperienceHeaderAction[];

  /**
   * The composer's "+" menu. `false` takes the "+" away; a list replaces the
   * built-in three (Add, Design, Connectors). Keep a list stable.
   */
  composerMenu?: ComposerMenuItem[] | false;
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

  /**
   * Which artifact is open, held by the host. Left out (`undefined`), this
   * component keeps it. `null` is "none open" — held, just empty.
   */
  openArtifactId?: string | null;
  /** Somebody opened or closed one — a card pressed, the pane's X, a custom
      card calling `openArtifact`. Called whether or not the state is held. */
  onOpenArtifactChange?: (id: string | null) => void;
  /**
   * Who draws the pane. `"inline"` (the default): this component, beside the
   * conversation, from `artifact`. `"none"`: nobody here — no pane, no room
   * made for one. The cards still open and still show which one is open;
   * the host draws the pane wherever its own layout wants it, usually with
   * `openArtifactId` and `<ArtifactPane>`.
   */
  pane?: "inline" | "none";
  /**
   * Whether the conversation is a card of its own.
   *
   * `"flush"` (the default) fills the window, as before. `"panes"` makes it a
   * surface on the page, so the pane beside it — the kit's or the host's own —
   * is a second surface rather than a strip cut off the same one. See
   * `ChatLayout`.
   */
  surface?: "flush" | "panes";

  /**
   * Where the composer lives.
   *
   * `"inline"` (the default): the input is the message. It stands at the end
   * of the conversation, and what you type becomes the bubble where you typed
   * it — the argument this kit makes.
   *
   * `"docked"`: the input stays at the bottom of the view, the way most chats
   * keep it, and the conversation stacks above it. Sent, it still becomes the
   * bubble — the same element, travelling into the conversation — and a fresh
   * one takes its place at the bottom straight away, so the next question can
   * be typed while this one is being answered. Everything else is the same:
   * the parts, the pane, the highlighter, editing in place.
   *
   * With a `chat` of your own, give its `useChatTurns` `nextTurn: "at-send"`.
   */
  composer?: "inline" | "docked";

  /**
   * What the chat is as tall as.
   *
   * `"window"` (the default): the whole window, which is what a page that is
   * nothing but the chat wants, and why it needs no height from its host.
   *
   * `"container"`: whatever its parent gives it. For a chat embedded in a
   * card, a sidebar, a split — anywhere smaller than the window, which is
   * nearly every embed. The parent has to have a height to give; the chat
   * fills it and scrolls inside it. Measured in a host whose card was inset
   * 12px top and bottom, `"window"` hung 24px past the card and a docked
   * composer lost half of itself to the card's clip.
   *
   * The software keyboard is the host's to handle here: the chat no longer
   * knows where the window's bottom edge is relative to itself.
   */
  fill?: "window" | "container";

  /** The theme, if the host keeps it. Left off, this manages its own and puts
      a toggle in the header; `data-theme` on the root element either way, and
      unset until somebody chooses, so the kit follows the system preference —
      which is what it is there for. */
  theme?: "light" | "dark" | null;
  onThemeChange?: (theme: "light" | "dark") => void;

  /** The pointer-following cursor, and the rule that hides the real one. Only
      ever where there is a pointer to replace. */
  cursor?: boolean;
  /** The freeform-marker / precise-selection pair in the header. Drawn only
      where there is marking to choose a mode for. */
  selectionToggle?: boolean;

  /**
   * Whether an answer can be marked at all.
   *
   * On by default: a marker over a passage is how a reader asks about one
   * sentence rather than the whole answer. `false` draws answers as prose —
   * no marker layer, no highlight menu, nothing in the tab order over the
   * text — and takes the saved highlights and the selection-mode pair with
   * it, because both are about marking. A thread is opened from a highlight,
   * so `onThreadReply` has nothing to open it from either.
   *
   * Set in code, not offered in the interface: a product either works this
   * way or it does not.
   */
  highlights?: boolean;
  /**
   * Whether marked passages are kept.
   *
   * On by default, and only ever visible once there is one: the header grows
   * a button with the count, and it opens the sheet that lists them.
   * `false` keeps marking and threads and drops the keeping — for a host that
   * would rather store them itself, through `onHighlight`.
   */
  bookmarks?: boolean;

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

/** Stands in for a missing `onSend` when the host brought `chat` instead. */
const silent = () => "";

/**
 * The spring a sent message travels on, docked.
 *
 * Inline, the bubble spring is quick — 600/22/0.3 — because the morph happens
 * in place and a slow one there reads as lag. Docked, the same spring carries
 * the message from the bottom edge to its place in the conversation, and at
 * that speed a 600px journey is over in a hundred milliseconds: measured, the
 * bubble was at the top before the first frame anybody could see. Softer, it
 * is a thing moving rather than a thing appearing, and it settles in about a
 * third of a second. A host that tunes `animationConfig.bubble` still wins.
 */
const DOCKED_TRAVEL: InlineAnimConfig["bubble"] = { stiffness: 170, damping: 24, mass: 1 };

export function ChatExperience({
  onSend,
  chat: hostChat,
  renderPart,
  labels,
  headerActions: builtInActions = true,
  composerMenu,
  onTranscribe,
  onThreadReply,
  title: titleProp,
  backHref,
  backLabel,
  actions,
  placeholder,
  empty,
  contextTotal,
  contextBase = 0,
  artifact,
  openArtifactId: openArtifactProp,
  onOpenArtifactChange,
  pane: paneMode = "inline",
  surface = "flush",
  composer = "inline",
  /* Renamed: `fill` is also the labels helper that fills in `{index}`. */
  fill: fillMode = "window",
  theme: themeProp,
  onThemeChange,
  cursor = false,
  selectionToggle = false,
  highlights: marking = true,
  bookmarks = true,
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
  /* Read above the provider this renders, so the outer one (if any) and this
     component's own `labels` both count. */
  const text = useLabels("experience", labels?.experience);
  const title = titleProp ?? text.title;
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

  /* Called either way — a hook cannot be skipped — and ignored when the host
     holds the conversation. */
  const docked = composer === "docked";
  /* One object for every row, or the memo would see a new prop each render. */
  const rowAnimation = useMemo<InlineAnimConfig | undefined>(
    () =>
      docked
        ? {
            ...defaultInlineAnimConfig,
            ...animationConfig,
            bubble: animationConfig?.bubble ?? DOCKED_TRAVEL,
          }
        : animationConfig,
    [docked, animationConfig]
  );
  const ownChat = useChatTurns({
    onSend: onSend ?? silent,
    announcements: { responding: text.responding },
    /* A docked composer is always there, so the next input opens at send. */
    nextTurn: docked ? "at-send" : "after-answer",
  });
  const {
    turns,
    setDraft,
    submit,
    showVersion,
    stop,
    beginEdit,
    cancelEdit,
    updatePart,
    isStreaming,
  } = hostChat ?? ownChat;

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
  /* Docked too. The composer moving to the bottom does not change what a
     reader wants after pressing send: their question at the top and its answer
     written underneath, rather than both pushed up from below a line at a
     time. The composer stays where it is through all of it — it is `sticky`,
     so the room the anchor scrolls into passes behind it. */
  const heldAnchor = anchoredTurn && anchoredTurn.state !== "resting" ? anchorTurnId : null;

  /* The software keyboard, on a phone.

     A docked composer sits on the bottom edge of the view, and on iOS the
     keyboard comes up *over* that edge: the layout viewport keeps its height
     and only the visual one shrinks, so a composer pinned to the bottom is
     pinned behind the keys. `visualViewport` says how much is covered, and the
     workspace gives that much up — the composer rides up on the keyboard's
     top edge, which is where a thumb expects it. Inline, the composer is the
     last turn and the browser scrolls it into view itself. */
  const [keyboard, setKeyboard] = useState(0);
  const fillsWindow = fillMode === "window";
  useEffect(() => {
    if (!docked || !fillsWindow) return;
    const view = window.visualViewport;
    if (!view) return;
    const sync = () => setKeyboard(Math.max(0, Math.round(window.innerHeight - view.height)));
    sync();
    view.addEventListener("resize", sync);
    return () => view.removeEventListener("resize", sync);
  }, [docked, fillsWindow]);

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
    announce(text.windowFull);
  }, [windowFull, text.windowFull]);

  /* Which artifact the pane is showing. Held here rather than in either the
     card or the pane, because they are in different parts of the tree and both
     need the answer. */
  const artifacts = useArtifacts();
  /* Held by the host or here, the same rule the theme follows. `undefined`
     means "not held"; `null` is a held value. */
  const artifactHeld = openArtifactProp !== undefined;
  const openArtifactId = artifactHeld ? openArtifactProp : artifacts.openId;
  /* Read through a ref so the setter below stays one function for the life of
     the component — it is handed to every row, and the rows are memoised. */
  const artifactState = useRef({ openArtifactId, artifactHeld, onOpenArtifactChange });
  useEffect(() => {
    artifactState.current = { openArtifactId, artifactHeld, onOpenArtifactChange };
  });
  const setOpenArtifact = artifacts.open;
  const clearOpenArtifact = artifacts.close;
  const changeArtifact = useCallback(
    (id: string | null) => {
      const { artifactHeld: held, onOpenArtifactChange: report } = artifactState.current;
      if (!held) {
        if (id === null) clearOpenArtifact();
        else setOpenArtifact(id);
      }
      report?.(id);
    },
    [setOpenArtifact, clearOpenArtifact]
  );
  const closeArtifact = useCallback(() => changeArtifact(null), [changeArtifact]);

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

  const handleHighlight = useCallback(
    (turnId: string, text: string) => {
      if (!bookmarks) return;
      if (text.trim().length > 0) {
        setHighlights((prev) => [...prev, { turnId, text: text.trim() }]);
      }
    },
    [bookmarks]
  );

  /* Hoisted for the memo. It was an arrow written inline in the row's props,
     which is a new function every render — so every finished row re-rendered
     on every frame of the answer arriving, and `ChatTurnRow`'s memo, whose
     whole job is to stop that, never got the chance. */
  /* A card pressed again closes what it opened. */
  const openArtifact = useCallback(
    (_turnId: string, id: string) =>
      changeArtifact(artifactState.current.openArtifactId === id ? null : id),
    [changeArtifact]
  );

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

  const offers = (id: ChatExperienceHeaderAction) =>
    builtInActions === true || (Array.isArray(builtInActions) && builtInActions.includes(id));

  const headerActions: ChatHeaderAction[] = [
    ...(marking && bookmarks && highlights.length > 0
      ? [
          {
            id: "bookmarks",
            label: text.savedHighlights,
            icon: <Bookmark size={16} aria-hidden />,
            count: highlights.length,
            pinned: true,
            onClick: () => setShowHighlights(true),
          },
        ]
      : []),
    ...(offers("theme")
      ? [
          {
            id: "theme",
            label: theme === "dark" ? text.themeToLight : text.themeToDark,
            icon: theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />,
            active: theme === "dark",
            onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
          },
        ]
      : []),
    ...(offers("share")
      ? [
          {
            id: "share",
            label: text.share,
            icon: <Share size={16} aria-hidden />,
            onClick: () =>
              navigator.share?.({ title: conversationTitle, url: window.location.href }),
          },
        ]
      : []),
    ...(actions ?? []),
  ];

  const open =
    paneMode === "inline" && openArtifactId ? artifact?.(openArtifactId) : null;

  const chat = (
    <motion.div
      className={[
        styles.page,
        surface === "panes" || !fillsWindow ? styles.fitted : "",
        "ick-chat-page",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--ick-experience-anchor": `${anchorOffset}px` } as CSSProperties}
      data-composer={docked ? "docked" : undefined}
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

        {selectionToggle && marking && (
          /* The kit does not manage this one through `actions`: a segmented
             control has no icon-and-label shape to fold into a menu. */
          <div className={styles.selectMode} role="group" aria-label={text.selectionMode}>
            <button
              type="button"
              data-active={selectionMode === "marker"}
              onClick={() => setSelectionMode("marker")}
              aria-label={text.marker}
              title={text.marker}
            >
              <Highlighter size={16} />
            </button>
            <button
              type="button"
              data-active={selectionMode === "precise"}
              onClick={() => setSelectionMode("precise")}
              aria-label={text.precise}
              title={text.precise}
            >
              <TextCursor size={16} />
            </button>
          </div>
        )}
      </ChatHeader>

      <Conversation
        viewportClassName={`${styles.feed} ick-chat-feed`}
        anchorId={heldAnchor ? `turn-${heldAnchor}` : undefined}
        dock={docked}
        /* `anchorOffset` has to match the viewport's own `padding-top`, or a
           turn brought to the top lands under the fixed header — so the same
           number sets both, and the stylesheet reads it back out of the custom
           property. Two places that must agree, written once. */
        anchorOffset={anchorOffset}
        /* Room under the composer once an answer settles. The last turn is the
           input, and flush against the bottom edge of a phone is where the
           browser's own chrome sits, so this is about a composer's height of
           air under it. */
        /* Room under the last turn. Docked, the composer is the last child and
           its own height is already in the flow, so what is asked for here is
           only the air above it — the conversation's gap does that. */
        endOffset={docked ? 0 : endOffset}
      >
        {isEmpty && empty && (
          <EmptyState
            /* The opening block and the composer under it share one column, so
               they read as one thing. See `.opening`. Docked, the composer is
               at the bottom and the block is centred in the room above it. */
            className={docked ? `${styles.opening} ${styles.centred}` : styles.opening}
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
                questionAlign={(docked && live) || (isEmpty && i === 0) ? "stretch" : "end"}
                className={
                  docked && live ? styles.dock : isEmpty && i === 0 ? styles.opening : undefined
                }
                onTranscribe={onTranscribe}
                isActiveInput={live}
                inputRef={live ? activeInputRef : null}
                entranceDelay={i === 0 ? feedDelay : 0}
                selectionMode={selectionMode}
                highlights={marking}
                animationConfig={rowAnimation}
                foldMotion={foldMotion}
                openArtifactId={openArtifactId}
                onOpenArtifact={openArtifact}
                onArtifactChange={changeArtifact}
                placeholder={placeholder}
                onDraft={setDraft}
                onSubmit={handleSubmit}
                onRegenerate={handleRegenerate}
                onShowVersion={showVersion}
                onFeedback={handleFeedback}
                feedback={verdicts[turn.id] ?? null}
                /* Docked, the stop is on the composer, which is always in
                   view; the bubble being answered may have scrolled away. */
                onStop={!docked || live ? stop : undefined}
                busy={docked && live ? isStreaming : undefined}
                onEdit={beginEdit}
                onCancelEdit={cancelEdit}
                onHighlight={handleHighlight}
                onReplyInThread={onThreadReply ? handleReplyInThread : undefined}
                onAnswerQuestion={answerQuestion}
                onEditQuestion={editQuestion}
                onDecideApproval={decideApproval}
                renderPart={renderPart}
                composerMenu={composerMenu}
              />
            );
          })}
        </AnimatePresence>

        {windowFull && (
          <SystemMessage>{text.windowFull}</SystemMessage>
        )}
      </Conversation>
      <div className={styles.bottomBlur} />
    </motion.div>
  );

  return (
    <LabelsProvider labels={labels}>
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
        surface={surface}
        data-fill={fillsWindow ? undefined : "container"}
        style={fillsWindow && keyboard > 0 ? ({ "--ick-keyboard": `${keyboard}px` } as CSSProperties) : undefined}
        /* On a phone the pane is a sheet, and a sheet's ways out belong to the
           layout: dragged down, or the conversation behind it pressed. */
        onDismiss={closeArtifact}
        pane={({ narrow, expanded, toggleExpanded }) =>
          open ? (
            <ArtifactPane
              title={open.title}
              meta={open.meta}
              modal={narrow}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              onClose={closeArtifact}
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
              aria-label={text.savedHighlights}
              initial={{ y: 20, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.sheetHead}>
                <h2 className={styles.sheetTitle}>{text.highlights}</h2>
                <button className={styles.close} onClick={() => setShowHighlights(false)}>
                  {text.close}
                </button>
              </div>

              {Array.from(new Set(highlights.map((h) => h.turnId))).map((turnId, index) => (
                <div key={turnId} className={styles.group}>
                  <h3 className={styles.groupTitle}>
                    {fill(text.paragraph, { index: index + 1 })}
                  </h3>
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
    </LabelsProvider>
  );
}
