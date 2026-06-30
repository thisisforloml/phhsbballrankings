import { readFileSync } from "node:fs";

const s = readFileSync(
  "node_modules/react-devtools/node_modules/react-devtools-core/dist/backend.js",
  "utf8"
);

const i = s.indexOf('"stopProfiling", function ()');
console.log(s.slice(i, i + 600));

const j = s.indexOf('"getProfilingData", function (_ref6)');
console.log("\n--- getProfilingData ---\n");
console.log(s.slice(j, j + 600));
