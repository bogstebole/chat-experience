import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as kit from "../index";

/**
 * The front-door README is checked against the package, not against memory.
 *
 * It is the first and often the only thing somebody installing this reads, so
 * the two ways it rots are the two that matter: a component named in "What's
 * in the box" that the package does not export, and a link to a file that has
 * moved. Neither shows up in a build, and neither is caught by reading — the
 * old README carried a test count that had been wrong by 587 for months.
 *
 * Read from disk the same way `roadmap.test.ts` does, and for the same reason:
 * the file is outside the package root, so `?raw` cannot reach it, and under
 * Vitest `import.meta.url` is an http URL rather than a path.
 */
const repoRoot = () => {
  let at = process.cwd();
  for (let up = 0; up < 6; up += 1) {
    // Not "the first directory with a README" — the package has one of those,
    // so the walk stopped inside it and the test checked the wrong file
    // against the wrong root. The workspace list is what actually defines the
    // root, and only one package.json in the tree carries it.
    const manifest = join(at, "package.json");
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, "utf8"));
      if (parsed.workspaces) return at;
    }
    at = dirname(at);
  }
  throw new Error("no workspace root above the working directory");
};

const readme = async () => readFile(join(repoRoot(), "README.md"), "utf8");

/** The lines of one `## ` section, up to the next one. */
const section = (text: string, heading: string) => {
  const lines = text.split("\n");
  const from = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (from < 0) throw new Error(`no "## ${heading}" section in the README`);
  const rest = lines.slice(from + 1);
  const to = rest.findIndex((l) => l.startsWith("## "));
  return to < 0 ? rest : rest.slice(0, to);
};

/**
 * Names the box list claims to hold.
 *
 * Only lines that *begin* with a backtick, and only the part before the em
 * dash that introduces a description — so the prose around the list, which
 * mentions types and fields that are not runtime exports, is not mistaken for
 * a claim about `Object.keys(kit)`.
 */
const claimedComponents = (text: string) =>
  section(text, "What's in the box")
    .filter((line) => line.startsWith("`"))
    .flatMap((line) => [...line.split(" — ")[0].matchAll(/`([^`]+)`/g)].map((m) => m[1]));

/** Every relative link target, ignoring anchors and the open web. */
const localLinks = (text: string) =>
  [...text.matchAll(/\]\(([^)]+)\)/g)]
    .map((m) => m[1])
    .filter((href) => !/^(https?:|#|mailto:)/.test(href));

describe("the front-door README", () => {
  it("names only components the package exports", async () => {
    const claimed = claimedComponents(await readme());
    // A guard over an empty list passes for the wrong reason.
    expect(claimed.length).toBeGreaterThan(20);
    for (const name of claimed) {
      expect(kit, `README lists \`${name}\`, which is not exported`).toHaveProperty(name);
    }
  });

  it("links only to files that exist", async () => {
    const root = repoRoot();
    for (const href of localLinks(await readme())) {
      const target = join(root, href.split("#")[0]);
      expect(existsSync(target), `README links to ${href}, which is not there`).toBe(true);
    }
  });

  it("sends contributors somewhere, and it is not this file", async () => {
    // The dev environment moved out of the README so that the README could be
    // for people installing the package. The move only works if the pointer
    // survives.
    const text = await readme();
    expect(text).toContain("CONTRIBUTING.md");
    expect(existsSync(join(repoRoot(), "CONTRIBUTING.md"))).toBe(true);
  });
});
