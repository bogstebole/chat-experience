"use client";

import { useEffect, type RefObject } from "react";

/* Replaced by the host's bundler, as React's own is: `"production"` there,
   and everything below the first line of the effect is dead code. */
declare const process: { env: { NODE_ENV?: string } };

/** Roles already warned about, so a list of forty answers warns once. */
const warned = new Set<string>();

/** For tests: forget which roles have been warned about. */
export function resetHostButtonWarnings() {
  warned.clear();
}

function warn(role: string, problems: string[]) {
  if (warned.has(role) || problems.length === 0) return;
  warned.add(role);
  console.warn(
    `inline-chat-kit: the Button given in \`components\` for "${role}" ${problems.join("; ")}. ` +
      `See "Bring your own button" in theming.md.`
  );
}

/* What a focus ring is made of, by whichever means a host draws it. */
const RING = [
  "outline-style",
  "outline-width",
  "outline-color",
  "box-shadow",
  "border-color",
  "background-color",
  "color",
] as const;

function look(element: Element) {
  const style = getComputedStyle(element);
  return RING.map((property) => style.getPropertyValue(property)).join("|");
}

/**
 * In development, checks a host's button against the contract in
 * `KitButtonProps`, and says so once per role when it falls short:
 *
 * - its ref is not forwarded (`forwardRef`), so the kit cannot focus it;
 * - what it renders is not a `<button>`;
 * - it drops the `aria-*` or `data-ick-*` the kit gave it;
 * - keyboard focus changes nothing about how it looks.
 *
 * `role` is `undefined` for the kit's own button, which is not checked.
 */
export function useHostButtonChecks(
  role: string | undefined,
  box: RefObject<HTMLElement | null>,
  element: RefObject<HTMLElement | null>,
  forwarded: RefObject<boolean>,
  given: Record<string, unknown>
) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!role || warned.has(role)) return;

    const problems: string[] = [];
    if (!forwarded.current) problems.push("does not forward its ref — wrap it in `forwardRef`");

    const node = element.current ?? box.current?.firstElementChild ?? null;
    if (!node) {
      problems.push("rendered nothing");
      warn(role, problems);
      return;
    }
    if (node.tagName !== "BUTTON") {
      problems.push(`renders a <${node.tagName.toLowerCase()}>, not a <button>`);
    }

    const expected: Record<string, unknown> = { "data-ick-role": role, ...given };
    const dropped = Object.entries(expected)
      .filter(([name, value]) => /^(aria-|data-ick-)/.test(name) && value !== undefined && value !== null)
      .filter(([name]) => !node.hasAttribute(name))
      .map(([name]) => name);
    if (dropped.length) {
      problems.push(`drops ${dropped.join(", ")} — spread the props it does not use onto the <button>`);
    }

    if (problems.length) {
      warn(role, problems);
      return;
    }

    /* Focus, last, and only from the keyboard: a ring that only shows for
       `:focus-visible` is the right one. Read a moment after focus arrives,
       so a ring that fades in has arrived too. */
    const resting = look(node);
    let timer: number | undefined;
    const onFocus = () => {
      let keyboard = true;
      try {
        keyboard = node.matches(":focus-visible");
      } catch {
        /* A browser without the selector: assume a keyboard. */
      }
      if (!keyboard) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.activeElement !== node) return;
        if (look(node) === resting) warn(role, ["shows no change on keyboard focus — give it a visible focus ring"]);
      }, 400);
    };
    node.addEventListener("focus", onFocus);
    return () => {
      node.removeEventListener("focus", onFocus);
      window.clearTimeout(timer);
    };
    /* Once, on mount: a contract is kept or broken by the component, not by
       a render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);
}
