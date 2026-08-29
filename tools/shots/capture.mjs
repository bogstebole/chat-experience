/**
 * Captures the screenshots that prove a piece of work is done.
 *
 * Every part of the kit ends with something to look at rather than a paragraph
 * saying it works. This drives the real Storybook and the real playground, so
 * a shot cannot show something the component does not do.
 *
 *   npm run shots                 everything
 *   npm run shots -- markdown     only shots whose name contains "markdown"
 *
 * Storybook must be running on :6006 and the playground on :5173. Missing one
 * skips its shots rather than failing the run.
 *
 * Playwright is not a dependency of this repo — browsers are a heavy install
 * for everyone and this is a documentation tool. A global install is enough.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { join } from "node:path";

const loadPlaywright = async () => {
  try {
    return await import("playwright");
  } catch {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    return await import(`file://${join(root, "playwright", "index.js")}`);
  }
};

const playwright = await loadPlaywright();
const { chromium } = playwright.default ?? playwright;

// `fileURLToPath`, not `.pathname` — the repo lives under a directory with a
// space in its name, and `.pathname` hands back the percent-encoded form.
const OUT = fileURLToPath(new URL("../../Shots", import.meta.url));
const SB = "http://localhost:6006";
const APP = "http://localhost:5173";

/** The screencast lesson from the recorder: pixels come from the launch flag. */
const SCALE = 2;

/** A story, with the Storybook chrome left out. */
const story = (id, theme) => `${SB}/iframe.html?id=${id}&globals=theme:${theme}`;

/**
 * What to capture.
 *
 * `clip` is a selector — the shot is of that element rather than the viewport,
 * so there is no field of empty page under the thing being looked at. It
 * defaults to Storybook's own root, which is exactly the story and nothing
 * else. `act` runs before the shot for anything that needs a gesture.
 */
