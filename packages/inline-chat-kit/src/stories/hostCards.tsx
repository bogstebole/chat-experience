import type { CSSProperties, ReactNode } from "react";
import { Button } from "../Button/Button";
import type { ChatLabels } from "../labels/labels";
import type { CustomPart, TurnPartUpdate } from "../turnParts/turnParts";
import type { SendHandler } from "../useChatTurns/useChatTurns";

/**
 * A host's own cards, the way an app would write them — for the stories.
 *
 * Nothing here is in the package. It is what a `renderPart` looks like from
 * the other side: a card that knows its own `type`, reads its own `data`, and
 * reports a click by writing the part back through `updatePart`. The kit's
 * tokens are used so the card sits on the same ground an approval does, and
 * the kit's `Button` so every control has its hover, press and focus.
 */

export interface PlanChange {
  field: string;
  before: string;
  after: string;
}

export interface PlanDiffData {
  title: string;
  changes: PlanChange[];
  status: "proposed" | "applied" | "dismissed";
}

export interface SendRequestData {
  to: string;
  subject: string;
  status: "draft" | "sent";
}

export interface OpenPageData {
  label: string;
  href: string;
}

const ground: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ick-space-5)",
  width: "100%",
  padding: "var(--ick-approval-pad)",
  borderRadius: "var(--ick-approval-radius)",
  background: "var(--ick-approval-surface)",
  fontFamily: "var(--ick-font-sans)",
};

const card: CSSProperties = {
  boxSizing: "border-box",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
  alignItems: "baseline",
  columnGap: "var(--ick-space-4)",
  rowGap: "var(--ick-space-4)",
  padding: "var(--ick-space-6) var(--ick-approval-column)",
  borderRadius: "calc(var(--ick-approval-radius) - var(--ick-approval-pad))",
  background: "var(--ick-card)",
  boxShadow: "var(--ick-shadow-1)",
  fontSize: "var(--ick-text-sm)",
  color: "var(--ick-ink)",
};

const head: CSSProperties = {
  margin: 0,
  padding: "var(--ick-space-2) 0 0 var(--ick-approval-column)",
  fontSize: "var(--ick-text-sm)",
  fontWeight: 560,
  color: "var(--ick-ink)",
};

const faint: CSSProperties = { color: "var(--ick-ink-faint)" };

/* The arrow is a picture; a screen reader gets the word instead. */
const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

