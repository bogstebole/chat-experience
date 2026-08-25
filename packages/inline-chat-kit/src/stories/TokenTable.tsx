import { useEffect, useState } from "react";

export interface Token {
  name: string;
  value: string;
}

/**
 * Every `--ick-` token, read out of the stylesheets themselves.
 *
 * Not a hand-written list. A table of tokens kept in step by hand is a table
 * that will be wrong within a month — this one cannot be, because it reads
 * the same source the components read. Adding a token adds a row.
 */
function collectTokenNames(): string[] {
  const names = new Set<string>();

  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      // Grouping rules — @layer, @media, @supports — hold their own list.
      const nested = (rule as CSSGroupingRule).cssRules;
      if (nested) walk(nested);

      const style = (rule as CSSStyleRule).style;
      if (!style) continue;
      for (let i = 0; i < style.length; i++) {
        const property = style.item(i);
        if (property.startsWith("--ick-")) names.add(property);
      }
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules);
    } catch {
      // A cross-origin stylesheet cannot be read. None of ours are.
    }
  }

  return [...names].sort();
}

const readTokens = (): Token[] => {
  const root = getComputedStyle(document.documentElement);
  return collectTokenNames().map((name) => ({ name, value: root.getPropertyValue(name).trim() }));
};

export function useTokens(): Token[] {
  // Read once, during the first render. Doing it in an effect instead would
  // mean setting state the moment the effect ran, which is a render the page
  // does not need and a rule React is right to complain about.
  const [tokens, setTokens] = useState<Token[]>(readTokens);

  useEffect(() => {
    // The theme can change while the table is open, and the values shown
    // should be the ones in force rather than the ones that happened to be in
    // force on mount.
    const observer = new MutationObserver(() => setTokens(readTokens()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  return tokens;
}

/** Which of the three tiers a token belongs to, from its name. */
const GROUPS: { title: string; note: string; match: (name: string) => boolean }[] = [
  {
    title: "Primitives",
    note: "Raw channels. Only the token file reads these; swapping them is what makes a theme.",
    match: (n) => n.endsWith("-rgb"),
  },
  {
    title: "Ink",
    note: "Text, strongest to faintest.",
    match: (n) => n.startsWith("--ick-ink"),
  },
  {
    title: "Surface & edge",
    note: "Backgrounds, borders, the focus ring.",
    match: (n) =>
      n.startsWith("--ick-surface") || n.startsWith("--ick-border") || n.startsWith("--ick-focus"),
  },
  {
    title: "Marker",
    note: "The highlighter's own colour, which used to be a hex literal in a TSX constant.",
    match: (n) => n.startsWith("--ick-marker"),
  },
  {
    title: "Glass",
    note: "A material rather than a colour. Its shadow stacks are the one part restated per theme.",
    match: (n) => n.startsWith("--ick-glass") || n.startsWith("--ick-shadow-glass"),
  },
  {
    title: "Elevation",
    note: "Named by how far off the page a thing sits, not by how it is drawn.",
    match: (n) => n.startsWith("--ick-shadow"),
  },
  {
    title: "Type",
    note: "Font stacks, sizes and weights.",
    match: (n) =>
      n.startsWith("--ick-font") || n.startsWith("--ick-text") || n.startsWith("--ick-weight"),
  },
  { title: "Space", note: "", match: (n) => n.startsWith("--ick-space") },
  { title: "Shape", note: "", match: (n) => n.startsWith("--ick-radius") },
  {
    title: "Motion",
    note: "One easing curve, which used to be retyped thirteen times.",
    match: (n) => n.startsWith("--ick-ease") || n.startsWith("--ick-duration"),
  },
  {
    title: "Layers",
    note: "The old values were 0, 1, 2, 3, 5, 10, 50, 200, 10000 and 99999.",
    match: (n) => n.startsWith("--ick-z-"),
  },
];

const isColour = (v: string) => /^(#|rgb|hsl|color\()/.test(v);
const isGradient = (v: string) => v.includes("gradient(");
const isShadow = (v: string) => v.includes("px") && v.includes("rgb") && v.includes(",");
const isLength = (v: string) => /^-?[\d.]+(px|rem|em)$/.test(v);

function Preview({ token }: { token: Token }) {
  const { value } = token;

  if (isColour(value) || isGradient(value)) {
    return (
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 44,
          height: 22,
          borderRadius: 4,
          background: value,
          border: "1px solid var(--ick-border)",
          verticalAlign: "middle",
        }}
      />
    );
  }

  if (isShadow(value)) {
    return (
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 44,
          height: 22,
          borderRadius: 999,
          background: "var(--ick-glass-fill)",
          boxShadow: value,
        }}
      />
    );
  }

  if (isLength(value)) {
    return (
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: value,
          minWidth: 2,
          maxWidth: 120,
          height: 12,
          borderRadius: 2,
          background: "var(--ick-ink-faint)",
          verticalAlign: "middle",
        }}
      />
    );
  }

  if (token.name.startsWith("--ick-font")) {
    return <span style={{ fontFamily: value, fontSize: 15 }}>Ag</span>;
  }

  return null;
}

export function TokenTable() {
  const tokens = useTokens();
  const used = new Set<string>();

  return (
    <div style={{ maxWidth: 860, fontFamily: "var(--ick-font-sans)", color: "var(--ick-ink)" }}>
      <p style={{ color: "var(--ick-ink-soft)", fontSize: 13, lineHeight: 1.6, margin: "0 0 28px" }}>
        Read live from the stylesheets, in whichever theme is selected in the toolbar. Every value
        here is the one the components are using right now.
      </p>

      {GROUPS.map((group) => {
        const rows = tokens.filter((t) => !used.has(t.name) && group.match(t.name));
        rows.forEach((t) => used.add(t.name));
        if (rows.length === 0) return null;

        return (
          <section key={group.title} style={{ marginBottom: 36 }}>
            <h3 style={{ fontSize: 13, margin: "0 0 2px", letterSpacing: "0.02em" }}>
              {group.title}
            </h3>
            {group.note && (
              <p style={{ color: "var(--ick-ink-faint)", fontSize: 12, margin: "0 0 12px" }}>
                {group.note}
              </p>
            )}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {rows.map((token) => (
                  <tr key={token.name} style={{ borderTop: "1px solid var(--ick-border)" }}>
                    <td style={{ padding: "8px 12px 8px 0", width: 56 }}>
                      <Preview token={token} />
                    </td>
                    <td
                      style={{
                        padding: "8px 12px 8px 0",
                        fontFamily: "var(--ick-font-mono)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {token.name}
                    </td>
                    <td
                      style={{
                        padding: "8px 0",
                        fontFamily: "var(--ick-font-mono)",
                        color: "var(--ick-ink-soft)",
                        wordBreak: "break-word",
                      }}
                    >
                      {token.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
