/**
 * Temporary bootstrap waterfall probe — read-only measurement, no app changes.
 * Usage: node scripts/measure-bootstrap.mjs [url]
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const url = process.argv[2] ?? "http://localhost:3000/";
const require = createRequire(import.meta.url);

let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch {
  console.error("puppeteer not installed. Run: npm install -D puppeteer");
  process.exit(1);
}

const PROBE = `
(() => {
  const t0 = performance.timeOrigin;
  const marks = { timeOrigin: t0 };
  const mark = (name) => {
    marks[name] = performance.now();
    try { performance.mark(name); } catch {}
  };
  mark("probe-injected");

  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.entryType === "paint" && e.name === "first-contentful-paint") {
        marks.fcp = e.startTime;
      }
    }
  });
  try { obs.observe({ type: "paint", buffered: true }); } catch {}

  const hookReact = () => {
    if (marks.hydrateStart) return;
    const desc = Object.getOwnPropertyDescriptor(HTMLDivElement.prototype, "innerHTML");
    if (!desc?.set) return;
    const orig = desc.set;
    let seen = 0;
    Object.defineProperty(HTMLDivElement.prototype, "innerHTML", {
      configurable: true,
      get: desc.get,
      set(v) {
        if (!marks.hydrateStart && typeof v === "string" && v.includes("__next_f")) {
          mark("hydrateStart");
        }
        return orig.call(this, v);
      },
    });
  };
  hookReact();

  const pollReact = setInterval(() => {
    const root = document.getElementById("__next");
    if (root && root.childElementCount > 0 && !marks.hydrateComplete) {
      mark("hydrateComplete");
      clearInterval(pollReact);
    }
  }, 16);

  window.__bootstrapMarks = marks;
  window.__bootstrapDone = () => {
    clearInterval(pollReact);
    return marks;
  };
})();
`;

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(PROBE);

  const cdp = await page.createCDPSession();
  await cdp.send("Performance.enable");
  await cdp.send("Network.enable");

  const networkEvents = [];
  cdp.on("Network.responseReceived", (e) => {
    const { response, type } = e;
    if (response.url.includes("_next/static") || response.url.includes("fonts.googleapis") || response.url.includes("fonts.gstatic")) {
      networkEvents.push({
        url: response.url.split("?")[0].slice(-80),
        fullUrl: response.url,
        mime: response.mimeType,
        type,
        status: response.status,
      });
    }
  });

  const navStart = Date.now();
  const response = await page.goto(url, { waitUntil: "load", timeout: 120000 });
  const loadDone = Date.now();

  await page.waitForFunction(() => {
    const root = document.getElementById("__next");
    return root && root.childElementCount > 0;
  }, { timeout: 120000 }).catch(() => null);

  const hydratedAt = Date.now();
  await new Promise((r) => setTimeout(r, 500));

  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource").map((r) => ({
      name: r.name.split("?")[0].slice(-100),
      initiatorType: r.initiatorType,
      startTime: Math.round(r.startTime),
      responseEnd: Math.round(r.responseEnd),
      duration: Math.round(r.duration),
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
    }));

    const scripts = resources.filter((r) => r.initiatorType === "script" || r.name.endsWith(".js"));
    const css = resources.filter((r) => r.initiatorType === "link" || r.name.endsWith(".css"));

    const marks = window.__bootstrapMarks ?? {};
    const paints = performance.getEntriesByType("paint").map((p) => ({ name: p.name, startTime: Math.round(p.startTime) }));

    const firstScript = scripts.sort((a, b) => a.startTime - b.startTime)[0];
    const lastScript = scripts.sort((a, b) => b.responseEnd - a.responseEnd)[0];
    const layoutCss = css.find((c) => c.name.includes("layout")) ?? css[0];

    const htmlLen = document.documentElement.outerHTML.length;
    const bodyChildCount = document.body?.childElementCount ?? 0;
    const nextChildCount = document.getElementById("__next")?.childElementCount ?? 0;

    const headLinks = [...document.querySelectorAll("head link, head style, head script")].map((el) => ({
      tag: el.tagName,
      rel: el.getAttribute("rel"),
      href: (el.getAttribute("href") ?? el.getAttribute("src") ?? "").slice(0, 120),
      blocking: el.tagName === "LINK" && el.getAttribute("rel") === "stylesheet" && !el.media,
    }));

    return {
      marks,
      paints,
      navigation: nav
        ? {
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
            loadEventEnd: Math.round(nav.loadEventEnd),
            responseEnd: Math.round(nav.responseEnd),
            domInteractive: Math.round(nav.domInteractive),
            transferSize: nav.transferSize,
          }
        : null,
      firstScript,
      lastScript,
      layoutCss,
      scriptCount: scripts.length,
      cssCount: css.length,
      scripts: scripts.sort((a, b) => a.startTime - b.startTime),
      css,
      htmlLen,
      bodyChildCount,
      nextChildCount,
      headLinks,
      status: document.readyState,
    };
  });

  const metrics = await cdp.send("Performance.getMetrics");
  await browser.close();

  const report = {
    url,
    wallClock: {
      navigationStart: 0,
      htmlReceived: data.navigation?.responseEnd ?? null,
      loadEvent: loadDone - navStart,
      hydratedWall: hydratedAt - navStart,
    },
    ...data,
    cdpMetrics: Object.fromEntries(metrics.metrics.map((m) => [m.name, m.value])),
    networkSample: networkEvents.slice(0, 40),
  };

  const outPath = `.cursor/bootstrap-report-${url.includes("localhost") ? "local" : "prod"}.json`;
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n=== Bootstrap Waterfall:", url, "===\n");
  console.log("HTML received (responseEnd):     ", report.navigation?.responseEnd, "ms");
  console.log("DOM interactive:                 ", report.navigation?.domInteractive, "ms");
  console.log("First Contentful Paint:          ", report.paints.find((p) => p.name === "first-contentful-paint")?.startTime ?? "n/a", "ms");
  console.log("DOMContentLoaded:                ", report.navigation?.domContentLoaded, "ms");
  console.log("Load event:                      ", report.navigation?.loadEventEnd, "ms");
  console.log("First script resource start:     ", report.firstScript?.startTime, "ms", report.firstScript?.name);
  console.log("Last script resource end:        ", report.lastScript?.responseEnd, "ms", report.lastScript?.name);
  console.log("Layout CSS applied (responseEnd):", report.layoutCss?.responseEnd, "ms", report.layoutCss?.name);
  console.log("Google Fonts CSS:                ", report.css.find((c) => c.name.includes("fonts.googleapis")) ?? "not in resource timing");
  console.log("HTML size (chars):               ", report.htmlLen);
  console.log("__next children:                 ", report.nextChildCount);
  console.log("Script bundles:", report.scriptCount);
  console.log("Wall clock to load:              ", report.wallClock.loadEvent, "ms");
  console.log("Wall clock to hydrated DOM:      ", report.wallClock.hydratedWall, "ms");
  console.log("\nHead blocking resources:");
  for (const l of report.headLinks.filter((h) => h.blocking || h.tag === "SCRIPT")) {
    console.log(" ", l.tag, l.rel ?? "", l.href);
  }
  console.log("\nScripts (start → end ms):");
  for (const s of report.scripts) {
    console.log(`  ${String(s.startTime).padStart(6)} → ${String(s.responseEnd).padStart(6)}  ${s.duration}ms  ${s.name}`);
  }
  console.log("\nFull report:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
