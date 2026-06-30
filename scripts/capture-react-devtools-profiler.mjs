/**
 * React DevTools Profiler capture — official backend + WS frontend protocol.
 * No app instrumentation. Requires REACT_PROFILE_BUILD=1 production build.
 *
 * Usage:
 *   REACT_PROFILE_BUILD=1 npm run build   (or npx cross-env REACT_PROFILE_BUILD=1 npx next build)
 *   npm start
 *   node scripts/capture-react-devtools-profiler.mjs
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import puppeteer from "puppeteer";
import { summarizeOperationsBatches } from "./decode-devtools-operations.mjs";
import { WebSocketServer } from "ws";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = process.env.PROFILE_BASE_URL ?? "http://localhost:3000";
const PORT = 8097;
const ROUTES = ["/", "/teams", "/rankings"];
const OUT = path.join(ROOT, ".cursor", "react-profiler");
const BACKEND_PATH = path.join(
  ROOT,
  "node_modules/react-devtools/node_modules/react-devtools-core/dist/backend.js"
);

mkdirSync(OUT, { recursive: true });

class DevToolsFrontend {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.events = [];
    this.profilingData = null;
    this.operations = [];
    this.profilingStatus = null;
    this.backendVersion = null;
    this.rendererID = 1;
    this.lastError = null;
  }

  resetCapture() {
    this.profilingData = null;
    this.operations = [];
    this.lastError = null;
  }

  send(event, payload) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({ event, payload }));
    }
  }

  onMessage(data) {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    this.events.push({ dir: "in", at: Date.now(), ...msg });
    if (msg.event === "profilingData") this.profilingData = msg.payload;
    if (msg.event === "operations") this.operations.push(msg.payload);
    if (msg.event === "profilingStatus") this.profilingStatus = msg.payload;
    if (msg.event === "backendVersion") this.backendVersion = msg.payload;
  }

  async waitFor(fn, timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (fn()) return true;
      await sleep(50);
    }
    return false;
  }

  async ensureProfilingActive() {
    await this.waitFor(() => this.backendVersion != null, 10000);
    await this.waitFor(() => this.operations.length > 0, 15000);
    this.send("startProfiling", true);
    await this.waitFor(() => this.profilingStatus === true, 5000);
  }

  async stopAndExport() {
    this.send("stopProfiling");
    await sleep(400);
    this.profilingData = null;
    this.send("getProfilingData", { rendererID: this.rendererID });
    const ok = await this.waitFor(() => this.profilingData != null, 15000);
    if (!ok) {
      const err = this.events.find((e) => e.event === "error" || e.event === "exception");
      if (err) this.lastError = err;
    }
  }
}

function buildInjectorScript(port) {
  const backend = readFileSync(BACKEND_PATH, "utf8");
  return `
window.__REACT_DEVTOOLS_APPEND_COMPONENT_STACK__ = true;
window.__REACT_DEVTOOLS_COMPONENT_FILTERS__ = [];
try {
  sessionStorage.setItem('React::DevTools::reloadAndProfile', 'true');
  sessionStorage.setItem('React::DevTools::recordChangeDescriptions', 'true');
} catch (e) {}
${backend}
if (window.ReactDevToolsBackend && window.ReactDevToolsBackend.connectToDevTools) {
  window.ReactDevToolsBackend.connectToDevTools({ port: ${port}, host: '127.0.0.1', useHttps: false });
}
`;
}

function startFrontendServer(frontend) {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/javascript" });
    res.end(buildInjectorScript(PORT));
  });

  const wss = new WebSocketServer({ server });
  wss.on("connection", (ws) => {
    frontend.ws = ws;
    frontend.connected = true;
    ws.on("message", (d) => frontend.onMessage(d.toString()));
    ws.on("close", () => {
      frontend.ws = null;
      frontend.connected = false;
    });
    // Start profiling before the page's React renderer attaches.
    frontend.send("startProfiling", true);
    frontend.send("getBridgeProtocol");
    frontend.send("getProfilingStatus");
  });

  return new Promise((resolve) => {
    server.listen(PORT, "127.0.0.1", () => resolve({ server, wss }));
  });
}

function mapEntries(v) {
  if (v instanceof Map) return [...v.entries()];
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.entries(v);
  return [];
}

function resolveFiberName(renderer, fiberId, cache) {
  if (cache.has(fiberId)) return cache.get(fiberId);
  let name = `fiber#${fiberId}`;
  try {
  if (renderer?.getDisplayNameForFiberID) {
      name = renderer.getDisplayNameForFiberID(fiberId, false) || name;
    }
  } catch {
    /* ignore */
  }
  cache.set(fiberId, name);
  return name;
}

