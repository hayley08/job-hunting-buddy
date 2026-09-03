import { loadData, loadNavigation, saveNavigation } from "./store.js";
import {
  ASSESSMENT_SCOPE_OPTIONS,
  REPEAT_ENTRY_OPTIONS,
  TEST_DURATION_OPTIONS,
  TEST_PLATFORM_OPTIONS,
  TEST_STATUS_OPTIONS,
  TEST_TYPE_OPTIONS,
  assessmentPendingActions,
  assessmentSummaryBullets,
  assessmentUpcomingEvents,
  computeAssessmentStats,
  createLocalAssessment,
  displayTestType,
  exportAssessmentsXlsx,
  formatMonthDay,
  loadAssessmentDrafts,
  mergeAssessments,
  saveAssessmentDraft,
  validateAssessment
} from "./assessments.js";
import {
  createLocalInterview,
  exportInterviewsXlsx,
  loadInterviewDrafts,
  mergeInterviews,
  saveInterviewDraft,
  validateInterview
} from "./interviews.js";
import {
  PIPELINE_STATUS_OPTIONS,
  createLocalPipelineDraft,
  exportPipelineWorkbook,
  loadPipelineDrafts,
  mergePipelineApplications,
  savePipelineDraft,
  validatePipelineDraft
} from "./pipeline.js";
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
  { id: "assessments", label: "测试", icon: "✓" },
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
let assessmentModalOpen = false;
let interviewModalOpen = false;
let pipelineModalOpen = false;
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
  state.localAssessmentDrafts = loadAssessmentDrafts();
  state.localInterviewDrafts = loadInterviewDrafts();
  state.localPipelineDrafts = loadPipelineDrafts();
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
      ${assessmentModalOpen ? renderAssessmentModal() : ""}
      ${interviewModalOpen ? renderInterviewModal() : ""}
      ${pipelineModalOpen ? renderPipelineModal() : ""}
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

  document.querySelectorAll("[data-assessment-new]").forEach((button) => {
    button.addEventListener("click", () => {
      assessmentModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-pipeline-new]").forEach((button) => {
    button.addEventListener("click", () => {
      pipelineModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-pipeline-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      pipelineModalOpen = false;
      render();
    });
  });

  document.querySelectorAll("[data-pipeline-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const message = document.querySelector("[data-pipeline-export-message]");
      try {
        const result = exportPipelineWorkbook(getPipelineApplications(), getAssessmentRecords());
        if (message) message.textContent = `已导出 ${result.fileName}（流程 ${result.pipelineCount} 条，测评 ${result.assessmentCount} 条）`;
      } catch (error) {
        if (message) message.textContent = error.message;
      }
    });
  });

  document.querySelectorAll("[data-assessment-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      assessmentModalOpen = false;
      render();
    });
  });

  document.querySelectorAll("[data-assessment-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const message = document.querySelector("[data-assessment-export-message]");
      try {
        const result = exportAssessmentsXlsx(getAssessmentRecords());
        if (message) message.textContent = `已导出 ${result.fileName}（${result.rowCount} 条）`;
      } catch (error) {
        if (message) message.textContent = error.message;
      }
    });
  });

  document.querySelectorAll("[data-interview-new]").forEach((button) => {
    button.addEventListener("click", () => {
      interviewModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-interview-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      interviewModalOpen = false;
      render();
    });
  });

  document.querySelectorAll("[data-interview-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const message = document.querySelector("[data-interview-export-message]");
      try {
        const result = exportInterviewsXlsx(getInterviewRecords());
        if (message) message.textContent = `已导出 ${result.fileName}（${result.rowCount} 条）`;
      } catch (error) {
        if (message) message.textContent = error.message;
      }
    });
  });

  const assessmentForm = document.querySelector("[data-assessment-form]");
  if (assessmentForm) {
    assessmentForm.addEventListener("submit", handleAssessmentSubmit);
    assessmentForm.querySelectorAll('input[name="testType"]').forEach((input) => input.addEventListener("change", () => {
      const custom = assessmentForm.querySelector("[data-custom-test-type]");
      if (custom) custom.hidden = !assessmentForm.querySelector('input[name="testType"][value="其他"]')?.checked;
    }));
    assessmentForm.querySelectorAll("[data-month-select]").forEach((select) => {
      select.addEventListener("change", () => syncMonthDayOptions(assessmentForm, select.dataset.monthSelect));
    });
  }

  const interviewForm = document.querySelector("[data-interview-form]");
  if (interviewForm) interviewForm.addEventListener("submit", handleInterviewSubmit);

  const pipelineForm = document.querySelector("[data-pipeline-form]");
  if (pipelineForm) {
    pipelineForm.addEventListener("submit", handlePipelineSubmit);
    pipelineForm.elements.jobId?.addEventListener("change", () => fillPipelineFormFromApplication(pipelineForm));
  }
}

