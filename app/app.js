import { loadData, loadNavigation, saveNavigation } from "./store.js";
import {
  applicationInProgress,
  activeApplications,
  activeOpportunities,
  archivedRecords,
  byUpcomingDate,
  computeKpis,
  currentResume,
  statusLabel
} from "./filters.js";

const tabs = [
  { id: "home", label: "首页", icon: "⌂" },
  { id: "opportunities", label: "机会", icon: "◎" },
  { id: "pipeline", label: "流程", icon: "▤" },
  { id: "interviews", label: "面试", icon: "✦" },
  { id: "me", label: "我的", icon: "⚙" }
];

const pipelineFilters = [
  { id: "all", label: "全部" },
  { id: "inProgress", label: "投递中" },
  { id: "applied", label: "已投递" },
  { id: "active", label: "流程中" },
  { id: "interview", label: "面试" },
  { id: "offer", label: "Offer" },
  { id: "todo", label: "待投递" },
  { id: "watch", label: "提醒列表" },
  { id: "closed", label: "已结束" },
  { id: "jd", label: "JD" }
];

const opportunityClassifications = [
  { id: "APPLY_NOW", label: "建议立即投递" },
  { id: "OPEN", label: "当前可投" },
  { id: "WATCH", label: "持续关注" },
  { id: "UPCOMING", label: "即将开放" },
  { id: "HISTORICAL", label: "往届参考" },
  { id: "VERIFY", label: "待核实" }
];

let state = {};
let activeTab = normalizeTab(loadNavigation());
let drawerOpen = false;
let pipelineFilter = "all";
let opportunityDateFilter = "all";
let selectedJobId = "";
let serviceWorkerReloading = false;

init();

async function init() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {});

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (serviceWorkerReloading) return;
      serviceWorkerReloading = true;
      window.location.reload();
    });
  }

  state = await loadData();
  render();
}

function render() {
  document.querySelector("#app").innerHTML = `
    <div class="layout ${drawerOpen ? "drawer-open" : ""}">
      ${renderSidebar()}
      <div class="mobile-topbar">
        <button class="menu-button" data-menu-toggle aria-label="打开导航">☰</button>
        <strong>Campus OS</strong>
      </div>
      <main class="screen">${renderCurrentTab()}</main>
      ${selectedJobId ? renderDetailDrawer() : ""}
    </div>
  `;

  bindInteractions();
}

function bindInteractions() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = normalizeTab(button.dataset.tab);
      drawerOpen = false;
      selectedJobId = "";
      saveNavigation(activeTab);
      render();
    });
  });

  document.querySelectorAll("[data-menu-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      drawerOpen = !drawerOpen;
      render();
    });
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      pipelineFilter = button.dataset.filter;
      render();
    });
  });

  document.querySelectorAll("[data-opportunity-date]").forEach((button) => {
    button.addEventListener("click", () => {
      opportunityDateFilter = button.dataset.opportunityDate;
      render();
    });
  });

  document.querySelectorAll("[data-row-job]").forEach((row) => {
    row.addEventListener("click", () => {
      selectedJobId = row.dataset.rowJob;
      render();
    });
  });

  document.querySelectorAll("[data-drawer-close]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedJobId = "";
      render();
    });
  });

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(button.dataset.copy || "");
      button.textContent = "已复制";
      window.setTimeout(() => (button.textContent = button.dataset.label), 1200);
    });
  });
}

function normalizeTab(tab) {
  if (tab === "story") return "interviews";
  return tabs.some((item) => item.id === tab) ? tab : "home";
}

function renderCurrentTab() {
  if (activeTab === "opportunities") return renderOpportunities();
  if (activeTab === "pipeline") return renderPipeline();
  if (activeTab === "interviews") return renderInterviewWorkspace();
  if (activeTab === "me") return renderMe();
  return renderHome();
}

