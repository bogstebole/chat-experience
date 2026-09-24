/**
 * Does a sent message go to the top while the model is still silent?
 *
 *   npm run build-storybook --workspace packages/inline-chat-kit && npm run silent-check
 *
 * `follow-check` sends to the demo's script, and the script starts talking the
 * moment it is asked — so every move it measured came with the content
 * growing, and a view that only moves when the answer grows passed it. A real
 * model is seconds of nothing and then the answer. Measured in that shape
 * before this existed: the second and third messages stood at 378px for the
 * whole wait and went to the top only when the answer came — with the host's
 * chat published from a store a render late, and, at 1120×680 and 390×844,
 * with the kit's own chat too.
 *
 * Two stories, three windows, three messages each: the message is at the
 * anchor before the answer has said anything, and still there just before it
 * does.
 */
import { fileURLToPath } from "node:url";
import { browsers, serveStatic, skip } from "../harness.mjs";

const playwright = await browsers();
if (!playwright) skip("the silent check");
const { chromium } = playwright;

const DIST = fileURLToPath(new URL("../../packages/inline-chat-kit/storybook-static", import.meta.url));
const site = await serveStatic(DIST, 4697);

const STORIES = ["components-chatexperience--thinks-first", "components-chatexperience--chat-in-a-store"];
const WINDOWS = [
  [1440, 900],
  [1120, 680],
  [390, 844],
];
const QUESTIONS = ["What is waiting on me?", "She walks with a frame now", "How is a visit paid for?"];
/** The stories' model is silent for 2500ms. */
const ARRIVED = 700;
const STILL = 2300;
const ANSWERED = 3400;

let bad = 0;
const check = (ok, line) => {
  if (!ok) bad += 1;
  console.log(`    ${ok ? "ok  " : "FAIL"}  ${line}`);
};

const browser = await chromium.launch();
for (const id of STORIES) {
  for (const [width, height] of WINDOWS) {
    const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
    await page.goto(`${site.url}/iframe.html?id=${id}&viewMode=story`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const anchor = await page.evaluate(() =>
      Math.round(parseFloat(getComputedStyle(document.querySelector(".ick-chat-feed")).paddingTop))
    );
    console.log(`\n  ${id.split("--")[1]}, ${width}×${height}, anchor ${anchor}px`);

    /* Where the turn that holds this question is, from the top of the view —
       and not the composer, which holds it too until it is sent. */
    const where = (q) =>
      page.evaluate((q) => {
        const view = document.querySelector(".ick-chat-feed");
        const turn = [...view.querySelectorAll("[id^='turn-']")]
          .filter((t) => !t.hasAttribute("data-active-input") && t.textContent.includes(q))
          .pop();
        if (!turn) return null;
        return Math.round(turn.getBoundingClientRect().top - view.getBoundingClientRect().top);
      }, q);

    for (const [i, q] of QUESTIONS.entries()) {
      await page.locator("[contenteditable]").last().click();
      await page.keyboard.type(q, { delay: 2 });
      await page.keyboard.press("Enter");
      await page.waitForTimeout(ARRIVED);
      const early = await where(q);
      await page.waitForTimeout(STILL - ARRIVED);
      const late = await where(q);
      check(
        early !== null && Math.abs(early - anchor) <= 8 && Math.abs(late - anchor) <= 8,
        `message ${i + 1} is at ${early}px ${ARRIVED}ms after the send and ${late}px at ${STILL}ms, ` +
          `with nothing answered yet — wanted ${anchor}`
      );
      await page.waitForTimeout(ANSWERED - STILL);
    }
    await page.close();
  }
}

await browser.close();
site.close();
console.log(bad ? `\n  ${bad} failed\n` : "\n  every message went to the top before the model said a word\n");
process.exit(bad ? 1 : 0);