function normalizeTab(tab) {
  if (tab === "story") return "interviews";
  return tabs.some((item) => item.id === tab) ? tab : "home";
}

function renderCurrentTab() {
  if (activeTab === "opportunities") return renderOpportunities();
  if (activeTab === "pipeline") return renderPipeline();
  if (activeTab === "assessments") return renderAssessments();
  if (activeTab === "interviews") return renderInterviewWorkspace();
  if (activeTab === "me") return renderMe();
  return renderHome();
}

function renderHome() {
  const kpis = computeKpis(state.applications || []);
  const upcoming = byUpcomingDate([...(state.events || []), ...assessmentUpcomingEvents(getAssessmentRecords())]).slice(0, 6);
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
  const kpis = computeKpis(getPipelineApplications());
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
    <section class="assessment-toolbar pipeline-toolbar">
      <div>
        <strong>流程离线管理</strong>
        <p class="muted">新建/修改先保存在当前浏览器；导出的 Excel 第一张为「流程」，第二张为「测评」。</p>
      </div>
      <div class="assessment-toolbar-actions">
        <button class="primary-button" data-pipeline-new>+ 新建流程</button>
        <button class="secondary-button" data-pipeline-export>导出 Excel</button>
      </div>
    </section>
    <p class="muted local-draft-note">Excel 可离线修改后交给 Codex / Daily Run 校验导入；Local Draft 不会自动跨设备同步。</p>
    <p class="assessment-export-message" data-pipeline-export-message aria-live="polite"></p>
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

function renderPipelineModal() {
  const applications = getPipelineApplications().filter((item) => item.jobId && !item.localDraft);
  const options = applications.map((item) => `<option value="${escapeAttr(item.jobId)}">${escapeHtml(`${item.company} · ${item.title}`)}</option>`).join("");
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="assessment-modal" role="dialog" aria-modal="true" aria-labelledby="pipeline-modal-title">
        <div class="modal-head">
          <div><p class="eyebrow">Local Draft</p><h2 id="pipeline-modal-title">新建 / 更新流程</h2></div>
          <button type="button" data-pipeline-cancel aria-label="关闭">×</button>
        </div>
        <form class="assessment-form" data-pipeline-form novalidate>
          <label class="form-field"><span>关联现有岗位（可选）</span><select name="jobId"><option value="">新岗位 / 暂不关联</option>${options}</select></label>
          <div class="form-grid">
            ${textField("company", "公司", "例如：地平线", true)}
            ${textField("title", "岗位", "例如：人力资源管培生", true)}
          </div>
          <div class="form-grid">
            ${selectField("currentStatus", "当前进度", PIPELINE_STATUS_OPTIONS, "Applied")}
            <label class="form-field"><span>状态日期 *</span><input name="statusUpdatedAt" type="date" required></label>
          </div>
          <div class="form-grid">
            <label class="form-field"><span>投递日期</span><input name="appliedDate" type="date"></label>
            ${textField("location", "地点", "例如：北京")}
          </div>
          <label class="form-field"><span>岗位 / 投递链接</span><input name="applyUrl" type="url" inputmode="url" placeholder="https://..."></label>
          ${textareaField("notes", "备注", "记录下一步、结果或需要核实的信息")}
          <p class="assessment-form-error" data-pipeline-form-error aria-live="assertive"></p>
          <div class="modal-actions">
            <button type="button" class="secondary-button" data-pipeline-cancel>取消</button>
            <button type="submit" class="primary-button">保存 Local Draft</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function handlePipelineSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = Object.fromEntries(new FormData(form).entries());
  const baseRecord = (state.applications || []).find((item) => item.jobId === input.jobId);
  const errors = validatePipelineDraft(input);
  const errorNode = form.querySelector("[data-pipeline-form-error]");
  if (errors.length) {
    errorNode.textContent = errors.join("；");
    return;
  }
  const record = createLocalPipelineDraft(input, { baseRecord });
  state.localPipelineDrafts = savePipelineDraft(record);
  pipelineModalOpen = false;
  render();
}

function fillPipelineFormFromApplication(form) {
  const record = (state.applications || []).find((item) => item.jobId === form.elements.jobId.value);
  if (!record) return;
  ["company", "title", "location", "currentStatus", "statusUpdatedAt", "appliedDate", "applyUrl", "notes"].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = record[key] || "";
  });
}