function parseProfilingPayload(payload, nameResolver) {
  if (!payload) {
    return {
      commits: [],
      rankedByRenderTime: [],
      top10: [],
      over20ms: [],
      rerenders: [],
      suspended: [],
      totalRenderTime: 0,
      totalCommitTime: 0,
      initialCommitDuration: null,
      largestComponent: null,
      flamegraph: [],
    };
  }

  const roots = payload.dataForRoots ?? payload;
  const rootList = Array.isArray(roots) ? roots : mapEntries(roots).map(([, v]) => v);

  const fiberTotals = new Map();
  const fiberCommitCounts = new Map();
  const commits = [];
  const flamegraph = [];
  const suspended = new Set();
  const nameCache = new Map();

  for (const rootData of rootList) {
    const commitData = rootData.commitData ?? [];
    for (let ci = 0; ci < commitData.length; ci++) {
      const commit = commitData[ci];
      const commitDuration = commit.duration ?? 0;
      const commitNodes = [];

      commits.push({
        index: ci,
        duration: commitDuration,
        effectDuration: commit.effectDuration ?? 0,
        passiveEffectDuration: commit.passiveEffectDuration ?? 0,
        priorityLevel: commit.priorityLevel ?? null,
        timestamp: commit.timestamp ?? null,
        updaterCount: commit.updaters?.length ?? 0,
      });

      for (const [fiberId, actualMs] of commit.fiberActualDurations ?? []) {
        const selfMs =
          (commit.fiberSelfDurations ?? []).find(([id]) => id === fiberId)?.[1] ?? 0;
        const name = nameResolver ? nameResolver(fiberId, nameCache) : `fiber#${fiberId}`;

        if (name === "Suspense" || name.includes("Suspense")) suspended.add(name);

        const prev = fiberTotals.get(fiberId) ?? {
          fiberId,
          name,
          actualDuration: 0,
          selfBaseDuration: 0,
          commitCount: 0,
        };
        prev.actualDuration += actualMs ?? 0;
        prev.selfBaseDuration += selfMs ?? 0;
        prev.commitCount += 1;
        prev.name = name;
        fiberTotals.set(fiberId, prev);

        fiberCommitCounts.set(fiberId, (fiberCommitCounts.get(fiberId) ?? 0) + 1);

        if ((actualMs ?? 0) > 0) {
          commitNodes.push({ fiberId, name, actualDuration: actualMs, selfBaseDuration: selfMs });
        }
      }

      commitNodes.sort((a, b) => b.actualDuration - a.actualDuration);
      flamegraph.push({
        commitIndex: ci,
        commitDuration,
        components: commitNodes.slice(0, 30),
      });
    }
  }

  const ranked = [...fiberTotals.values()].sort((a, b) => b.actualDuration - a.actualDuration);
  const over20 = ranked.filter((c) => c.actualDuration > 20);
  const rerenders = ranked
    .filter((c) => c.commitCount > 1)
    .sort((a, b) => b.commitCount - a.commitCount || b.actualDuration - a.actualDuration);

  const totalRenderTime = ranked.reduce((s, c) => s + c.actualDuration, 0);
  const totalCommitTime = ranked.reduce((s, c) => s + c.selfBaseDuration, 0);
  const initialCommitDuration = commits[0]?.duration ?? null;
  const largestComponent = ranked[0] ?? null;

  return {
    commits,
    rankedByRenderTime: ranked,
    top10: ranked.slice(0, 10),
    over20ms: over20,
    rerenders,
    suspended: [...suspended],
    totalRenderTime,
    totalCommitTime,
    initialCommitDuration,
    largestComponent,
    flamegraph,
  };
}

