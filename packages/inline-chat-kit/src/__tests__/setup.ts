import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

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
