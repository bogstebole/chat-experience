/**
 * Does a chat in a host's panel that is still opening come out right?
 *
 *   npm run build-storybook --workspace packages/inline-chat-kit && npm run panel-check
 *
 * Reported from a host: a card's button opens the assistant beside it and
 * sends a message from it, and the host's own answer is ready at once — so
 * the answer settles while the panel is still a few pixels wide. Everything
 * the kit measured in those frames stuck. The one-line message came out faded
 * with "Read more" on it, because it was measured once, 27px wide and 269px
 * tall; and the fresh composer under it stayed on two lines, because an empty
 * composer a few pixels wide decided it needed a second one and the way back
 * compared against that width.
 *
 * Three things, per window:
 *   - the short message is not faded and offers no "Read more";
 *   - the fresh composer is one row: the "+" beside the text, not under it;
 *   - and a message that really is long still is clamped, so the fix is not
 *     simply that nothing is measured any more.
 */
import { fileURLToPath } from "node:url";
import { browsers, serveStatic, skip } from "../harness.mjs";

const playwright = await browsers();
if (!playwright) skip("the panel check");
const { chromium } = playwright;

const DIST = fileURLToPath(new URL("../../packages/inline-chat-kit/storybook-static", import.meta.url));
/* `BASE=http://localhost:6006` runs it against a Storybook dev server. */
const site = process.env.BASE
  ? { url: process.env.BASE.replace(/\/$/, ""), close: () => {} }
  : await serveStatic(DIST, 4689);

const STORY = "components-chatexperience--opens-with-the-message";
const WINDOWS = [
  [1440, 900],
  [1120, 680],
];
const LONG = "A message that runs on for a while, the way a careful note about a visit does. ".repeat(8).trim();

let bad = 0;
const check = (ok, line) => {
  if (!ok) bad += 1;
  console.log(`    ${ok ? "ok  " : "FAIL"}  ${line}`);
};

/** The sent bubble holding `text`: its fade, its size, and whether it offers more. */
const bubble = (page, text) =>
  page.evaluate((text) => {
    const editor = [...document.querySelectorAll("[role='textbox']")].find(
      (e) => e.textContent === text
    );
    if (!editor) return null;
    const wrap = editor.parentElement;
    return {
      fade: wrap.parentElement.getAttribute("data-fade"),
      width: wrap.offsetWidth,
      height: wrap.scrollHeight,
    };
  }, text);

/** Whether the composer's "+" sits on the text's row or under it. */
const composerRow = (page) =>
  page.evaluate(() => {
    const turn = [...document.querySelectorAll("[data-active-input]")].pop();
    const editor = turn.querySelector("[role='textbox']").getBoundingClientRect();
    const plus = turn.querySelector("button[aria-label='Add']").getBoundingClientRect();
    return {
      gap: Math.round(Math.abs(plus.top + plus.height / 2 - (editor.top + editor.height / 2))),
      height: Math.round(turn.querySelector("[class*='surface']").getBoundingClientRect().height),
    };
  });

const browser = await chromium.launch();
for (const [width, height] of WINDOWS) {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  await page.goto(`${site.url}/iframe.html?id=${STORY}&viewMode=story`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  console.log(`\n  ${width}×${height}`);

  await page.getByRole("button", { name: "Report a change" }).click();
  await page.waitForTimeout(1500);

  const sent = "Something changed on this card.";
  const short = await bubble(page, sent);
  await page.getByRole("textbox").filter({ hasText: sent }).hover();
  await page.waitForTimeout(400);
  const more = await page.getByRole("button", { name: "Read more" }).count();
  check(
    short && !short.fade && more === 0,
    `the one-line message, ${short?.width}×${short?.height}, is ${short?.fade ? `faded (${short.fade})` : "not faded"}` +
      `${more ? ", and offers Read more" : ""}`
  );

  const row = await composerRow(page);
  check(row.gap <= 4, `the fresh composer is ${row.height}px tall, its "+" ${row.gap}px off the text's row`);

  await page.locator("[contenteditable]").last().click();
  await page.keyboard.type(LONG, { delay: 0 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  const long = await bubble(page, LONG);
  check(long?.fade === "bottom", `a long message, ${long?.height}px of it, is still clamped (fade ${long?.fade})`);

  await page.close();
}

await browser.close();
site.close();
console.log(bad ? `\n  ${bad} failed\n` : "\n  a panel opening under an answer leaves nothing measured at the wrong width\n");
process.exit(bad ? 1 : 0);
