/**
 * Checks the microphone button's states in a real browser.
 *
 * The unit tests cannot: the button is a child of the composer's
 * `AnimatePresence`, and Motion's animations never complete under jsdom, so an
 * exit that never finishes leaves that presence rendering stored children and
 * the flag its siblings return on is restored from an `onExitComplete` that
 * never fires. Clicking it there tests jsdom's handling of Motion.
 *
 * This drives the real playground with the microphone stubbed — refused, then
 * granted — and reports what the button actually says.
 *
 *   npm run dev            # in another terminal
 *   node tools/voice/check.mjs
 */
import { chromium } from "../showcase/lib.mjs";

const BASE = process.env.BASE ?? "http://localhost:5173";
const beat = (page, ms) => page.waitForTimeout(ms);

/** Replaces the microphone, and nothing else. */
const stub = (refuse) => `(${((refuse) => {
  const deny = () => Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" }));
  const allow = async () => ({ getTracks: () => [{ stop() {} }] });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: refuse ? deny : allow },
  });
  class R {
    constructor() { this.state = "inactive"; }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["x"]) }); this.onstop?.(); }
    static isTypeSupported() { return true; }
  }
  window.MediaRecorder = R;
  window.AudioContext = class {
    createAnalyser() { return { fftSize: 512, getByteTimeDomainData() {} }; }
    createMediaStreamSource() { return { connect() {} }; }
    close() { return Promise.resolve(); }
  };
}).toString()})(${refuse})`;

const read = (page) =>
  page.evaluate(() => {
    const button = document.querySelector("[data-voice]");
    const note = document.querySelector('[class*="voiceNote"]');
    return {
      state: button?.getAttribute("data-voice") ?? null,
      label: button?.getAttribute("aria-label") ?? null,
      disabled: button?.disabled ?? null,
      note: note?.textContent?.trim() ?? null,
    };
  });

const open = async (refuse) => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 900, height: 620 } });
  await context.addInitScript(stub(refuse));
  const page = await context.newPage();
  await page.goto(`${BASE}/?showcase&theme=light`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /start experience/i }).click();
  await beat(page, 1500);
  return { browser, page };
};

const expect = (label, got, want) => {
  const ok = got === want;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}: ${JSON.stringify(got)}${ok ? "" : ` (wanted ${JSON.stringify(want)})`}`);
  return ok;
};

let good = true;

{
  const { browser, page } = await open(false);
  good = expect("idle label", (await read(page)).label, "Dictate a message") && good;
  await page.getByRole("button", { name: /dictate a message/i }).click();
  await beat(page, 900);
  const listening = await read(page);
  good = expect("listening state", listening.state, "listening") && good;
  good = expect("listening label", listening.label, "Stop listening") && good;
  await browser.close();
}

{
  const { browser, page } = await open(true);
  await page.getByRole("button", { name: /dictate a message/i }).click();
  await beat(page, 900);
  const denied = await read(page);
  good = expect("refused state", denied.state, "denied") && good;
  good = expect("refused label", denied.label, "Microphone blocked") && good;
  good = expect("refused disabled", denied.disabled, true) && good;
  console.log(`  note: ${denied.note}`);
  await browser.close();
}

console.log(good ? "\n  all states as expected\n" : "\n  something is off\n");
process.exit(good ? 0 : 1);
