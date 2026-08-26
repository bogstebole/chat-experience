import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Colours belong in the token file and nowhere else.
 *
 * Every literal outside it is a colour a host cannot change and a theme
 * cannot reach — the migration removed about three hundred of them, and one
 * hurried commit is all it takes to start again. So the rule is enforced
 * rather than remembered.
 */
const SRC = join(import.meta.dirname, "..");

/** Where colours are supposed to live. */
const TOKEN_FILE = "styles/tokens.css";

/**
 * The exceptions, each with its reason. A list that says "deliberately",
 * not a list that says "skipped" — anything added here should be arguing
 * that the value is not a colour at all.
 */
const ALLOWED: { match: RegExp; reason: string }[] = [
  {
    match: /linear-gradient\(#fff 0 0\)/,
    reason: "a mask stencil: it needs an opaque value and any one will do",
  },
];

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba\(|hsla?\(/;

function walk(dir: string, hits: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "stories") continue;
      walk(path, hits);
    } else if (/\.(module\.css|tsx|ts)$/.test(entry.name)) {
      hits.push(path);
    }
  }
  return hits;
}

const offenders = () => {
  const found: string[] = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file);
    if (rel === TOKEN_FILE) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (!COLOUR.test(line)) return;
        if (ALLOWED.some((a) => a.match.test(line))) return;
        found.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
  }
  return found;
};

describe("colours live in the token file", () => {
  it("has none anywhere else", () => {
    const found = offenders();
    expect(found, `literal colours outside ${TOKEN_FILE}:\n${found.join("\n")}`).toEqual([]);
  });

  /** A scan that reads nothing would pass this suite without checking it. */
  it("is actually reading the source", () => {
    expect(walk(SRC).length).toBeGreaterThan(10);
  });

  it("finds colours in the token file, where they belong", () => {
    const tokens = readFileSync(join(SRC, TOKEN_FILE), "utf8");
    expect(COLOUR.test(tokens)).toBe(true);
  });
});
