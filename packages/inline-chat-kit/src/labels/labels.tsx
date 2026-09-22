"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Every word the kit says, in one place.
 *
 * The components each took a `labels` prop, and that was enough right up until
 * somebody assembled them: `ChatExperience` and `ChatTurnRow` draw a dozen of
 * them and passed none of it through, so a chat translated piece by piece still
 * said "Copy", "Allow once" and "Thinking" in English. This is the one object
 * that reaches all of them.
 *
 * Grouped by the component that says it, so a translator can find a string by
 * looking at the screen. Every group is partial: what is left out stays the
 * English default below. `{name}` in a value is filled in by the component —
 * keep the placeholder, move it wherever the language wants it.
 *
 * What counts: text on screen, an `aria-label`, a `title`, a placeholder, text
 * only a screen reader gets, and anything said through the live region.
 * Everything a person sees or hears.
 */
export const defaultLabels = {
  approval: {
    once: "Allow once",
    always: "Always allow",
    deny: "Deny",
    allowedOnce: "Allowed once",
    allowedAlways: "Allowed from now on",
    wasDenied: "Denied",
    pending: "Waiting for you",
  },
  tool: {
    input: "Input",
    output: "Output",
    error: "Error",
    pending: "Queued",
    running: "Running",
    done: "Done",
  },
  reasoning: {
    thinking: "Thinking",
    thought: "Thought",
    /** Followed by the duration: "Thought for 12s". */
    thoughtFor: "Thought for",
  },
  chain: {
    /** Followed by the count: "Thought through 4 steps". */
    through: "Thought through",
    step: "step",
    steps: "steps",
    thinking: "Thinking",
  },
  tasks: {
    pending: "Queued",
    running: "In progress",
    done: "Done",
    error: "Failed",
    /** `{done}` and `{total}` are filled in. */
    progress: "{done} of {total}",
  },
  sources: { title: "Sources", one: "source", many: "sources" },
  /** The marker in the prose, spoken as "Source 2: <title>". */
  citation: { cite: "Source" },
  answerActions: {
    copy: "Copy answer",
    copied: "Copied",
    regenerate: "Regenerate",
    up: "Good answer",
    down: "Bad answer",
  },
  branch: {
    previous: "Previous answer",
    next: "Next answer",
    /** `{index}` and `{total}` are filled in. */
    position: "Answer {index} of {total}",
  },
  context: {
    name: "Context used",
    /** Between the two numbers: "128k of 1M". */
    of: "of",
    tokens: "tokens",
    /** Said once it is past `warnAt`, and it should say what happens next. */
    nearlyFull: "Nearly full — the oldest messages will start dropping out",
  },
  attachments: {
    /** Followed by the file's name. */
    remove: "Remove",
  },
  question: {
    next: "Next",
    none: "None of these",
    edit: "Edit answer",
    /** The free-text row, when the question does not name its own. */
    other: "Something else",
    /** The alphabet the options are lettered from, in order. */
    letters: "abcdefghijklmnopqrstuvwxyz",
  },
  questionGroup: {
    /** After the count, in the folded row: "3 answers". */
    answers: "answers",
  },
  /** The composer — the box you type in, and the bubble it becomes. */
  input: {
    placeholder: "Ask anything…",
    send: "Send message",
    save: "Save edits",
    stop: "Stop response",
    cancelEdit: "Cancel edit",
    /** The "+" that opens the menu. */
    add: "Add",
    closeMenu: "Close",
    /** The three built-in menu entries. */
    attach: "Add",
    design: "Design",
    connectors: "Connectors",
    /** Under a sent message. */
    copy: "Copy",
    edit: "Edit",
    readMore: "Read more",
    readLess: "Read less",
    /** The microphone, by what pressing it would do. */
    dictate: "Dictate a message",
    stopListening: "Stop listening",
    waitingForMicrophone: "Waiting for microphone access",
    cancelTranscription: "Cancel transcription",
    microphoneBlocked: "Microphone blocked",
    microphoneBlockedHelp:
      "Microphone access is blocked. Allow it for this site in your browser settings, then reload.",
  },
  /** Said through the live region while dictating, and shown when it fails. */
  voice: {
    listening: "Listening.",
    stoppedListening: "Stopped listening.",
    transcribing: "Transcribing.",
    nothingHeard: "Nothing was heard.",
    transcriptAdded: "Transcript added.",
    transcriptFailed: "The transcript could not be made.",
    refused: "Microphone access was refused.",
    notFound: "No microphone was found.",
    couldNotOpen: "The microphone could not be opened.",
  },
  header: {
    back: "Back",
    more: "More actions",
  },
  highlighter: {
    menu: "Highlight actions",
    reply: "Reply in thread",
    remove: "Remove highlight",
    /** The invisible button per highlight, followed by its text. */
    highlight: "Highlight:",
    /** `{count}` is filled in. */
    countOne: "{count} highlight",
    countMany: "{count} highlights",
    /** Read when the answer takes focus: how to highlight without a pointer. */
    keyboardHint:
      "Left and right arrow keys move by word. Hold shift to select. Enter highlights the selection, Escape clears it.",
  },
  thread: {
    title: "Replying in a thread",
    save: "Save",
    close: "Close thread",
    /** Screen-reader only, before the quoted passage. */
    on: "Thread on",
    placeholder: "Ask me about this text...",
  },
  codeBlock: {
    copy: "Copy",
    copyCode: "Copy code",
    copied: "Copied",
    copiedAnnouncement: "Copied to clipboard",
  },
  pane: {
    close: "Close",
    expand: "Widen",
    collapse: "Narrow",
  },
  conversation: {
    jump: "Jump to the latest",
  },
  emptyState: {
    suggestions: "Suggestions",
  },
  /** What `ChatExperience` adds around the pieces. */
  experience: {
    title: "Chat",
    savedHighlights: "Saved highlights",
    themeToLight: "Switch to the light theme",
    themeToDark: "Switch to the dark theme",
    share: "Share",
    selectionMode: "Selection mode",
    marker: "Freeform marker",
    precise: "Precise text selection",
    windowFull: "The oldest messages are dropping out of the window.",
    highlights: "Highlights",
    close: "Close",
    /** `{index}` is filled in. */
    paragraph: "Paragraph {index}",
    /** Said when a request starts. */
    responding: "Generating response",
  },
};

