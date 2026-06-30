import { readFileSync } from "node:fs";

const s = readFileSync(
  "node_modules/react-devtools/node_modules/react-devtools-core/dist/backend.js",
  "utf8"
);

const start = s.indexOf("function getProfilingData()");
console.log(s.slice(start, start + 3500));
