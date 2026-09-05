"use client";

import { useEffect } from "react";

/**
 * Stops mobile Safari zooming the page in when a field is focused.
 *
 * ## What it is for
 *
 * iOS zooms to any editable whose text is under 16px, and it does not zoom
 * back out afterwards — so tapping the composer throws the conversation out of
 * frame and leaves it there. The composer draws at 12.
 *
 * ## Why it is here and not in the kit
 *
 * The two other ways out are worse. Making the field 16px works and looks
 * wrong: the composer becomes the largest text on the page, larger than the
 * answer it turns into. Putting `maximum-scale=1` in the viewport meta
 * permanently works and takes pinch-zoom away from everybody, for ever, to fix
 * something that only happens for the seconds somebody is typing.
 *
 * So the scale is locked **only while a field has focus**, and released the
 * moment it does not. That is a change to the host document's `<meta
 * name="viewport">`, which belongs to the host: a component library reaching
 * up and rewriting the page's viewport as a side effect of being rendered is
 * not a library, it is a surprise. Hence a hook the host calls, and a note in
 * the kit's theming guide pointing at it.
 *
 * ## What it does not do
 *
 * Not verified on real hardware from here — no emulator implements focus zoom
 * at all, so nothing in this repo can prove the zoom is gone. What it can
 * prove is the ordering, which is what the first version got wrong.
 *
 * And it stands aside for anybody who has zoomed in themselves: locking the
 * scale below where they put it would snap them back out, which is a worse
 * thing to do to a reader than the fault being fixed.
 */
export function useNoFocusZoom(): void {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    // A mouse never triggers this, and a page that rewrites its own viewport
    // for no reason is a page that will surprise somebody eventually.
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    const released = meta.getAttribute("content") ?? "width=device-width, initial-scale=1";
    const locked = /maximum-scale/.test(released)
      ? released.replace(/maximum-scale\s*=\s*[\d.]+/, "maximum-scale=1")
      : `${released}, maximum-scale=1`;

    const field = (node: unknown): boolean =>
      node instanceof HTMLElement &&
      (node.isContentEditable ||
        node instanceof HTMLTextAreaElement ||
        (node instanceof HTMLInputElement &&
          !["button", "submit", "checkbox", "radio", "file", "range", "hidden"].includes(node.type)));

    /**
     * Locked on `pointerdown`, not on `focusin`, and that is the whole fix.
     *
     * The first version locked when a field took focus, which is too late by
     * one step. Safari decides whether to zoom *as* focus lands, so a lock
     * applied in the focus handler arrives after the decision. It looked like
     * it worked when you tapped straight into the composer and did not when
     * you went through the attachment fan, because the fan's card focuses the
     * editor programmatically from inside its own tap handler — measured: the
     * meta read inside `focusin` had no `maximum-scale`, and the same meta
     * read a frame later did.
     *
     * `pointerdown` runs before focus, before the tap has decided what it is
     * for. So the lock is always in place before anything can be focused.
     */
    const lock = () => {
      // Someone who pinched to zoom meant it. Leave them where they are.
      if ((window.visualViewport?.scale ?? 1) > 1.01) return;
      meta.setAttribute("content", locked);
    };

    /**
     * And released again unless the tap actually put focus in a field.
     *
     * Checked a frame later because focus lands after the gesture ends, and
     * `focusout` fires before the next element has it. Without this a single
     * tap anywhere would take pinch-zoom away for the rest of the session,
     * which is the thing this hook exists not to do.
     */
    const settle = () => {
      requestAnimationFrame(() => {
        if (!field(document.activeElement)) meta.setAttribute("content", released);
      });
    };

    document.addEventListener("pointerdown", lock, true);
    document.addEventListener("pointerup", settle, true);
    document.addEventListener("pointercancel", settle, true);
    document.addEventListener("focusout", settle, true);
    return () => {
      document.removeEventListener("pointerdown", lock, true);
      document.removeEventListener("pointerup", settle, true);
      document.removeEventListener("pointercancel", settle, true);
      document.removeEventListener("focusout", settle, true);
      meta.setAttribute("content", released);
    };
  }, []);
}
