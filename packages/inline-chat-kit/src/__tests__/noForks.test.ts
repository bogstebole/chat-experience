import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * No app may keep its own copy of something the kit already has.
 *
 * This is the guard for the fault that produced the last three bug reports,
 * and none of them looked like this from the outside. The playground's page
 * and the website's page were the same assembly written twice — 865 lines and
 * 890, ~90% identical — with 537 byte-identical lines of scripted answers and
 * two stylesheets beside them. Every fix went into one copy. The header
 * rendered see-through, the empty state snapped out of existence, and a sent
 * message stayed pinned to the top for the rest of the session, all because
 * the other copy never got the change.
 *
 * A rule about it is not enough: the copy is made by somebody in a hurry, and
 * the person reviewing it is reading a new file, not diffing it against one
 * two directories away. So it is measured.
 *
 * ## What counts as a copy
 *
 * Overlap of *substantial* lines — long enough to be a statement rather than a
 * brace, present in both files. Comments are stripped, because two files that
 * share only prose are a quotation and not a fork, and whitespace is
 * normalised, because a reformat is not a defence.
 *
 * Small files are exempt: a handful of shared lines between two short files is
 * two people writing the same obvious thing, not a fork. The threshold is
 * about where a file starts being worth maintaining in one place.
 */

/* Walked up to rather than computed from `process.cwd()`, which is the package
   directory under `npm test` and the repository root under a direct `vitest
   --root`. Two right answers to "where am I" is one too many for a check whose
   whole job is to read two trees. The first assertion below is what catches a
   miss: no sources found is a broken check, not a clean one. */
function repoRoot(from: string): string {
  let dir = from;
  for (let up = 0; up < 8; up++) {
    if (existsSync(join(dir, "packages", "inline-chat-kit", "src"))) return dir;
    dir = join(dir, "..");
  }
  return from;
}

const ROOT = repoRoot(process.cwd());
const KIT = join(ROOT, "packages", "inline-chat-kit", "src");
const APPS = join(ROOT, "apps");

/** Big enough that keeping two of it is a maintenance problem. */
const SUBSTANTIAL = 40;
/** Above this share of one file's lines found in another, it is a fork. */
const FORKED = 0.5;

const SKIP = new Set(["node_modules", "dist", "storybook-static", ".next", "__tests__"]);

function sources(dir: string, found: string[] = []): string[] {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, found);
    else if (/\.(ts|tsx|css)$/.test(entry.name)) found.push(path);
  }
  return found;
}

/**
 * The lines worth comparing: no comments, no whitespace-only differences, and
 * nothing so short it is punctuation. `}` appears in every file ever written
 * and says nothing about where a file came from.
 */
function meaningful(source: string): Set<string> {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return new Set(
    withoutBlockComments
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, "").trim().replace(/\s+/g, " "))
      .filter((line) => line.length > 12)
  );
}

const kitFiles = sources(KIT).map((path) => ({ path, lines: meaningful(readFileSync(path, "utf8")) }));
const appFiles = sources(APPS).map((path) => ({ path, lines: meaningful(readFileSync(path, "utf8")) }));

describe("no app keeps its own copy of the kit", () => {
  it("found both trees to compare", () => {
    expect(kitFiles.length, "no kit sources found — the paths are wrong").toBeGreaterThan(30);
    expect(appFiles.length, "no app sources found — the paths are wrong").toBeGreaterThan(5);
  });

  it("has no app file that is mostly a kit file", () => {
    const forks: string[] = [];

    for (const app of appFiles) {
      if (app.lines.size < SUBSTANTIAL) continue;
      for (const kit of kitFiles) {
        if (kit.lines.size < SUBSTANTIAL) continue;
        let shared = 0;
        for (const line of app.lines) if (kit.lines.has(line)) shared++;
        const share = shared / app.lines.size;
        if (share >= FORKED) {
          forks.push(
            `${relative(ROOT, app.path)} is ${Math.round(share * 100)}% ` +
              `${relative(ROOT, kit.path)} (${shared} of ${app.lines.size} lines)`
          );
        }
      }
    }

    expect(
      forks,
      "move the shared part into the kit and import it — " + forks.join("; ")
    ).toEqual([]);
  });
});
