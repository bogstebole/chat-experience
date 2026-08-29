"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pencil } from "lucide-react";
import { Button } from "../Button/Button";
import { Chip } from "../Chip/Chip";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import {
  QuestionBadge,
  QuestionFieldRow,
  QuestionOptionRow,
  QuestionOtherRow,
  QuestionShell,
} from "./parts";
import type { Answer, Question, QuestionState } from "./types";
import styles from "./QuestionCard.module.css";

export interface QuestionCardProps {
  question: Question;
  /** Shown in the badge. 1-based. */
  number: number;
  state: QuestionState;
  answer?: Answer;
  onCommit?: (answer: Answer) => void;
  /** Called when somebody asks to change an answer already given. */
  onEdit?: () => void;
  /** Answers can be read but not changed. */
  readOnly?: boolean;
  labels?: Partial<Record<"next" | "none" | "edit", string>>;
}

type Labels = Record<"next" | "none" | "edit", string>;

const DEFAULT_LABELS: Labels = { next: "Next", none: "None of these", edit: "Edit answer" };

const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

/** a, b, c … — the option's letter. */
const letterFor = (i: number) => String.fromCharCode(97 + i);

/** How long a single-select stays visibly picked before it moves on. */
const PICK_SETTLE = 300;
/** Long enough for the card to have finished growing before focus lands. */
const FOCUS_AFTER = 380;

/**
 * What an answer looks like once folded into a row.
 *
 * Two at most, then a count. Three chips of unpredictable width in a row that
 * also holds a title is a row that wraps, and a summary that wraps is not a
 * summary.
 */
export function answerChips(question: Question, answer?: Answer): string[] {
  if (!answer) return [];

  if (question.type === "inputs" && "values" in answer) {
    const values = question.fields.map((f) => answer.values?.[f.id]).filter(Boolean) as string[];
    return values.length <= 2 ? values : [...values.slice(0, 2), `+${values.length - 2}`];
  }

  if (question.type === "single" && "optionId" in answer) {
    const option = question.options.find((o) => o.id === answer.optionId);
    return option ? [option.title] : [];
  }

  if (question.type === "multi" && "optionIds" in answer) {
    const picked = question.options.filter((o) => answer.optionIds?.includes(o.id));
    const other = answer.other?.trim();
    // Several short ones read better joined than stacked.
    if (!other && picked.length > 1 && picked.every((o) => o.short)) {
      return [picked.map((o) => o.short).join(", ")];
    }
    const labels = [...picked.map((o) => o.title), ...(other ? [other] : [])];
    return labels.length <= 2 ? labels : [...labels.slice(0, 2), `+${labels.length - 2}`];
  }

  return [];
}

/** The body of a question being answered. */
function ActiveBody({
  question,
  number,
  answer,
  onCommit,
  labels,
}: {
  question: Question;
  number: number;
  answer?: Answer;
  onCommit?: (answer: Answer) => void;
  labels: Labels;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    answer && "values" in answer ? { ...answer.values } : {}
  );
  const [ids, setIds] = useState<string[]>(() =>
    answer && "optionIds" in answer ? [...(answer.optionIds ?? [])] : []
  );
  const [other, setOther] = useState(() => (answer && "optionIds" in answer ? answer.other ?? "" : ""));
  const [picked, setPicked] = useState<string | null>(
    answer && "optionId" in answer ? answer.optionId : null
  );

  const firstField = useRef<HTMLInputElement | null>(null);
  /* Built once per question rather than filled in during the map. Writing to a
     ref while rendering is the kind of thing that works until React renders
     twice, and it renders twice in development on purpose. */
  const fields = useMemo<RefObject<HTMLInputElement | null>[]>(
    () => (question.type === "inputs" ? question.fields.map(() => ({ current: null })) : []),
    [question]
  );

  useEffect(() => {
    if (question.type !== "inputs") return;
    // After the card has finished growing, or focus lands mid-animation and
    // the browser scrolls to where the field was rather than where it is.
    const t = setTimeout(
      () => firstField.current?.focus({ preventScroll: true }),
      prefersReducedMotion() ? 0 : FOCUS_AFTER
    );
    return () => clearTimeout(t);
  }, [question.type]);

  const complete = useMemo(
    () =>
      question.type !== "inputs" ||
      question.fields.every((f) => f.optional || (values[f.id] ?? "").trim()),
    [question, values]
  );

  /* The same in all three branches. An object rather than a local component —
     a component declared inside a render is a new type every render, and the
     rows would remount on every keystroke, taking the focus with them. The
     card around this one is the one that morphs, so this shell draws no box. */
  const shell = {
    number,
    title: question.title,
    subtitle: question.subtitle,
    card: false,
  } as const;

  if (question.type === "inputs") {
    const commit = () => complete && onCommit?.({ values });
    return (
      <QuestionShell
        {...shell}
        footer={
          <Button variant="secondary" size="m" disabled={!complete} onClick={commit}>
            {labels.next}
          </Button>
        }
      >
        {question.fields.map((field, i) => (
          <QuestionFieldRow
            key={field.id}
            letter={letterFor(i)}
            label={field.label}
            placeholder={field.placeholder}
            value={values[field.id] ?? ""}
            onChange={(v) => setValues((all) => ({ ...all, [field.id]: v }))}
            ref={i === 0 ? firstField : fields[i]}
            /* Enter moves on rather than submitting the lot: the next field
               is nearly always what somebody means by it. */
            onEnter={() => {
              const next = i === 0 ? fields[1]?.current : fields[i + 1]?.current;
              if (next) next.focus();
              else commit();
            }}
          />
        ))}
      </QuestionShell>
    );
  }

  if (question.type === "single") {
    return (
      <QuestionShell {...shell}>
        {question.options.map((option, i) => (
          <QuestionOptionRow
            key={option.id}
            letter={letterFor(i)}
            title={option.title}
            description={option.description}
            selected={picked === option.id}
            /* Picked, then a beat, then on. Committing instantly means the
               card is gone before anyone sees which one they chose. */
            onClick={() => {
              setPicked(option.id);
              setTimeout(() => onCommit?.({ optionId: option.id }), PICK_SETTLE);
            }}
          />
        ))}
      </QuestionShell>
    );
  }

  const trimmed = other.trim();
  const empty = ids.length === 0 && !trimmed;
  const commitMulti = () => {
    if (!question.allowEmpty && empty) return;
    onCommit?.({ optionIds: ids, ...(trimmed ? { other: trimmed } : {}) });
  };

  return (
    <QuestionShell
      {...shell}
      footer={
        <Button
          variant="secondary"
          size="m"
          disabled={!question.allowEmpty && empty}
          onClick={commitMulti}
        >
          {question.allowEmpty && empty ? labels.none : labels.next}
        </Button>
      }
    >
      {question.options.map((option, i) => (
        <QuestionOptionRow
          key={option.id}
          letter={letterFor(i)}
          title={option.title}
          description={option.description}
          selected={ids.includes(option.id)}
          onClick={() =>
            setIds((all) =>
              all.includes(option.id) ? all.filter((x) => x !== option.id) : [...all, option.id]
            )
          }
        />
      ))}
      {question.allowOther && (
        <QuestionOtherRow
          letter={letterFor(question.options.length)}
          value={other}
          placeholder={question.otherPlaceholder ?? "Something else"}
          onChange={setOther}
          onEnter={commitMulti}
        />
      )}
    </QuestionShell>
  );
}

