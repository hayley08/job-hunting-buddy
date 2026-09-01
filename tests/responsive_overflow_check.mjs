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
  { name: "pipeline-in-progress", tab: "pipeline", filter: "inProgress" },
  { name: "pipeline-applied", tab: "pipeline", filter: "applied" },
  { name: "pipeline-active", tab: "pipeline", filter: "active" },
  { name: "pipeline-interview", tab: "pipeline", filter: "interview" },
  { name: "pipeline-offer", tab: "pipeline", filter: "offer" },
  { name: "pipeline-todo", tab: "pipeline", filter: "todo" },
  { name: "pipeline-watch", tab: "pipeline", filter: "watch" },
  { name: "pipeline-closed", tab: "pipeline", filter: "closed" },
  { name: "pipeline-jd", tab: "pipeline", filter: "jd" },
  { name: "assessments", tab: "assessments" },
  { name: "assessment-details", tab: "assessments", details: true },
  { name: "assessment-modal", tab: "assessments", modal: true },
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
  const assessmentDraft = [{
    testId: "test-local-responsive",
    company: "响应式测试公司",
    jobTitle: "人力资源管理培训生（组织发展与人才发展方向）",
    jobId: "",
    assessmentScope: "海测",
    testType: ["笔试｜行测 + 图推 + 性格测试", "AI 面试", "英语面试"],
    customTestType: "",
    status: "待完成",
    dueAt: "09-04",
    completedAt: "",
    testPlatform: "企业自建",
    duration: "90–120 分钟",
    repeatEntry: "不可重复进入",
    testUrl: "https://example.com/assessment/very-long-responsive-test-link",
    sourceMaterials: [{
      materialId: "material-responsive-text",
      materialType: "text",
      title: "原始通知长标题",
      sourceUrl: "",
      storageRef: "",
      rawContent: "RAW_SOURCE_MARKER：这是只允许出现在详情里的原始长段文字，不得直接进入表格测试重点。",
      capturedAt: "2026-09-01T02:00:00.000Z",
      contentHash: "responsive-hash"
    }],
    assessmentSummary: {
      testComposition: ["资料分析", "图形推理", "性格测试"],
      keyQuestionTypes: ["数据计算", "图形规律"],
      timingAndPacing: ["各模块限时，具体分钟数待确认"],
      competenciesAssessed: ["数理分析", "抽象推理", "作答一致性"],
      recurringSignals: ["多份材料均提到图推与性格测试"],
      preparationAdvice: ["计时练习资料分析", "复盘常见图形规律", "保持性格题作答一致"],
      conflicts: ["模块顺序信息不一致/待确认"],
      conciseBullets: ["包含资料分析、图推和性格测试", "重点训练数据计算与图形规律", "各模块存在限时压力", "模块顺序待确认"],
      sourceMaterialIds: ["material-responsive-text"],
      analyzedAt: "2026-09-01T03:00:00.000Z"
    },
    analysisStatus: "CURRENT",
    notes: "",
    createdAt: "2026-09-01T02:00:00.000Z",
    updatedAt: "2026-09-01T02:00:00.000Z",
    sourceOfTruth: "local-draft"
  }];
  await evaluate(ws, `localStorage.setItem('campus-os-tab', ${JSON.stringify(state.tab)}); ${state.tab === "assessments" ? `localStorage.setItem('campus-os-assessment-drafts-v1', ${JSON.stringify(JSON.stringify(assessmentDraft))});` : ""} location.href = '${ROOT_URL}/index.html?check=${Date.now()}';`);
  await waitForReady(ws);
  if (state.filter) {
    await evaluate(ws, `document.querySelector('[data-filter="${state.filter}"]')?.click()`);
    await wait(60);
  }
  if (state.modal) {
    await evaluate(ws, `document.querySelector('[data-assessment-new]')?.click()`);
    await wait(60);
  }
  if (state.details) {
    await evaluate(ws, `document.querySelector('.assessment-detail-row')?.setAttribute('open', ''); document.querySelector('.source-material')?.setAttribute('open', '')`);
    await wait(60);
  }
}

