import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { ChatExperience, type PartWriter } from "../ChatExperience/ChatExperience";
import type { InlineAnimConfig } from "../ChatInput/ChatInput";
import type { FoldMotion } from "../QuestionGroup/QuestionGroup";
import type { Answer } from "../QuestionCard/types";
import type { Decision } from "../Approval/Approval";
import { useThemeAttribute } from "../theme/useThemeAttribute";
import { IntroLanding, type IntroMotion } from "./IntroLanding";
import { QUESTIONS, RUNNING_PLAN, scriptedApi, threadReply, scriptedTranscript } from "./scriptedApi";
import styles from "./ChatExperienceDemo.module.css";

/**
 * The demo, whole: the landing page, the chat, and the scripted answers behind
 * it.
 *
 * It is in the published package on purpose. Two apps show this demo — the
 * playground and the website — and before this they each had their own copy of
 * all of it: 865 and 890 lines of page, 537 identical lines of scripted
 * answers, 300 of stylesheet, and a banner and a landing page each. Nothing
 * about that content is specific to either app, so neither one owned it, and a
 * change to it was a change in two places that only ever got made in one.
 *
 * A host gives it two things, and they are the two things that genuinely
 * differ: its logo, and where "back" goes.
 *
 * This is not the library's surface — `ChatExperience` is. It lives behind the
 * `inline-chat-kit/demo` entry point, so an app that does not import it does
 * not carry a line of it.
 */

/** A small window, so the meter is worth looking at. A 200k one would sit at
    1% all afternoon and never show what the component does when it fills. */
const CONTEXT_TOTAL = 8_000;
/** What a system prompt and the tool definitions cost before anybody types. */
const CONTEXT_BASE = 900;

export interface ChatExperienceDemoProps {
  /** The host's mark, on the landing page. */
  logo?: ReactNode;
  /** The way back out of the landing page — an `<a>`, or a framework `<Link>`,
      which renders one. Styled by the kit; the destination is the host's. */
  back?: ReactNode;
  /** Where the header's back control goes, once you are in the chat. */
  backHref?: string;
  backLabel?: string;
  /** Start in the chat rather than on the landing page. */
  skipIntro?: boolean;
  /** The theme, if the host keeps it. Left off, the header's own toggle does. */
  theme?: "light" | "dark" | null;
  onThemeChange?: (theme: "light" | "dark") => void;
  /** Development chrome the playground turns on and nobody else does. */
  cursor?: boolean;
  /** Motion, opened up so a tuning panel can reach it. */
  animationConfig?: InlineAnimConfig;
  foldMotion?: FoldMotion;
  feedDelay?: number;
  introMotion?: IntroMotion;
}

export function ChatExperienceDemo({
  logo,
  back,
  backHref = "/",
  backLabel = "Back to home",
  skipIntro = false,
  theme,
  onThemeChange,
  cursor = false,
  animationConfig,
  foldMotion,
  feedDelay,
  introMotion,
}: ChatExperienceDemoProps) {
  const [started, setStarted] = useState(skipIntro);

  /* The landing page gets the theme too, and only when the host is the one
     holding it. `ChatExperience` writes the same attribute from the same value
     once the chat is up, so the two agree by construction — but it is not
     mounted yet while somebody is still reading the page in front of it, and
     without this that page came up in whatever the system preferred and then
     changed colour when they pressed the button.

     Skipped when `theme` is undefined, because then the chat holds its own and
     this would be a second writer removing what the first had just set. */
  useThemeAttribute(theme === undefined ? undefined : theme);

  /* The answers to a question the assistant asked.

     Held in a ref rather than in state, and read only inside the handler: the
     row is memoised, and a callback rebuilt on every render is what makes
     `memo` give up. Keyed by the part's id, so two questionnaires in one
     conversation do not share answers. */
  const answers = useRef<Record<string, Record<string, Answer>>>({});

  const onAnswerQuestion = useCallback(
    (write: PartWriter, turnId: string, partId: string, questionId: string, answer: Answer) => {
      const given = { ...(answers.current[partId] ?? {}), [questionId]: answer };
      answers.current[partId] = given;

      const next = QUESTIONS.findIndex((q) => q.id === questionId) + 1;
      const finished = next >= QUESTIONS.length;
      write(turnId, {
        kind: "question",
        id: partId,
        title: "Setting up the run",
        questions: QUESTIONS,
        answers: given,
        activeIndex: finished ? null : next,
        /* Once every question is answered the whole step folds to one row. */
        collapsible: finished,
      });
    },
    []
  );

  const onEditQuestion = useCallback(
    (write: PartWriter, turnId: string, partId: string, index: number) => {
      write(turnId, {
        kind: "question",
        id: partId,
        questions: QUESTIONS,
        answers: answers.current[partId] ?? {},
        activeIndex: index,
        collapsible: false,
      });
    },
    []
  );

  /* A decision the agent asked for. Recorded on the part it was asked on, and
     then the thing it asked about either happens or does not — which in a demo
     with no shell is one more part rather than a command. */
  const onDecideApproval = useCallback(
    (write: PartWriter, turnId: string, partId: string, decision: Decision) => {
      write(turnId, { kind: "approval", id: partId, decision });
      if (decision === "denied") return;

      write(turnId, {
        kind: "tool",
        id: `${partId}-ran`,
        name: "bash",
        state: "running",
        summary: "Removing Shots/",
        input: { command: "rm -rf Shots/" },
      });
      window.setTimeout(() => {
        write(turnId, {
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
    []
  );

  return (
    <AnimatePresence mode="wait">
      {started ? (
        <ChatExperience
          key="chat"
          onSend={scriptedApi}
          /* Recording is the kit's; the words are this demo's, and scripted
             like every other answer here. */
          onTranscribe={scriptedTranscript}
          onThreadReply={threadReply}
          title="inline chat experience"
          backHref={backHref}
          backLabel={backLabel}
          placeholder="Ask me about particle physics…"
          empty={{
            title: "Ask me about particle physics",
            description: "The Standard Model, the Higgs, and what a boson actually is.",
            /* One opener per branch of `scriptedApi`, so everything the kit can
               draw is reachable by pressing something rather than by knowing
               what to type. */
            suggestions: [
              "What does particle physics actually study?",
              "How big is the Higgs boson?",
              "Write me a plan for running a 5k",
              "How do you know — show me your sources",
              "What would you do first — give me a plan",
              "Set up a double-slit experiment",
              "Delete the screenshots",
            ],
          }}
          contextTotal={CONTEXT_TOTAL}
          contextBase={CONTEXT_BASE}
          /* The host's content, not the kit's. A plan here, a document or a
             table somewhere else — which is the whole reason the pane takes
             children rather than content. */
          artifact={() => ({
            title: "5k training plan",
            meta: "8 weeks · 4 sessions a week",
            children: <pre className={styles.plan}>{RUNNING_PLAN}</pre>,
          })}
          theme={theme}
          onThemeChange={onThemeChange}
          cursor={cursor}
          selectionToggle
          animationConfig={animationConfig}
          foldMotion={foldMotion}
          feedDelay={feedDelay}
          onAnswerQuestion={onAnswerQuestion}
          onEditQuestion={onEditQuestion}
          onDecideApproval={onDecideApproval}
        />
      ) : (
        <IntroLanding
          key="intro"
          logo={logo}
          back={back}
          onStart={() => setStarted(true)}
          motionConfig={introMotion}
        />
      )}
    </AnimatePresence>
  );
}