const STORY_ROOT = "#storybook-root";
const SHOTS = [
  {
    name: "markdown-everything",
    story: "components-texthighlighter-markdown--everything",
    themes: ["light", "dark"],
  },
  {
    name: "markdown-partial-syntax",
    story: "components-texthighlighter-markdown--partial-syntax",
    themes: ["light"],
  },
  {
    name: "markdown-code-not-markable",
    story: "components-texthighlighter-markdown--code-is-not-markable",
    themes: ["light"],
  },
  {
    name: "markdown-marker-across-bold",
    story: "components-texthighlighter-markdown--across-emphasis",
    themes: ["light", "dark"],
    /** The whole point of the design: one stroke, two elements. */
    act: async (page) => {
      const box = await page.locator("[class*='ick-tokens']").boundingBox();
      const y = box.y + 8;
      await page.mouse.move(box.x + 4, y);
      await page.mouse.down();
      for (let i = 1; i <= 40; i++) {
        await page.mouse.move(box.x + 4 + (box.width * 0.62 * i) / 40, y + Math.sin(i / 6) * 1.5);
        await page.waitForTimeout(6);
      }
      await page.mouse.up();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "question-states",
    story: "components-questioncard--states",
    themes: ["light", "dark"],
  },
  {
    name: "question-types",
    story: "components-questioncard--types",
    themes: ["light"],
  },
  {
    name: "question-summaries",
    story: "components-questioncard--summaries",
    themes: ["light"],
  },
  {
    name: "question-step",
    story: "components-questioncard--a-whole-step",
    themes: ["light"],
    /** Answer the first one, so the fold and the summary row are both real. */
    act: async (page) => {
      const boxes = page.getByRole("textbox");
      await boxes.nth(0).fill("Milica Stevanović");
      await boxes.nth(1).fill("84");
      await boxes.nth(2).fill("Vračar, Beograd");
      await page.getByRole("button", { name: "Next" }).click();
      await page.waitForTimeout(900);
    },
  },
  {
    name: "empty-state",
    story: "components-emptystate--everything",
    themes: ["light", "dark"],
  },
  {
    name: "loader",
    story: "components-emptystate--the-loader",
    themes: ["light"],
  },
  {
    name: "answer-actions",
    story: "components-answeractions--what-is-drawn",
    themes: ["light", "dark"],
  },
  {
    name: "answer-actions-verdict",
    story: "components-answeractions--the-verdict",
    themes: ["light"],
    /** The lit state, which is the half nobody sees in a still. */
    act: async (page) => {
      await page.getByRole("button", { name: "Good answer" }).click();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "answer-actions-in-a-turn",
    story: "components-answeractions--in-a-turn",
    themes: ["light"],
  },
  {
    name: "conversation-anchored",
    story: "components-conversation--anchored-to-a-turn",
    themes: ["light"],
    /** Two turns, so the second has to travel to the top to be held there. */
    act: async (page) => {
      await page.getByRole("button", { name: "send a message" }).click();
      await page.waitForTimeout(3200);
    },
  },
  {
    name: "conversation-following",
    story: "components-conversation--with-padding-below",
    themes: ["light"],
  },
  {
    name: "conversation-let-go",
    story: "components-conversation--with-padding-below",
    themes: ["light", "dark"],
    /** Scrolled away, which is the only state where the button is offered. */
    act: async (page) => {
      const view = page.locator("[class*='viewport']").first();
      await view.hover();
      await page.mouse.wheel(0, -400);
      await page.waitForTimeout(600);
    },
  },
  {
    name: "code-languages",
    story: "components-codeblock--languages",
    themes: ["light", "dark"],
  },
  {
    name: "code-bar",
    story: "components-codeblock--the-bar",
    themes: ["light"],
  },
  {
    name: "code-copied",
    story: "components-codeblock--languages",
    themes: ["light"],
    /** The confirmed state, which is the half of the button nobody sees. */
    act: async (page) => {
      await page.getByRole("button", { name: "Copy code" }).first().click();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "code-in-an-answer",
    story: "components-codeblock--in-an-answer",
    themes: ["light", "dark"],
  },
  {
    name: "turn-row-states",
    story: "components-chatturnrow--states",
    themes: ["light", "dark"],
  },
  {
    name: "header-variants",
    story: "components-chatheader--variants",
    themes: ["light", "dark"],
  },
  {
    name: "header-variants-scrolled",
    story: "components-chatheader--variants-scrolled",
    themes: ["light", "dark"],
    /**
     * Actually scroll each column. Setting `data-scrolled` by hand produced a
     * still where nothing was behind the header — which is the one thing the
     * shot needs to show, since a blur with nothing under it is just a tint.
     */
    act: async (page) => {
      await page.evaluate(() => {
        document.querySelectorAll("div").forEach((el) => {
          if (el.scrollHeight > el.clientHeight + 20) el.scrollTop = 90;
        });
      });
      await page.waitForTimeout(500);
    },
  },
  {
    name: "header-collapsing",
    story: "components-chatheader--collapsing",
    themes: ["light"],
  },
];

/** The playground, driven far enough to show a real answer. */
const APP_SHOTS = [
  {
    name: "demo-markdown-answer",
    themes: ["light", "dark"],
    clip: null,
    act: async (page) => {
      await page.getByRole("button", { name: /start experience/i }).click();
      await page.waitForTimeout(900);
      const editor = page.locator("[contenteditable]").last();
      await editor.click();
      await page.keyboard.type("What does particle physics actually study?", { delay: 8 });
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: /send message/i }).click();
      // Wait for the answer to stop growing rather than guessing a duration.
      await page.waitForFunction(
        () => {
          const el = document.querySelector("[data-cursor-active]");
          if (!el) return false;
          const now = el.textContent.length;
          const settled = window.__len === now;
          window.__len = now;
          return settled && now > 120;
        },
        null,
        { polling: 300, timeout: 30000 }
      );
      await page.waitForTimeout(400);

      // A second turn: the first is what proves nothing, since it is already
      // at the top. This one has to travel there.
      const next = page.locator("[contenteditable]").last();
      await next.click();
      await page.keyboard.type("How big is the Higgs boson?", { delay: 8 });
      await page.getByRole("button", { name: /send message/i }).last().click();
      await page.waitForTimeout(1400);
    },
  },
];

const filter = process.argv[2];
const wanted = (name) => !filter || name.includes(filter);

const reachable = async (url) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
};

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ args: [`--force-device-scale-factor=${SCALE}`] });
  const written = [];

  const shoot = async (page, shot, theme, name) => {
    if (shot.act) await shot.act(page);
    const target = shot.clip === null ? page : page.locator(shot.clip ?? STORY_ROOT).first();
    const file = join(OUT, `${name}.png`);
    await writeFile(file, await target.screenshot());
    written.push(file);
  };

  if (await reachable(SB)) {
    for (const shot of SHOTS) {
      for (const theme of shot.themes) {
        const name = `${shot.name}-${theme}`;
        if (!wanted(name)) continue;
        const context = await browser.newContext({
          viewport: { width: 720, height: 900 },
          deviceScaleFactor: SCALE,
          colorScheme: theme,
        });
        const page = await context.newPage();
        await page.goto(story(shot.story, theme), { waitUntil: "networkidle" });
        await page.waitForTimeout(700);
        await shoot(page, shot, theme, name);
        await context.close();
      }
    }
  } else {
    console.log(`  (${SB} is not running, so the story shots were skipped)`);
  }

  if (await reachable(APP)) {
    for (const shot of APP_SHOTS) {
      for (const theme of shot.themes) {
        const name = `${shot.name}-${theme}`;
        if (!wanted(name)) continue;
        const context = await browser.newContext({
          viewport: { width: 1000, height: 760 },
          deviceScaleFactor: SCALE,
          colorScheme: theme,
        });
        const page = await context.newPage();
        await page.goto(`${APP}/?showcase&theme=${theme}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(500);
        await shoot(page, shot, theme, name);
        await context.close();
      }
    }
  } else {
    console.log(`  (${APP} is not running, so the demo shots were skipped)`);
  }

  await browser.close();

  if (written.length === 0) throw new Error("nothing was captured");
  console.log();
  for (const file of written) console.log(`  ${file}`);
  console.log();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
