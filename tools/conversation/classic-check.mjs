/**
 * Does a docked chat set to work the classic way hold still where it should?
 *
 *   npm run build-storybook --workspace packages/inline-chat-kit && npm run classic-check
 *
 * Reported from a host, docked, on every send: the message flew from the
 * composer to the top while the answer's "…" was already loading up there;
 * the answer before it left the view in one step and empty room was held
 * under the new one; the header swapped the host's "Assistant" for the
 * question; and the composer itself went 16px up and back. None of it could
 * be turned off. `anchor="end"`, `travel={false}` and `retitle={false}` are
 * how it is turned off, and the `Classic` story sets all three.
 *
 * Per window, three messages, read after each frame is painted:
 *   - the composer does not move — its bottom edge, by more than a pixel;
 *   - the header keeps the host's title;
 *   - the message is drawn where it lands — its place in the conversation is
 *     the same from the first frame it is there;
 *   - nothing is held empty under it, and once the answer settles the view is
 *     at the end of the conversation;
 * and, once, a reader who scrolls up while an answer arrives is left there.
 */
import { fileURLToPath } from "node:url";
import { browsers, serveStatic, skip } from "../harness.mjs";

const playwright = await browsers();
if (!playwright) skip("the classic check");
const { chromium } = playwright;

const DIST = fileURLToPath(new URL("../../packages/inline-chat-kit/storybook-static", import.meta.url));
/* `BASE=http://localhost:6006` runs it against a Storybook dev server. */
const site = process.env.BASE
  ? { url: process.env.BASE.replace(/\/$/, ""), close: () => {} }
  : await serveStatic(DIST, 4687);

const STORY = "components-chatexperience--classic";
const TITLE = "Assistant";
const WINDOWS = [
  [1440, 900],
  [1120, 680],
  [390, 844],
];
const QUESTIONS = [
  "How big is the Higgs boson?",
  "Write me a plan for running a 5k",
  "What does particle physics actually study?",
];
/** What the morph from box to bubble moves the text inside it: measured, 5px. */
const MORPH = 8;
/** Long enough for the demo's longest answer to finish and settle. */
const ANSWER = 7000;

let bad = 0;
const check = (ok, line) => {
  if (!ok) bad += 1;
  console.log(`    ${ok ? "ok  " : "FAIL"}  ${line}`);
};

/* Sampled after paint — a message posted from a rAF callback runs once
   rendering is done — so what is read is what was drawn. */
const record = (page, q) =>
  page.evaluate(
    ({ q, ms }) =>
      new Promise((done) => {
        const view = document.querySelector(".ick-chat-feed");
        const frames = [];
        const t0 = performance.now();
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          const box = view.getBoundingClientRect();
          const dock = [...view.querySelectorAll("[data-active-input]")].pop();
          const turn = [...view.querySelectorAll("[id^='turn-']")].find(
            (t) => !t.hasAttribute("data-active-input") && t.textContent.includes(q)
          );
          const bubble = turn?.querySelector("[role='textbox']");
          frames.push({
            ms: performance.now() - t0,
            /* Its bottom edge: the box grows upwards as a question is typed
               into it and shrinks back as it empties, which is not moving. */
            composer: dock.getBoundingClientRect().bottom - box.top,
            /* Where in the conversation, not where on screen: the view
               scrolls, and a message drawn where it lands keeps this. */
            place: bubble ? bubble.getBoundingClientRect().top - box.top + view.scrollTop : null,
            title: document.querySelector(".ick-chat-header h2")?.textContent,
            busy: turn?.getAttribute("aria-busy") === "true",
          });
          if (performance.now() - t0 < ms) requestAnimationFrame(() => channel.port2.postMessage(0));
          else done(frames);
        };
        requestAnimationFrame(() => channel.port2.postMessage(0));
      }),
    { q, ms: ANSWER }
  );

const browser = await chromium.launch();
for (const [width, height] of WINDOWS) {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  await page.goto(`${site.url}/iframe.html?id=${STORY}&viewMode=story`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  console.log(`\n  ${width}×${height}`);

  for (const q of QUESTIONS) {
    await page.locator("[contenteditable]").last().click();
    await page.keyboard.type(q, { delay: 2 });
    const recording = record(page, q);
    await page.keyboard.press("Enter");
    const frames = await recording;

    const start = frames[0].composer;
    const drift = Math.max(...frames.map((f) => Math.abs(f.composer - start)));
    const places = frames.filter((f) => f.place !== null).map((f) => f.place);
    const travel = places.length ? Math.round(Math.max(...places) - Math.min(...places)) : NaN;
    const titles = [...new Set(frames.map((f) => f.title))];
    const settled = await page.evaluate(() => {
      const view = document.querySelector(".ick-chat-feed");
      const content = view.firstElementChild;
      const room = getComputedStyle(content).getPropertyValue("--ick-conversation-room").trim();
      return {
        room: room === "" ? 0 : parseFloat(room),
        fromEnd: Math.round(view.scrollHeight - view.clientHeight - view.scrollTop),
      };
    });

    check(drift <= 1, `"${q.slice(0, 32)}" — the composer moved ${Math.round(drift)}px`);
    /* A travel is the whole way from the composer, hundreds of pixels. What
       is allowed is the morph: the box becoming a bubble eases its own
       padding, and moves the text inside it by a few. */
    check(travel <= MORPH, `  the message moved ${travel}px in the conversation after it appeared`);
    check(titles.length === 1 && titles[0] === TITLE, `  the header said ${titles.map((t) => `"${t}"`).join(", ")}`);
    check(
      settled.room === 0 && settled.fromEnd <= 2,
      `  ${settled.room}px held under it, the view ${settled.fromEnd}px from the end once it settled`
    );
  }

  /* While an answer arrives, scrolling up to read what came before is left
     alone — and the next message takes the reader back down. */
  await page.locator("[contenteditable]").last().click();
  await page.keyboard.type("Write me a plan for running a 5k", { delay: 2 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const feed = await page.locator(".ick-chat-feed").boundingBox();
  await page.mouse.move(feed.x + feed.width / 2, feed.y + feed.height / 2);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(300);
  const left = await page.evaluate(() => document.querySelector(".ick-chat-feed").scrollTop);
  await page.waitForTimeout(2000);
  const later = await page.evaluate(() => document.querySelector(".ick-chat-feed").scrollTop);
  check(later <= left + 2, `scrolled up mid-answer, the view stayed (${Math.round(left)} → ${Math.round(later)})`);
  await page.close();
}

await browser.close();
site.close();
console.log(bad ? `\n  ${bad} failed\n` : "\n  the classic way held still where it should\n");
process.exit(bad ? 1 : 0);
