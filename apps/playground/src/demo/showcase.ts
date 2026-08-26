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

export const initialTheme = (): "light" | "dark" =>
  params().get("theme") === "dark" ? "dark" : "light";
