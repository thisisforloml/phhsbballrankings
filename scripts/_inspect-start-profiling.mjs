import { readFileSync } from "node:fs";

const s = readFileSync(
  "node_modules/react-devtools/node_modules/react-devtools-core/dist/backend.js",
  "utf8"
);

const i = s.indexOf("function startProfiling(shouldRecordChangeDescriptions)");
console.log(s.slice(i, i + 1200));

const j = s.indexOf("isProfiling && toggleProfilingStatus");
console.log("\n--- attach ---\n");
console.log(s.slice(j - 200, j + 400));
