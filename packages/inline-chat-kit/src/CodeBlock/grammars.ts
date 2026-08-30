/**
 * The grammars, and nothing else.
 *
 * A module of its own so it can be one chunk. `highlight.ts` reaches it with
 * `await import("./grammars")` — and the imports below stay **static**, which
 * is the whole point: `lowlight`'s entry re-exports `all` (190 grammars) and
 * `common` (37) beside `createLowlight`, so importing the package *itself*
 * dynamically materialises the entire namespace and cannot be shaken. That is
 * 961 kB raw, 301 kB gzipped — thirteen times what deferring it saved.
 *
 * Static named imports inside a deferred module shake normally. The chunk
 * comes out at what the eleven grammars actually cost.
 */
import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/** Registered under the names `highlight.ts` claims. A test holds the two
    lists against each other, since one is written out and one is not. */
export const createHighlighter = () =>
  createLowlight({
    bash,
    css,
    diff,
    javascript,
    json,
    markdown,
    python,
    sql,
    typescript,
    xml,
    yaml,
  });
