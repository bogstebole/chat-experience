import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import { ChatExperience } from "../ChatExperience/ChatExperience";
import { ReplyThreadPopup } from "../ReplyThreadPopup/ReplyThreadPopup";
import { ArtifactPane } from "../Artifact/ArtifactPane";
import { LabelsProvider, defaultLabels, type ChatLabels } from "../labels/labels";
import type { ChatTurn } from "../useChatTurns/useChatTurns";
import type { TurnPart } from "../turnParts/turnParts";

/**
 * Every word the kit says goes through `labels`.
 *
 * The check is by alphabet rather than by list. Everything the host supplies
 * here — the question, the answer, tool names, titles, file names — is written
 * in Cyrillic, and every label is set to "§". So once the kit has drawn, any
 * Latin letter left in the text, an `aria-label`, a `title` or a placeholder
 * is a string the kit wrote itself and did not route through `labels`. A list
 * of known strings would only catch the strings somebody remembered to list.
 *
 * Two things are stripped first, and only these: durations ("1.5s", "300ms"),
 * whose units are SI rather than English, and class names and ids, which are
 * not text anybody reads.
 */

const SENTINEL = "§";

const sentinel = Object.fromEntries(
  Object.entries(defaultLabels).map(([group, strings]) => [
    group,
    Object.fromEntries(Object.keys(strings).map((key) => [key, SENTINEL])),
  ])
) as ChatLabels;

const READ = ["aria-label", "title", "placeholder", "data-placeholder", "alt", "aria-valuetext"];

/** Everything a person could see or hear, as a list of strings. */
const said = (root: HTMLElement = document.body): string[] => {
  const out: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent && (parent.closest("style") || parent.closest("script"))) continue;
    if (node.textContent?.trim()) out.push(node.textContent);
  }
  for (const el of root.querySelectorAll("*")) {
    for (const name of READ) {
      const value = el.getAttribute(name);
      if (value) out.push(`[${name}] ${value}`);
    }
  }
  return out;
};

const DURATION = /\d+(\.\d+)?\s?(ms|s)\b/g;

const leaks = (root?: HTMLElement) =>
  said(root)
    .map((s) => s.replace(DURATION, "").replace(/^\[[\w-]+\] /, ""))
    .filter((s) => /[A-Za-z]/.test(s));

/* The parts, all of them, in the states that say different things. */
const parts: TurnPart[] = [
  { kind: "reasoning", id: "r1", text: "мислим", state: "thinking" },
  { kind: "reasoning", id: "r2", text: "мислио сам", state: "done", duration: 1500 },
  {
    kind: "chain",
    id: "c1",
    steps: [
      { id: "a", label: "први", state: "done" },
      { id: "b", label: "други", state: "running" },
    ],
    state: "done",
    duration: 900,
  },
  {
    kind: "tasks",
    id: "k",
    title: "План",
    collapsible: true,
    tasks: [
      { id: "1", label: "један", state: "pending" },
      { id: "2", label: "два", state: "running" },
      { id: "3", label: "три", state: "done" },
      { id: "4", label: "четири", state: "error" },
    ],
  },
  { kind: "sources", id: "s", sources: [{ id: "x", title: "Извор", origin: "извор" }] },
  { kind: "tool", id: "t1", name: "алат", state: "pending" },
  { kind: "tool", id: "t2", name: "алат", state: "running", input: { "упит": "вредност" } },
  {
    kind: "tool",
    id: "t3",
    name: "алат",
    state: "done",
    input: { "упит": "вредност" },
    output: "резултат",
    duration: 300,
  },
  { kind: "tool", id: "t4", name: "алат", state: "error", error: "грешка" },
  {
    kind: "approval",
    id: "a1",
    title: "Дозвола",
    tool: { name: "алат", input: { "наредба": "обриши" } },
  },
  { kind: "approval", id: "a2", title: "Дозвола", decision: "once" },
  { kind: "approval", id: "a3", title: "Дозвола", decision: "always" },
  { kind: "approval", id: "a4", title: "Дозвола", decision: "denied" },
  { kind: "approval", id: "a5", title: "Дозвола", choices: ["once", "deny"] },
  {
    kind: "question",
    id: "q",
    title: "Питања",
    activeIndex: 0,
    questions: [
      {
        id: "q1",
        type: "multi",
        title: "Изабери",
        shortTitle: "избор",
        allowOther: true,
        allowEmpty: true,
        options: [{ id: "o", title: "опција" }],
      },
      {
        id: "q2",
        type: "inputs",
        title: "Упиши",
        shortTitle: "унос",
        fields: [{ id: "f", label: "поље" }],
      },
    ],
  },
  { kind: "notice", id: "n", text: "обавештење" },
  { kind: "artifact", id: "art1", title: "Документ", state: "writing" },
  { kind: "artifact", id: "art2", title: "Документ", content: "садржај", preview: "text" },
  { kind: "custom", id: "cu", type: "картица", data: null },
];