function getPipelineApplications() {
  return mergePipelineApplications(state.applications || [], state.localPipelineDrafts || []);
}

function renderAssessments() {
  const records = getAssessmentRecords();
  const stats = computeAssessmentStats(records);
  return `
    ${hero("测试", "Assessment Tracker", "独立记录海测、笔试、AI 面试和英语面试；不会改变岗位 application 状态")}
    <section class="assessment-toolbar">
      <div class="assessment-stats" aria-label="测试统计">
        ${miniKpi("待完成", stats.pending)}
        ${miniKpi("7天内截止", stats.dueWithin7Days)}
        ${miniKpi("已完成", stats.completed)}
        ${miniKpi("海测", stats.assessmentScope)}
      </div>
      <div class="assessment-toolbar-actions">
        <button class="primary-button" data-assessment-new>+ 新建测试</button>
        <button class="secondary-button" data-assessment-export>导出 Excel</button>
      </div>
    </section>
    <p class="muted local-draft-note">网页手动新增的数据仅保存在当前浏览器并标记为 <strong>Local Draft</strong>；不会假装已同步到 GitHub 或其他设备。</p>
    <p class="assessment-export-message" data-assessment-export-message aria-live="polite"></p>
    <section class="table-panel assessment-panel">
      <div class="assessment-grid" role="table" aria-label="Assessment tracker">
        <div class="assessment-grid-head" role="row">
          <span>公司</span><span>岗位</span><span>海测类型</span><span>测试类型</span><span>截止日期</span><span>状态</span><span>测试重点</span><span>操作</span>
        </div>
        ${records.map(renderAssessmentRow).join("") || empty("暂无测试记录；点击“+ 新建测试”可先保存 Local Draft。")}
      </div>
    </section>
  `;
}

function renderAssessmentRow(item) {
  const bullets = assessmentSummaryBullets(item);
  return `
    <article class="assessment-record">
      <div class="assessment-row" role="row">
        <div class="assessment-cell assessment-company" data-label="公司"><strong>${escapeHtml(item.company)}</strong>${item.localDraft ? `<small class="local-draft-badge">Local Draft</small>` : ""}</div>
        <div class="assessment-cell assessment-title" data-label="岗位"><strong>${escapeHtml(item.jobTitle)}</strong>${item.jobId ? `<small>${escapeHtml(item.jobId)}</small>` : `<small>jobId 待关联</small>`}</div>
        <div class="assessment-cell" data-label="海测类型">${tag(item.assessmentScope || "未记录")}</div>
        <div class="assessment-cell" data-label="测试类型"><span class="assessment-type-tags">${displayTestType(item).split("；").map(tag).join("")}</span></div>
        <div class="assessment-cell" data-label="截止日期">${escapeHtml(formatMonthDay(item.dueAt))}</div>
        <div class="assessment-cell" data-label="状态"><span class="status-pill ${assessmentStatusClass(item.status)}">${escapeHtml(item.status || "待完成")}</span></div>
        <div class="assessment-cell assessment-focus" data-label="测试重点">${renderConciseAssessmentSummary(bullets, item.analysisStatus)}</div>
        <div class="assessment-cell assessment-operation" data-label="操作">${item.testUrl ? `<a href="${escapeAttr(item.testUrl)}" target="_blank" rel="noreferrer">打开测试</a>` : `<span class="muted">链接待补</span>`}</div>
      </div>
      ${renderAssessmentDetail(item)}
    </article>
  `;
}

