import { readFileSync } from "node:fs";

const s = readFileSync(
  "node_modules/react-devtools/node_modules/react-devtools-core/dist/backend.js",
  "utf8"
);

for (const k of ["stopProfiling", "startProfiling", "profilingData", "bridgeProtocol"]) {
  let idx = 0;
  let n = 0;
  while ((idx = s.indexOf(k, idx)) >= 0 && n < 3) {
    console.log(`\n--- ${k} @ ${idx} ---`);
    console.log(s.slice(Math.max(0, idx - 100), idx + 150));
    idx += k.length;
    n++;
  }
}
