import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
const SRC = join(import.meta.dirname, "..");

const walk = (dir: string, found: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else if (/ \d+\.[a-z]+$/i.test(name)) found.push(path.slice(SRC.length + 1));
  }
  return found;
};

describe("copies the filesystem left behind", () => {
  it("are not in the source tree", () => {
    const strays = walk(SRC);
    expect(
      strays,
      `delete these — they compile, and they ship:\n  ${strays.join("\n  ")}`
    ).toEqual([]);
  });
});