const answered: ChatTurn = {
  id: "t",
  user: "Питање",
  attachments: [{ id: "f", name: "прилог" }],
  ai: "Одговор[^1] са кодом:\n\n```\nкод\n```\n",
  parts,
  versions: [
    { id: "v1", ai: "први", parts: [] },
    { id: "v2", ai: "Одговор", parts: [] },
  ],
  versionIndex: 1,
  state: "resting",
};

/* A highlight needs a measurement; see TextHighlighter.highlights.test.tsx.
   Restored by hand: `restoreAllMocks` would also strip the `matchMedia` stub
   the setup file installs. */
let rects: { mockRestore: () => void };
beforeEach(() => {
  rects = vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
    { left: 10, top: 20, width: 120, height: 16 },
  ] as unknown as DOMRectList);
});
afterEach(() => rects.mockRestore());

describe("labels reach every piece of an assembled turn", () => {
  it("leaves no English in a turn with every part", () => {
    render(
      <ChatTurnRow
        turn={answered}
        labels={sentinel}
        onRegenerate={() => {}}
        onFeedback={() => {}}
        onShowVersion={() => {}}
        onOpenArtifact={() => {}}
        onReplyInThread={() => {}}
        renderPart={(part) => <span>{part.type}</span>}
      />
    );
    // It drew what it was asked to — a check on the check.
    expect(screen.getAllByText(SENTINEL).length).toBeGreaterThan(20);
    expect(leaks()).toEqual([]);
  });

  it("leaves no English in a highlight and its menu", async () => {
    const { container } = render(
      <ChatTurnRow turn={answered} labels={sentinel} onReplyInThread={() => {}} />
    );
    const surface = container.querySelector("[data-cursor] [tabindex], [data-cursor][tabindex]") as HTMLElement
      ?? (container.querySelector("[tabindex='0']") as HTMLElement);
    surface.focus();
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    fireEvent.keyDown(surface, { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
    expect(leaks()).toEqual([]);
  });

  it("leaves no English in the composer, its menu, and the bubble's own actions", () => {
    const live: ChatTurn = { id: "l", user: "", ai: "", parts: [], state: "idle" };
    const { container, unmount } = render(
      <ChatTurnRow turn={live} isActiveInput labels={sentinel} />
    );
    fireEvent.click(within(container).getByRole("button", { name: SENTINEL }));
    // The three built-in entries and the button that closes them.
    expect(screen.getAllByRole("button", { name: SENTINEL }).length).toBeGreaterThanOrEqual(4);
    expect(leaks()).toEqual([]);
    unmount();

    /* Editing: cancel and save. */
    render(
      <ChatTurnRow
        turn={{ ...answered, parts: [], state: "typing" }}
        labels={sentinel}
        isActiveInput
      />
    );
    expect(leaks()).toEqual([]);
  });

  it("leaves no English on a sent bubble's hover actions", () => {
    const { container } = render(
      <ChatTurnRow turn={{ ...answered, parts: [] }} labels={sentinel} onEdit={() => {}} />
    );
    const bubble = container.querySelector("[contenteditable]")!.closest("[class]")!;
    let el: Element | null = bubble;
    while (el && el !== container) {
      fireEvent.mouseEnter(el);
      el = el.parentElement;
    }
    // Copy and edit, under the bubble.
    expect(screen.getAllByRole("button", { name: SENTINEL }).length).toBeGreaterThanOrEqual(2);
    expect(leaks()).toEqual([]);
  });

  it("leaves no English in the microphone", () => {
    const recorder = vi.fn();
    vi.stubGlobal("MediaRecorder", recorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    try {
      render(
        <ChatTurnRow
          turn={{ id: "m", user: "", ai: "", parts: [], state: "idle" }}
          isActiveInput
          labels={sentinel}
          onTranscribe={() => ""}
        />
      );
      expect(document.querySelector("button[aria-pressed]")).toHaveAttribute("aria-label", SENTINEL);
      expect(leaks()).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, "mediaDevices");
    }
  });
});

describe("labels reach the pieces around the conversation", () => {
  it("leaves no English in the assembled chat", async () => {
    render(
      <ChatExperience
        onSend={() => "Одговор."}
        labels={sentinel}
        backHref="#"
        selectionToggle
        contextTotal={1}
        empty={{ title: "Добродошли", suggestions: ["Предлог"] }}
      />
    );
    // The header's own: back, theme, share; and the selection pair.
    expect(screen.getAllByRole("button", { name: SENTINEL }).length).toBeGreaterThanOrEqual(4);
    expect(leaks()).toEqual([]);

    /* An answer, a highlight on it, and the sheet that lists them. */
    fireEvent.click(screen.getByRole("button", { name: "Предлог" }));
    const answer = await screen.findByText("Одговор.", undefined, { timeout: 3000 });
    const surface = answer.closest("[tabindex]") as HTMLElement;
    surface.focus();
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    fireEvent.keyDown(surface, { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("menu"), { key: "Escape" });

    fireEvent.click(await screen.findByRole("button", { name: `${SENTINEL}, 1` }));
    const sheet = await screen.findByRole("dialog", { name: SENTINEL });
    expect(within(sheet).getByRole("heading", { level: 2 })).toHaveTextContent(SENTINEL);
    expect(leaks()).toEqual([]);
  });

  it("leaves no English in a thread", () => {
    render(
      <LabelsProvider labels={sentinel}>
        <ReplyThreadPopup
          activeReply={{ text: "одломак", rect: new DOMRect(0, 0, 10, 10) }}
          onClose={() => {}}
          onSendMessage={() => "одговор"}
        />
      </LabelsProvider>
    );
    expect(leaks()).toEqual([]);
  });

  it("leaves no English in the artifact pane", () => {
    render(
      <LabelsProvider labels={sentinel}>
        <ArtifactPane title="Документ" onClose={() => {}} onToggleExpanded={() => {}}>
          садржај
        </ArtifactPane>
      </LabelsProvider>
    );
    expect(leaks()).toEqual([]);
  });

  it("is spoken, too: what the live region says goes through labels", async () => {
    const heard: string[] = [];
    const listen = new MutationObserver(() => {
      for (const region of document.querySelectorAll("[aria-live]")) {
        if (region.textContent) heard.push(region.textContent);
      }
    });
    listen.observe(document.body, { subtree: true, childList: true, characterData: true });

    render(
      <ChatExperience
        onSend={() => "Одговор."}
        labels={sentinel}
        contextTotal={1}
        empty={{ title: "Добродошли", suggestions: ["Предлог"] }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Предлог" }));
    await screen.findByText("Одговор.", undefined, { timeout: 3000 });
    await waitFor(() => expect(heard).toContain("Одговор."));
    listen.disconnect();

    // The window filling, and "generating response" — both the kit's words.
    expect(heard.filter((h) => h === SENTINEL).length).toBeGreaterThanOrEqual(1);
    expect(heard.filter((h) => /[A-Za-z]/.test(h))).toEqual([]);
  });
});

describe("what is left out", () => {
  it("stays English, string by string", () => {
    render(
      <ChatTurnRow
        turn={{ ...answered, parts: [{ kind: "approval", id: "a", title: "Дозвола" }] }}
        labels={{ approval: { once: "Дозволи једном" } }}
      />
    );
    expect(screen.getByRole("button", { name: "Дозволи једном" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deny" })).toBeInTheDocument();
  });

  it("lets a component's own labels win over the provider's", () => {
    render(
      <LabelsProvider labels={{ approval: { deny: "Одбиј" } }}>
        <ChatTurnRow
          turn={{ ...answered, parts: [{ kind: "approval", id: "a", title: "Дозвола" }] }}
          labels={{ approval: { deny: "Не" } }}
        />
      </LabelsProvider>
    );
    expect(screen.getByRole("button", { name: "Не" })).toBeInTheDocument();
  });
});
