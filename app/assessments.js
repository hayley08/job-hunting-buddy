export const ASSESSMENT_STORAGE_KEY = "campus-os-assessment-drafts-v1";

export const ASSESSMENT_SCOPE_OPTIONS = ["海测", "非海测"];
export const TEST_TYPE_OPTIONS = [
  "笔试｜行测 + 图推 + 性格测试",
  "笔试｜性格测试",
  "AI 笔试",
  "AI 面试",
  "英语面试",
  "其他"
];
export const TEST_STATUS_OPTIONS = ["待完成", "已完成", "已过期"];
export const TEST_PLATFORM_OPTIONS = ["待确认", "牛客", "赛码", "北森", "SHL", "AON / cut-e", "Moka", "飞书招聘", "企业自建", "其他"];
export const TEST_DURATION_OPTIONS = ["待确认", "30 分钟以内", "30–60 分钟", "60–90 分钟", "90–120 分钟", "120 分钟以上"];
export const REPEAT_ENTRY_OPTIONS = ["未知", "可重复进入", "不可重复进入"];

export function mergeAssessments(repoRecords = [], localRecords = []) {
  const merged = new Map();
  for (const item of [...repoRecords, ...localRecords]) {
    if (!item?.testId) continue;
    merged.set(item.testId, { ...item, localDraft: item.sourceOfTruth === "local-draft" });
  }
  return [...merged.values()].sort((a, b) => assessmentSortKey(a).localeCompare(assessmentSortKey(b)));
}

