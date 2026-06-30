/**
 * React DevTools Profiler capture for production build.
 * Uses official react-devtools standalone (WS on 8097) + Puppeteer.
 * No app instrumentation.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = process.env.PROFILE_BASE_URL ?? "http://localhost:3000";
const ROUTES = ["/", "/teams", "/rankings"];
const OUT_DIR = path.join(ROOT, ".cursor", "react-profiler");

mkdirSync(OUT_DIR, { recursive: true });

function startDevTools() {
  const bin = path.join(ROOT, "node_modules", "react-devtools", "bin.js");
  const child = spawn(process.execPath, [bin], {
    cwd: ROOT,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  return child;
}

async function waitForPort(port, ms = 30000) {
  const net = await import("node:net");
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      await new Promise((resolve, reject) => {
        const s = net.connect(port, "127.0.0.1");
        s.on("connect", () => {
          s.end();
          resolve(true);
        });
        s.on("error", reject);
      });
      return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

async function profileRoute(browser, route) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
  window.__REACT_DEVTOOLS_PORT__ = 8097;
  });

  const resourceEnds = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("_next/static") || url.includes("localhost:3000")) {
      try {
        resourceEnds.push({ url: url.split("?")[0].slice(-60), status: res.status() });
      } catch {
        /* ignore */
      }
    }
  });

  const navStart = Date.now();
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle0", timeout: 120000 });
  const networkIdleAt = Date.now() - navStart;

  // Allow React commits after network idle
  await sleep(3000);

  const profile = await page.evaluate(async () => {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) return { error: "no hook" };

    const renderers = hook.renderers ?? new Map();
    const rendererList = typeof renderers.values === "function" ? [...renderers.values()] : [];

    function fiberName(fiber) {
      if (!fiber) return "Unknown";
      const t = fiber.type;
      if (typeof t === "string") return t;
      if (typeof t === "function") return t.displayName || t.name || "Anonymous";
      if (t && typeof t === "object" && t.displayName) return t.displayName;
      return "Unknown";
    }

    function walkFiber(fiber, out, depth = 0) {
      if (!fiber) return;
      const duration = fiber.actualDuration ?? 0;
      const selfDuration = fiber.selfBaseDuration ?? 0;
      const treeDuration = fiber.treeBaseDuration ?? 0;
      if (duration > 0 || selfDuration > 0) {
        out.push({
          name: fiberName(fiber),
          actualDuration: duration,
          selfBaseDuration: selfDuration,
          treeBaseDuration: treeDuration,
          depth,
        });
      }
      let child = fiber.child;
      while (child) {
        walkFiber(child, out, depth + 1);
        child = child.sibling;
      }
    }

    const components = [];
    const roots = [];
    try {
      if (hook.getFiberRoots) {
        for (const root of hook.getFiberRoots(1) ?? []) {
          roots.push(root);
          walkFiber(root.current, components);
        }
      }
    } catch (e) {
      return { error: String(e), hookKeys: Object.keys(hook) };
    }

    const paints = performance.getEntriesByType("paint").map((p) => ({ name: p.name, startTime: p.startTime }));
    const measures = performance.getEntriesByType("measure").map((m) => ({
      name: m.name,
      duration: m.duration,
      startTime: m.startTime,
    }));

    // Suspense detection via fiber type
    const suspended = components
      .filter((c) => c.name.includes("Suspense") || c.name === "Suspense")
      .map((c) => c.name);

    const sorted = [...components].sort((a, b) => (b.actualDuration || 0) - (a.actualDuration || 0));
    const over20 = sorted.filter((c) => (c.actualDuration || 0) > 20);

    const totalRenderEstimate = sorted.reduce((s, c) => s + (c.actualDuration || 0), 0);

    return {
      rendererCount: rendererList.length,
      rootCount: roots.length,
      componentCount: components.length,
      suspended,
      paints,
      measures,
      top10: sorted.slice(0, 10),
      over20ms: over20,
      totalRenderEstimate,
      rankedByRenderTime: sorted.slice(0, 50),
      initialCommitEstimate: sorted.reduce((max, c) => Math.max(max, c.actualDuration || 0), 0),
      largestComponent: sorted[0] ?? null,
      htmlLen: document.documentElement.outerHTML.length,
      heroVisible: !!document.querySelector("h1")?.textContent?.includes("Philippine"),
    };
  });

  await page.close();

  return {
    route,
    networkIdleMs: networkIdleAt,
    resourcesLoaded: resourceEnds.length,
    ...profile,
  };
}

async function main() {
  console.log("Starting react-devtools standalone on :8097 ...");
  startDevTools();
  const ready = await waitForPort(8097, 45000);
  if (!ready) {
    console.error("react-devtools did not open port 8097 (Electron may be blocked in CI)");
    console.error("Falling back to fiber profiling without DevTools session...");
  }

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const results = [];

  for (const route of ROUTES) {
    console.log(`Profiling ${route} ...`);
    try {
      results.push(await profileRoute(browser, route));
    } catch (e) {
      results.push({ route, error: String(e) });
    }
  }

  await browser.close();

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(results, null, 2));
  console.log("\n=== React Profiler Report ===\n");
  for (const r of results) {
    console.log(`\n## ${r.route}`);
    if (r.error) {
      console.log("ERROR:", r.error);
      continue;
    }
    console.log("Network idle (wall):", r.networkIdleMs, "ms");
    console.log("Initial commit (max fiber actualDuration):", r.initialCommitEstimate?.toFixed?.(2) ?? r.initialCommitEstimate, "ms");
    console.log("Largest component:", r.largestComponent?.name, r.largestComponent?.actualDuration?.toFixed?.(2), "ms");
    console.log("Total render estimate (sum actualDuration):", r.totalRenderEstimate?.toFixed?.(2), "ms");
    console.log("Components >20ms:", r.over20ms?.length ?? 0);
    console.log("Suspended:", r.suspended?.length ? r.suspended : "none detected");
    console.log("Hero visible:", r.heroVisible);
    console.log("\nTop 10 slowest:");
    for (const c of r.top10 ?? []) {
      console.log(`  ${(c.actualDuration ?? 0).toFixed(2).padStart(8)}ms  ${c.name}`);
    }
  }
  console.log("\nFull JSON:", path.join(OUT_DIR, "report.json"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
