import type { ReasoningState } from "../Reasoning/Reasoning";
import type { Thought } from "../ChainOfThought/ChainOfThought";
import type { Source } from "../Sources/Sources";
import type { Task } from "../TaskList/TaskList";
import type { ToolState } from "../Tool/Tool";
import type { Decision } from "../Approval/Approval";
import type { Answer, Question } from "../QuestionCard/types";
import type { SystemTone } from "../SystemMessage/SystemMessage";

/**
 * The parts of a turn that are not the answer's prose.
 *
 * An answer used to be one string, and everything the agent tier draws had
 * nowhere to live: a tool call, a plan and a block of reasoning all flattened
 * into the same text or did not arrive at all. These are what a turn carries
 * alongside `ai`.
 *
 * Every part has an `id` and parts are **merged by it**, which is what makes
 * streaming one of them bearable: send `{ kind: "reasoning", id: "r1", text }`
 * as it grows, then `{ kind: "reasoning", id: "r1", state: "done" }` when it
 * stops, and the text is still there. Only the fields you send change.
 */
export type TurnPart =
  | {
      kind: "reasoning";
      id: string;
      text?: string;
      state?: ReasoningState;
      /** In ms. Left out, the block times itself. */
      duration?: number;
    }
  | {
      kind: "tool";
      id: string;
      name: string;
      state?: ToolState;
      summary?: string;
      input?: unknown;
      output?: unknown;
      error?: string;
      duration?: number;
    }
  | {
      kind: "tasks";
      id: string;
      title?: string;
      tasks: Task[];
      collapsible?: boolean;
    }
  | {
      /**
       * Reasoning that has structure — steps that follow from one another,
       * rather than one block of prose. `reasoning` is the block; this is the
       * chain. Sending both for the same stretch of thinking says it twice.
       */
      kind: "chain";
      id: string;
      steps: Thought[];
      state?: "thinking" | "done";
      /** In ms. Left out, the block times itself. */
      duration?: number;
    }
  | {
      /**
       * What the answer stands on.
       *
       * Also what an inline `[^1]` in the prose resolves against: the citation
       * takes the source at that position, so the list is ordered by the order
       * the answer cites them, not by rank. Send it **before** the prose that
       * cites it and the markers come up already knowing what they point at.
       */
      kind: "sources";
      id: string;
      sources: Source[];
      title?: string;
      collapsible?: boolean;
    }
  | {
      /**
       * Something the agent wants to do, and has not done yet.
       *
       * Data rather than JSX, like every other part: a part is what a stream
       * can send, and a stream cannot send a component. The tool it names is
       * drawn for it, unrun.
       */
      kind: "approval";
      id: string;
      title: string;
      description?: string;
      tool?: { name: string; input?: unknown };
      /** `null` or absent while it is still being asked. */
      decision?: Decision | null;
    }
  | {
      kind: "question";
      id: string;
      /** What this step is about, at the top of the group. */
      title?: string;
      questions: Question[];
      /** Owned by the host: the row reports an answer, it does not keep one. */
      answers?: Record<string, Answer | undefined>;
      activeIndex?: number | null;
      collapsible?: boolean;
      readOnly?: boolean;
    }
  | {
      /**
       * Something that happened to the conversation rather than in it — the
       * window filling, the model changing partway through, a connection
       * going. A part rather than a component the host drops between rows,
       * because those are the two ways anything reaches a conversation here
       * and only one of them can be sent down a stream.
       */
      kind: "notice";
      id: string;
      text: string;
      tone?: SystemTone;
    };

/**
 * An update to a part, which is a part with everything optional but the two
 * fields that say which one it is.
 *
 * This is what a stream and a host actually send. Once a tool call is on
 * screen, saying it finished should be `{ kind: "tool", id, state: "done" }`
 * and nothing else — repeating the name to satisfy a type is how a field that
 * was not meant to change gets overwritten with whatever was easiest to type.
 */
export type TurnPartUpdate = {
  [K in TurnPart["kind"]]: { kind: K; id: string } & Partial<
    Omit<Extract<TurnPart, { kind: K }>, "kind" | "id">
  >;
}[TurnPart["kind"]];

/**
 * Fold one update into a turn's list, by id.
 *
 * A shallow merge, deliberately: the fields left out keep the values they had.
 * Sending a state change should not wipe the text that arrived before it.
 */
export function mergeParts(parts: TurnPart[], incoming: TurnPartUpdate): TurnPart[] {
  const at = parts.findIndex((part) => part.id === incoming.id);
  if (at === -1) return [...parts, incoming as TurnPart];

  const next = parts.slice();
  next[at] = { ...next[at], ...incoming } as TurnPart;
  return next;
}