/**
 * One question, in whichever of its three states it is in.
 *
 * The card morphs between them rather than swapping: the box animates with
 * FLIP, and the content inside counter-scales so text keeps its real size
 * instead of stretching on the way. `overflow: hidden` is what makes growing
 * read as a reveal rather than as content spilling out of a box that has not
 * caught up.
 */
export function QuestionCard({
  question,
  number,
  state,
  answer,
  onCommit,
  onEdit,
  readOnly = false,
  labels,
}: QuestionCardProps) {
  const label = { ...DEFAULT_LABELS, ...labels };
  const isCard = state !== "upcoming";
  const still = prefersReducedMotion();

  let body: ReactNode;
  if (state === "active") {
    body = (
      <ActiveBody
        question={question}
        number={number}
        answer={answer}
        onCommit={onCommit}
        labels={label}
      />
    );
  } else if (state === "collapsed") {
    const chips = answerChips(question, answer);
    const summary = (
      <>
        <span className={styles.collapsedLabel}>
          <QuestionBadge onCard>{number}</QuestionBadge>
          <span className={styles.collapsedTitle}>{question.shortTitle}</span>
        </span>
        <span className={styles.collapsedAnswer}>
          {chips.map((chip, i) => (
            <Chip key={`${chip}-${i}`}>{chip}</Chip>
          ))}
          {!readOnly && <Pencil className={styles.pencil} size={14} aria-hidden />}
        </span>
      </>
    );

    /* One control for the whole row rather than a click handler on a div with
       a button inside it. The original could be clicked but not tabbed to, and
       a nested button inside a clickable row is a second tab stop for the same
       action. Read-only, it is not a control at all. */
    body = readOnly ? (
      <div className={`${styles.collapsed} ${styles.static}`}>{summary}</div>
    ) : (
      <button
        type="button"
        className={styles.collapsed}
        onClick={onEdit}
        aria-label={`${label.edit}: ${question.shortTitle}`}
      >
        {summary}
      </button>
    );
  } else {
    body = (
      <div className={styles.upcoming}>
        {/* The number, not a mark meaning "one of these" — the row is question
            three whether or not it has been reached yet, and saying so is what
            makes a list of them read as a list. White, because an upcoming
            card has no card under it: the badge is what stands off the
            group's own surface. */}
        <QuestionBadge>{number}</QuestionBadge>
        <span className={styles.upcomingLabel}>{question.shortTitle}</span>
      </div>
    );
  }

  return (
    <motion.div
      layout={!still}
      data-active={state === "active" || undefined}
      className={styles.item}
      data-card={isCard || undefined}
      transition={{ layout: SPRING }}
    >
      {/* The wrapper resizes with FLIP, which scales everything inside it.
          `layout="position"` makes Motion counter-scale the content, so text
          and controls keep their real size instead of stretching. `popLayout`
          takes the outgoing state out of flow so it is not squashed on its
          way out. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={state}
          layout={still ? false : "position"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, delay: still ? 0 : 0.12 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
