import "@testing-library/jest-dom/vitest";
import { afterEach, expect, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as axeMatchers from "vitest-axe/matchers";

// Registered here rather than by importing vitest-axe/extend-expect in each
// test file — that path does not reach Vitest's `expect` under ESM, and the
// matcher silently does not exist.
expect.extend(axeMatchers);

afterEach(cleanup);

// jsdom has no layout engine, so anything that measures returns zeroes and
// anything that hit-tests returns null. Components under test must not crash
// on that; tests that need real geometry are marked and skipped instead of
// being faked into passing.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = vi.fn() as unknown as Element["scrollTo"];
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
}
// Hit-testing. In a document with no layout there is nothing under any point,
// so `null` is the truthful answer rather than a convenient one. Without the
// stub the highlighter's pointer handler throws inside React's event dispatch,
// which surfaces as an unhandled error and fails the run even though every
// test passes.
if (!document.elementFromPoint) {
  document.elementFromPoint = vi.fn(() => null);
}

// Ranges measure too, and jsdom implements no more geometry for them than it
// does for elements. An empty list is the honest answer: nothing occupies any
// space in a document with no layout.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = vi.fn(() => [] as unknown as DOMRectList);
  Range.prototype.getBoundingClientRect = vi.fn(() => new DOMRect());
}

// Motion observes element size. jsdom has no layout, so it has no
// ResizeObserver either — a stub that never reports is the truthful shape:
// nothing ever resizes in a document with no layout.
if (!("ResizeObserver" in globalThis)) {
  class NoopResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = NoopResizeObserver;
}

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
