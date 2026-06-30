import { readFileSync } from "node:fs";

const s = readFileSync(
  "node_modules/react-devtools/node_modules/react-devtools-core/dist/backend.js",
  "utf8"
);

const i = s.indexOf("getProfilingData");
console.log(s.slice(i - 200, i + 800));