const actions: CSSProperties = {
  display: "flex",
  gap: "var(--ick-space-3)",
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

const record: CSSProperties = {
  margin: 0,
  padding: "0 var(--ick-approval-column)",
  fontSize: "var(--ick-text-sm)",
  color: "var(--ick-ink-soft)",
};

type Write = (part: TurnPartUpdate) => void;

function PlanDiffCard({ data, write, id }: { data: PlanDiffData; write: Write; id: string }) {
  const settle = (status: PlanDiffData["status"]) =>
    write({ kind: "custom", id, data: { ...data, status } satisfies PlanDiffData });

  return (
    <section style={ground} aria-label={data.title} data-status={data.status}>
      <p style={head}>{data.title}</p>
      <div style={card}>
        {data.changes.map((change) => (
          <PlanRow key={change.field} change={change} />
        ))}
      </div>
      {data.status === "proposed" ? (
        <div style={actions}>
          <Button variant="ghost" size="m" onClick={() => settle("dismissed")}>
            Ne sada
          </Button>
          <Button variant="primary" size="m" onClick={() => settle("applied")}>
            Primeni na plan
          </Button>
        </div>
      ) : (
        <p style={record}>{data.status === "applied" ? "✓ Primenjeno" : "Nije primenjeno"}</p>
      )}
    </section>
  );
}

function PlanRow({ change }: { change: PlanChange }) {
  return (
    <>
      <span style={{ gridColumn: "1 / -1", ...faint, fontSize: "var(--ick-text-xs)" }}>
        {change.field}
      </span>
      <span style={{ ...faint, textDecoration: "line-through" }}>{change.before}</span>
      <span aria-hidden style={faint}>
        →
      </span>
      <span>
        <span style={visuallyHidden}>umesto toga </span>
        {change.after}
      </span>
    </>
  );
}

function SendRequestCard({ data, write, id }: { data: SendRequestData; write: Write; id: string }) {
  return (
    <section style={ground} aria-label="Pošalji upit">
      <p style={head}>Pošalji upit</p>
      <div style={{ ...card, gridTemplateColumns: "auto minmax(0, 1fr)" }}>
        <span style={faint}>Kome</span>
        <span>{data.to}</span>
        <span style={faint}>Tema</span>
        <span>{data.subject}</span>
      </div>
      {data.status === "draft" ? (
        <div style={actions}>
          <Button
            variant="primary"
            size="m"
            onClick={() => write({ kind: "custom", id, data: { ...data, status: "sent" } })}
          >
            Pošalji
          </Button>
        </div>
      ) : (
        <p style={record}>✓ Poslato</p>
      )}
    </section>
  );
}

function OpenPageButton({ data }: { data: OpenPageData }) {
  return (
    <div>
      <Button
        variant="outline"
        size="m"
        onClick={() => window.alert(`Aplikacija bi otvorila ${data.href}`)}
      >
        {data.label}
      </Button>
    </div>
  );
}

/**
 * The `renderPart` itself, given the writer for the turn. Built once per
 * writer — `updatePart` is stable — so the rows' memo holds.
 */
export const hostRenderer =
  (update: (turnId: string, part: TurnPartUpdate) => void) =>
  (part: CustomPart, { turnId }: { turnId: string }): ReactNode => {
    const write: Write = (next) => update(turnId, next);
    switch (part.type) {
      case "plan-diff":
        return <PlanDiffCard id={part.id} data={part.data as PlanDiffData} write={write} />;
      case "send-request":
        return <SendRequestCard id={part.id} data={part.data as SendRequestData} write={write} />;
      case "open-page":
        return <OpenPageButton data={part.data as OpenPageData} />;
      default:
        return null;
    }
  };

export const PLAN_DIFF: PlanDiffData = {
  title: "Predlažem ove izmene",
  status: "proposed",
  changes: [
    { field: "Trening utorkom", before: "5 km lagano", after: "6 km lagano" },
    { field: "Duga staza", before: "10 km", after: "12 km" },
    { field: "Odmor", before: "nedelja", after: "ponedeljak" },
  ],
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/** A reply in Serbian that carries every kind of host card, and an approval with two answers. */
export const serbianApi: SendHandler = async function* (_message, { signal }) {
  yield { kind: "reasoning", id: "r", text: "Gledam trenutni plan i tvoj cilj.", state: "thinking" };
  await wait(700, signal);
  yield { kind: "reasoning", id: "r", state: "done" };
  for (const word of "Pogledao sam plan. Dve stvari bih pomerio, i jednu dodao.".split(" ")) {
    yield `${word} `;
    await wait(40, signal);
  }
  yield { kind: "custom", id: "plan", type: "plan-diff", data: PLAN_DIFF };
  await wait(300, signal);
  yield {
    kind: "approval",
    id: "ok",
    title: "Upiši izmenu u kalendar",
    description: "Samo ovu nedelju. Ništa drugo se ne menja.",
    choices: ["once", "deny"],
  };
  yield {
    kind: "custom",
    id: "mail",
    type: "send-request",
    data: { to: "Trener Marko", subject: "Pomeranje duge staze", status: "draft" } satisfies SendRequestData,
  };
  yield {
    kind: "custom",
    id: "open",
    type: "open-page",
    data: { label: "Otvori plan treninga", href: "/plan" } satisfies OpenPageData,
  };
};

/** The whole chat in Serbian — every group, most strings. */
export const serbianLabels: ChatLabels = {
  approval: {
    once: "Dozvoli jednom",
    always: "Uvek dozvoli",
    deny: "Odbij",
    allowedOnce: "Dozvoljeno jednom",
    allowedAlways: "Dozvoljeno od sada",
    wasDenied: "Odbijeno",
    pending: "Čeka tebe",
  },
  tool: { input: "Ulaz", output: "Izlaz", error: "Greška", pending: "Na čekanju", running: "Radi", done: "Gotovo" },
  reasoning: { thinking: "Razmišljam", thought: "Razmislio", thoughtFor: "Razmišljao" },
  chain: { through: "Prošao kroz", step: "korak", steps: "koraka", thinking: "Razmišljam" },
  tasks: { pending: "Na čekanju", running: "U toku", done: "Gotovo", error: "Nije uspelo", progress: "{done} od {total}" },
  sources: { title: "Izvori", one: "izvor", many: "izvora" },
  citation: { cite: "Izvor" },
  answerActions: { copy: "Kopiraj odgovor", copied: "Kopirano", regenerate: "Ponovo", up: "Dobar odgovor", down: "Loš odgovor" },
  branch: { previous: "Prethodni odgovor", next: "Sledeći odgovor", position: "Odgovor {index} od {total}" },
  input: {
    placeholder: "Pitaj bilo šta…",
    send: "Pošalji poruku",
    save: "Sačuvaj izmene",
    stop: "Zaustavi odgovor",
    cancelEdit: "Otkaži izmenu",
    add: "Dodaj",
    copy: "Kopiraj",
    edit: "Izmeni",
    readMore: "Više",
    readLess: "Manje",
  },
  header: { back: "Nazad", more: "Još radnji" },
  highlighter: {
    menu: "Radnje za označeno",
    reply: "Odgovori u niti",
    remove: "Ukloni oznaku",
    highlight: "Oznaka:",
    countOne: "{count} oznaka",
    countMany: "{count} oznaka",
    keyboardHint:
      "Strelice levo i desno pomeraju po reč. Drži Shift za izbor. Enter označava izbor, Escape ga briše.",
  },
  codeBlock: { copy: "Kopiraj", copyCode: "Kopiraj kod", copied: "Kopirano", copiedAnnouncement: "Kopirano" },
  conversation: { jump: "Na najnovije" },
  emptyState: { suggestions: "Predlozi" },
  experience: {
    title: "Asistent",
    savedHighlights: "Sačuvane oznake",
    highlights: "Oznake",
    close: "Zatvori",
    paragraph: "Pasus {index}",
    windowFull: "Najstarije poruke ispadaju iz prozora.",
    responding: "Stiže odgovor",
  },
};
