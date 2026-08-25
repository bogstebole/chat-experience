import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useChatTurns } from "../useChatTurns/useChatTurns";
import { prefersReducedMotion, resetReducedMotionCache } from "../reducedMotion/reducedMotion";

const realMatchMedia = window.matchMedia;

const setReduceMotion = (matches: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    matches,
    media,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  resetReducedMotionCache();
};

afterEach(() => {
  window.matchMedia = realMatchMedia;
  resetReducedMotionCache();
});

describe("prefersReducedMotion", () => {
  it("reports what the media query says", () => {
    setReduceMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    setReduceMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("assumes motion is fine where matchMedia does not exist", () => {
    // Server render. Guessing "reduce" here would send the wrong markup to
    // every reader; the client corrects it on the first real render.
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    resetReducedMotionCache();
    expect(prefersReducedMotion()).toBe(false);
  });
});

const ANSWER = "Particle physics studies the most fundamental constituents of matter.";

/** Every distinct partial answer the hook rendered, in order. */
const revealSteps = async (reduce: boolean) => {
  setReduceMotion(reduce);
  const seen: string[] = [];
  const { result } = renderHook(() => {
    const value = useChatTurns({
      onSend: () => ANSWER,
      revealSpeed: 50, // slow enough that a real reveal takes many frames
      announcements: false,
    });
    seen.push(value.turns[0].ai);
    return value;
  });

  const id = result.current.turns[0].id;
  act(() => result.current.setDraft(id, "q"));
  act(() => result.current.submit(id));
  await waitFor(() => expect(result.current.turns[0].state).toBe("resting"), { timeout: 5000 });

  return [...new Set(seen.filter(Boolean))];
};

describe("useChatTurns — reduced motion", () => {
  it("hands over the whole answer at once", async () => {
    expect(await revealSteps(true)).toEqual([ANSWER]);
  });

  /** The other half of the claim: without the preference, it really does type. */
  it("still types the answer out when motion is welcome", async () => {
    const steps = await revealSteps(false);
    expect(steps.length).toBeGreaterThan(1);
    expect(steps[steps.length - 1]).toBe(ANSWER);
  });
});