async function measure(ws) {
  return evaluate(ws, `(() => {
    const tolerance = 2;
    const vw = document.documentElement.clientWidth;
    const overflowers = Array.from(document.querySelectorAll('body, #app, .layout, .screen, .table-panel, .pipeline-row, .jd-record, .assessment-row, .assessment-detail-row, .assessment-detail-content, .source-material, .assessment-modal, .copy-card, .story-card, .detail-drawer, a, pre, .tag'))
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
    const visibleDesktopGrid = (headSelector) => {
      const head = document.querySelector(headSelector);
      return head && getComputedStyle(head).display !== 'none';
    };
    const misalignedRows = [];
    if (visibleDesktopGrid('.pipeline-grid-head')) {
      document.querySelectorAll('.pipeline-row').forEach((row, rowIndex) => {
        const rowBottom = row.getBoundingClientRect().bottom;
        const cellBottoms = Array.from(row.children).map((cell) => cell.getBoundingClientRect().bottom);
        if (cellBottoms.some((bottom) => Math.abs(bottom - rowBottom) > tolerance)) {
          misalignedRows.push({ grid: 'pipeline', rowIndex, rowBottom, cellBottoms });
        }
      });
    }
    if (visibleDesktopGrid('.jd-grid-head')) {
      document.querySelectorAll('.jd-main').forEach((row, rowIndex) => {
        const rowBottom = row.getBoundingClientRect().bottom;
        const cellBottoms = Array.from(row.children).map((cell) => cell.getBoundingClientRect().bottom);
        if (cellBottoms.some((bottom) => Math.abs(bottom - rowBottom) > tolerance)) {
          misalignedRows.push({ grid: 'jd', rowIndex, rowBottom, cellBottoms });
        }
      });
    }
    if (visibleDesktopGrid('.assessment-grid-head')) {
      document.querySelectorAll('.assessment-row').forEach((row, rowIndex) => {
        const rowBottom = row.getBoundingClientRect().bottom;
        const cellBottoms = Array.from(row.children).map((cell) => cell.getBoundingClientRect().bottom);
        if (cellBottoms.some((bottom) => Math.abs(bottom - rowBottom) > tolerance)) {
          misalignedRows.push({ grid: 'assessment', rowIndex, rowBottom, cellBottoms });
        }
      });
    }
    return {
      clientWidth: vw,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflowers,
      misalignedRows: misalignedRows.slice(0, 8),
      assessmentUi: {
        defaultScope: document.querySelector('input[name="assessmentScope"]:checked')?.value || '',
        testTypeCheckboxes: document.querySelectorAll('input[name="testType"][type="checkbox"]').length,
        receivedFields: document.querySelectorAll('[name="receivedAt"], [name="receivedMonth"], [name="receivedDay"]').length,
        dateTimeFields: document.querySelectorAll('.assessment-form input[type="datetime-local"], .assessment-form input[type="date"]').length,
        monthDaySelects: document.querySelectorAll('.assessment-form [data-month-select]').length,
        conciseBulletCount: document.querySelectorAll('.assessment-focus .assessment-focus-list li').length,
        rawMaterialLeakedIntoFocus: (document.querySelector('.assessment-focus')?.textContent || '').includes('RAW_SOURCE_MARKER'),
        sourceMaterialCount: document.querySelectorAll('.source-material').length,
        analysisSectionCount: document.querySelectorAll('.assessment-analysis-panel .analysis-section').length
      }
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
      const assessmentUiInvalid = state.modal && (
        result.assessmentUi.defaultScope !== '海测' ||
        result.assessmentUi.testTypeCheckboxes !== 6 ||
        result.assessmentUi.receivedFields !== 0 ||
        result.assessmentUi.dateTimeFields !== 0 ||
        result.assessmentUi.monthDaySelects !== 2
      );
      const assessmentDataUiInvalid = state.tab === 'assessments' && !state.modal && (
        result.assessmentUi.conciseBulletCount !== 4 ||
        result.assessmentUi.rawMaterialLeakedIntoFocus ||
        result.assessmentUi.sourceMaterialCount !== 1 ||
        result.assessmentUi.analysisSectionCount !== 7
      );
      if (hasDocumentOverflow || result.overflowers.length || result.misalignedRows.length || assessmentUiInvalid || assessmentDataUiInvalid) {
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
