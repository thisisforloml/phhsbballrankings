import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import puppeteer from "puppeteer";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 8098;
const BACKEND = readFileSync(
  path.join(ROOT, "node_modules/react-devtools/node_modules/react-devtools-core/dist/backend.js"),
  "utf8"
);

let wsRef = null;
let profilingData = null;

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/javascript" });
  res.end(`${BACKEND}\nwindow.ReactDevToolsBackend.connectToDevTools({port:${PORT},host:'127.0.0.1',useHttps:false});`);
});
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  wsRef = ws;
  ws.on("message", (d) => {
    const msg = JSON.parse(d.toString());
    if (msg.event === "profilingData") profilingData = msg.payload;
    if (msg.event === "backendVersion") ws.send(JSON.stringify({ event: "startProfiling", payload: true }));
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(`
try {
  sessionStorage.setItem('React::DevTools::reloadAndProfile', 'true');
  sessionStorage.setItem('React::DevTools::recordChangeDescriptions', 'true');
} catch (e) {}
${BACKEND}
window.ReactDevToolsBackend.connectToDevTools({port:${PORT},host:'127.0.0.1',useHttps:false});
`);

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
await sleep(3000);
wsRef.send(JSON.stringify({ event: "startProfiling", payload: true }));
await sleep(500);
await page.reload({ waitUntil: "networkidle0", timeout: 120000 });
await sleep(3000);

const perf = await page.evaluate(() => {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const renderer = hook?.rendererInterfaces?.get?.(1);
  const marks = performance.getEntriesByType("mark").map((e) => ({ name: e.name, start: e.startTime, dur: e.duration }));
  const measures = performance.getEntriesByType("measure").map((e) => ({
    name: e.name,
    start: e.startTime,
    dur: e.duration,
  }));
  const reactMeasures = measures.filter((m) => /react|⚛|Component/i.test(m.name));
  const reactMarks = marks.filter((m) => /react|⚛|Component/i.test(m.name));

  function walk(fiber, out) {
    if (!fiber) return;
    const ad = fiber.actualDuration ?? 0;
    const sd = fiber.selfBaseDuration ?? 0;
    if (ad > 0 || sd > 0) {
      const t = fiber.type;
      let name = "Unknown";
      if (typeof t === "function") name = t.displayName || t.name || "Anonymous";
      else if (typeof t === "string") name = t;
      out.push({ name, ad, sd });
    }
    let c = fiber.child;
    while (c) {
      walk(c, out);
      c = c.sibling;
    }
  }
  const fibers = [];
  for (const root of hook?.getFiberRoots?.(1) ?? []) walk(root.current, fibers);
  fibers.sort((a, b) => b.ad - a.ad);

  return {
    supportsProfiling: renderer?.supportsProfiling,
    measureCount: measures.length,
    reactMeasureCount: reactMeasures.length,
    reactMeasures: reactMeasures.slice(0, 30),
    reactMarks: reactMarks.slice(0, 30),
    topFibers: fibers.slice(0, 20),
    fiberCount: fibers.length,
  };
});

wsRef.send(JSON.stringify({ event: "stopProfiling" }));
await sleep(500);
wsRef.send(JSON.stringify({ event: "getProfilingData", payload: { rendererID: 1 } }));
await sleep(2000);

writeFileSync(
  path.join(ROOT, ".cursor/react-profiler/debug-perf.json"),
  JSON.stringify({ perf, profilingData }, null, 2)
);
console.log(JSON.stringify(perf, null, 2));
console.log("profilingData", profilingData ? Object.keys(profilingData) : null);
if (profilingData) {
  const roots = profilingData.dataForRoots;
  const first = Array.isArray(roots) ? roots[0] : null;
  console.log("commits", first?.commitData?.length);
}

await browser.close();
server.close();
