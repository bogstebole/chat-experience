import { describe, it, expect, afterEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { announce, resetAnnouncer } from "../announce/announce";

afterEach(resetAnnouncer);

const regions = () => [...document.querySelectorAll('[data-inline-chat-kit="live-region"]')];
const polite = () => document.querySelector('[aria-live="polite"]') as HTMLElement;

describe("announce", () => {
  it("creates a polite region the first time it is used", async () => {
    announce("the answer");
    const node = polite();
    expect(node).toBeTruthy();
    expect(node.getAttribute("role")).toBe("status");
    expect(node.getAttribute("aria-atomic")).toBe("true");
  });

  it("puts the message in the region", async () => {
    announce("the answer");
    await waitFor(() => expect(polite().textContent).toBe("the answer"));
  });

  /**
   * The reason for the delay in the implementation. A region inserted together
   * with its text is, to a screen reader, an ordinary DOM insertion — nothing
   * is spoken. It has to be empty when it lands and be written to afterwards.
   */
  it("lands empty, and fills in afterwards", () => {
    announce("the answer");
    expect(polite().textContent).toBe("");
  });

  it("keeps one region rather than stacking them up", async () => {
    announce("first");
    await waitFor(() => expect(polite().textContent).toBe("first"));
    announce("second");
    await waitFor(() => expect(polite().textContent).toBe("second"));
    expect(regions()).toHaveLength(1);
  });

  /**
   * Writing the same string twice is not a DOM change and would be silent.
   * Clearing first is what makes a repeated answer speak again.
   */
  it("speaks the same message twice when it is sent twice", async () => {
    announce("same");
    await waitFor(() => expect(polite().textContent).toBe("same"));
    announce("same");
    expect(polite().textContent).toBe("");
    await waitFor(() => expect(polite().textContent).toBe("same"));
  });

  it("ignores an empty message, since clearing is not an announcement", () => {
    announce("");
    expect(regions()).toHaveLength(0);
  });

  it("keeps assertive separate, as an alert", async () => {
    announce("polite thing");
    announce("urgent thing", "assertive");
    await waitFor(() => {
      expect(document.querySelector('[aria-live="assertive"]')?.getAttribute("role")).toBe("alert");
    });
    expect(regions()).toHaveLength(2);
  });
});