async function profileRoute(browser, frontend, route) {
  frontend.resetCapture();

  const page = await browser.newPage();
  const injector = buildInjectorScript(PORT);
  await page.evaluateOnNewDocument(injector);

  const networkLog = [];
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("_next/") || u.startsWith(BASE)) {
      networkLog.push({ url: u.split("?")[0].slice(-80), status: res.status() });
    }
  });

  // Single navigation — profiling must be active before React renderer injects (WS handler).
  const navStart = Date.now();
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle0", timeout: 120000 });
  const networkIdleMs = Date.now() - navStart;

  await sleep(3000);
  await frontend.stopAndExport();

  const hookMeta = await page.evaluate(() => {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const paints = performance.getEntriesByType("paint").map((p) => ({
      name: p.name,
      startTime: p.startTime,
    }));
    const resources = performance.getEntriesByType("resource");
    const lastResourceEnd = resources.length
      ? Math.max(...resources.map((r) => r.responseEnd ?? 0))
      : 0;

    let renderer = null;
    if (hook?.rendererInterfaces?.get) renderer = hook.rendererInterfaces.get(1);
    else if (hook?.renderers?.get) {
      const r = hook.renderers.get(1);
      renderer = r?.findFiberByHostInstance ? r : null;
    }

    return {
      hasHook: !!hook,
      hasRendererInterface: !!renderer,
      paints,
      lastResourceEnd,
      heroVisible: !!document.querySelector("h1")?.textContent?.match(/Philippine|Team|Ranking/i),
      readyState: document.readyState,
      renderer,
    };
  });

  const nameResolver = (fiberId, cache) => {
    const key = `${fiberId}`;
    if (cache.has(key)) return cache.get(key);
    return `fiber#${fiberId}`;
  };

  let parsed = parseProfilingPayload(frontend.profilingData, null);

  // Resolve fiber IDs to display names via renderer interface in page context.
  if (frontend.profilingData && parsed.rankedByRenderTime.length) {
    const ids = [
      ...new Set(
        parsed.rankedByRenderTime.map((c) => c.fiberId).concat(
          parsed.flamegraph.flatMap((f) => f.components.map((c) => c.fiberId))
        )
      ),
    ].slice(0, 500);

    const names = await page.evaluate((fiberIds) => {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      const renderer = hook?.rendererInterfaces?.get?.(1);
      const out = {};
      if (!renderer?.getDisplayNameForFiberID) return out;
      for (const id of fiberIds) {
        try {
          out[id] = renderer.getDisplayNameForFiberID(id, false) || `fiber#${id}`;
        } catch {
          out[id] = `fiber#${id}`;
        }
      }
      return out;
    }, ids);

    const resolve = (fiberId, cache) => {
      const key = String(fiberId);
      if (cache.has(key)) return cache.get(key);
      const name = names[fiberId] ?? `fiber#${fiberId}`;
      cache.set(key, name);
      return name;
    };
    parsed = parseProfilingPayload(frontend.profilingData, resolve);
  }

  const fcp = hookMeta.paints?.find((p) => p.name === "first-contentful-paint")?.startTime ?? null;
  const gapAfterNetworkMs =
    fcp != null && hookMeta.lastResourceEnd > 0 ? Math.max(0, fcp - hookMeta.lastResourceEnd) : null;

  const opsSummary = summarizeOperationsBatches(frontend.operations);

  await page.close();

  return {
    route,
    networkIdleMs,
    networkRequestCount: networkLog.length,
    fcpMs: fcp,
    lastResourceEndMs: hookMeta.lastResourceEnd,
    gapAfterNetworkMs,
    hookInfo: {
      hasHook: hookMeta.hasHook,
      hasRendererInterface: hookMeta.hasRendererInterface,
      heroVisible: hookMeta.heroVisible,
    },
    profilingReceived: !!frontend.profilingData,
    profilingError: frontend.lastError ?? null,
    profilingActive: frontend.profilingStatus === true,
    devtoolsBackendConnected: !!frontend.backendVersion,
    operationBatches: frontend.operations.length,
    inboundEvents: [...new Set(frontend.events.map((e) => e.event).filter(Boolean))],
    commitCount: parsed.commits.length,
    commits: parsed.commits,
    top10SlowestComponents: parsed.top10,
    over20ms: parsed.over20ms,
    rerenders: parsed.rerenders.slice(0, 30),
    suspended: parsed.suspended,
    totalRenderTime: parsed.totalRenderTime,
    totalCommitTime: parsed.totalCommitTime,
    initialCommitDuration: parsed.initialCommitDuration,
    largestComponent: parsed.largestComponent,
    rankedByRenderTime: parsed.rankedByRenderTime.slice(0, 100),
    flamegraph: parsed.flamegraph,
    rawProfilingPayload: frontend.profilingData,
    operationsDecoded: opsSummary,
    operationsRawCount: frontend.operations.length,
  };
}

