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

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/javascript" });
  res.end(`${BACKEND}\nwindow.ReactDevToolsBackend.connectToDevTools({port:${PORT},host:'127.0.0.1',useHttps:false});`);
});
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  ws.on("message", () => {});
  ws.send(JSON.stringify({ event: "startProfiling", payload: true }));
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
await page.goto("http://localhost:3000/rankings", { waitUntil: "networkidle0", timeout: 120000 });
await sleep(2000);

const info = await page.evaluate(() => {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const renderers = [];
  hook?.renderers?.forEach((r, id) => {
    renderers.push({
      id,
      version: r.version,
      bundleType: r.bundleType,
      reconcilerVersion: r.reconcilerVersion,
    });
  });
  const ri = hook?.rendererInterfaces?.get?.(1);
  let fiberSample = null;
  for (const root of hook?.getFiberRoots?.(1) ?? []) {
    const f = root.current?.child?.child;
    if (f) {
      fiberSample = {
        actualDuration: f.actualDuration,
        selfBaseDuration: f.selfBaseDuration,
        treeBaseDuration: f.treeBaseDuration,
        name: typeof f.type === "function" ? f.type.name : String(f.type),
      };
      break;
    }
  }
  return {
    rendererCount: hook?.renderers?.size ?? 0,
    renderers,
    hasRendererInterface: !!ri,
    fiberSample,
    reactVersion: window.React?.version,
  };
});

writeFileSync(path.join(ROOT, ".cursor/react-profiler/debug-hook.json"), JSON.stringify(info, null, 2));
console.log(JSON.stringify(info, null, 2));

await browser.close();
server.close();
