/**
 * Does the page still zoom when a field is focused on a phone?
 *
 *   node tools/mobile/zoom-check.mjs        (dev server must be up on :5173)
 *
 * **In WebKit, because Chromium cannot show this.** Safari is the engine that
 * zooms, and it is also the engine whose `:focus-visible` disagrees — two
 * faults this week that a Chromium-only pass reported as clean. Install it
 * once with `npx playwright install webkit`.
 *
 * What it cannot check is the zoom itself: no engine here implements
 * zoom-on-focus, so there is nothing to observe. What it checks instead is the
 * thing that was actually wrong — **when** the lock is in place. It has to be
 * on before focus lands, because Safari decides as focus lands; a lock applied
 * in the focus handler is one step late, which is what shipped and what still
 * zoomed through the attachment fan.
 *
 * And the other half: that the lock lets go again. A page that quietly keeps
 * `maximum-scale=1` after any tap has taken pinch-zoom away from everybody,
 * which is worse than the fault.
 */
import { execSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const mod = await import(pathToFileURL(join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright", "index.js")).href);
const { webkit, chromium } = mod.default ?? mod;
const BASE = "http://localhost:5173";
const beat = (p, ms) => p.waitForTimeout(ms);
const meta = (p) => p.evaluate(() => document.querySelector('meta[name="viewport"]').getAttribute("content"));
const locked = (s) => s.includes("maximum-scale=1");

let bad = 0;
const check = (label, want, got) => {
  const ok = want === got;
  if (!ok) bad++;
  console.log(`    ${ok ? "ok  " : "FAIL"}  ${label} — ${got ? "locked" : "free"}`);
};

for (const [name, engine, touch] of [["webkit touch", webkit, true], ["chromium touch", chromium, true], ["chromium mouse", chromium, false]]) {
  const b = await engine.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: touch, isMobile: touch })).newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await beat(page, 1000);
  await page.getByRole("button", { name: /start experience/i }).click();
  await beat(page, 1800);
  console.log(`  ${name}`);

  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await beat(page, 400);
  check("at rest, before anything", false, locked(await meta(page)));

  /* Read *inside* a capture-phase `focusin`, not after the tap has settled.
  
     This is the assertion the whole check exists for and the first version did
     not make. Safari decides whether to zoom as focus lands, so the lock has to
     already be there at that instant — and a lock applied in the hook's own
     `focusin` handler still ends up in place a moment later, which is what a
     read-after-the-fact sees. Measured: with the hook on `focusin` this check
     passed while the page still zoomed. Capture runs before bubble, and this
     listener is registered before the hook's, so what it reads is what Safari
     had to work with. */
  await page.evaluate(() => {
    window.__atFocus = null;
    document.addEventListener(
      "focusin",
      () => {
        if (window.__atFocus === null) {
          window.__atFocus = document
            .querySelector('meta[name="viewport"]')
            .getAttribute("content");
        }
      },
      true
    );
  });

  const editor = page.locator("[contenteditable]").last();
  if (touch) await editor.tap(); else await editor.click();
  await beat(page, 400);
  check("while the composer has focus", touch, locked(await meta(page)));
  const atFocus = await page.evaluate(() => window.__atFocus);
  check(
    "and it was already locked at the instant focus landed",
    touch,
    atFocus !== null && locked(atFocus)
  );

  // Through the attachment fan: the path that was still zooming.
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await beat(page, 400);
  const add = page.getByRole("button", { name: "Add", exact: true });
  if (touch) await add.tap(); else await add.click();
  await beat(page, 700);
  await page.evaluate(() => (window.__atFocus = null));
  const card = page.locator("[class*='addCardFan']").first();
  if (await card.count()) { touch ? await card.tap() : await card.click(); await beat(page, 700); }
  check("after the attachment fan focuses the editor", touch, locked(await meta(page)));
  const viaFan = await page.evaluate(() => window.__atFocus);
  check(
    "and the fan's route was locked in time too",
    touch,
    viaFan !== null && locked(viaFan)
  );

  // A tap on something that is not a field must give pinch-zoom back.
  const header = page.locator("header button").first();
  if (touch) await header.tap(); else await header.click();
  await beat(page, 500);
  check("after a tap on a button", false, locked(await meta(page)));

  await b.close();
}
console.log(bad ? `\n  ${bad} wrong\n` : "\n  all behave\n");
process.exit(bad ? 1 : 0);
