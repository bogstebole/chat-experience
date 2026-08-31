/**
 * The machinery behind a showcase recording: a browser, a screencast, and two
 * encoders.
 *
 * Everything in here was learned the hard way once — that a screencast ignores
 * `deviceScaleFactor`, that Playwright's ffmpeg has no H.264, that libvpx needs
 * `-b:v 0` to obey a CRF — and it is worth not learning twice. So it is a file
 * of its own rather than copied into each scene.
 *
 * A *scene* is the part that differs: what happens on screen, how big the frame
 * is, and what the file is called. See `record.mjs` and `questions.mjs`.
 *
 * Playwright is not a dependency of this repo — browsers are a heavy install
 * for everyone and this is a marketing tool. A global install is enough.
 */
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync, spawn } from "node:child_process";

const loadPlaywright = async () => {
  try {
    return await import("playwright");
  } catch {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    try {
      return await import(pathToFileURL(join(root, "playwright", "index.js")).href);
    } catch {
      throw new Error(
        "Playwright is not installed. Install it with:\n" +
          "  npm i -g playwright && npx playwright install chromium"
      );
    }
  }
};

// Playwright is CommonJS, so a dynamic import by path hands it back under
// `default`.
const playwright = await loadPlaywright();
export const { chromium } = playwright.default ?? playwright;

export const BASE = "http://localhost:5173";

// `fileURLToPath`, not `.pathname` — the repo lives under a directory with a
// space in its name, and `.pathname` hands back the percent-encoded form,
// which fs takes literally and quietly builds a parallel tree for.
export const OUT = fileURLToPath(new URL("../../Videos/showcase", import.meta.url));

/** `npm run showcase -- dark`. Light unless the argument says otherwise. */
export const theme = () => (process.argv[2] === "dark" ? "dark" : "light");

/** Frames a second in the encoded file, not the rate they arrive at. */
export const FPS = 30;


/**
 * Resolution, and the thing about it that is not obvious.
 *
 * `Page.startScreencast` **ignores the context's `deviceScaleFactor`**.
 * Measured at 1, 2 and 3: the frames come back 1120×680 every time, while
 * `devicePixelRatio` inside the page dutifully reports 1, 2 and 3. The
 * previous cut therefore asked for 2× and shipped 1×, and the comment
 * claiming otherwise was wrong for as long as it stood.
 *
 * What the screencast does read is the browser's own scale factor, set at
 * launch. With this flag the frames arrive at 2240×1360 while the layout
 * viewport stays 1120 CSS px — same design, twice the pixels, nothing moved.
 *
 * `zoom` on the root is the obvious-looking alternative and it does not work:
 * viewport units are not divided by it, so `100vh` becomes twice the frame
 * height and the intro is pushed off screen.
 */
export const SCALE = 2;

export const beat = (page, ms) => page.waitForTimeout(ms);

export async function startCapture(page, dir, viewport) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const client = await page.context().newCDPSession(page);
  const frames = [];
  let index = 0;

  client.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
    const name = join(dir, `${String(index++).padStart(5, "0")}.jpg`);
    frames.push({ name, t: metadata.timestamp });
    await writeFile(name, Buffer.from(data, "base64"));
    try {
      await client.send("Page.screencastFrameAck", { sessionId });
    } catch {
      // The page can close between a frame arriving and its acknowledgement.
    }
  });

  await client.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: viewport.width * SCALE,
    maxHeight: viewport.height * SCALE,
    everyNthFrame: 1,
  });

  return {
    frames,
    stop: async () => {
      await client.send("Page.stopScreencast").catch(() => {});
      await new Promise((r) => setTimeout(r, 250)); // let the last writes land
    },
  };
}

/**
 * Screencast frames arrive only when something changes, so they are spaced
 * unevenly. Encoding needs a steady rate: for each slot on a fixed clock,
 * write whichever frame was the most recent at that moment.
 */
/**
 * ffmpeg, twice over.
 *
 * Playwright ships one, which is how this runs on a machine with nothing
 * installed — but it is a stripped build with no H.264 encoder, so it can
 * only write webm. A system ffmpeg, if there is one, writes the mp4 as well.
 */
export const bundledFfmpeg = () =>
  execSync("ls -d ~/Library/Caches/ms-playwright/ffmpeg-*/ffmpeg-mac | tail -1", {
    shell: "/bin/bash",
    encoding: "utf8",
  }).trim();

export const systemFfmpeg = () => {
  try {
    return execSync("command -v ffmpeg", { shell: "/bin/bash", encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};

export const VP8 = [
  "-c:v", "libvpx",
  // Constant quality, which for libvpx means `-b:v 0` — a bitrate of zero is
  // how it is told to obey the CRF instead. The first version asked for a
  // flat 8M and got a 15MB file for twenty seconds, while H.264 at constant
  // quality wrote 0.9MB of the same frames. Almost all of it was being spent
  // on flat background nobody was looking at.
  "-crf", "24",
  "-b:v", "0",
  "-deadline", "good",
  "-cpu-used", "1",
  "-auto-alt-ref", "0",
];

export const H264 = [
  "-c:v", "libx264",
  // Constant quality rather than a bitrate: the frame is mostly flat colour
  // with small text, which is exactly where a fixed bitrate wastes bits on
  // the background and starves the letters.
  "-crf", "20",
  "-preset", "slow",
  "-profile:v", "high",
  // Every player, including the ones that decode on the GPU only.
  "-movflags", "+faststart",
];

export async function encode(frames, out, ffmpeg, codec) {
  if (frames.length === 0) throw new Error("no frames were captured");

  const start = frames[0].t;
  const duration = frames[frames.length - 1].t - start;
  const slots = Math.max(1, Math.round(duration * FPS));

  const proc = spawn(ffmpeg, [
    "-y",
    "-f", "image2pipe",
    "-r", String(FPS),
    "-c:v", "mjpeg",
    // `pipe:0`, not `-`: this build enables the pipe and file protocols only,
    // and the shorthand resolves to neither.
    "-i", "pipe:0",
    ...codec,
    "-pix_fmt", "yuv420p",
    out,
  ]);

  // Kept so a failure says what ffmpeg objected to. Without it every argument
  // mistake arrives as a bare EPIPE from the pipe it already closed.
  let stderr = "";
  proc.stderr.on("data", (chunk) => (stderr += chunk));
  proc.stdin.on("error", () => {});

  const tail = () => stderr.trim().split("\n").slice(-12).join("\n");
  let finished = false;
  const done = new Promise((resolve, reject) => {
    proc.on("error", (error) => {
      finished = true;
      reject(new Error(`could not run ffmpeg: ${error.message}`));
    });
    proc.on("close", (code) => {
      finished = true;
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${tail()}`));
    });
  });
  // Nothing downstream awaits this copy; it exists so an early exit rejects
  // rather than leaving the writer waiting for a drain that never comes.
  done.catch(() => {});

  let cursor = 0;
  for (let slot = 0; slot < slots && !finished; slot++) {
    const at = start + slot / FPS;
    while (cursor + 1 < frames.length && frames[cursor + 1].t <= at) cursor++;
    const jpeg = await readFile(frames[cursor].name);
    if (!proc.stdin.write(jpeg)) {
      // Raced against `done`, or a dead ffmpeg means waiting forever — and a
      // promise nothing can settle exits node silently with a success code.
      await Promise.race([new Promise((r) => proc.stdin.once("drain", r)), done]);
    }
  }
  proc.stdin.end();

  await done;
}