export function loadAssessmentDrafts(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(ASSESSMENT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAssessmentDraft(record, storage = globalThis.localStorage) {
  const drafts = loadAssessmentDrafts(storage);
  const next = drafts.filter((item) => item.testId !== record.testId);
  next.push(record);
  storage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function validateAssessment(input) {
  const errors = [];
  if (!String(input.company || "").trim()) errors.push("公司不能为空");
  if (!String(input.jobTitle || "").trim()) errors.push("岗位不能为空");
  const received = parseDate(input.receivedAt);
  const due = parseDate(input.dueAt);
  if (received && due && due < received) errors.push("截止时间不能早于收到时间");
  if (input.status === "已完成" && !parseDate(input.completedAt)) errors.push("已完成状态请补充完成时间");
  if (input.testType === "其他" && !String(input.customTestType || "").trim()) errors.push("选择“其他”后请填写自定义测试类型");
  if (input.testUrl && !/^https:\/\//i.test(String(input.testUrl).trim())) errors.push("测试链接必须是有效的 HTTPS URL");
  return errors;
}

export function createLocalAssessment(input, options = {}) {
  const now = options.now || new Date();
  const createdAt = now.toISOString();
  const company = String(input.company || "").trim();
  const jobTitle = String(input.jobTitle || "").trim();
  const idFactory = options.idFactory || (() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return {
    testId: `test-local-${idFactory()}`,
    company,
    jobTitle,
    jobId: String(input.jobId || "").trim(),
    assessmentScope: input.assessmentScope || "非海测",
    testType: input.testType || TEST_TYPE_OPTIONS[0],
    customTestType: input.testType === "其他" ? String(input.customTestType || "").trim() : "",
    status: input.status || "待完成",
    receivedAt: normalizeDateTime(input.receivedAt),
    dueAt: normalizeDateTime(input.dueAt),
    completedAt: normalizeDateTime(input.completedAt),
    testPlatform: input.testPlatform || "待确认",
    duration: input.duration || "待确认",
    repeatEntry: input.repeatEntry || "未知",
    testUrl: String(input.testUrl || "").trim(),
    summary: String(input.summary || "").trim(),
    preparationFocus: [],
    notes: String(input.notes || "").trim(),
    createdAt,
    updatedAt: createdAt,
    sourceOfTruth: "local-draft"
  };
}

export function computeAssessmentStats(records, now = new Date()) {
  const pending = records.filter((item) => item.status === "待完成");
  return {
    pending: pending.length,
    dueWithin7Days: pending.filter((item) => isWithinNextDays(item.dueAt, 7, now)).length,
    completed: records.filter((item) => item.status === "已完成").length,
    assessmentScope: records.filter((item) => item.assessmentScope === "海测").length
  };
}

export function assessmentUpcomingEvents(records, now = new Date()) {
  return records
    .filter((item) => item.status === "待完成" && isWithinNextDays(item.dueAt, 7, now))
    .map((item) => {
      const localDue = shanghaiDateTimeParts(item.dueAt);
      return {
      eventId: `assessment-${item.testId}`,
      jobId: item.jobId || "",
      company: item.company,
      eventType: displayTestType(item),
      date: localDue.date,
      time: localDue.time,
      completed: false,
      status: "scheduled",
      testId: item.testId,
      testUrl: item.testUrl
      };
    });
}

export function assessmentPendingActions(records, now = new Date()) {
  return records
    .filter((item) => item.status === "待完成" && isWithinNextDays(item.dueAt, 7, now))
    .map((item) => ({
      company: item.company,
      title: `${item.jobTitle} · ${displayTestType(item)}`,
      applyUrl: item.testUrl,
      reminder: item.dueAt ? `测试截止：${formatLocalDateTime(item.dueAt)}` : "测试待完成",
      actionLabel: "开始测试",
      actionKind: "assessment"
    }));
}

export function displayTestType(item) {
  return item.testType === "其他" && item.customTestType ? item.customTestType : item.testType || "未分类";
}

export function buildAssessmentWorkbook(records, xlsx = globalThis.XLSX, now = new Date()) {
  if (!xlsx?.utils?.json_to_sheet || !xlsx?.writeFile) throw new Error("Excel 导出组件尚未加载，请刷新后重试");
  const rows = records.map((item) => ({
    testId: item.testId || "",
    company: item.company || "",
    jobTitle: item.jobTitle || "",
    jobId: item.jobId || "",
    assessmentScope: item.assessmentScope || "",
    testType: displayTestType(item),
    status: item.status || "",
    receivedAt: excelDate(item.receivedAt),
    dueAt: excelDate(item.dueAt),
    completedAt: excelDate(item.completedAt),
    testPlatform: item.testPlatform || "",
    duration: item.duration || "",
    repeatEntry: item.repeatEntry || "",
    testUrl: item.testUrl || "",
    summary: item.summary || "",
    preparationFocus: Array.isArray(item.preparationFocus) ? item.preparationFocus.join("；") : item.preparationFocus || "",
    notes: item.notes || "",
    createdAt: excelDate(item.createdAt),
    updatedAt: excelDate(item.updatedAt),
    sourceOfTruth: item.sourceOfTruth || "repo"
  }));
  const worksheet = xlsx.utils.json_to_sheet(rows, { cellDates: true });
  worksheet["!cols"] = [
    { wch: 34 }, { wch: 20 }, { wch: 28 }, { wch: 34 }, { wch: 12 }, { wch: 30 }, { wch: 12 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 42 },
    { wch: 42 }, { wch: 42 }, { wch: 42 }, { wch: 20 }, { wch: 20 }, { wch: 16 }
  ];
  worksheet["!autofilter"] = { ref: `A1:T${Math.max(rows.length + 1, 1)}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Tests");
  const fileName = `${formatShanghaiDate(now)}_assessment-tracker.xlsx`;
  return { workbook, fileName, rowCount: rows.length };
}

export function exportAssessmentsXlsx(records, xlsx = globalThis.XLSX, now = new Date()) {
  const output = buildAssessmentWorkbook(records, xlsx, now);
  xlsx.writeFile(output.workbook, output.fileName, { compression: true, cellDates: true });
  return output;
}

export function formatLocalDateTime(value) {
  const parts = shanghaiDateTimeParts(value);
  return parts.date ? `${parts.date} ${parts.time}` : "未记录";
}

function assessmentSortKey(item) {
  const priority = item.status === "待完成" ? "0" : item.status === "已完成" ? "1" : "2";
  return `${priority}-${item.dueAt || "9999"}-${item.company || ""}-${item.jobTitle || ""}`;
}

function isWithinNextDays(value, days, now) {
  const date = parseDate(value);
  if (!date) return false;
  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return date >= start && date <= end;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDateTime(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : "";
}

function excelDate(value) {
  return parseDate(value) || "";
}

function shanghaiDateTimeParts(value) {
  const date = parseDate(value);
  if (!date) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

function formatShanghaiDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
