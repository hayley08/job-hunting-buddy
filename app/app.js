import { loadData, loadNavigation, saveNavigation } from "./store.js";
import {
  activeOpportunities,
  archivedRecords,
  byUpcomingDate,
  computeKpis,
  currentResume,
  groupByStatus,
  statusLabel
} from "./filters.js";

const tabs = [
  { id: "home", label: "首页" },
  { id: "opportunities", label: "机会" },
  { id: "pipeline", label: "流程" },
  { id: "interviews", label: "面试" },
  { id: "story", label: "Story" },
  { id: "me", label: "我的" }
];

let state = {};
let activeTab = loadNavigation();

init();

async function init() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  state = await loadData();
  render();
}

function render() {
  document.querySelector("#app").innerHTML = `
    <main class="screen">${renderCurrentTab()}</main>
    ${renderNav()}
  `;

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      saveNavigation(activeTab);
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

function renderCurrentTab() {
  if (activeTab === "opportunities") return renderOpportunities();
  if (activeTab === "pipeline") return renderPipeline();
  if (activeTab === "interviews") return renderInterviews();
  if (activeTab === "story") return renderStoryBank();
  if (activeTab === "me") return renderMe();
  return renderHome();
}

function renderHome() {
  const kpis = computeKpis(state.applications || []);
  const upcoming = byUpcomingDate(state.events || []).slice(0, 6);
  const latestDaily = state.daily || {};

  return `
    ${hero("Hayley Campus Job OS", "2027 内地校招 HR 求职工作台", "岗位发现 -> 投递 -> 测评/面试 -> 复盘 -> Story Bank")}
    ${renderWarnings()}
    <section class="kpi-grid">
      ${kpi("已投递", kpis.applied)}
      ${kpi("筛选中", kpis.screening)}
      ${kpi("测评/笔试", kpis.assessment)}
      ${kpi("面试", kpis.interview)}
      ${kpi("Offer", kpis.offer)}
    </section>
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
        <p><strong>新增推荐</strong>${latestDaily.finalRecommendedCount ?? 0}</p>
        <p><strong>迁移投递</strong>${latestDaily.migratedApplications ?? 0}</p>
        <p><strong>归档记录</strong>${latestDaily.archivedRecords ?? 0}</p>
      </div>
    </section>
  `;
}

function renderOpportunities() {
  const jobs = activeOpportunities(state.opportunities || []);
  return `
    ${hero("机会", "尚未投递的内地校招机会", "只展示通过校验且未投递的岗位")}
    <section class="stack">
      ${jobs.length ? jobs.map(renderJobCard).join("") : empty("当前没有通过验证的内地校招新机会。0 条比低质量推荐更好。")}
    </section>
  `;
}

function renderPipeline() {
  const groups = groupByStatus(state.applications || []);
  const statuses = Object.keys(groups);
  return `
    ${hero("流程", "投递漏斗", "Closed 不计入 Rejected，香港历史不进入活跃 KPI")}
    <section class="stack">
      ${statuses.length ? statuses.map((status) => `
        <article class="panel">
          <div class="panel-head"><h2>${statusLabel(status)}</h2><span>${groups[status].length} 个</span></div>
          ${groups[status].map(renderCompactJob).join("")}
        </article>
      `).join("") : empty("当前没有内地活跃投递记录")}
    </section>
  `;
}

function renderInterviews() {
  const interviews = state.interviews || [];
  const packs = state.interviewPacks || [];
  return `
    ${hero("面试", "Interview Center", "测评、笔试、面试和复盘集中在这里")}
    <section class="two-col">
      <article class="panel">
        <div class="panel-head"><h2>Interview Records</h2><span>${interviews.length}</span></div>
        ${interviews.length ? interviews.map((item) => `<p>${item.company || item.jobId || "未命名"} · ${item.round || "未记录轮次"}</p>`).join("") : empty("暂无面试记录")}
      </article>
      <article class="panel">
        <div class="panel-head"><h2>Interview Packs</h2><span>${packs.length}</span></div>
        ${packs.length ? packs.map((item) => `<p>${item.jobId} · ${item.version}</p>`).join("") : empty("暂无面试包；有新投递或面试阶段变化时再生成")}
      </article>
    </section>
  `;
}

function renderStoryBank() {
  const bank = state.storyBank || {};
  const intro = bank.coreIntroduction || {};
  const stories = bank.stories || [];
  return `
    ${hero("Story", "长期面试资产", "事实和答案版本分离，Core Introduction 默认锁定")}
    <section class="panel important">
      <div class="panel-head">
        <h2>Core Introduction</h2>
        <span>${intro.locked ? "Locked" : "Editable"}</span>
      </div>
      ${copyBlock("中文 60 秒", intro.introCN60)}
      ${copyBlock("中文 120 秒", intro.introCN120)}
      ${copyBlock("English 60 sec", intro.introEN60)}
      ${copyBlock("English 120 sec", intro.introEN120)}
      <p class="muted">${intro.storyline || ""}</p>
    </section>
    <section class="stack">
      ${stories.map(renderStory).join("")}
    </section>
  `;
}

function renderMe() {
  const resume = currentResume(state.resumes || {});
  const archived = archivedRecords(state.applications || [], state.archive || []);
  return `
    ${hero("我的", "简历版本与历史记录", "香港旧数据在这里保留，不进入内地活跃面板")}
    <section class="panel">
      <div class="panel-head"><h2>简历版本：${resume.version || "未记录"}</h2><span>${resume.profile?.email || ""}</span></div>
      ${(resume.sections || []).map(renderResumeSection).join("") || empty("暂无简历数据")}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Archive / Records</h2><span>${archived.length}</span></div>
      ${archived.slice(0, 20).map(renderCompactJob).join("") || empty("暂无归档记录")}
    </section>
  `;
}

function renderNav() {
  return `
    <nav class="bottom-nav">
      ${tabs.map((tab) => `<button class="${tab.id === activeTab ? "active" : ""}" data-tab="${tab.id}">${tab.label}</button>`).join("")}
    </nav>
  `;
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

function kpi(label, value) {
  return `<article class="kpi"><span>${label}</span><strong>${value}</strong></article>`;
}

function renderWarnings() {
  const errors = state.loadErrors || [];
  const pending = state.pending || [];
  const warnings = [...errors, ...pending.filter((item) => item.status === "open").map((item) => item.content)];
  if (!warnings.length) return "";
  return `<section class="notice">${warnings.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</section>`;
}

function renderJobCard(job) {
  return `
    <article class="job-card">
      <div class="panel-head">
        <h2>${job.company || "未命名公司"}</h2>
        <span>${job.source || "Unknown"}</span>
      </div>
      <h3>${job.title || "未命名岗位"}</h3>
      <div class="tag-row">
        ${tag(job.location)}
        ${tag(job.postedDate ? `发布 ${job.postedDate}` : "发布日期待验证")}
        ${tag(job.deadline ? `截止 ${job.deadline}` : "Deadline 未记录")}
        ${tag(job.salary || "薪资未列出")}
        ${tag(job.experience || "经验未列出")}
      </div>
      <p>${(job.matchReasons || []).join("；") || "等待下一次批处理生成推荐理由"}</p>
      ${(job.gaps || []).length ? `<p class="risk">Gap：${job.gaps.join("；")}</p>` : ""}
      ${(job.risks || []).length ? `<p class="risk">Risk：${job.risks.join("；")}</p>` : ""}
      <div class="actions">${renderLink(job.applyUrl || job.jdUrl || job.officialUrl, job.applyUrl ? "去投递" : "查看招聘页面")}</div>
    </article>
  `;
}

function renderCompactJob(job) {
  return `
    <div class="compact-job">
      <strong>${job.company || "未命名公司"}</strong>
      <span>${job.title || "未命名岗位"}</span>
      <small>${job.location || ""} · ${statusLabel(job.currentStatus)} · ${job.market || ""}</small>
    </div>
  `;
}

function renderEvent(event) {
  return `
    <div class="event">
      <strong>${event.date || ""} ${event.time || ""}</strong>
      <span>${event.company || event.jobId || "未关联岗位"} · ${event.eventType || "Event"}</span>
    </div>
  `;
}

function renderStory(story) {
  return `
    <article class="panel">
      <div class="panel-head">
        <h2>${story.title}</h2>
        <span>成熟度 ${story.maturityScore || 0}</span>
      </div>
      <p>${story.facts?.situation || "Needs User Input"}</p>
      <div class="tag-row">${(story.competencies || []).map(tag).join("")}</div>
    </article>
  `;
}

function renderResumeSection(section) {
  return `
    <details class="resume-section">
      <summary>${section.title}</summary>
      <p class="muted">${section.period || ""} · ${section.location || ""}</p>
      ${copyBlock("复制中文", section.contentCN)}
      ${copyBlock("Copy English", section.contentEN)}
      <div class="tag-row">${(section.tags || []).map(tag).join("")}</div>
    </details>
  `;
}

function copyBlock(label, text = "") {
  const safe = escapeHtml(text || "");
  return `
    <div class="copy-card">
      <div class="panel-head"><h3>${label}</h3><button data-label="${label}" data-copy="${escapeAttr(text || "")}">${label}</button></div>
      <p>${safe}</p>
    </div>
  `;
}

function renderLink(url, label) {
  if (!url) return `<span class="muted">链接待验证</span>`;
  return `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${label}</a>`;
}

function tag(value) {
  if (!value) return "";
  return `<span class="tag">${escapeHtml(value)}</span>`;
}

function empty(text) {
  return `<div class="empty">${text}</div>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/\n/g, "&#10;");
}
