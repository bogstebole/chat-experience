/**
 * `?showcase` strips the development chrome — the perf HUD and the animation
 * dial panel — leaving only the thing itself.
 *
 * It exists for recording and for showing the demo to somebody, which are the
 * two times the tooling around the component is exactly what nobody wants to
 * look at. `?theme=dark` sets the starting theme, so a recording can be made
 * of either without touching a control on the way in.
 */
const params = () =>
  typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);

export const isShowcase = () => params().has("showcase");

/**
 * The development chrome — the perf HUD and the animation dial — which is
 * **off unless `?dev` asks for it**.
 *
 * It used to be the other way round, with `?showcase` stripping it. That is
 * the wrong default for a page whose whole point is the thing in the middle:
 * opening the demo put two panels of tooling on screen and the component
 * third. `?showcase` still means "no chrome" whatever else is in the URL, so
 * the recordings and the screenshots are unaffected.
 */
export const showDevTools = () => params().has("dev") && !isShowcase();

/**
 * The theme asked for in the URL, or `null` for "whatever the system says".
 *
 * `null` matters: setting `data-theme` unconditionally would pin the page to
 * one theme and the kit's `prefers-color-scheme` rule would never get a turn.
 * Only an explicit choice belongs on the element.
 */
export const requestedTheme = (): "light" | "dark" | null => {
  const value = params().get("theme");
  return value === "dark" || value === "light" ? value : null;
};
