/**
 * The artifact pane on a phone, where it is a sheet rather than a column.
 *
 *   npm run build && npm run sheet-check
 *
 * The thing worth checking is not that it looks like a sheet. It is the
 * gesture: a sheet is dragged with a finger and its contents are scrolled with
 * the same finger, and every web sheet that feels wrong feels wrong here. This
 * kit settles it with `touch-action` rather than with arbitration code — the
 * body says `pan-y` so reading never drags, the header and the grabber have no
 * scroller under them and drag — so the check reads that declaration and then
 * actually drags the thing by its header to see it go.
 */
import { browsers, serveStatic } from "file:///Users/bogste/Documents/Projects/Personal/Ideation/AI%20Chat%20Experience/tools/harness.mjs";
const { chromium } = await browsers();
const site = await serveStatic("/Users/bogste/Documents/Projects/Personal/Ideation/AI Chat Experience/apps/playground/dist", 4695);
const b = await chromium.launch();
const OUT = process.env.SHEET_SHOTS ?? "/private/tmp/claude-501/-Users-bogste-Documents-Projects-Personal-Ideation-AI-Chat-Experience/cb1d5703-0ba4-4b81-b30d-4f60d75fd8e7/scratchpad/sheet";
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await page.goto(site.url, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.getByRole("button", { name: /start experience/i }).click();
await page.waitForTimeout(1300);
await page.getByRole("button", { name: /plan for running a 5k/i }).tap();
await page.locator("button", { hasText: "5k training plan" }).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(1600);

const geo = () => page.evaluate(() => {
  const sheet = document.querySelector("[role='dialog']");
  if (!sheet) return null;
  const r = sheet.getBoundingClientRect();
  const cs = getComputedStyle(sheet);
  const body = sheet.querySelector("[class*='body']");
  const grab = sheet.querySelector("[class*='grabber']");
  return {
    top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
    radiusTop: cs.borderTopLeftRadius, radiusBottom: cs.borderBottomLeftRadius,
    bodyTouch: body ? getComputedStyle(body).touchAction : null,
    grabber: !!grab,
    scrim: !!document.querySelector("[class*='scrim']"),
    viewport: window.innerHeight,
  };
});

let bad = 0;
const check = (ok, line) => { if (!ok) bad++; console.log(`  ${ok ? "ok  " : "FAIL"}  ${line}`); };

await page.locator("button", { hasText: "5k training plan" }).first().tap();
await page.waitForTimeout(1400);
const g = await geo();
await page.screenshot({ path: `${OUT}/open.png` });
console.log(JSON.stringify(g));
check(g && g.top > 40, `it stops short of the top — ${g?.top}px of the conversation still showing`);
check(g && g.bottom >= g.viewport - 2, "and runs to the bottom edge");
check(g && parseFloat(g.radiusTop) > 8 && parseFloat(g.radiusBottom) === 0, `corners at the top only (${g?.radiusTop} / ${g?.radiusBottom})`);
check(!!g?.grabber, "it has a grabber");
check(!!g?.scrim, "the conversation goes under a scrim");
check(g?.bodyTouch === "pan-y", `the body keeps the vertical gesture for scrolling (touch-action: ${g?.bodyTouch})`);

// Drag it down by the header.
const before = await geo();
await page.mouse.move(195, before.top + 30);
await page.mouse.down();
for (let y = 0; y <= 200; y += 20) { await page.mouse.move(195, before.top + 30 + y); await page.waitForTimeout(16); }
await page.screenshot({ path: `${OUT}/dragging.png` });
await page.mouse.up();
await page.waitForTimeout(900);
check(!(await geo()), "dragged down by the header, it goes");
await page.screenshot({ path: `${OUT}/dismissed.png` });

await b.close(); site.close();
console.log(bad ? `\n  ${bad} wrong\n` : "\n  the sheet behaves\n");
process.exit(bad ? 1 : 0);