function renderHome() {
  const kpis = computeKpis(state.applications || []);
  const upcoming = byUpcomingDate(state.events || []).slice(0, 6);
  const latestDaily = state.daily || {};
  const pendingActions = getPendingActions();

  return `
    ${hero("Hayley Campus Job OS", "2027 内地校招 HR 求职工作台", "岗位发现 -> 投递 -> 测评/面试 -> 复盘 -> Story Bank")}
    ${renderVersionInfo(latestDaily, state.version || {})}
    ${renderWarnings()}
    <section class="kpi-grid">
      ${kpi("投递中", kpis.inProgress)}
      ${kpi("已投递", kpis.applied)}
      ${kpi("筛选中", kpis.screening)}
      ${kpi("测评/笔试", kpis.assessment)}
      ${kpi("面试", kpis.interview)}
      ${kpi("Offer", kpis.offer)}
    </section>
    ${renderPendingActions(pendingActions)}
    <section class="two-col">
      <article class="panel">
        <div class="panel-head">
          <h2>最近 7 天</h2>
          <span>真实状态记录</span>
        </div>
        <div class="metric-row"><strong>${kpis.last7Applied}</strong><span>新增投递</span></div>
        <div class="metric-row"><strong>${kpis.last7Interview}</strong><span>进入面试</span></div>
      </article>
      <article class="panel">
        <div class="panel-head">
          <h2>Upcoming</h2>
          <span>Today / Tomorrow / Next 7 Days</span>
        </div>
        ${upcoming.length ? upcoming.map(renderEvent).join("") : empty("暂无待办事件")}
      </article>
    </section>
    <section class="panel">
      <div class="panel-head">
        <h2>今日更新</h2>
        <span>${latestDaily.runDate || "未记录"}</span>
      </div>
      <div class="daily-grid">
        <p><strong>新增投递</strong>${latestDaily.newApplications ?? 0}</p>
        <p><strong>新增推荐</strong>${latestDaily.finalRecommendedCount ?? 0}</p>
        <p><strong>活跃投递</strong>${latestDaily.activeMainlandApplications ?? kpis.applied}</p>
      </div>
    </section>
  `;
}

function renderOpportunities() {
  const snapshots = getOpportunitySnapshots();
  const dates = snapshots.map((snapshot) => snapshot.recommendationDate);
  const selectedIds = opportunityDateFilter === "all"
    ? [...new Set(snapshots.flatMap((snapshot) => snapshot.jobIds || []))]
    : snapshots.find((snapshot) => snapshot.recommendationDate === opportunityDateFilter)?.jobIds || [];
  const jobs = selectedIds.map(findOpportunityHistoryJob).filter(Boolean);
  return `
    ${hero("机会", "内地校招机会历史", "按推荐日期保留历史结果；状态变化不会删除旧推荐")}
    <section class="opportunity-date-filter" aria-label="推荐日期">
      <button class="${opportunityDateFilter === "all" ? "active" : ""}" data-opportunity-date="all">全部</button>
      ${dates.map((date) => `<button class="${opportunityDateFilter === date ? "active" : ""}" data-opportunity-date="${escapeAttr(date)}">${escapeHtml(formatDate(date))}</button>`).join("")}
    </section>
    ${jobs.length ? opportunityClassifications.map((group) => renderOpportunityGroup(group, jobs)).join("") : `<section class="stack">${empty("该日期没有通过验证的新机会。零结果快照仍会保留。")}</section>`}
    ${renderTargetCompanyWatchlist()}
  `;
}

function renderOpportunityGroup(group, jobs) {
  const grouped = jobs.filter((job) => job.classification === group.id);
  if (!grouped.length) return "";
  return `
    <section class="opportunity-group">
      <div class="panel-head"><h2>${group.label}</h2><span>${grouped.length}</span></div>
      <div class="stack">${grouped.map(renderJobCard).join("")}</div>
    </section>
  `;
}

