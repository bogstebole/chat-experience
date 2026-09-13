import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The first code anybody copies has to compile.
 *
 * `getting-started.md` opens with a whole working file, and the version of it
 * that a newcomer runs is the one they paste from the page — so if the page
 * and the source drift, the page wins and the source's typechecking proved
 * nothing. A getting-started whose example no longer compiles is worse than
 * none: it fails for somebody who has no way to tell whether the mistake is
 * theirs.
 *
 * So the example lives in `src/examples/minimal.tsx`, is compiled by `tsc -b`
 * with everything else, and this asserts the page quotes it exactly. Two
 * substitutions are allowed, and both are here rather than in a comment
 * somewhere: the import path, which cannot be `inline-chat-kit` from inside
 * `inline-chat-kit`, and the leading block comment, which explains to a
 * maintainer why the file exists and is noise to a reader.
 *
 * Nothing imports the example, so the library build never reaches it and it
 * ships nothing — checked by the build, which reports zero occurrences.
 */

const PKG = process.cwd();

const source = readFileSync(join(PKG, "src/examples/minimal.tsx"), "utf8");
const page = readFileSync(join(PKG, "getting-started.md"), "utf8");

/** The example as the page should carry it. */
const quotable = source
  .replace(/^\/\*\*[\s\S]*?\*\/\n/, "")
  .replace(
    'import { ChatExperience } from "../index";',
    'import { ChatExperience } from "inline-chat-kit";\n' +
      'import "inline-chat-kit/styles.css";'
  );

describe("the getting-started page", () => {
  it("found both files", () => {
    expect(source.length, "src/examples/minimal.tsx").toBeGreaterThan(500);
    expect(page.length, "getting-started.md").toBeGreaterThan(500);
  });

  it("quotes the example that the build compiles", () => {
    const blocks = [...page.matchAll(/```tsx\n([\s\S]*?)```/g)].map((m) => m[1]);
    expect(blocks.length, "the page has no tsx block at all").toBeGreaterThan(0);
    expect(
      blocks,
      "getting-started.md and src/examples/minimal.tsx have drifted — " +
        "regenerate the page's first block from the file"
    ).toContain(quotable);
  });

  /* The one import a reader cannot infer and the one whose absence looks like
     a broken package rather than a missing line. */
  it("tells the reader to import the stylesheet", () => {
    expect(page).toContain('import "inline-chat-kit/styles.css"');
  });

  /** It is no use to anybody if npm does not send it. */
  it("is listed in the files the package publishes", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
    expect(manifest.files).toContain("getting-started.md");
  });
});
