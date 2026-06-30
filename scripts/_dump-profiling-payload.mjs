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

let profilingData = null;
const events = [];

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/javascript" });
  res.end(`${BACKEND}\nwindow.ReactDevToolsBackend.connectToDevTools({port:${PORT},host:'127.0.0.1',useHttps:false});`);
});
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  ws.on("message", (d) => {
    const msg = JSON.parse(d.toString());
    events.push(msg.event);
    if (msg.event === "profilingData") profilingData = msg.payload;
    if (msg.event === "operations") {
      ws.send(JSON.stringify({ event: "startProfiling", payload: true }));
    }
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
await sleep(2000);
const ws = [...wss.clients][0];
ws.send(JSON.stringify({ event: "startProfiling", payload: true }));
await sleep(500);
await page.reload({ waitUntil: "networkidle0", timeout: 120000 });
await sleep(2000);
ws.send(JSON.stringify({ event: "stopProfiling" }));
await sleep(500);
profilingData = null;
ws.send(JSON.stringify({ event: "getProfilingData", payload: { rendererID: 1 } }));
await sleep(2000);

writeFileSync(
  path.join(ROOT, ".cursor/react-profiler/debug-raw.json"),
  JSON.stringify({ events, profilingData }, null, 2)
);
console.log("events", [...new Set(events)]);
console.log("payload keys", profilingData ? Object.keys(profilingData) : null);
if (profilingData?.dataForRoots) {
  console.log("roots type", Array.isArray(profilingData.dataForRoots) ? "array" : typeof profilingData.dataForRoots);
  const roots = profilingData.dataForRoots;
  const first = Array.isArray(roots) ? roots[0] : roots?.[0] ?? Object.values(roots ?? {})[0];
  console.log("first root keys", first ? Object.keys(first) : null);
  console.log("commitData len", first?.commitData?.length);
  if (first?.commitData?.[0]) console.log("first commit keys", Object.keys(first.commitData[0]));
}

await browser.close();
server.close();
