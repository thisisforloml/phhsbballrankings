/**
 * HTTP streaming profiler for Next.js App Router RSC responses.
 *
 * Usage:
 *   node scripts/profile-rsc-stream.mjs
 *   node scripts/profile-rsc-stream.mjs --url http://localhost:3000/rankings
 *   node scripts/profile-rsc-stream.mjs --start-server
 *
 * With --start-server:
 *   POST_PRISMA_PROFILE=1 PORT=3010 next start
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { brotliCompressSync, gzipSync } from "node:zlib";

const outDir = path.join(process.cwd(), ".cursor", "post-prisma-profile");
mkdirSync(outDir, { recursive: true });

function parseArgs(argv) {
  const args = { url: "http://localhost:3010/rankings", startServer: false, port: 3010 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--url" && argv[i + 1]) args.url = argv[++i];
    else if (argv[i] === "--start-server") args.startServer = true;
    else if (argv[i] === "--port" && argv[i + 1]) args.port = Number(argv[++i]);
  }
  if (args.startServer && !argv.includes("--url")) {
    args.url = `http://localhost:${args.port}/rankings`;
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 120_000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      /* retry */
    }
    await sleep(1000);
  }
  return false;
}

function analyzeHtmlBody(bodyText) {
  const flightChunkRegex = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;
  const rscLineRegex = /^([0-9A-Za-z]+):([\s\S]*)$/gm;

  let flightInlineBytes = 0;
  let flightChunkCount = 0;
  let match;
  while ((match = flightChunkRegex.exec(bodyText)) !== null) {
    flightChunkCount += 1;
    flightInlineBytes += Buffer.byteLength(match[1], "utf8");
  }

  const scriptBlocks = [...bodyText.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const scriptBytes = scriptBlocks.reduce((sum, block) => sum + Buffer.byteLength(block, "utf8"), 0);

  const htmlWithoutScripts = bodyText.replace(/<script[\s\S]*?<\/script>/gi, "");
  const htmlShellBytes = Buffer.byteLength(htmlWithoutScripts, "utf8");

  const rscLines = [];
  for (const block of scriptBlocks) {
    let lineMatch;
    rscLineRegex.lastIndex = 0;
    while ((lineMatch = rscLineRegex.exec(block)) !== null) {
      rscLines.push({ id: lineMatch[1], bytes: Buffer.byteLength(lineMatch[2], "utf8") });
    }
  }

  const largestRscLine = rscLines.reduce(
    (max, line) => (line.bytes > max.bytes ? line : max),
    { id: "", bytes: 0 }
  );

  return {
    flightChunkCount,
    flightInlineBytes,
    scriptBytes,
    htmlShellBytes,
    rscLineCount: rscLines.length,
    largestRscLine,
    totalRscPayloadBytes: rscLines.reduce((sum, line) => sum + line.bytes, 0),
  };
}

async function profileStream(url) {
  const fetchStart = performance.now();
  const res = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Encoding": "identity",
      "Cache-Control": "no-cache, no-store",
    },
    redirect: "follow",
  });

  const headersReceivedAt = performance.now();
  const ttfbMs = headersReceivedAt - fetchStart;

  if (!res.body) {
    throw new Error("Response has no body stream");
  }

  const reader = res.body.getReader();
  const chunks = [];
  let firstChunkAt = null;
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!firstChunkAt) firstChunkAt = performance.now();
    chunks.push(value);
    totalBytes += value.byteLength;
  }

  const streamEndAt = performance.now();
  const bodyBuffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const bodyText = bodyBuffer.toString("utf8");

  const gzipBytes = gzipSync(bodyBuffer).byteLength;
  const brotliBytes = brotliCompressSync(bodyBuffer).byteLength;
  const htmlAnalysis = analyzeHtmlBody(bodyText);

  return {
    url,
    status: res.status,
    contentType: res.headers.get("content-type"),
    contentEncoding: res.headers.get("content-encoding"),
    transferEncoding: res.headers.get("transfer-encoding"),
    timingMs: {
      ttfb: Math.round(ttfbMs),
      firstChunk: firstChunkAt ? Math.round(firstChunkAt - fetchStart) : null,
      streamComplete: Math.round(streamEndAt - fetchStart),
      streamBodyOnly: firstChunkAt ? Math.round(streamEndAt - firstChunkAt) : null,
    },
    bytes: {
      rawTotal: totalBytes,
      gzip: gzipBytes,
      brotli: brotliBytes,
      chunkCount: chunks.length,
      firstChunkBytes: chunks[0]?.byteLength ?? 0,
      lastChunkBytes: chunks[chunks.length - 1]?.byteLength ?? 0,
    },
    html: htmlAnalysis,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  let serverProc = null;

  if (args.startServer) {
    const buildDir = path.join(process.cwd(), ".next");
    if (!existsSync(buildDir)) {
      throw new Error("Missing .next build. Run `npm run build` first.");
    }

    serverProc = spawn("npm", ["run", "start", "--", "-p", String(args.port)], {
      cwd: process.cwd(),
      shell: true,
      env: {
        ...process.env,
        PORT: String(args.port),
        POST_PRISMA_PROFILE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const ready = await waitForServer(args.url);
    if (!ready) {
      serverProc.kill();
      throw new Error(`Server did not become ready at ${args.url}`);
    }
  }

  try {
    const report = await profileStream(args.url);
    const serverProfilePath = path.join(outDir, "rankings-server.json");
    let serverProfile = null;
    if (existsSync(serverProfilePath)) {
      serverProfile = JSON.parse(readFileSync(serverProfilePath, "utf8"));
    }

    const combined = {
      generatedAt: new Date().toISOString(),
      http: report,
      serverStages: serverProfile,
      waterfall: [
        {
          stage: "db+loaders (server report)",
          ms: serverProfile?.stages?.find((s) => s.name === "loader.getLatestNationalRankings.done")?.cumulativeMs ?? null,
        },
        {
          stage: "post-prisma transform+serialize (server report)",
          ms: serverProfile
            ? Math.round(
                (serverProfile.stages ?? [])
                  .filter((s) => s.name.startsWith("transform.") || s.name.startsWith("json.stringify."))
                  .reduce((sum, s) => sum + s.deltaMs, 0)
              )
            : null,
        },
        {
          stage: "ttfb (client fetch)",
          ms: report.timingMs.ttfb,
        },
        {
          stage: "first streamed chunk",
          ms: report.timingMs.firstChunk,
        },
        {
          stage: "stream complete",
          ms: report.timingMs.streamComplete,
        },
      ],
    };

    const outPath = path.join(outDir, "rankings-http-stream.json");
    writeFileSync(outPath, JSON.stringify(combined, null, 2), "utf8");
    console.log(JSON.stringify(combined, null, 2));
  } finally {
    if (serverProc) {
      serverProc.kill();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
