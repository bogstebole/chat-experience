import type { Question, TurnPart } from "inline-chat-kit";

/**
 * The demo pretending to be a model, and now pretending to be an agent.
 *
 * A `SendHandler` may stream two kinds of thing: strings, which are deltas of
 * the answer's prose, and `TurnPart`s, which are merged into the turn by id.
 * Everything the agent tier draws arrives through the second kind — so this is
 * where reasoning, tool calls, a plan and a question get into the conversation
 * at all, rather than only into Storybook.
 *
 * Routed on what was typed, so each one is reachable by asking for it. The
 * openers on the empty state are the four that route somewhere.
 */

/* Markdown, because that is what a model returns. The first and last
   paragraphs are left as plain prose on purpose: the showcase recording draws
   a marker from "Higgs" to "2012", and a stroke has to cross the boundary of
   a `**bold**` run to prove that it can. */
const AI_RESPONSE = [
  "Particle physics studies the most fundamental constituents of matter and the forces that act between them.",
  "The **Standard Model** organises them into three families:",
  "- twelve fermions — six quarks and six leptons\n- the force-carrying bosons\n- the Higgs, which gives the rest their mass",
  "The Higgs boson, found at CERN in 2012, completes the picture by giving elementary particles their mass through interaction with the Higgs field.",
];

const HIGGS_RESPONSE = [
  "The Higgs boson is a *point particle* — it has no measurable spatial extent at any scale we can currently probe.",
  "| property | value |\n| --- | --- |\n| mass | ~125 GeV/c² |\n| charge | 0 |\n| spin | 0 |",
  "So 'how big is it' has only one honest answer: it has no size, only `mass` and quantum numbers.",
];

const PLAN_RESPONSE = [
  "Here is what I would do, in order. The first two are cheap and tell us whether the rest is worth doing.",
];

