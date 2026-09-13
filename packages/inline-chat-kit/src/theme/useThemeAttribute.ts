import { useEffect } from "react";

/**
 * Writes the chosen theme onto the root element, and takes it off again when
 * nothing is chosen.
 *
 * `data-theme` is how a host sets the theme — the same way it would by hand.
 * The absence of the attribute is not a third theme: it is the kit following
 * `prefers-color-scheme`, which is what it is there for, so "nothing chosen"
 * has to actually remove it rather than settle on a default.
 *
 * It is a hook rather than three lines inside one component because two things
 * need it. `ChatExperience` is the chat, and the demo has a landing page in
 * front of it — and with the effect living only in the chat, a site that had
 * decided the page is read in light got a dark landing page and a light
 * conversation, changing under the reader at the press of a button.
 */
export function useThemeAttribute(chosen: "light" | "dark" | null | undefined): void {
  useEffect(() => {
    /* `undefined` and `null` are not the same answer, and the difference is
       what keeps two callers from fighting over one attribute. `null` is
       "nobody has chosen" — take it off, follow the system. `undefined` is
       "not mine to say", which is what a caller passes when somebody else is
       holding the theme; a hook cannot be called conditionally, so this is how
       it opts out. */
    if (chosen === undefined) return;
    if (chosen) document.documentElement.setAttribute("data-theme", chosen);
    else document.documentElement.removeAttribute("data-theme");
  }, [chosen]);
}
