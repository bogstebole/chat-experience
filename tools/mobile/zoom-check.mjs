/**
 * Can anything on the page make a phone zoom itself in?
 *
 *   npm run build && npm run zoom-check
 *
 * iOS zooms the page in to any editable whose text computes under 16px and
 * does not zoom back out, so tapping the composer threw the conversation out
 * of frame and left it there. The kit answers that by not being under 16px on
 * a touch device — see the `pointer: coarse` block in `tokens.css`.
 *
 * ## Why this check looks nothing like the one it replaces
 *
 * The old answer was a hook in the host that rewrote the document's viewport
 * meta while a field had focus, and this file used to assert the *timing* of
 * that: that `maximum-scale=1` was in place at the instant focus landed. It
 * cost two ordering bugs, one race, and a guard that switched itself off for
 * good once the page was zoomed.
 *
 * None of which the check could see, because **no engine outside a real
 * iPhone implements zoom-on-focus.** There was nothing to observe, so it
 * observed a proxy, and a proxy is only as good as the belief that it stands
 * for the thing. Twice it did not: the check went green over a version that
 * still zoomed.
 *
 * A font size is not a proxy. It is the input to the platform's own rule, it
 * is the same number in every engine, and it is either under 16 or it is not.
 * So this measures that, in both engines, at phone width — and it would have
 * caught every one of the faults the timing check let through.
 *
 * The other half is that the way out stays open: nothing may lock
 * `maximum-scale`, because a page that quietly takes pinch-zoom away from
 * everybody has fixed a fault that lasts seconds by breaking something that
 * lasts for ever.
 */
import { fileURLToPath } from "node:url";
import { browsers, serveStatic, skip } from "../harness.mjs";

const playwright = await browsers();
if (!playwright) skip("the zoom check");
const { webkit, chromium } = playwright;

const DIST = fileURLToPath(new URL("../../apps/playground/dist", import.meta.url));
const site = await serveStatic(DIST, 4685);
const BASE = site.url;
const beat = (p, ms) => p.waitForTimeout(ms);

/** What iOS looks for. Not a preference. */
const FLOOR = 16;

let bad = 0;
const check = (ok, line) => {
  if (!ok) bad += 1;
  console.log(`    ${ok ? "ok  " : "FAIL"}  ${line}`);
};

/**
 * Every editable on the page, with the size it actually draws at.
 *
 * Computed off the element rather than off the token, because a token is a
 * claim and this is the thing the platform reads. Hidden ones are skipped —
 * the composer's file input is `display: none` and cannot zoom anything.
 */
const fields = (page) =>
  page.evaluate(() => {
    const off = ["button", "submit", "reset", "checkbox", "radio", "file", "range", "hidden", "color", "image"];
    return [...document.querySelectorAll("input, textarea, [contenteditable]")]
      .filter((el) => {
        if (el instanceof HTMLInputElement && off.includes(el.type)) return false;
        if (el.getAttribute("contenteditable") === "false") return false;
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden";
      })
      .map((el) => ({
        what:
          el.tagName.toLowerCase() +
          (typeof el.className === "string" && el.className
            ? `.${el.className.split(" ")[0].replace(/_.*/, "")}`
            : ""),
        size: Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100,
      }));
  });

/**
 * And the tokens themselves, resolved.
 *
 * A component that is not on screen right now still has to obey the rule, and
 * the token is what it will read when it arrives. `max()` inside a custom
 * property does not resolve until something uses it, so this uses it.
 */
const tokens = (page) =>
  page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    document.body.append(probe);
    const read = (name) => {
      probe.style.fontSize = `var(${name})`;
      return Math.round(parseFloat(getComputedStyle(probe).fontSize) * 100) / 100;
    };
    const out = {
      "--ick-composer-size": read("--ick-composer-size"),
      "--ick-field-size": read("--ick-field-size"),
    };
    probe.remove();
    return out;
  });

const meta = (p) =>
  p.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "");

for (const [name, engine, touch] of [
  ["webkit touch", webkit, true],
  ["chromium touch", chromium, true],
  ["chromium mouse", chromium, false],
]) {
  const b = await engine.launch();
  const page = await (
    await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: touch, isMobile: touch })
  ).newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await beat(page, 1000);
  console.log(`  ${name}`);

  /* The check is about a touch device, so the first thing to establish is
     that the engine agrees it is one. Without this the whole run could pass
     by never applying the rule at all. */
  const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
  check(coarse === touch, `the engine reports a ${coarse ? "coarse" : "fine"} pointer`);

  await page.getByRole("button", { name: /start experience/i }).click();
  await beat(page, 1800);

  // The attachment fan, because its card focuses the editor — the route that
  // used to zoom when the composer on its own did not.
  const add = page.getByRole("button", { name: "Add", exact: true });
  if (await add.count()) {
    touch ? await add.tap() : await add.click();
    await beat(page, 700);
  }

  const seen = await fields(page);
  const small = seen.filter((f) => f.size < FLOOR);
  check(
    seen.length > 0,
    `${seen.length} editable${seen.length === 1 ? "" : "s"} on the page: ` +
      seen.map((f) => `${f.what} ${f.size}px`).join(", ")
  );
  if (touch) {
    check(
      small.length === 0,
      small.length
        ? `and ${small.length} of them would zoom the page: ` +
          small.map((f) => `${f.what} ${f.size}px`).join(", ")
        : `and none of them is under ${FLOOR}px, so there is nothing to zoom`
    );
  }

  const size = await tokens(page);
  const named = Object.entries(size).map(([k, v]) => `${k} ${v}px`).join(", ");
  if (touch) {
    check(
      Object.values(size).every((v) => v >= FLOOR),
      `the tokens a field reads are at or over ${FLOOR}px — ${named}`
    );
  } else {
    /* The other direction, and it is worth an assertion of its own: a rule
       that applied everywhere would pass the check above and quietly make the
       desktop 16px too. The scale is meant to move on touch devices only. */
    check(
      Object.values(size).every((v) => v < FLOOR),
      `and a mouse is left alone — ${named}`
    );
  }

  /* Nothing may take pinch-zoom away. This is what the old hook did for the
     length of a tap, and it is what a `maximum-scale` in the document would
     do for ever. Either way the reader loses the way out. */
  const viewport = await meta(page);
  check(
    !/maximum-scale|user-scalable\s*=\s*no/.test(viewport),
    `and the page can still be pinched — ${viewport || "no viewport meta"}`
  );

  await b.close();
}
site.close();
console.log(bad ? `\n  ${bad} wrong\n` : "\n  nothing on the page can make it zoom\n");
process.exit(bad ? 1 : 0);
