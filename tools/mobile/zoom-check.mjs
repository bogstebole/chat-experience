/**
 * How big is everything on a phone, and can any of it make the page zoom?
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

/**
 * The rest of the scale, and what the icons beside it come out at.
 *
 * A phone raises two sizes and only two: the prose, and the text you type
 * into. Everything else stays small, and the icons are sized from the text
 * they sit next to rather than from a number in a component. The first cut
 * raised the whole scale together and the phone came out shouting — a 17px
 * header over 15px chips over 16px prose, with 13px icons left behind by all
 * of it.
 */
const scale = (page) =>
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
      prose: read("--ick-answer-size"),
      /* The loudest step of the ordinary scale. Chrome — headers, chips,
         labels, the row that says how long something thought. */
      chrome: Math.max(read("--ick-text-sm"), read("--ick-text-md"), read("--ick-text-lg")),
    };
    probe.remove();

    /* And every icon against the text it is drawn beside. A glyph half the
       height of its label reads as a mistake, and nothing about it is visible
       in a number written into a component. */
    const strays = [];
    for (const svg of document.querySelectorAll("svg")) {
      const seen = svg.getBoundingClientRect();
      if (seen.width < 2) continue;
      const cs = getComputedStyle(svg);
      /* The **used** width, not the rect.
      
         A rect is measured after every transform above it, and this kit
         animates whole panels with `scale` — the attachment fan's cards sit
         at about 1.35 while they are open, so their 16px icons measured 21.3
         and 22.5 and the check called two correct icons a fault. The font
         size it is being compared against is not transformed, so the width
         must not be either. */
      const drawn = parseFloat(cs.width);
      /* Decorative artwork is not an icon beside text. */
      if (!Number.isFinite(drawn) || drawn > 40) continue;
      const font = parseFloat(cs.fontSize);
      /* Not a band around the font size — a **floor**, and the direction
         matters.
      
         A glyph carries padding inside its own box, so an icon drawn at the
         text's size already reads slightly smaller than the letters beside
         it. Below that it reads as a mistake, which is what a page of 13px
         icons against raised text looked like. A symmetric band called that
         acceptable: 13 against 16 is 19% off, well inside any tolerance worth
         writing, and still visibly wrong.
      
         The ceiling is loose because it is not the failure anybody has: an
         icon has to be half again the text before it looks like artwork. */
      if (drawn < font - 1) {
        strays.push(`${Math.round(drawn * 10) / 10}px icon under ${Math.round(font)}px text`);
      } else if (drawn > font * 1.6) {
        strays.push(`${Math.round(drawn * 10) / 10}px icon over ${Math.round(font)}px text`);
      }
    }
    return { ...out, strays };
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

  /* An answer first, and it is not optional.
  
     The scale and the icons were measured on the empty state, where the only
     icons are the header's and the composer's. Everything the complaint was
     about — the row that says how long something thought, a tool call, the
     actions under an answer — only exists once something has been asked. So
     the guard could not fail: put the old sizes back and it still said ok,
     because none of the elements that were wrong were on the page. */
  /* The fan is still open from the check above, and its backdrop swallows
     everything behind it — Playwright retried the click for thirty seconds
     and then failed with a stack trace instead of a finding. Escape does not
     shut it; the backdrop is what it listens to, so that is what gets
     pressed. */
  const backdrop = page.locator('[class*="addBackdrop"]');
  if (await backdrop.count()) {
    touch ? await backdrop.first().tap() : await backdrop.first().click();
    await beat(page, 700);
  }
  await page.getByRole("button", { name: /How big is the Higgs boson/i }).click();
  await page.waitForFunction(
    () => !!document.querySelector("[aria-expanded]"),
    null,
    { timeout: 20000 }
  ).catch(() => console.log("    ??    no answer arrived — the scale is measured on less than it should be"));
  await beat(page, 9000);

  const sizes = await scale(page);
  if (touch) {
    check(
      sizes.prose >= 16,
      `the prose is ${sizes.prose}px — the one size worth spending on a small screen`
    );
    check(
      sizes.chrome <= 14,
      `and the chrome around it stays at ${sizes.chrome}px, so there is still a difference ` +
        `between what you read and what you press`
    );
    check(
      sizes.strays.length === 0,
      sizes.strays.length
        ? `but ${sizes.strays.length} icons are out of step with their text — ${sizes.strays.slice(0, 4).join(", ")}`
        : `and no icon is smaller than the text beside it`
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
