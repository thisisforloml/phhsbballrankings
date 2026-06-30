import puppeteer from "puppeteer";
import { readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 8097;
const BACKEND = readFileSync(
  path.join(ROOT, "node_modules/react-devtools/node_modules/react-devtools-core/dist/backend.js"),
  "utf8"
);
const events = [];

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/javascript" });
  res.end(`
${BACKEND}
window.ReactDevToolsBackend.connectToDevTools({ port: ${PORT}, host: '127.0.0.1', useHttps: false });
`);
});
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  ws.on("message", (d) => {
    const msg = JSON.parse(d.toString());
    events.push(msg);
    console.log("IN", msg.event, JSON.stringify(msg.payload)?.slice(0, 120));
    if (msg.event === "backendVersion") {
      ws.send(JSON.stringify({ event: "startProfiling", payload: true }));
    }
    if (msg.event === "profilingStatus" && msg.payload === true) {
      console.log("-> profiling ON");
    }
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(`
${BACKEND}
window.ReactDevToolsBackend.connectToDevTools({ port: ${PORT}, host: '127.0.0.1', useHttps: false });
`);
await page.goto("about:blank");
await sleep(1000);
await page.goto("http://localhost:3000/", { waitUntil: "networkidle0", timeout: 120000 });
await sleep(2000);
const ws = [...wss.clients][0];
ws.send(JSON.stringify({ event: "stopProfiling" }));
await sleep(500);
ws.send(JSON.stringify({ event: "getProfilingData", payload: { rendererID: 1 } }));
await sleep(2000);

const check = await page.evaluate(() => {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const r = hook?.rendererInterfaces?.get?.(1);
  return {
    hasRI: !!r,
    supportsProfiling: !!r?.supportsProfiling,
    // @ts-expect-error internal
    profilingBuild: typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined",
  };
});
console.log("page check", check);
console.log("profilingData events", events.filter((e) => e.event === "profilingData").length);
for (const e of events.filter((e) => e.event === "profilingStatus")) console.log("status", e.payload);

await browser.close();
server.close();
