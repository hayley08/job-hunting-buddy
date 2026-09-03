export const PIPELINE_STORAGE_KEY = "campus-os-pipeline-drafts-v1";

export const PIPELINE_STATUS_OPTIONS = [
  "Saved",
  "Recommended",
  "Application In Progress",
  "Applied",
  "Resume Screening",
  "Online Assessment",
  "Written Test",
  "HR Interview",
  "Business Interview",
  "Case Interview",
  "Final Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Closed",
  "Archived"
];

export function loadPipelineDrafts(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(PIPELINE_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizePipelineRecord).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function savePipelineDraft(record, storage = globalThis.localStorage) {
  if (!storage) throw new Error("当前浏览器不支持本地保存");
  const drafts = loadPipelineDrafts(storage);
  const next = [...drafts.filter((item) => item.jobId !== record.jobId), normalizePipelineRecord(record)].filter(Boolean);
  storage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function mergePipelineApplications(repoRecords = [], localRecords = []) {
  const merged = new Map();
  for (const item of repoRecords) {
    if (item?.jobId) merged.set(item.jobId, { ...item, localDraft: false });
  }
  for (const item of localRecords) {
    const normalized = normalizePipelineRecord(item);
    if (!normalized) continue;
    merged.set(normalized.jobId, normalized);
  }
  return [...merged.values()];
}

export function validatePipelineDraft(input) {
  const errors = [];
  if (!String(input.company || "").trim()) errors.push("公司不能为空");
  if (!String(input.title || "").trim()) errors.push("岗位不能为空");
  if (!PIPELINE_STATUS_OPTIONS.includes(input.currentStatus)) errors.push("请选择有效的当前进度");
  if (!isDate(input.statusUpdatedAt)) errors.push("请选择有效的状态日期");
  if (input.appliedDate && !isDate(input.appliedDate)) errors.push("投递日期格式无效");
  if (!["Saved", "Recommended", "Application In Progress"].includes(input.currentStatus) && !input.appliedDate) errors.push("已投递或后续状态请补充投递日期");
  if (input.applyUrl && !/^https:\/\//i.test(String(input.applyUrl).trim())) errors.push("岗位链接必须是有效的 HTTPS URL");
  return errors;
}

export function createLocalPipelineDraft(input, options = {}) {
  const now = options.now || new Date();
  const base = options.baseRecord || {};
  const idFactory = options.idFactory || (() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const currentStatus = input.currentStatus || base.currentStatus || "Application In Progress";
  const statusUpdatedAt = String(input.statusUpdatedAt || "").trim();
  const history = Array.isArray(base.statusHistory) ? [...base.statusHistory] : [];
  const latest = history.at(-1);
  if (!latest || latest.status !== currentStatus || latest.date !== statusUpdatedAt) {
    history.push({ status: currentStatus, date: statusUpdatedAt, sourceOfTruth: "local-draft", notes: String(input.notes || "").trim() || "Offline pipeline update." });
  }
  const jobId = String(base.jobId || input.jobId || `app-local-${idFactory()}`).trim();
  return normalizePipelineRecord({
    ...emptyApplication(),
    ...base,
    jobId,
    company: String(input.company || base.company || "").trim(),
    title: String(input.title || base.title || "").trim(),
    location: String(input.location || base.location || "").trim(),
    applyUrl: String(input.applyUrl || base.applyUrl || "").trim(),
    officialUrl: String(base.officialUrl || input.applyUrl || "").trim(),
    foundDate: base.foundDate || statusUpdatedAt,
    applicationStartedAt: currentStatus === "Application In Progress" ? (base.applicationStartedAt || statusUpdatedAt) : (base.applicationStartedAt || ""),
    appliedDate: String(input.appliedDate || base.appliedDate || "").trim(),
    currentStatus,
    statusUpdatedAt,
    statusHistory: history,
    notes: String(input.notes || base.notes || "").trim(),
    archived: currentStatus === "Archived",
    sourceOfTruth: "local-draft"
  });
}

export function buildPipelineWorkbook(applications, assessments, xlsx = globalThis.XLSX, now = new Date()) {
  if (!xlsx?.utils?.json_to_sheet || !xlsx?.writeFile) throw new Error("Excel 导出组件尚未加载，请刷新后重试");
  const pipelineRows = applications.map(applicationToRow);
  const assessmentRows = assessments.map(assessmentToRow);
  const workbook = xlsx.utils.book_new();
  const pipelineSheet = xlsx.utils.json_to_sheet(pipelineRows);
  pipelineSheet["!cols"] = pipelineWidths();
  pipelineSheet["!autofilter"] = { ref: `A1:AC${Math.max(pipelineRows.length + 1, 1)}` };
  pipelineSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  xlsx.utils.book_append_sheet(workbook, pipelineSheet, "流程");
  const assessmentSheet = xlsx.utils.json_to_sheet(assessmentRows);
  assessmentSheet["!cols"] = assessmentWidths();
  assessmentSheet["!autofilter"] = { ref: `A1:V${Math.max(assessmentRows.length + 1, 1)}` };
  assessmentSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  xlsx.utils.book_append_sheet(workbook, assessmentSheet, "测评");
  return {
    workbook,
    fileName: `${formatShanghaiDate(now)}_pipeline-assessment-tracker.xlsx`,
    pipelineCount: pipelineRows.length,
    assessmentCount: assessmentRows.length
  };
}

export function exportPipelineWorkbook(applications, assessments, xlsx = globalThis.XLSX, now = new Date()) {
  const output = buildPipelineWorkbook(applications, assessments, xlsx, now);
  xlsx.writeFile(output.workbook, output.fileName, { compression: true });
  return output;
}

function normalizePipelineRecord(item) {
  if (!item || typeof item !== "object" || !item.jobId) return null;
  return { ...item, sourceOfTruth: "local-draft", localDraft: true };
}

function emptyApplication() {
  return {
    businessUnit: "", location: "", industry: "", market: "Mainland", source: "Local Draft", sourceJobId: "",
    jdUrl: "", applyUrl: "", officialUrl: "", foundDate: "", postedDate: "", appliedDate: "", deadline: "",
    jobDescription: "", jdSnapshot: "", jdCapturedAt: "", jdKeywords: [], jobFamily: "", campusType: "", salary: "",
    experience: "", matchScore: 0, matchReasons: [], gaps: [], risks: [], statusHistory: [], englishInterviewPossible: false,
    technicalInterviewPossible: false, interviewPackId: "", manualOverrides: {}, notes: "", archived: false
  };
}

function applicationToRow(item) {
  return {
    jobId: item.jobId || "", company: item.company || "", title: item.title || "", businessUnit: item.businessUnit || "",
    location: item.location || "", industry: item.industry || "", market: item.market || "", source: item.source || "",
    sourceJobId: item.sourceJobId || "", currentStatus: item.currentStatus || "", statusUpdatedAt: item.statusUpdatedAt || "",
    appliedDate: item.appliedDate || "", applicationStartedAt: item.applicationStartedAt || "", deadline: item.deadline || "",
    applyUrl: item.applyUrl || "", jdUrl: item.jdUrl || "", officialUrl: item.officialUrl || "", jobFamily: item.jobFamily || "",
    campusType: item.campusType || "", salary: item.salary || "", experience: item.experience || "", matchScore: item.matchScore ?? "",
    notes: item.notes || "", archived: Boolean(item.archived), sourceOfTruth: item.sourceOfTruth || "repo",
    statusHistory: JSON.stringify(item.statusHistory || []), matchReasons: JSON.stringify(item.matchReasons || []),
    risks: JSON.stringify(item.risks || []), gaps: JSON.stringify(item.gaps || [])
  };
}

function assessmentToRow(item) {
  return {
    testId: item.testId || "", company: item.company || "", jobTitle: item.jobTitle || "", jobId: item.jobId || "",
    assessmentScope: item.assessmentScope || "", testType: JSON.stringify(item.testType || []), customTestType: item.customTestType || "",
    status: item.status || "", dueAt: item.dueAt || "", completedAt: item.completedAt || "", testPlatform: item.testPlatform || "",
    duration: item.duration || "", repeatEntry: item.repeatEntry || "", testUrl: item.testUrl || "",
    sourceMaterials: JSON.stringify(item.sourceMaterials || []), assessmentSummary: JSON.stringify(item.assessmentSummary || {}),
    analysisStatus: item.analysisStatus || "", notes: item.notes || "", createdAt: item.createdAt || "", updatedAt: item.updatedAt || "",
    sourceOfTruth: item.sourceOfTruth || "repo", localDraft: Boolean(item.localDraft)
  };
}

function pipelineWidths() {
  return [34, 20, 34, 18, 20, 20, 12, 24, 20, 22, 18, 14, 18, 14, 48, 48, 48, 28, 24, 16, 24, 12, 50, 12, 16, 70, 70, 55, 55].map((wch) => ({ wch }));
}

function assessmentWidths() {
  return [34, 20, 30, 34, 12, 35, 20, 12, 12, 12, 18, 18, 18, 48, 80, 80, 18, 50, 22, 22, 16, 12].map((wch) => ({ wch }));
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function formatShanghaiDate(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
