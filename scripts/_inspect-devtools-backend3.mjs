import { readFileSync } from "node:fs";

const s = readFileSync(
  "node_modules/react-devtools/node_modules/react-devtools-core/dist/backend.js",
  "utf8"
);

for (const k of ["subscribe", "stopProfiling", "getProfilingData"]) {
  const re = new RegExp(`['"]${k}['"]`, "g");
  let m;
  let n = 0;
  while ((m = re.exec(s)) && n < 8) {
    console.log(`\n--- '${k}' @ ${m.index} ---`);
    console.log(s.slice(Math.max(0, m.index - 80), m.index + 120));
    n++;
  }
}
