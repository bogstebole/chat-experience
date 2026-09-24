/**
 * Does an answer hold still while it arrives and as it settles?
 *
 *   npm run build && npm run still-check
 *
 * `follow-check` asks where the view comes to rest; this asks what it does on
 * the way. Measured before this existed, docked: every answer with a card in
 * it dropped by 3–13px for a single frame and came back as it settled — the
 * reasoning folding away above the card while the room under the turn caught
 * up a frame late — and a plain answer was nudged up by the pixels its row of
 * actions did not fit, the moment it finished. Both read as the answer
 * shaking. Neither shows in where anything ends up.
 *
 * Read **after the frame is painted** — a message posted from a rAF callback
 * runs once rendering is done — because a rAF sampler reads the layout before
 * the component has corrected it, and reports jolts nobody ever saw.
 *
 * Two things, per answer, in four windows:
 *   - no jolt: a move of 3px or more undone within two frames;
 *   - an answer that fits is not moved as it settles.
 */
import { browsers, serveStatic, skip } from "../harness.mjs";

const playwright = await browsers();
if (!playwright) skip("the still check");
const { chromium } = playwright;

const site = process.env.BASE
  ? { url: process.env.BASE.replace(/\/$/, ""), close: () => {} }
  : await serveStatic(
      new URL("../../apps/playground/dist", import.meta.url).pathname.replace(/%20/g, " "),
      4699
    );

const WINDOWS = [
  [1440, 900],
  [1280, 720],
  [1120, 680],
  [390, 844],
];
const QUESTIONS = [
  "What does particle physics actually study?",
  "How big is the Higgs boson?",
  "Write me a plan for running a 5k",
  "Set up a double-slit experiment",
  "Delete the screenshots",
];
const JOLT = 3;

let bad = 0;
const check = (ok, line) => {
  if (!ok) bad += 1;
  console.log(`    ${ok ? "ok  " : "FAIL"}  ${line}`);
};

const browser = await chromium.launch();
for (const [width, height] of WINDOWS) {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  await page.goto(`${site.url}/?composer=docked`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const start = page.getByRole("button", { name: /start experience/i });
  if (await start.count()) {
    await start.click();
    await page.waitForTimeout(1500);
  }
  const anchor = await page.evaluate(() =>
    Math.round(parseFloat(getComputedStyle(document.querySelector(".ick-chat-feed")).paddingTop))
  );
  console.log(`\n  ${width}×${height}, docked, anchor ${anchor}px`);

  for (const q of QUESTIONS) {
    await page.locator("[contenteditable]").last().click();
    await page.keyboard.type(q, { delay: 2 });
    await page.evaluate((q) => {
      window.__still = [];
      const view = document.querySelector(".ick-chat-feed");
      const t0 = performance.now();
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        const turn = [...view.querySelectorAll("[id^='turn-']")].find(
          (t) => !t.hasAttribute("data-active-input") && t.textContent.includes(q)
        );
        window.__still.push({
          ms: performance.now() - t0,
          top: turn ? turn.getBoundingClientRect().top - view.getBoundingClientRect().top : null,
          busy: turn?.getAttribute("aria-busy") === "true",
          /* Whether it would fit between the anchor and the composer — the
             part of the view it has, docked. */
          room:
            [...view.querySelectorAll("[data-active-input]")].pop().getBoundingClientRect().top -
            view.getBoundingClientRect().top,
          tall: turn ? turn.getBoundingClientRect().height : 0,
        });
        if (performance.now() - t0 < 7000) requestAnimationFrame(() => channel.port2.postMessage(0));
      };
      requestAnimationFrame(() => channel.port2.postMessage(0));
    }, q);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(7300);
    const frames = await page.evaluate(() => window.__still);

    // From the moment it first reaches the anchor: the travel up is the send.
    const from = frames.findIndex((f) => f.top !== null && Math.abs(f.top - anchor) < 1);
    const moves = [];
    for (let k = Math.max(from, 1) + 1; k < frames.length; k++) {
      const a = frames[k - 1].top;
      const b = frames[k].top;
      if (a !== null && b !== null) moves.push({ k, d: b - a });
    }
    let jolts = 0;
    for (let m = 0; m < moves.length; m++) {
      if (Math.abs(moves[m].d) < JOLT) continue;
      const back = moves
        .slice(m + 1, m + 3)
        .some((n) => Math.sign(n.d) === -Math.sign(moves[m].d) && Math.abs(n.d) >= JOLT);
      if (back) jolts += 1;
    }
    const settleAt = frames.findIndex((f, k) => k > 0 && !f.busy && frames[k - 1].busy);
    const before = frames[Math.max(0, settleAt - 1)];
    const after = frames[Math.min(frames.length - 1, settleAt + 15)];
    /* Whether the answer, as it finished, fits above the composer — read
       once it has, because a card can arrive in the frame the answer ends. */
    const last = frames.at(-1);
    const fits = last.tall <= last.room - anchor;
    const nudged = settleAt > 0 && fits ? Math.round(after.top - before.top) : 0;
    check(
      from >= 0 && jolts === 0 && nudged === 0,
      `"${q.slice(0, 32)}" — ${jolts} jolts, ${fits ? `moved ${nudged}px as it settled` : "longer than the view, followed"}`
    );
  }
  await page.close();
}

await browser.close();
site.close();
console.log(bad ? `\n  ${bad} failed\n` : "\n  every answer held still\n");
process.exit(bad ? 1 : 0);
