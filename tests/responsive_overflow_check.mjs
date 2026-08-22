import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const ROOT_URL = "http://127.0.0.1:8781";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const VIEWPORTS = [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [375, 812]
];
const STATES = [
  { name: "home", tab: "home" },
  { name: "opportunities", tab: "opportunities" },
  { name: "pipeline-all", tab: "pipeline", filter: "all" },
  { name: "pipeline-applied", tab: "pipeline", filter: "applied" },
  { name: "pipeline-active", tab: "pipeline", filter: "active" },
  { name: "pipeline-interview", tab: "pipeline", filter: "interview" },
  { name: "pipeline-offer", tab: "pipeline", filter: "offer" },
  { name: "pipeline-todo", tab: "pipeline", filter: "todo" },
  { name: "pipeline-watch", tab: "pipeline", filter: "watch" },
  { name: "pipeline-closed", tab: "pipeline", filter: "closed" },
  { name: "pipeline-jd", tab: "pipeline", filter: "jd" },
  { name: "interviews", tab: "interviews" },
  { name: "me", tab: "me" }
];

const server = spawn("python", ["-m", "http.server", "8781"], { stdio: "ignore" });
const userDataDir = mkdtempSync(join(tmpdir(), "campus-os-chrome-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=9224",
  `--user-data-dir=${userDataDir}`,
  "about:blank"
], { stdio: "ignore" });

let nextId = 1;
const pending = new Map();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, tries = 80) {
  for (let index = 0; index < tries; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await wait(125);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connectCdp() {
  await waitForHttp(`${ROOT_URL}/index.html`);
  await waitForHttp("http://127.0.0.1:9224/json/version");
  const response = await fetch(`${"http://127.0.0.1:9224/json/new"}?${encodeURIComponent(ROOT_URL + "/index.html")}`, { method: "PUT" });
  const target = await response.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return ws;
}

function cdp(ws, method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(ws, expression) {
  const result = await cdp(ws, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitForReady(ws) {
  for (let index = 0; index < 80; index += 1) {
    const ready = await evaluate(ws, "document.readyState === 'complete' && !!document.querySelector('#app .layout')");
    if (ready) return;
    await wait(100);
  }
  throw new Error("Timed out waiting for app render");
}

async function showState(ws, state) {
  await evaluate(ws, `localStorage.setItem('campus-os-tab', ${JSON.stringify(state.tab)}); location.href = '${ROOT_URL}/index.html?check=${Date.now()}';`);
  await waitForReady(ws);
  if (state.filter) {
    await evaluate(ws, `document.querySelector('[data-filter="${state.filter}"]')?.click()`);
    await wait(60);
  }
}

async function measure(ws) {
  return evaluate(ws, `(() => {
    const tolerance = 2;
    const vw = document.documentElement.clientWidth;
    const overflowers = Array.from(document.querySelectorAll('body, #app, .layout, .screen, .table-panel, .pipeline-row, .jd-record, .copy-card, .story-card, .detail-drawer, a, pre, .tag'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          selector: el.className || el.id || el.tagName,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          text: (el.textContent || '').trim().slice(0, 80)
        };
      })
      .filter((item) => item.right > vw + tolerance || item.left < -tolerance)
      .slice(0, 8);
    return {
      clientWidth: vw,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflowers
    };
  })()`);
}

try {
  const ws = await connectCdp();
  await cdp(ws, "Page.enable");
  await cdp(ws, "Runtime.enable");

  const failures = [];
  for (const [width, height] of VIEWPORTS) {
    await cdp(ws, "Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 767
    });
    for (const state of STATES) {
      await showState(ws, state);
      const result = await measure(ws);
      const hasDocumentOverflow = result.scrollWidth > result.clientWidth + 2 || result.bodyScrollWidth > result.clientWidth + 2;
      if (hasDocumentOverflow || result.overflowers.length) {
        failures.push({ viewport: `${width}x${height}`, state: state.name, ...result });
      }
    }
  }

  ws.close();
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  } else {
    console.log("responsive_overflow_check: all viewports passed");
  }
} finally {
  chrome.kill();
  server.kill();
  await wait(500);
  try {
    rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch {
    // Chrome can hold its profile lock briefly on Windows; this should not fail layout verification.
  }
}