function renderConciseAssessmentSummary(bullets, analysisStatus) {
  if (!bullets.length) return `<span class="analysis-pending">${analysisStatus === "NEEDS_SOURCE" ? "缺少原始资料" : "待基于全部资料分析"}</span>`;
  return `<ul class="assessment-focus-list">${bullets.slice(0, 6).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>${analysisStatus === "STALE" ? `<small class="analysis-stale">有新资料，待重新分析</small>` : ""}`;
}

function renderAssessmentDetail(item) {
  const summary = item.assessmentSummary;
  const materials = item.sourceMaterials || [];
  return `
    <details class="assessment-detail-row">
      <summary>查看完整分析与原始资料（${materials.length}）</summary>
      <div class="assessment-detail-content">
        <section class="assessment-analysis-panel">
          <div class="panel-head"><h3>完整分析总结</h3>${analysisStatusBadge(item.analysisStatus)}</div>
          ${summary ? `
            ${analysisSection("测试组成", summary.testComposition)}
            ${analysisSection("重点题型", summary.keyQuestionTypes)}
            ${analysisSection("时间与节奏", summary.timingAndPacing)}
            ${analysisSection("考察重点", summary.competenciesAssessed)}
            ${analysisSection("高频信息", summary.recurringSignals)}
            ${analysisSection("准备建议", summary.preparationAdvice)}
            ${analysisSection("信息冲突 / 待确认", summary.conflicts, true)}
            <p class="analysis-meta">综合材料 ${summary.sourceMaterialIds?.length || 0} 份 · 分析时间 ${escapeHtml(formatUpdatedAt(summary.analyzedAt))}</p>
          ` : `<p class="analysis-pending">尚无分析结果。原始资料不会直接作为“测试重点”；需由 Codex / Daily Run 阅读全部材料后生成。</p>`}
        </section>
        <section class="assessment-sources-panel">
          <h3>原始资料来源</h3>
          ${materials.length ? materials.map(renderSourceMaterial).join("") : `<p class="muted">尚未保存原始资料。</p>`}
        </section>
      </div>
    </details>
  `;
}