function formatMs(v) {
  return typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(2)} ms` : "n/a";
}

async function main() {
  const frontend = new DevToolsFrontend();
  await startFrontendServer(frontend);
  console.log(`DevTools WS frontend on 127.0.0.1:${PORT}`);
  console.log(`Target: ${BASE}`);
  console.log(`Requires production build with REACT_PROFILE_BUILD=1\n`);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const results = [];

  for (const route of ROUTES) {
    console.log(`Profiling ${route} ...`);
    await sleep(400);
    try {
      results.push(await profileRoute(browser, frontend, route));
    } catch (e) {
      results.push({ route, error: String(e) });
    }
  }

  await browser.close();

  const jsonPath = path.join(OUT, "devtools-profiler-report.json");
  const htmlPath = path.join(OUT, "devtools-profiler-report.html");
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  writeFileSync(htmlPath, buildHtmlReport(results));
  writeFileSync(
    path.join(OUT, "devtools-profiler-raw.json"),
    JSON.stringify(
      results.map((r) => ({ route: r.route, rawProfilingPayload: r.rawProfilingPayload ?? null })),
      null,
      2
    )
  );

  console.log("\n=== React DevTools Profiler Report ===\n");
  for (const r of results) {
    console.log(`\n## ${r.route}`);
    if (r.error) {
      console.log("ERROR:", r.error);
      continue;
    }
    console.log("Network idle:", r.networkIdleMs, "ms");
    console.log("FCP:", formatMs(r.fcpMs));
    console.log("Last resource end:", formatMs(r.lastResourceEndMs));
    console.log("DevTools backend:", r.devtoolsBackendConnected);
    console.log("Profiling payload:", r.profilingReceived);
    console.log("Commits recorded:", r.commitCount);
    console.log("Initial commit duration:", formatMs(r.initialCommitDuration));
    console.log("Total render time:", formatMs(r.totalRenderTime));
    console.log("Total commit (self) time:", formatMs(r.totalCommitTime));
    console.log("Components >20ms:", r.over20ms?.length ?? 0);
    console.log("Re-rendering components:", r.rerenders?.length ?? 0);
    console.log("Suspended:", r.suspended?.length ? r.suspended.join(", ") : "none detected");
    console.log("\nTop 10 slowest components:");
    for (const c of r.top10SlowestComponents ?? []) {
      console.log(
        `  ${c.actualDuration.toFixed(2).padStart(8)}ms render  ${c.selfBaseDuration.toFixed(2).padStart(8)}ms self  ${c.commitCount}x  ${c.name}`
      );
    }
  }
  console.log("\nJSON:", jsonPath);
  console.log("HTML flamegraph report:", htmlPath);
}

function buildHtmlReport(results) {
  const sections = results
    .map((r) => {
      if (r.error) return `<section><h2>${r.route}</h2><pre>${r.error}</pre></section>`;
      const rows = (r.rankedByRenderTime ?? [])
        .slice(0, 50)
        .map(
          (c) =>
            `<tr><td>${c.name}</td><td>${c.actualDuration.toFixed(2)}</td><td>${c.selfBaseDuration.toFixed(2)}</td><td>${c.commitCount}</td></tr>`
        )
        .join("");
      const flame = (r.flamegraph ?? [])
        .map(
          (f) =>
            `<h4>Commit #${f.commitIndex} (${f.commitDuration.toFixed(2)} ms)</h4><ol>${f.components
              .map((c) => `<li>${c.name}: ${c.actualDuration.toFixed(2)} ms</li>`)
              .join("")}</ol>`
        )
        .join("");
      return `<section>
<h2>${r.route}</h2>
<ul>
<li>Network idle: ${r.networkIdleMs} ms</li>
<li>FCP: ${formatMs(r.fcpMs)}</li>
<li>Initial commit: ${formatMs(r.initialCommitDuration)}</li>
<li>Total render: ${formatMs(r.totalRenderTime)}</li>
<li>Total commit (self): ${formatMs(r.totalCommitTime)}</li>
<li>Commits: ${r.commitCount}</li>
</ul>
<h3>Ranked by render time</h3>
<table border="1" cellpadding="4"><tr><th>Component</th><th>Render ms</th><th>Self ms</th><th>Commits</th></tr>${rows}</table>
<h3>Flamegraph (per commit)</h3>${flame}
</section>`;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>React DevTools Profiler</title></head><body>${sections}</body></html>`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
