import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The roadmap says what it means by its own headings.
 *
 * It had three sections called **Now** with nothing open in any of them, and
 * two shipped components still listed as not started. A roadmap that has to be
 * checked against the code before it can be believed is a roadmap nobody reads
 * — and this one is the first thing anybody opens.
 *
 * Two rules, both mechanical: a **Now** has work left in it, and a **Shipped**
 * does not. Neither can tell whether a paragraph is true, but both catch the
 * thing that actually rotted: a heading nobody moved.
 *
 * Read from disk rather than imported, because the file is outside the
 * package's own root and `?raw` cannot reach it. Walked up from the working
 * directory rather than resolved against `import.meta.url`, which under Vitest
 * is an http URL and not a path at all.
 */
const repoRoot = () => {
  let at = process.cwd();
  for (let up = 0; up < 6; up += 1) {
    if (existsSync(join(at, "ROADMAP.md"))) return at;
    at = dirname(at);
  }
  throw new Error("no ROADMAP.md above the working directory");
};

const roadmap = async () => readFile(join(repoRoot(), "ROADMAP.md"), "utf8");

/** Every `## ` section, with the lines under it. */
const sections = (text: string) => {
  const out: { heading: string; open: number; done: number }[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) out.push({ heading: line.slice(3).trim(), open: 0, done: 0 });
    else if (out.length && /^- \[[ ~]\]/.test(line)) out[out.length - 1].open += 1;
    else if (out.length && /^- \[x\]/.test(line)) out[out.length - 1].done += 1;
  }
  return out;
};

describe("the roadmap", () => {
  it("keeps work under Now and nothing else there", async () => {
    const now = sections(await roadmap()).filter((s) => s.heading.startsWith("Now"));
    expect(now.length, "there is no Now section").toBeGreaterThan(0);
    for (const section of now) {
      expect(section.open, `"${section.heading}" has nothing left to do`).toBeGreaterThan(0);
    }
  });

  it("leaves nothing open under Shipped", async () => {
    const shipped = sections(await roadmap()).filter((s) => s.heading.startsWith("Shipped"));
    expect(shipped.length).toBeGreaterThan(0);
    for (const section of shipped) {
      expect(section.open, `"${section.heading}" still has open items`).toBe(0);
    }
  });

  /**
   * And the H tier is where the component list lives, so the two that shipped
   * have to be marked. This is the fault that started it: `<Attachments>` and
   * `<Branch>` were in the public API and listed as not started.
   */
  it("marks a component done once the kit exports it", async () => {
    const text = await roadmap();
    const api = (await import("../index.ts?raw")).default as string;
    for (const [item, name] of [
      ["H1", "Attachments"],
      ["H2", "Branch"],
    ] as const) {
      const exported = new RegExp(`export \\{[^}]*\\b${name}\\b`).test(api);
      const marked = new RegExp(`^- \\[x\\] \\*\\*${item} ·`, "m").test(text);
      expect(marked, `${name} is exported but ${item} is not marked done`).toBe(exported);
    }
  });
});