function analysisSection(title, values, emphasize = false) {
  const items = Array.isArray(values) ? values : [];
  return `<div class="analysis-section ${emphasize && items.length ? "analysis-conflict" : ""}"><h4>${escapeHtml(title)}</h4>${items.length ? `<ul>${items.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>` : `<p class="muted">材料未提供 / 未发现可靠信息</p>`}</div>`;
}

function analysisStatusBadge(status) {
  const labels = { CURRENT: "分析已更新", STALE: "有新资料·待重新分析", NOT_ANALYZED: "待分析", NEEDS_SOURCE: "缺少资料" };
  return `<span class="analysis-status ${String(status || "NEEDS_SOURCE").toLowerCase()}">${escapeHtml(labels[status] || labels.NEEDS_SOURCE)}</span>`;
}

function renderSourceMaterial(material) {
  const sourceUrl = /^https?:\/\//i.test(material.sourceUrl || "") ? material.sourceUrl : "";
  const reference = sourceUrl || material.storageRef || "";
  return `
    <details class="source-material">
      <summary>${escapeHtml(material.title || "未命名资料")} · ${escapeHtml(material.materialType || "other")}</summary>
      <div class="source-material-body">
        <p class="muted">ID: ${escapeHtml(material.materialId || "")} · 保存时间: ${escapeHtml(formatUpdatedAt(material.capturedAt))}</p>
        ${reference ? `<p>${sourceUrl ? `<a href="${escapeAttr(sourceUrl)}" target="_blank" rel="noreferrer">打开原始网页</a>` : escapeHtml(reference)}</p>` : ""}
        ${material.rawContent ? `<pre>${escapeHtml(material.rawContent)}</pre>` : `<p class="muted">原文件通过引用保存，未内嵌文本。</p>`}
      </div>
    </details>
  `;
}

function assessmentStatusClass(status) {
  if (status === "已完成") return "green";
  if (status === "已过期") return "gray";
  return "amber";
}

function renderAssessmentModal() {
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="assessment-modal" role="dialog" aria-modal="true" aria-labelledby="assessment-modal-title">
        <div class="modal-head">
          <div><p class="eyebrow">Local Draft</p><h2 id="assessment-modal-title">新建测试</h2></div>
          <button type="button" data-assessment-cancel aria-label="关闭">×</button>
        </div>
        <form class="assessment-form" data-assessment-form novalidate>
          <div class="form-grid">
            ${textField("company", "公司", "例如：小鹏汽车", true)}
            ${textField("jobTitle", "岗位", "例如：HRBP 培训生", true)}
          </div>
          ${choiceField("assessmentScope", "海测类型", ASSESSMENT_SCOPE_OPTIONS, "海测")}
          ${multiChoiceField("testType", "测试类型（可多选）", TEST_TYPE_OPTIONS)}
          ${selectField("status", "状态", TEST_STATUS_OPTIONS, "待完成")}
          <label class="form-field" data-custom-test-type hidden><span>自定义测试类型</span><input name="customTestType" type="text" placeholder="请输入测试类型"></label>
          <div class="form-grid">
            ${monthDayField("due", "截止日期")}
            ${monthDayField("completed", "完成日期")}
          </div>
          <div class="form-grid three-col-form">
            ${selectField("testPlatform", "测试平台", TEST_PLATFORM_OPTIONS, "待确认")}
            ${selectField("duration", "预计耗时", TEST_DURATION_OPTIONS, "待确认")}
            ${selectField("repeatEntry", "是否可重复进入", REPEAT_ENTRY_OPTIONS, "未知")}
          </div>
          <label class="form-field"><span>测试链接</span><input name="testUrl" type="url" inputmode="url" placeholder="https://..."></label>
          <div class="form-grid">
            ${textareaField("sourceMaterialText", "原始资料（可选）", "粘贴通知或材料原文；这里只保存 sourceMaterials，不会直接显示为测试重点")}
            ${textareaField("notes", "备注", "仅记录你确认过的事实和后续动作")}
          </div>
          <p class="assessment-form-error" data-assessment-form-error aria-live="assertive"></p>
          <div class="modal-actions">
            <button type="button" class="secondary-button" data-assessment-cancel>取消</button>
            <button type="submit" class="primary-button">保存 Local Draft</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function handleAssessmentSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const input = Object.fromEntries(formData.entries());
  input.testType = formData.getAll("testType");
  input.dueAt = monthDayFromForm(formData, "due");
  input.completedAt = monthDayFromForm(formData, "completed");
  input.jobId = findMatchingJobId(input.company, input.jobTitle);
  const errors = validateAssessment(input);
  const errorNode = form.querySelector("[data-assessment-form-error]");
  if (errors.length) {
    errorNode.textContent = errors.join("；");
    return;
  }
  const record = createLocalAssessment(input);
  state.localAssessmentDrafts = saveAssessmentDraft(record);
  assessmentModalOpen = false;
  render();
}

function getAssessmentRecords() {
  return mergeAssessments(state.tests || [], state.localAssessmentDrafts || []);
}

function findMatchingJobId(company, title) {
  const normalize = (value) => String(value || "").toLocaleLowerCase().replace(/[\s/／·・()（）\[\]【】_-]+/g, "");
  const companyKey = normalize(company);
  const titleKey = normalize(title);
  if (!companyKey || !titleKey) return "";
  const candidates = [...(state.applications || []), ...(state.opportunities || []), ...(state.historicalOpportunities || [])];
  const exact = candidates.find((job) => normalize(job.company) === companyKey && normalize(job.title) === titleKey);
  if (exact) return exact.jobId || "";
  const close = candidates.find((job) => normalize(job.company) === companyKey && (normalize(job.title).includes(titleKey) || titleKey.includes(normalize(job.title))));
  return close?.jobId || "";
}

function textField(name, label, placeholder, required = false) {
  return `<label class="form-field"><span>${escapeHtml(label)}${required ? " *" : ""}</span><input name="${name}" type="text" placeholder="${escapeAttr(placeholder)}" ${required ? "required" : ""}></label>`;
}

function textareaField(name, label, placeholder) {
  return `<label class="form-field"><span>${escapeHtml(label)}</span><textarea name="${name}" rows="4" placeholder="${escapeAttr(placeholder)}"></textarea></label>`;
}

function selectField(name, label, options, selected) {
  return `<label class="form-field"><span>${escapeHtml(label)}</span><select name="${name}">${options.map((option) => `<option value="${escapeAttr(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
}

function choiceField(name, label, options, selected) {
  return `<fieldset class="choice-field"><legend>${escapeHtml(label)}</legend><div class="choice-row">${options.map((option) => `<label><input type="radio" name="${name}" value="${escapeAttr(option)}" ${option === selected ? "checked" : ""}><span>${escapeHtml(option)}</span></label>`).join("")}</div></fieldset>`;
}

function multiChoiceField(name, label, options) {
  return `<fieldset class="choice-field"><legend>${escapeHtml(label)}</legend><div class="choice-row">${options.map((option) => `<label><input type="checkbox" name="${name}" value="${escapeAttr(option)}"><span>${escapeHtml(option)}</span></label>`).join("")}</div></fieldset>`;
}

function monthDayField(prefix, label) {
  const months = Array.from({ length: 12 }, (_, index) => `<option value="${String(index + 1).padStart(2, "0")}">${index + 1} 月</option>`).join("");
  const days = Array.from({ length: 31 }, (_, index) => `<option value="${String(index + 1).padStart(2, "0")}">${index + 1} 日</option>`).join("");
  return `<label class="form-field"><span>${escapeHtml(label)}</span><span class="month-day-input"><select name="${prefix}Month" data-month-select="${prefix}" aria-label="${escapeAttr(label)}月份"><option value="">月份</option>${months}</select><select name="${prefix}Day" aria-label="${escapeAttr(label)}日期"><option value="">日期</option>${days}</select></span></label>`;
}

function monthDayFromForm(formData, prefix) {
  const month = String(formData.get(`${prefix}Month`) || "");
  const day = String(formData.get(`${prefix}Day`) || "");
  if (!month && !day) return "";
  return `${month || "00"}-${day || "00"}`;
}

function syncMonthDayOptions(form, prefix) {
  const month = Number(form.elements[`${prefix}Month`]?.value || 0);
  const daySelect = form.elements[`${prefix}Day`];
  if (!daySelect) return;
  const maxDays = month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31;
  [...daySelect.options].forEach((option) => {
    option.disabled = Boolean(option.value) && Number(option.value) > maxDays;
  });
  if (Number(daySelect.value) > maxDays) daySelect.value = "";
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
  const interviews = getInterviewRecords();
  const packs = state.interviewPacks || [];
  return `
    <section class="panel section-block">
      <div class="panel-head interview-records-head">
        <div>
          <h2>面试记录 / Interview Records</h2>
          <p class="muted">真实发生的面试问题和轮次复盘会沉淀在这里。</p>
        </div>
        <div class="assessment-toolbar-actions">
          <button class="primary-button" data-interview-new>+ 新建面试</button>
          <button class="secondary-button" data-interview-export>导出 Excel</button>
        </div>
      </div>
      <p class="muted local-draft-note">网页手动新增的数据仅保存在当前浏览器并标记为 <strong>Local Draft</strong>；导出 Excel 后可交给 Codex / Daily Run 正式导入。</p>
      <p class="assessment-export-message" data-interview-export-message aria-live="polite"></p>
      <p class="interview-record-count">${interviews.length} records · ${packs.length} packs</p>
      ${interviews.length ? interviews.map(renderInterviewRecord).join("") : empty("暂无面试记录；收到测评或面试后会写入 persistent interview data。")}
    </section>
  `;
}

function renderInterviewModal() {
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="assessment-modal" role="dialog" aria-modal="true" aria-labelledby="interview-modal-title">
        <div class="modal-head">
          <div><p class="eyebrow">Local Draft</p><h2 id="interview-modal-title">新建面试</h2></div>
          <button type="button" data-interview-cancel aria-label="关闭">×</button>
        </div>
        <form class="assessment-form" data-interview-form novalidate>
          <div class="form-grid">
            ${textField("company", "公司", "例如：宝洁", true)}
            ${interviewJobSelect()}
          </div>
          <div class="form-grid">
            ${textField("round", "面试轮次", "例如：HR Interview / 一面", true)}
            <label class="form-field"><span>面试日期 *</span><input name="date" type="date" required></label>
          </div>
          ${textareaField("questions", "面试问题", "每行填写一个问题；保存后仍使用现有 questions 数组字段")}
          <p class="assessment-form-error" data-interview-form-error aria-live="assertive"></p>
          <div class="modal-actions">
            <button type="button" class="secondary-button" data-interview-cancel>取消</button>
            <button type="submit" class="primary-button">保存 Local Draft</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function interviewJobSelect() {
  const options = (state.applications || []).filter((item) => item.jobId).map((item) =>
    `<option value="${escapeAttr(item.jobId)}">${escapeHtml(`${item.company} · ${item.title}`)}</option>`
  ).join("");
  return `<label class="form-field"><span>关联岗位（可选）</span><select name="jobId"><option value="">暂不关联</option>${options}</select></label>`;
}

function handleInterviewSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = Object.fromEntries(new FormData(form).entries());
  const linkedJob = (state.applications || []).find((item) => item.jobId === input.jobId);
  if (linkedJob) input.company = linkedJob.company;
  if (!input.jobId) input.jobId = findUniqueApplicationByCompany(input.company)?.jobId || "";
  const errors = validateInterview(input);
  const errorNode = form.querySelector("[data-interview-form-error]");
  if (errors.length) {
    errorNode.textContent = errors.join("；");
    return;
  }
  const record = createLocalInterview(input);
  state.localInterviewDrafts = saveInterviewDraft(record);
  interviewModalOpen = false;
  render();
}

function getInterviewRecords() {
  return mergeInterviews(state.interviews || [], state.localInterviewDrafts || []);
}

function findUniqueApplicationByCompany(company) {
  const normalize = (value) => String(value || "").toLocaleLowerCase().replace(/[\s/／·・()（）\[\]【】_-]+/g, "");
  const companyKey = normalize(company);
  const matches = (state.applications || []).filter((item) => normalize(item.company) === companyKey);
  return matches.length === 1 ? matches[0] : null;
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
  const applications = activeApplications(getPipelineApplications()).map((job) => ({
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
  const applications = applicationInProgress(state.applications || []).map((job) => ({
    ...job,
    actionPriority: deadlineDistance(job.deadline) !== "" ? "HIGH" : "HIGH",
    reminder: inProgressReminder(job),
    actionLabel: "继续投递",
    actionKind: "application"
  }));
  return [...applications, ...assessmentPendingActions(getAssessmentRecords())];
}

function renderPendingActions(actions) {
  if (!actions.length) return "";
  return `
    <section class="panel pending-actions high-priority">
      <div class="panel-head">
        <div>
          <h2>需要行动</h2>
          <p class="muted">投递中和 7 天内截止的未完成测试属于高优先级 Pending Action。</p>
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
            ${renderLink(job.applyUrl || job.jdUrl || job.officialUrl, job.actionLabel || "继续处理")}
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
      <div class="cell cell-company" data-label="公司"><strong>${escapeHtml(job.company || "未命名公司")}</strong><small>${escapeHtml(job.rowLabel || job.source || "")}</small>${job.localDraft ? `<small class="local-draft-badge">Local Draft</small>` : ""}</div>
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
      <strong>${escapeHtml(`${event.displayDate || event.date || ""} ${event.time || ""}`)}</strong>
      <span>${escapeHtml(event.company || event.jobId || "未关联岗位")} · ${escapeHtml(event.eventType || "Event")}</span>
    </div>
  `;
}

function renderInterviewRecord(item) {
  const linkedJob = (state.applications || []).find((job) => job.jobId === item.jobId);
  return `
    <article class="record-row">
      <strong>${escapeHtml(item.company || item.jobId || "未命名")}${item.localDraft ? ` <small class="local-draft-badge">Local Draft</small>` : ""}</strong>
      <span>${escapeHtml(item.round || "未记录轮次")} · ${escapeHtml(item.date || "未记录日期")}</span>
      ${linkedJob ? `<small>${escapeHtml(linkedJob.title)}</small>` : ""}
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
  const sectionMeta = [section.period, section.location].filter(Boolean).map(escapeHtml).join(" · ");
  return `
    <details class="resume-section" open>
      <summary>${escapeHtml(section.title)}</summary>
      ${sectionMeta ? `<p class="muted">${sectionMeta}</p>` : ""}
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