function renderTargetCompanyWatchlist() {
  const watchlist = state.targetCompanyWatchlist || {};
  const companies = watchlist.companies || [];
  if (!companies.length) return "";
  return `
    <section class="panel target-watchlist">
      <div class="panel-head">
        <div><h2>Target Company Watchlist</h2><p class="muted">本次已检查 ${companies.length} 家；没有 HR opening 的公司仍会保留。</p></div>
        <span>${escapeHtml(watchlist.checkedAt ? formatUpdatedAt(watchlist.checkedAt) : "")}</span>
      </div>
      <div class="watchlist-grid">
        ${companies.map((item) => `
          <article>
            <strong>${escapeHtml(item.company)}</strong>
            <span class="status-pill ${targetStatusClass(item.status)}">${escapeHtml(item.status)}</span>
            <p>${escapeHtml(item.note || "")}</p>
            ${item.sourceUrl ? `<a href="${escapeAttr(item.sourceUrl)}" target="_blank" rel="noreferrer">查看核验来源</a>` : `<small>本轮未找到可靠链接</small>`}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function targetStatusClass(status = "") {
  if (status === "OPEN") return "green";
  if (status === "UPCOMING") return "purple";
  if (status === "CLOSED") return "gray";
  if (status === "CAMPUS_OPEN_HR_UNKNOWN") return "blue";
  if (status === "HISTORICAL_REFERENCE") return "amber";
  return "teal";
}

function renderVersionInfo(daily, version) {
  return `
    <section class="version-strip" aria-label="版本信息">
      <span>Last updated: <strong>${escapeHtml(formatUpdatedAt(daily.dataUpdatedAt || daily.updatedAt || daily.runDate))}</strong></span>
      <span>Web version: <strong>${escapeHtml(version.commitShortSha || "unavailable")}</strong></span>
    </section>
  `;
}

function getOpportunitySnapshots() {
  return [...(state.opportunityHistory?.snapshots || [])]
    .filter((snapshot) => snapshot.recommendationDate)
    .sort((a, b) => b.recommendationDate.localeCompare(a.recommendationDate));
}

function findOpportunityHistoryJob(jobId) {
  const archive = Array.isArray(state.archive) ? state.archive : state.archive && state.archive.records || [];
  return [...(state.opportunities || []), ...(state.historicalOpportunities || []), ...(state.applications || []), ...archive]
    .find((job) => job.jobId === jobId);
}

function renderPipeline() {
  const rows = getPipelineRows();
  const filtered = rows.filter((row) => matchesPipelineFilter(row, pipelineFilter));
  const kpis = computeKpis(state.applications || []);
  const latestDaily = state.daily || {};
  const isJdTab = pipelineFilter === "jd";

  return `
    <section class="pipeline-banner">
      <div>
        <p class="eyebrow">2027 Campus Recruitment · Mainland China</p>
        <h1>校招流程</h1>
        <p>Campus Application Pipeline · Last updated: ${escapeHtml(formatUpdatedAt(latestDaily.dataUpdatedAt || latestDaily.runDate))}</p>
      </div>
      <div class="pipeline-kpis">
        ${miniKpi("投递中", kpis.inProgress)}
        ${miniKpi("已投递", kpis.applied)}
        ${miniKpi("测评/笔试", kpis.assessment)}
        ${miniKpi("面试", kpis.interview)}
      </div>
    </section>
    <section class="table-panel">
      <div class="filter-row">
        ${pipelineFilters.map((filter) => `<button class="${filter.id === pipelineFilter ? "active" : ""}" data-filter="${filter.id}">${filter.label}</button>`).join("")}
      </div>
      ${isJdTab ? renderJdKnowledge() : `<div class="pipeline-grid" role="table" aria-label="Application pipeline">
        <div class="pipeline-grid-head" role="row">
          <span>公司</span>
          <span>岗位</span>
          <span>Base</span>
          <span>投递/记录日期</span>
          <span>当前进度</span>
          <span>下一节点</span>
          <span>备注</span>
        </div>
        ${filtered.map(renderPipelineRow).join("") || empty("当前筛选下暂无记录")}
      </div>`}
    </section>
  `;
}

function renderInterviewWorkspace() {
  return `
    ${hero("面试", "Interview Workspace", "面试记录、简历复制工具和 Story Bank 集中在这里")}
    ${renderInterviewRecords()}
    ${renderResumeCopyTool()}
    ${renderStoryBankSection()}
  `;
}

function renderInterviewRecords() {
  const interviews = state.interviews || [];
  const packs = state.interviewPacks || [];
  return `
    <section class="panel section-block">
      <div class="panel-head">
        <div>
          <h2>面试记录 / Interview Records</h2>
          <p class="muted">真实发生的测评、笔试、面试和复盘会沉淀在这里。</p>
        </div>
        <span>${interviews.length} records · ${packs.length} packs</span>
      </div>
      ${interviews.length ? interviews.map(renderInterviewRecord).join("") : empty("暂无面试记录；收到测评或面试后会写入 persistent interview data。")}
    </section>
  `;
}

function renderResumeCopyTool() {
  const resume = currentResume(state.resumes || {});
  return `
    <section class="panel section-block">
      <div class="panel-head">
        <div>
          <h2>Resume Copy Tool</h2>
          <p class="muted">Resume Source · Last updated: ${formatDate(resume.updatedAt) || "未记录"} · Version ${resume.version || "未记录"}</p>
        </div>
        <span>${(resume.sections || []).length} sections</span>
      </div>
      ${(resume.sections || []).map(renderResumeSection).join("") || empty("暂无简历复制内容")}
    </section>
  `;
}

function renderStoryBankSection() {
  const bank = state.storyBank || {};
  const intro = bank.coreIntroduction || {};
  const stories = bank.stories || [];
  return `
    <section class="panel section-block important">
      <div class="panel-head">
        <div>
          <h2>Story Bank</h2>
          <p class="muted">Interview Preparation Knowledge Base · Core Introduction 默认锁定。</p>
        </div>
        <span>${stories.length} stories</span>
      </div>
      <div class="intro-grid">
        ${copyBlock("中文自我介绍 60 秒", intro.introCN60)}
        ${copyBlock("中文自我介绍 120 秒", intro.introCN120)}
        ${copyBlock("English Self Introduction 60 sec", intro.introEN60)}
        ${copyBlock("English Self Introduction 120 sec", intro.introEN120)}
      </div>
      <p class="storyline">${escapeHtml(intro.storyline || "")}</p>
      <div class="story-grid">
        ${stories.map(renderStory).join("")}
      </div>
    </section>
  `;
}

function renderMe() {
  const archived = archivedRecords(state.applications || [], state.archive || []);
  return `
    ${hero("我的", "设置与历史记录", "香港旧数据在这里保留，不进入内地活跃面板")}
    <section class="panel">
      <div class="panel-head"><h2>Archive / Records</h2><span>${archived.length}</span></div>
      ${archived.slice(0, 20).map(renderCompactJob).join("") || empty("暂无归档记录")}
    </section>
  `;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <strong>Campus OS</strong>
        <span>Hayley HR</span>
      </div>
      <nav class="side-nav">
        ${tabs.map((tab) => `<button class="${tab.id === activeTab ? "active" : ""}" data-tab="${tab.id}"><span>${tab.icon}</span>${tab.label}</button>`).join("")}
      </nav>
    </aside>
    <div class="scrim" data-menu-toggle></div>
  `;
}

function getPipelineRows() {
  const applications = activeApplications(state.applications || []).map((job) => ({
    ...job,
    rowType: inferApplicationRowType(job),
    rowLabel: statusLabel(job.currentStatus) || "已投递",
    rowDate: job.applicationStartedAt || job.appliedDate || job.statusUpdatedAt || job.foundDate || ""
  }));

  const opportunities = activeOpportunities(state.opportunities || []).map((job) => ({
    ...job,
    rowType: "todo",
    rowLabel: "待投递",
    rowDate: job.foundDate || job.postedDate || ""
  }));

  const reminders = (state.reminders || []).map((item) => ({
    jobId: item.reminderId,
    company: item.company,
    title: item.title,
    location: item.location || "",
    market: item.market || "Mainland",
    source: "User Reminder List",
    currentStatus: item.status || "提醒列表",
    rowType: "watch",
    rowLabel: "提醒列表",
    rowDate: item.addedDate || "",
    notes: item.notes || "用户明确加入提醒列表",
    industry: item.category || "",
    jdUrl: item.url || "",
    applyUrl: item.applyUrl || "",
    officialUrl: item.officialUrl || ""
  }));

  return [...applications, ...opportunities, ...reminders];
}

function getJdRows() {
  const jobsById = new Map(getPipelineRows().map((job) => [job.jobId, job]));
  return (state.jds || []).map((jd) => ({
    ...jd,
    job: jobsById.get(jd.jobId) || findArchivedJob(jd.jobId) || {}
  }));
}

function findArchivedJob(jobId) {
  const archive = Array.isArray(state.archive) ? state.archive : state.archive && state.archive.records || [];
  return [...(state.applications || []), ...archive].find((job) => job.jobId === jobId) || {};
}

function inferApplicationRowType(job) {
  const status = job.currentStatus || "";
  if (status === "Application In Progress") return "inProgress";
  if (status === "Offer") return "offer";
  if (["Rejected", "Withdrawn", "Closed", "Archived"].includes(status)) return "closed";
  if (status.includes("Interview")) return "interview";
  return "applied";
}

function matchesPipelineFilter(row, filter) {
  if (filter === "all") return true;
  if (filter === "jd") return false;
  if (filter === "active") return ["applied", "interview"].includes(row.rowType);
  return row.rowType === filter;
}

function getPendingActions() {
  return applicationInProgress(state.applications || []).map((job) => ({
    ...job,
    actionPriority: deadlineDistance(job.deadline) !== "" ? "HIGH" : "HIGH",
    reminder: inProgressReminder(job)
  }));
}

function renderPendingActions(actions) {
  if (!actions.length) return "";
  return `
    <section class="panel pending-actions high-priority">
      <div class="panel-head">
        <div>
          <h2>需要行动</h2>
          <p class="muted">投递中属于高优先级 Pending Action。</p>
        </div>
        <span>${actions.length}</span>
      </div>
      <div class="pending-list">
        ${actions.map((job) => `
          <article class="pending-action">
            <div>
              <strong>${escapeHtml(job.company || "未命名公司")} · ${escapeHtml(job.title || "未命名岗位")}</strong>
              <p>${escapeHtml(job.reminder)}</p>
            </div>
            ${renderLink(job.applyUrl || job.jdUrl || job.officialUrl, "继续投递")}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderJdKnowledge() {
  const rows = getJdRows();
  const completeCount = rows.filter((row) => row.jdStatus !== "JD Missing").length;
  const missingCount = rows.length - completeCount;
  return `
    <div class="jd-summary-strip">
      ${miniKpi("已保存 JD", completeCount)}
      ${miniKpi("JD Missing", missingCount)}
      ${miniKpi("需刷新面试包", rows.filter((row) => row.interviewPackNeedsRefresh).length)}
    </div>
    <div class="jd-grid" role="table" aria-label="JD Knowledge">
      <div class="jd-grid-head" role="row">
        <span>公司</span>
        <span>岗位</span>
        <span>JD重点</span>
        <span>差异关键词</span>
        <span>核心要求</span>
        <span>更新时间</span>
      </div>
      ${rows.map(renderJdRow).join("") || empty("暂无 JD 记录")}
    </div>
  `;
}

function renderJdRow(jd) {
  const job = jd.job || {};
  const title = job.title || jd.jobId;
  const company = job.company || "未关联岗位";
  const url = jd.jdUrl || job.jdUrl || job.applyUrl || job.officialUrl || "";
  const summary = jd.jdStatus === "JD Missing" ? "JD Missing：仅有岗位/投递记录，尚未保存原始 JD。" : jd.jdSummary;
  const mustHave = (jd.jdMustHave || []).slice(0, 4);
  const hiddenMustHave = Math.max((jd.jdMustHave || []).length - mustHave.length, 0);
  return `
    <article class="jd-record" role="row">
      <div class="jd-main">
        <div class="cell cell-company" data-label="公司"><strong>${escapeHtml(company)}</strong><small>${escapeHtml(jd.jdStatus || "")}</small></div>
        <div class="cell cell-title" data-label="岗位">${url ? `<a class="job-title-link" href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>` : escapeHtml(title)}</div>
        <div class="cell cell-summary" data-label="JD重点">${escapeHtml(shortText(summary || "JD Missing", 160))}</div>
        <div class="cell cell-tags" data-label="差异关键词"><div class="tag-row compact-tags">${(jd.jdDistinctiveKeywords || []).slice(0, 6).map(tag).join("") || tag("JD Missing")}</div></div>
        <div class="cell cell-must" data-label="核心要求">${mustHave.length ? `<ul class="compact-list">${mustHave.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}${hiddenMustHave ? `<li class="muted">+${hiddenMustHave}</li>` : ""}</ul>` : `<span class="muted">待补 JD</span>`}</div>
        <div class="cell cell-date" data-label="更新时间">${escapeHtml(formatDate(jd.jdCapturedAt) || "未捕获")}</div>
      </div>
      <details class="jd-detail-row">
        <summary>展开 JD Detail</summary>
        ${renderJdDetails(jd)}
      </details>
    </article>
  `;
}

function renderJdDetails(jd) {
  if (jd.jdStatus === "JD Missing") {
    return `
      <div class="jd-detail-grid">
        <section>
          <h3>JD Summary</h3>
          <p>JD Missing：当前只有岗位记录，还没有原始 JD。不会生成 summary、面试信号或原文 excerpt。</p>
        </section>
        <section>
          <h3>Source</h3>
          <p>${escapeHtml(jd.jdSource || "未记录")} ${jd.jdUrl ? `· ${escapeHtml(jd.jdUrl)}` : ""}</p>
        </section>
      </div>
    `;
  }

  return `
    <div class="jd-detail-grid">
      <section>
        <h3>JD Summary</h3>
        <p>${escapeHtml(jd.jdSummary || "")}</p>
      </section>
      <section>
        <h3>与普通 HR 岗相比的差异</h3>
        ${listBlock(jd.jdUniqueRequirements)}
      </section>
      <section>
        <h3>Distinctive Keywords</h3>
        <div class="tag-row">${(jd.jdDistinctiveKeywords || []).map(tag).join("")}</div>
      </section>
      <section>
        <h3>Must Have</h3>
        ${listBlock(jd.jdMustHave)}
      </section>
      <section>
        <h3>Nice to Have</h3>
        ${listBlock(jd.jdNiceToHave)}
      </section>
      <section>
        <h3>Interview Signals</h3>
        ${listBlock(jd.jdInterviewSignals)}
      </section>
      <section>
        <h3>Key Original Excerpt</h3>
        ${listBlock(jd.jdKeyOriginalExcerpt, "quote-list")}
      </section>
      <section>
        <h3>JD Versioning</h3>
        <p class="muted">Hash: ${escapeHtml(jd.jdHash || "missing")} · Refresh: ${escapeHtml(jd.interviewPackNeedsRefresh ? jd.refreshReason || "yes" : "no")}</p>
      </section>
      <section class="full-jd">
        <details>
          <summary>展开完整 JD</summary>
          <pre>${escapeHtml(jd.jdRaw || jd.jdSnapshot || "")}</pre>
        </details>
      </section>
    </div>
  `;
}

function listBlock(items = [], className = "") {
  if (!items.length) return `<p class="muted">待补充</p>`;
  return `<ul class="${escapeAttr(className)}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderPipelineRow(job) {
  const url = job.applyUrl || job.jdUrl || job.officialUrl || "";
  const latest = latestStatus(job);
  const isInProgress = job.currentStatus === "Application In Progress";
  return `
    <article class="pipeline-row ${isInProgress ? "application-in-progress" : ""}" data-row-job="${escapeAttr(job.jobId)}" role="row">
      <div class="cell cell-company" data-label="公司"><strong>${escapeHtml(job.company || "未命名公司")}</strong><small>${escapeHtml(job.rowLabel || job.source || "")}</small></div>
      <div class="cell cell-title" data-label="岗位">${url ? `<a class="job-title-link ${isInProgress ? "in-progress-job-link" : ""}" href="${escapeAttr(url)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">${escapeHtml(job.title || "未命名岗位")}</a>` : `<span class="${isInProgress ? "in-progress-job-link" : ""}">${escapeHtml(job.title || "未命名岗位")}</span><small>链接待验证</small>`}</div>
      <div class="cell" data-label="Base">${escapeHtml(job.location || job.base || "")}</div>
      <div class="cell" data-label="投递/记录日期">${escapeHtml(formatDate(job.rowDate || job.appliedDate || job.foundDate))}<small>${latest.date ? `最近 ${escapeHtml(formatDate(latest.date))}` : ""}</small></div>
      <div class="cell" data-label="当前进度"><span class="status-pill ${statusClass(job.currentStatus)}">${escapeHtml(statusLabel(job.currentStatus) || job.currentStatus || job.rowLabel)}</span></div>
      <div class="cell" data-label="下一节点">${escapeHtml(nextNode(job))}</div>
      <div class="cell cell-notes" data-label="备注">${escapeHtml(shortText(isInProgress ? `⚠ 尚未完成投递。${inProgressReminder(job)}` : job.notes || (job.risks || []).join("；") || (job.matchReasons || []).join("；"), 120))}</div>
    </article>
  `;
}

function renderDetailDrawer() {
  const job = getPipelineRows().find((item) => item.jobId === selectedJobId);
  if (!job) return "";
  const url = job.applyUrl || job.jdUrl || job.officialUrl || "";
  return `
    <aside class="detail-drawer">
      <div class="drawer-head">
        <div>
          <p class="eyebrow">${escapeHtml(job.source || job.rowLabel || "")}</p>
          <h2>${escapeHtml(job.company || "")}</h2>
          <p>${escapeHtml(job.title || "")}</p>
        </div>
        <button data-drawer-close aria-label="关闭">×</button>
      </div>
      <div class="drawer-body">
        <div class="tag-row">
          ${tag(job.location)}
          ${tag(job.industry)}
          ${tag(job.jobFamily)}
          ${tag(job.campusType)}
        </div>
        <h3>JD</h3>
        <p>${escapeHtml(job.jdSnapshot || job.jobDescription || "暂无 JD snapshot")}</p>
        <h3>Apply Link</h3>
        <p>${url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>` : "链接待验证"}</p>
        <h3>Application Timeline</h3>
        ${renderTimeline(job)}
        <h3>Notes</h3>
        <p>${escapeHtml(job.notes || "暂无备注")}</p>
        <h3>Interview Pack</h3>
        <p>${escapeHtml(job.interviewPackId || "暂无面试包；有面试或测评变化时生成。")}</p>
        <h3>Historical Reference</h3>
        <p>${escapeHtml(job.rowType === "watch" ? "来自用户明确提醒列表，不由系统自动生成。" : "无")}</p>
      </div>
    </aside>
  `;
}

function renderTimeline(job) {
  const history = job.statusHistory || [];
  if (!history.length) return empty("暂无状态历史");
  return `<ol class="timeline">${history.map((item) => `<li><strong>${escapeHtml(formatDate(item.date))}</strong><span>${escapeHtml(statusLabel(item.status))}</span><small>${escapeHtml(item.notes || "")}</small></li>`).join("")}</ol>`;
}

function latestStatus(job) {
  const history = job.statusHistory || [];
  return history[history.length - 1] || {};
}

function nextNode(job) {
  if (job.currentStatus === "Application In Progress") return "完成申请";
  if (job.rowType === "todo") return "待投递";
  if (job.rowType === "watch") return "等待跟进";
  if (job.currentStatus === "Applied") return "等待筛选";
  if (job.currentStatus === "Resume Screening") return "测评/面试通知";
  if (job.currentStatus?.includes("Interview")) return "复盘/下一轮";
  if (job.currentStatus === "Offer") return "Offer决策";
  return "待更新";
}

function statusClass(status = "") {
  if (status === "Application In Progress") return "red";
  if (status === "Applied") return "blue";
  if (status.includes("Assessment") || status.includes("Written")) return "amber";
  if (status.includes("Interview")) return "purple";
  if (status === "Offer") return "green";
  if (["Rejected", "Withdrawn", "Closed", "Archived"].includes(status)) return "gray";
  return "teal";
}

function inProgressReminder(job) {
  const days = daysSince(job.applicationStartedAt || job.statusUpdatedAt);
  const started = job.applicationStartedAt ? `开始投递：${formatDate(job.applicationStartedAt)}` : "已开始投递";
  const elapsed = days > 0 ? `，已开始投递 ${days} 天` : "";
  const deadline = deadlineDistance(job.deadline);
  return `⚠ 尚未完成，请继续申请。${started}${elapsed}${deadline ? `，${deadline}` : ""}`;
}

function deadlineDistance(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.ceil((target - start) / (24 * 60 * 60 * 1000));
  if (days < 0) return `已过截止 ${Math.abs(days)} 天`;
  if (days === 0) return "今天截止";
  return `距截止还有 ${days} 天`;
}

function daysSince(value = "") {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const today = new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((end - start) / (24 * 60 * 60 * 1000)));
}

function kpi(label, value) {
  return `<article class="kpi"><span>${label}</span><strong>${value}</strong></article>`;
}

function miniKpi(label, value) {
  return `<div class="mini-kpi"><span>${label}</span><strong>${value}</strong></div>`;
}

function hero(label, title, subtitle) {
  return `
    <section class="hero">
      <p class="eyebrow">${label}</p>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </section>
  `;
}

function renderWarnings() {
  const errors = state.loadErrors || [];
  const pending = state.pending || [];
  const warnings = [...errors, ...pending.filter((item) => item.status === "open").map((item) => item.content)];
  if (!warnings.length) return "";
  return `<section class="notice">${warnings.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</section>`;
}

function renderJobCard(job) {
  const classification = opportunityClassifications.find((item) => item.id === job.classification)?.label || job.classification || "待分类";
  const exactLinkVerified = job.linkStatus === "VERIFIED" && (job.applyUrl || job.jdUrl);
  const exactUrl = job.applyUrl || job.jdUrl || "";
  return `
    <article class="job-card">
      <div class="panel-head">
        <h2>${escapeHtml(job.company || "未命名公司")}</h2>
        <span>${escapeHtml(classification)} · ${escapeHtml(job.source || "Unknown")}</span>
      </div>
      <h3>${escapeHtml(job.title || "未命名岗位")}</h3>
      <div class="tag-row">
        ${tag(`Match ${Number(job.matchScore || 0).toFixed(1)}/10`)}
        ${tag(classification)}
        ${job.currentStatus && job.currentStatus !== "Recommended" ? tag(statusLabel(job.currentStatus)) : ""}
        ${tag(job.firstRecommendedAt ? `首次推荐 ${formatDate(job.firstRecommendedAt)}` : "首次推荐时间待补")}
        ${tag(job.location)}
        ${tag(job.sourcePriority || "来源等级待核实")}
        ${tag(job.postedDate ? `发布 ${job.postedDate}` : "发布日期待验证")}
        ${tag(job.deadline ? `截止 ${job.deadline}` : "Deadline 未记录")}
        ${tag(job.salary || "薪资未列出")}
        ${tag(job.experience || "经验未列出")}
      </div>
      <p><strong>推荐原因：</strong>${escapeHtml((job.matchReasons || []).join("；") || "等待下一次批处理生成推荐理由")}</p>
      ${(job.gaps || []).length ? `<p class="risk">Gap：${escapeHtml(job.gaps.join("；"))}</p>` : ""}
      ${(job.risks || []).length ? `<p class="risk">Risk：${escapeHtml(job.risks.join("；"))}</p>` : ""}
      <details class="opportunity-jd">
        <summary>JD · ${escapeHtml(job.jdStatus || "JD Missing")}</summary>
        <p>${escapeHtml(job.jdSummary || job.jdSnapshot || "JD Missing：只发现岗位/项目标题，不补写不存在的职责。")}</p>
      </details>
      <div class="opportunity-meta"><span>发现：${escapeHtml(formatUpdatedAt(job.foundAt || job.firstRecommendedAt))}</span><span>Source Job ID：${escapeHtml(job.sourceJobId || "未提供")}</span></div>
      <div class="actions">
        ${exactLinkVerified ? renderLink(exactUrl, "查看并投递") : `<strong class="link-unverified">链接待核实</strong>`}
        ${!exactLinkVerified && job.sourceUrl ? renderLink(job.sourceUrl, "查看来源页面") : ""}
      </div>
    </article>
  `;
}

function renderCompactJob(job) {
  return `
    <div class="compact-job">
      <strong>${escapeHtml(job.company || "未命名公司")}</strong>
      <span>${escapeHtml(job.title || "未命名岗位")}</span>
      <small>${escapeHtml(job.location || "")} · ${escapeHtml(statusLabel(job.currentStatus))} · ${escapeHtml(job.market || "")}</small>
    </div>
  `;
}

function renderEvent(event) {
  return `
    <div class="event">
      <strong>${escapeHtml(`${event.date || ""} ${event.time || ""}`)}</strong>
      <span>${escapeHtml(event.company || event.jobId || "未关联岗位")} · ${escapeHtml(event.eventType || "Event")}</span>
    </div>
  `;
}

function renderInterviewRecord(item) {
  return `
    <article class="record-row">
      <strong>${escapeHtml(item.company || item.jobId || "未命名")}</strong>
      <span>${escapeHtml(item.round || "未记录轮次")} · ${escapeHtml(item.date || "未记录日期")}</span>
      <small>${escapeHtml((item.questions || []).join("；") || "暂无问题记录")}</small>
    </article>
  `;
}

function renderStory(story) {
  return `
    <article class="story-card">
      <div class="panel-head">
        <h3>${escapeHtml(story.title)}</h3>
        <span>成熟度 ${story.maturityScore || 0}</span>
      </div>
      <p>${escapeHtml(story.facts?.situation || "Needs User Input")}</p>
      <div class="tag-row">${(story.competencies || []).map(tag).join("")}</div>
    </article>
  `;
}

function renderResumeSection(section) {
  return `
    <details class="resume-section" open>
      <summary>${escapeHtml(section.title)}</summary>
      <p class="muted">${escapeHtml(section.period || "")} · ${escapeHtml(section.location || "")}</p>
      ${copyBlock("复制中文", section.contentCN)}
      ${copyBlock("Copy English", section.contentEN)}
      <div class="bullet-tools">
        ${splitBullets(section.contentCN).map((bullet, index) => `<button data-label="复制 bullet" data-copy="${escapeAttr(bullet)}">复制中文 ${index + 1}</button>`).join("")}
      </div>
      <div class="tag-row">${(section.tags || []).map(tag).join("")}</div>
    </details>
  `;
}

function copyBlock(label, text = "") {
  const safe = escapeHtml(text || "");
  return `
    <div class="copy-card">
      <div class="panel-head"><h3>${escapeHtml(label)}</h3><button data-label="${escapeAttr(label)}" data-copy="${escapeAttr(text || "")}">${escapeHtml(label)}</button></div>
      <p>${safe}</p>
    </div>
  `;
}

function splitBullets(text = "") {
  return String(text)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderLink(url, label) {
  if (!url) return `<span class="muted">链接待验证</span>`;
  return `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function tag(value) {
  if (!value) return "";
  return `<span class="tag">${escapeHtml(value)}</span>`;
}

function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function shortText(value = "", max = 80) {
  const text = String(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatDate(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function formatUpdatedAt(value = "") {
  if (!value) return "未记录";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+08:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} UTC+8`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/\n/g, "&#10;");
}
