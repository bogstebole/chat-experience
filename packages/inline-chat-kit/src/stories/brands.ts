/**
 * Invented brands, to test a claim rather than repeat it.
 *
 * The claim is that a handful of tokens is enough to make the kit look like
 * somebody else. Each of these sets only what a brand would actually care
 * about, and nothing else — if one of them needs a token outside that
 * handful, the claim is wrong and the token belongs in the brand tier.
 */
export interface Brand {
  name: string;
  note: string;
  /** Set on a `.ick-theme` element. Nothing here is component-specific. */
  tokens: Record<string, string>;
  dark?: boolean;
}

export const BRANDS: Brand[] = [
  {
    name: "Ledger",
    note: "Warm and editorial. Paper rather than white, and a highlighter that looks like one.",
    tokens: {
      "--ick-ink-rgb": "38 32 26",
      "--ick-paper-rgb": "250 246 238",
      "--ick-marker-rgb": "255 176 46",
      "--ick-font-sans": "'Iowan Old Style', Georgia, serif",
      "--ick-font-mono": "'SF Mono', ui-monospace, monospace",
      "--ick-radius-xl": "10px",
      "--ick-radius-lg": "8px",
      "--ick-radius-pill": "8px",
    },
  },
  {
    name: "Terminal",
    note: "Cold and square. Mono throughout, corners at four pixels, a cyan marker.",
    tokens: {
      "--ick-ink-rgb": "16 24 40",
      "--ick-paper-rgb": "247 249 252",
      "--ick-marker-rgb": "56 224 255",
      "--ick-font-sans": "ui-monospace, 'SF Mono', monospace",
      "--ick-font-mono": "ui-monospace, 'SF Mono', monospace",
      "--ick-radius-xl": "4px",
      "--ick-radius-lg": "4px",
      "--ick-radius-md": "3px",
      "--ick-radius-pill": "4px",
    },
  },
  {
    name: "After hours",
    note: "Dark by default. The glass rim goes down, because there is less light to catch.",
    dark: true,
    tokens: {
      "--ick-dark-ink-rgb": "236 232 244",
      "--ick-dark-paper-rgb": "22 18 30",
      "--ick-marker-rgb": "255 64 160",
      "--ick-font-sans": "'Avenir Next', system-ui, sans-serif",
      "--ick-radius-xl": "20px",
      "--ick-radius-pill": "999px",
    },
  },
];
