/**
 * A structured question inside a conversation.
 *
 * Three shapes, because there are three ways to answer one: type something,
 * pick one, or pick several. Each carries a `shortTitle` for the row it
 * becomes once it is answered — the full question is too long to sit in a
 * summary, and truncating it loses the end, which is where the meaning is.
 */
export interface QuestionOption {
  id: string;
  title: string;
  description?: string;
  /** Used when several are chosen and the titles would not fit. */
  short?: string;
}

export interface QuestionField {
  id: string;
  label: string;
  placeholder?: string;
  optional?: boolean;
}

interface Common {
  id: string;
  title: string;
  subtitle?: string;
  /** What it is called once it is answered and folded into a row. */
  shortTitle: string;
}

export type Question =
  | (Common & { type: "inputs"; fields: QuestionField[] })
  | (Common & { type: "single"; options: QuestionOption[] })
  | (Common & {
      type: "multi";
      options: QuestionOption[];
      /** Adds a row that is a text field wearing an option's clothes. */
      allowOther?: boolean;
      otherPlaceholder?: string;
      /** Lets somebody answer "none of these" rather than being stuck. */
      allowEmpty?: boolean;
    });

export type Answer =
  | { values: Record<string, string> }
  | { optionId: string }
  | { optionIds: string[]; other?: string };

/** Answered, being answered, or still to come. */
export type QuestionState = "upcoming" | "active" | "collapsed";
