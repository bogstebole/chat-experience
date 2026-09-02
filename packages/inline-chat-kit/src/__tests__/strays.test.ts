import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Copies the filesystem makes beside a file being edited — "useVoiceInput 2.ts".
 *
 * They were already in `.gitignore`, which kept them out of commits and, it
 * turned out, out of sight. TypeScript went on compiling them: two had emitted
 * declarations into `dist` and were listed in the tarball of the first publish
 * that was attempted, one of them a duplicate of the voice hook.
 *
 * The build excludes them now, but excluding is not enough on its own — a file
 * nobody can see is a file nobody deletes, and the next one to appear would sit
 * there just as quietly. This fails instead, so it gets removed.
 */
/**
 * The whole repo, not just this package's source.
 *
 * The first version of this walked `src` alone, and while it was doing that a
 * `CONTRIBUTING 2.md` was sitting in the repo root — tracked, committed, and
 * disagreeing with the real file. Ignored by git only helps for the ones that
 * appear after the rule; this catches the ones already in.
 */
const repoRoot = () => {
  let at = process.cwd();
  for (let up = 0; up < 6; up += 1) {
    const manifest = join(at, "package.json");
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).workspaces) return at;
    at = dirname(at);
  }
  throw new Error("no workspace root above the working directory");
};

const SKIP = new Set(["node_modules", ".git", "dist", "Videos", "Shots", "storybook-static"]);

const walk = (dir: string, root: string, found: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, root, found);
    else if (/ \d+\.[a-z]+$/i.test(name)) found.push(path.slice(root.length + 1));
  }
  return found;
};

describe("copies the filesystem left behind", () => {
  it("are nowhere in the repo", () => {
    const root = repoRoot();
    const strays = walk(root, root);
    expect(
      strays,
      `delete these — they compile, and they ship:\n  ${strays.join("\n  ")}`
    ).toEqual([]);
  });
});