export const QUESTIONS: Question[] = [
  {
    id: "who",
    type: "inputs",
    title: "Who are we caring for?",
    subtitle: "Just the basics for now — we'll go into detail together",
    shortTitle: "About them",
    fields: [
      { id: "name", label: "Their name", placeholder: "Milica Stevanović" },
      { id: "age", label: "Age", placeholder: "84" },
    ],
  },
  {
    id: "household",
    type: "single",
    title: "Who else lives in the household?",
    subtitle: "This tells us how much support is already around them",
    shortTitle: "Household",
    options: [
      { id: "alone", title: "They live alone", description: "Nobody else in the home", short: "Alone" },
      { id: "partner", title: "With a partner", description: "Two in the household", short: "Partner" },
      { id: "family", title: "With family", description: "Children or relatives in the home", short: "Family" },
    ],
  },
  {
    id: "help",
    type: "multi",
    title: "What do they need help with?",
    subtitle: "Pick everything that applies",
    shortTitle: "Support needed",
    allowOther: true,
    allowEmpty: true,
    options: [
      { id: "meals", title: "Meals", description: "Cooking and shopping", short: "Meals" },
      { id: "mobility", title: "Getting around", description: "Stairs, walks, appointments", short: "Mobility" },
      { id: "meds", title: "Medication", description: "Reminders and refills", short: "Meds" },
    ],
  },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Word by word, which exercises the streaming path rather than the easy one. */
async function* prose(blocks: string[]): AsyncGenerator<string> {
  // Joined as blocks, not sentences: markdown needs the blank line between a
  // paragraph and the list that follows it.
  for (const word of blocks.join("\n\n").split(/(\s+)/)) {
    await wait(24);
    yield word;
  }
}

/**
 * Thinking, streamed a sentence at a time, then folded away.
 *
 * The same id throughout: the first send carries the text, the last carries
 * only the state, and the merge keeps everything in between.
 */
async function* thinking(id: string, sentences: string[]): AsyncGenerator<TurnPart> {
  let text = "";
  for (const sentence of sentences) {
    text += (text ? "\n\n" : "") + sentence;
    yield { kind: "reasoning", id, text, state: "thinking" };
    await wait(420);
  }
  yield { kind: "reasoning", id, state: "done" };
}

const SEARCH_INPUT = { query: "higgs boson mass measurement", limit: 3 };
const SEARCH_OUTPUT = {
  results: [
    { title: "ATLAS and CMS combined measurement", url: "https://example.com/atlas-cms", rank: 1 },
    { title: "Particle Data Group — Higgs boson", url: "https://example.com/pdg", rank: 2 },
  ],
  took_ms: 412,
};

async function* toolCall(id: string): AsyncGenerator<TurnPart> {
  yield { kind: "tool", id, name: "search_web", state: "running", summary: "Searching the web", input: SEARCH_INPUT };
  await wait(900);
  yield { kind: "tool", id, name: "search_web", state: "done", summary: "2 results", output: SEARCH_OUTPUT, duration: 412 };
}

const PLAN = [
  { id: "read", label: "Read the care plan" },
  { id: "meds", label: "Check the medication list against the prescription" },
  { id: "gaps", label: "Find the gaps in the weekly cover" },
  { id: "draft", label: "Draft the questions for the family" },
];

/** Work moving down the list, one row at a time. */
async function* plan(id: string): AsyncGenerator<TurnPart> {
  for (let at = 0; at <= PLAN.length; at++) {
    yield {
      kind: "tasks",
      id,
      title: "Plan",
      collapsible: true,
      tasks: PLAN.map((task, i) => ({
        ...task,
        state: i < at ? ("done" as const) : i === at ? ("running" as const) : ("pending" as const),
      })),
    };
    await wait(800);
  }
}

const asks = (message: string, ...words: string[]) => {
  const said = message.toLowerCase();
  return words.some((word) => said.includes(word));
};

/**
 * Where a real app would call its model.
 *
 * The kit owns the turn state, the streaming and the reveal; everything here
 * is the demo pretending to be an API, so the playground costs nothing to run.
 */
export async function* scriptedApi(message: string): AsyncGenerator<string | TurnPart> {
  if (asks(message, "question", "ask me", "pitanj")) {
    yield* thinking("r", [
      "They want to be asked rather than to write it all out.",
      "Three questions is the most anybody answers in one sitting — start with who, then the household, then what they need.",
    ]);
    yield { kind: "question", id: "q", questions: QUESTIONS, answers: {}, activeIndex: 0 };
    return;
  }

  if (asks(message, "delete", "run ", "send an email", "permission", "approve")) {
    yield* thinking("r", [
      "This one changes something outside the conversation, so it is not mine to decide.",
      "Show what it would run, and wait.",
    ]);
    yield {
      kind: "approval",
      id: "ask",
      title: "Run a command in your shell",
      description: "It removes the generated screenshots. Nothing else is touched.",
      tool: { name: "bash", input: { command: "rm -rf Shots/", cwd: "~/Projects/chat" } },
    };
    return;
  }

  if (asks(message, "plan", "todo", "steps", "what would you do")) {
    yield* thinking("r", [
      "This is a sequence, not a single answer, so the plan is the answer.",
      "Order it so the cheap checks come first — if the medication list already matches, the rest is much smaller.",
    ]);
    yield* plan("p");
    yield* prose(PLAN_RESPONSE);
    return;
  }

  if (asks(message, "how big", "mass", "size", "weigh")) {
    yield* thinking("r", [
      "The question is about the Higgs boson's size, and the honest answer is that it does not have one.",
      "Better to give the mass instead, and say why size is the wrong question — but check the current figure first.",
    ]);
    yield* toolCall("t");
    yield* prose(HIGGS_RESPONSE);
    return;
  }

  yield* thinking("r", [
    "A general question, so the answer should start from what the field is for rather than from a definition.",
    "Three families is the useful shape: fermions, bosons, and the Higgs.",
  ]);
  yield* prose(AI_RESPONSE);
}

/**
 * A reply inside a thread on a passage.
 *
 * Prose only. A thread is a follow-up on something already said, and a tool
 * call inside a popover over the answer would be absurd.
 */
export async function* threadReply(): AsyncGenerator<string> {
  yield* prose([
    "Marking a passage and asking about it keeps the question attached to what it is about — so the answer can be short.",
    "That is the whole of the thread: the quote, one question, one answer.",
  ]);
}
