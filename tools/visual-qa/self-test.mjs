/**
 * The suite's own test: three deliberately broken layouts, one correct one.
 *
 *   node tools/visual-qa/self-test.mjs
 *
 * A pass that reports nothing is worth nothing until it has been shown to
 * report something. This is the same discipline the unit guards in this repo
 * follow — every one of them was watched failing before it was trusted — and
 * it matters more here, because a geometry rule that silently matches nothing
 * looks exactly like a clean bill of health.
 *
 * The fixtures are plain HTML rather than stories, so this runs in a second
 * and does not need Storybook built.
 */
import { chromium } from "../showcase/lib.mjs";
import { RULES_SOURCE } from "./rules.mjs";

const TOLERANCE = 1;

/** Each case: a fixture, and the rule it must produce. */
const CASES = [
  {
    name: "a centred box whose child is pushed off-centre",
    expect: "centring",
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:60px;height:40px">
        <span style="width:10px;height:10px;margin-left:20px;background:#333"></span>
      </div>`,
  },
  {
    name: "a row of icon buttons at two sizes",
    expect: "even-row",
    html: `
      <div style="display:flex;align-items:center">
        <button style="width:28px;height:28px"><svg width="16" height="16"><rect width="16" height="16"/></svg></button>
        <button style="width:28px;height:28px"><svg width="12" height="12"><rect width="12" height="12"/></svg></button>
      </div>`,
  },
  {
    name: "a child wider than the box that clips it",
    expect: "overflow",
    html: `
      <div style="overflow:hidden;width:100px;height:30px">
        <div style="width:100%;padding:0 8px;height:20px;background:#eee"></div>
      </div>`,
  },
  {
    name: "the same three, built correctly",
    expect: null,
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:60px;height:40px">
        <span style="width:10px;height:10px;background:#333"></span>
      </div>
      <div style="display:flex;align-items:center">
        <button style="width:28px;height:28px"><svg width="16" height="16"><rect width="16" height="16"/></svg></button>
        <button style="width:28px;height:28px"><svg width="16" height="16"><rect width="16" height="16"/></svg></button>
      </div>
      <div style="overflow:hidden;width:100px;height:30px">
        <div style="box-sizing:border-box;width:100%;padding:0 8px;height:20px;background:#eee"></div>
      </div>`,
  },
];

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 400, height: 300 } })).newPage();

let bad = 0;
for (const test of CASES) {
  await page.setContent(`<body style="margin:0">${test.html}</body>`);
  const found = await page.evaluate(
    ([source, tolerance]) => {
      // eslint-disable-next-line no-eval
      (0, eval)(source);
      return window.__visualQa(tolerance);
    },
    [RULES_SOURCE, TOLERANCE]
  );
  const rules = [...new Set(found.map((v) => v.rule))];
  const ok = test.expect ? rules.includes(test.expect) : rules.length === 0;
  if (!ok) bad += 1;
  console.log(
    `  ${ok ? "ok  " : "FAIL"}  ${test.name}\n` +
      `          ${test.expect ? `wanted \`${test.expect}\`` : "wanted nothing"}, got ${rules.length ? rules.map((r) => `\`${r}\``).join(", ") : "nothing"}`
  );
  if (found.length && test.expect) console.log(`          ${found[0].detail}`);
}

await browser.close();
console.log(bad ? `\n  ${bad} of ${CASES.length} wrong\n` : `\n  all ${CASES.length} behave\n`);
process.exit(bad ? 1 : 0);
