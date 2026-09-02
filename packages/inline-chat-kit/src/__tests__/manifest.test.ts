import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "../../package.json";

/**
 * What a published package has to carry.
 *
 * None of this matters while a package is installed from a tarball by the one
 * person who built it. It all matters the moment it is on a registry: the
 * fields below are how somebody who has never seen this repo finds the source,
 * reports a bug, and decides whether to trust it — and they are exactly the
 * fields nobody notices are missing, because the build and the tests pass
 * without them.
 */
const root = join(import.meta.dirname, "..", "..");

describe("the published manifest", () => {
  it("says what it is, and in more than a name", () => {
    expect(manifest.name).toBe("inline-chat-kit");
    expect(manifest.license).toBe("MIT");
    expect(manifest.description.length).toBeGreaterThan(60);
    expect(manifest.keywords.length).toBeGreaterThanOrEqual(5);
  });

  it("points at its own source, not at the repo root", () => {
    // Without `directory`, npm links the monorepo root and a reader lands
    // nowhere near this package.
    expect(manifest.repository.url).toMatch(/^git\+https:\/\/github\.com\//);
    expect(manifest.repository.directory).toBe("packages/inline-chat-kit");
    expect(manifest.bugs.url).toMatch(/^https:\/\//);
    expect(manifest.homepage).toMatch(/^https:\/\//);
  });

  it("ships the licence it claims", () => {
    // `license: "MIT"` is a claim; the file is the thing itself, and npm only
    // includes it because it is named LICENSE.
    const licence = readFileSync(join(root, "LICENSE"), "utf8");
    expect(licence).toMatch(/MIT License/i);
  });

  it("ships the built package and nothing else", () => {
    expect(manifest.files).toContain("dist");
    // Source, stories and tests are not somebody else's business, and they are
    // most of the weight.
    for (const unwanted of ["src", "src/**", ".storybook", "vite.config.ts"]) {
      expect(manifest.files, `\`${unwanted}\` would be published`).not.toContain(unwanted);
    }
  });

  it("loads the same way whichever entry a bundler reaches for", () => {
    expect(manifest.exports["."].types).toBe(manifest.types);
    expect(manifest.exports["."].import).toBe(manifest.module);
    expect(manifest.main).toBe(manifest.module);
    // The stylesheet is a second entry on purpose: it is a side effect, and
    // `sideEffects` has to admit that or a bundler drops it.
    expect(manifest.exports["./styles.css"]).toBe("./dist/inline-chat-kit.css");
    expect(manifest.sideEffects).toContain("*.css");
  });

  it("is published in the open, and says so rather than relying on a default", () => {
    // Unscoped packages default to public. Stating it means a later move to a
    // scope does not silently become a private publish.
    expect(manifest.publishConfig?.access).toBe("public");
  });

  it("asks the host for React rather than bringing its own", () => {
    // Two copies of React in one page is a broken app, so these are peers and
    // must never appear as dependencies.
    for (const peer of ["react", "react-dom", "motion", "lucide-react"]) {
      expect(manifest.peerDependencies).toHaveProperty(peer);
      expect(manifest.dependencies).not.toHaveProperty(peer);
    }
  });
});
