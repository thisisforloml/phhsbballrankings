/**
 * Enhanced bootstrap probe with script execution + hydration detection.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const url = process.argv[2] ?? "http://localhost:3000/";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer");

const INJECT = `
(() => {
  window.__boot = { t0: performance.timeOrigin, events: [] };
  const log = (name, extra) => {
    const t = Math.round(performance.now());
    window.__boot.events.push({ name, t, ...extra });
    try { performance.mark(name); } catch {}
  };
  log("probe-start");

  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.entryType === "paint") log(e.name, { paint: e.startTime });
      if (e.entryType === "resource" && (e.name.endsWith(".js") || e.name.includes("fonts"))) {
        log("resource-end", { url: e.name.slice(-60), end: Math.round(e.responseEnd) });
      }
    }
  }).observe({ type: "paint", buffered: true });
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.entryType === "resource") {
          const n = e.name;
          if (n.endsWith(".js") || n.includes("font") || n.endsWith(".css")) {
            log("res", { url: n.split("?")[0].slice(-70), start: Math.round(e.startTime), end: Math.round(e.responseEnd), dur: Math.round(e.duration), size: e.transferSize });
          }
        }
      }
    }).observe({ type: "resource", buffered: true });
  } catch {}

  const origAppend = document.head.appendChild.bind(document.head);
  document.head.appendChild = function (node) {
    if (node?.tagName === "SCRIPT" && node.src && !window.__boot.firstScriptAppend) {
      log("first-script-append", { src: node.src.slice(-60) });
      window.__boot.firstScriptAppend = node.src;
    }
    return origAppend(node);
  };

  document.addEventListener("DOMContentLoaded", () => log("dom-content-loaded"));
  window.addEventListener("load", () => log("window-load"));

  const poll = setInterval(() => {
    const h1 = document.querySelector("h1");
    if (h1?.textContent?.includes("Philippine") && !window.__boot.heroVisible) {
      log("hero-h1-visible");
      window.__boot.heroVisible = true;
    }
    const next = document.getElementById("__next");
    if (next?.innerHTML?.length > 100 && !window.__boot.nextPopulated) {
      log("next-populated");
      window.__boot.nextPopulated = true;
    }
    if (window.__NEXT_DATA__ || window.next?.version) log("next-runtime-detected");
  }, 10);

  setTimeout(() => clearInterval(poll), 60000);
})();
`;

async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(INJECT);

  const scriptParsed = [];
  const cdp = await page.createCDPSession();
  await cdp.send("Performance.enable");
  cdp.on("Performance.scriptParsed", (e) => {
    if (e.url.includes("_next/static") || e.url.includes("node_modules")) {
      scriptParsed.push({ url: e.url.split("/").pop(), start: Date.now() });
    }
  });

  const t0 = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  const dcl = Date.now() - t0;

  await page.waitForFunction(
    () => document.querySelector("h1")?.textContent?.includes("Philippine"),
    { timeout: 120000 }
  ).catch(() => null);
  const hero = Date.now() - t0;

  await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => null);
  const idle = Date.now() - t0;

  const snapshot = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const scripts = resources
      .filter((r) => r.initiatorType === "script" || r.name.includes(".js"))
      .map((r) => ({
        file: r.name.split("/").pop()?.split("?")[0],
        start: Math.round(r.startTime),
        end: Math.round(r.responseEnd),
        dur: Math.round(r.duration),
        transfer: r.transferSize,
        encoded: r.encodedBodySize,
      }))
      .sort((a, b) => a.start - b.start);

    const fonts = resources.filter((r) => r.name.includes("font") || r.name.includes("gstatic"));
    const css = resources.filter((r) => r.name.endsWith(".css") || r.name.includes("/css/"));

    const paints = performance.getEntriesByType("paint").map((p) => ({ name: p.name, t: Math.round(p.startTime) }));

    const isNextApp = !!document.querySelector("script[src*='_next/static']");
    const title = document.title;
    const bodyPreview = document.body?.innerText?.slice(0, 200) ?? "";

    return {
      events: window.__boot?.events ?? [],
      navigation: nav
        ? {
            responseEnd: Math.round(nav.responseEnd),
            domInteractive: Math.round(nav.domInteractive),
            dcl: Math.round(nav.domContentLoadedEventEnd),
            load: Math.round(nav.loadEventEnd),
          }
        : null,
      scripts,
      fonts: fonts.map((f) => ({ url: f.name.split("/").pop(), start: Math.round(f.startTime), end: Math.round(f.endTime), transfer: f.transferSize })),
      css: css.map((c) => ({ url: c.name.split("/").pop()?.slice(0, 40), start: Math.round(c.startTime), end: Math.round(c.responseEnd), transfer: c.transferSize })),
      paints,
      isNextApp,
      title,
      bodyPreview,
      htmlLen: document.documentElement.outerHTML.length,
      scriptTags: [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")),
      blockingStylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href),
    };
  });

  await browser.close();

  const report = { url, wall: { dcl, hero, idle }, scriptParsed: scriptParsed.length, ...snapshot };
  const tag = url.includes("localhost") ? "local-v2" : "prod-v2";
  writeFileSync(`.cursor/bootstrap-report-${tag}.json`, JSON.stringify(report, null, 2));

  console.log("\n=== Enhanced Bootstrap:", url, "===\n");
  console.log("Title:", snapshot.title);
  console.log("Is Next.js app:", snapshot.isNextApp);
  console.log("HTML received:", snapshot.navigation?.responseEnd, "ms");
  console.log("DOM interactive:", snapshot.navigation?.domInteractive, "ms");
  console.log("DOMContentLoaded:", snapshot.navigation?.dcl, "ms | wall", dcl, "ms");
  console.log("FCP:", snapshot.paints.find((p) => p.name === "first-contentful-paint")?.t);
  console.log("Hero h1 visible (wall):", hero, "ms");
  console.log("Network idle (wall):", idle, "ms");
  console.log("\nBlocking stylesheets:");
  snapshot.blockingStylesheets.forEach((s) => console.log(" ", s));
  console.log("\nScript waterfall (start → end | transfer bytes):");
  let totalTransfer = 0;
  for (const s of snapshot.scripts) {
    totalTransfer += s.transfer || 0;
    console.log(`  ${String(s.start).padStart(5)} → ${String(s.end).padStart(5)}  ${String(s.transfer).padStart(7)}B  ${s.file}`);
  }
  console.log("Total script transfer (resource timing):", totalTransfer, "bytes");
  console.log("\nFont downloads:");
  for (const f of snapshot.fonts) console.log(`  ${f.start} → ${f.end}  ${f.transfer}B  ${f.url}`);
  console.log("\nKey events:");
  for (const e of snapshot.events.filter((x) => !x.url?.includes("resource"))) console.log(`  ${e.t}ms  ${e.name}`, e.src ?? "");
  console.log("\nBody preview:", JSON.stringify(snapshot.bodyPreview.slice(0, 120)));
  console.log("\nReport: .cursor/bootstrap-report-" + tag + ".json");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