type Defaults = typeof defaultLabels;

/** Every string one component says, all required. */
export type LabelsOf<K extends keyof Defaults> = { [S in keyof Defaults[K]]: string };

/**
 * What a host passes: any component's group, any of its strings. The rest
 * stay English.
 */
export type ChatLabels = { [K in keyof Defaults]?: Partial<LabelsOf<K>> };

export type ApprovalLabels = LabelsOf<"approval">;
export type ToolLabels = LabelsOf<"tool">;
export type ReasoningLabels = LabelsOf<"reasoning">;
export type ChainLabels = LabelsOf<"chain">;
export type TaskListLabels = LabelsOf<"tasks">;
export type SourcesLabels = LabelsOf<"sources">;
export type AnswerActionsLabels = LabelsOf<"answerActions">;
export type BranchLabels = LabelsOf<"branch">;
export type ContextLabels = LabelsOf<"context">;
export type ChatInputLabels = LabelsOf<"input">;
export type VoiceLabels = LabelsOf<"voice">;

const LabelsContext = createContext<ChatLabels>({});

/**
 * Hands a `ChatLabels` to every kit component beneath it.
 *
 * Through context rather than a prop on each row: `ChatTurnRow` is memoised,
 * and a translation threaded through its props would be one more thing that
 * had to stay referentially stable. It still has to be stable here — a new
 * object in context re-renders every reader — so the value is keyed on the
 * *contents*, and an object literal written inline in a host's render costs
 * nothing after the first time.
 *
 * Nests: an inner provider overrides the outer one string by string.
 */
export function LabelsProvider({
  labels,
  children,
}: {
  labels?: ChatLabels;
  children?: ReactNode;
}) {
  const parent = useContext(LabelsContext);
  const key = labels ? JSON.stringify(labels) : "";
  const value = useMemo(() => {
    if (!key) return parent;
    const own = JSON.parse(key) as ChatLabels;
    const merged: Record<string, unknown> = { ...parent };
    for (const group of Object.keys(own) as (keyof ChatLabels)[]) {
      merged[group] = { ...parent[group], ...own[group] };
    }
    return merged as ChatLabels;
  }, [parent, key]);

  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

/**
 * One component's strings: the English default, under whatever a
 * `LabelsProvider` above says, under the component's own `labels` prop.
 *
 * The prop wins because it is the more specific of the two — somebody who
 * wrote a string on one instance meant that instance.
 */
export function useLabels<K extends keyof Defaults>(
  group: K,
  local?: Partial<LabelsOf<K>>
): LabelsOf<K> {
  const fromContext = useContext(LabelsContext)[group];
  return { ...defaultLabels[group], ...fromContext, ...local } as LabelsOf<K>;
}

/** `"{done} of {total}"` → `"2 of 5"`. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole
  );
}
