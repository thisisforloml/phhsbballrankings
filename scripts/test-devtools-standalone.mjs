/** Quick test: can we load react-devtools standalone in jsdom? */
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "navigator", "self", "HTMLElement", "Node", "customElements"]) {
  globalThis[key] = dom.window[key] ?? dom.window;
}
globalThis.self = dom.window;
globalThis.window = dom.window;

try {
  const standalone = require("react-devtools/node_modules/react-devtools-core/standalone");
  console.log("standalone type", typeof standalone, typeof standalone.default);
  if (typeof standalone === "function") {
    const api = standalone({ port: 8098 });
    console.log("api keys", api && Object.keys(api));
  } else if (standalone.default) {
    console.log("default keys", Object.keys(standalone.default));
  }
} catch (e) {
  console.error("ERR", e.message);
}
