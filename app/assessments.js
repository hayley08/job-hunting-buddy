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
    merged.set(item.testId, normalizeAssessmentRecord(item));
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

export function appendSourceMaterials(record, materials = [], options = {}) {
  const now = options.now || new Date();
  const current = normalizeAssessmentRecord(record);
  const combined = [...current.sourceMaterials];
  const known = new Set(combined.map(sourceMaterialKey));
  for (const material of materials.map((item, index) => normalizeSourceMaterial(item, now, index)).filter(Boolean)) {
    const key = sourceMaterialKey(material);
    if (known.has(key)) continue;
    combined.push(material);
    known.add(key);
  }
  const added = combined.length > current.sourceMaterials.length;
  return {
    ...current,
    sourceMaterials: combined,
    analysisStatus: added ? (current.assessmentSummary ? "STALE" : "NOT_ANALYZED") : current.analysisStatus,
    updatedAt: added ? now.toISOString() : current.updatedAt
  };
}

export function applyAssessmentAnalysis(record, summary, options = {}) {
  const now = options.now || new Date();
  const current = normalizeAssessmentRecord(record);
  if (!current.sourceMaterials.length) throw new Error("没有原始资料，不能生成测试总结");
  const assessmentSummary = normalizeAssessmentSummary({
    ...summary,
    sourceMaterialIds: current.sourceMaterials.map((item) => item.materialId),
    analyzedAt: now.toISOString()
  });
  if (!assessmentSummary) throw new Error("分析总结必须包含 3–6 条精炼测试重点");
  if (assessmentSummary.preparationAdvice.length < 3 || assessmentSummary.preparationAdvice.length > 5) {
    throw new Error("准备建议必须包含 3–5 条可执行事项");
  }
  return { ...current, assessmentSummary, analysisStatus: "CURRENT", updatedAt: now.toISOString() };
}

export function validateAssessment(input) {
  const errors = [];
  if (!String(input.company || "").trim()) errors.push("公司不能为空");
  if (!String(input.jobTitle || "").trim()) errors.push("岗位不能为空");
  const testTypes = normalizeTestTypes(input.testType);
  if (!testTypes.length) errors.push("请至少选择一种测试类型");
  if (input.dueAt && !isValidMonthDay(input.dueAt)) errors.push("截止日期格式无效");
  if (input.completedAt && !isValidMonthDay(input.completedAt)) errors.push("完成日期格式无效");
  if (input.status === "已完成" && !isValidMonthDay(input.completedAt)) errors.push("已完成状态请补充完成日期");
  if (testTypes.includes("其他") && !String(input.customTestType || "").trim()) errors.push("选择“其他”后请填写自定义测试类型");
  if (input.testUrl && !/^https:\/\//i.test(String(input.testUrl).trim())) errors.push("测试链接必须是有效的 HTTPS URL");
  return errors;
}

export function createLocalAssessment(input, options = {}) {
  const now = options.now || new Date();
  const createdAt = now.toISOString();
  const company = String(input.company || "").trim();
  const jobTitle = String(input.jobTitle || "").trim();
  const idFactory = options.idFactory || (() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const rawMaterial = String(input.sourceMaterialText || "").trim();
  const sourceMaterials = rawMaterial ? [normalizeSourceMaterial({
    materialId: `material-local-${idFactory()}`,
    materialType: "text",
    title: "网页手动录入原始资料",
    rawContent: rawMaterial,
    capturedAt: createdAt
  }, now, 0)] : [];
  return {
    testId: `test-local-${idFactory()}`,
    company,
    jobTitle,
    jobId: String(input.jobId || "").trim(),
    assessmentScope: input.assessmentScope || "海测",
    testType: normalizeTestTypes(input.testType),
    customTestType: normalizeTestTypes(input.testType).includes("其他") ? String(input.customTestType || "").trim() : "",
    status: input.status || "待完成",
    dueAt: normalizeMonthDay(input.dueAt),
    completedAt: normalizeMonthDay(input.completedAt),
    testPlatform: input.testPlatform || "待确认",
    duration: input.duration || "待确认",
    repeatEntry: input.repeatEntry || "未知",
    testUrl: String(input.testUrl || "").trim(),
    sourceMaterials,
    assessmentSummary: null,
    analysisStatus: sourceMaterials.length ? "NOT_ANALYZED" : "NEEDS_SOURCE",
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
      const due = resolveMonthDay(item.dueAt, now);
      const localDue = shanghaiDateParts(due);
      return {
      eventId: `assessment-${item.testId}`,
      jobId: item.jobId || "",
      company: item.company,
      eventType: displayTestType(item),
      date: localDue.date,
      displayDate: formatMonthDay(item.dueAt),
      time: "",
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
      reminder: item.dueAt ? `测试截止：${formatMonthDay(item.dueAt)}` : "测试待完成",
      actionLabel: "开始测试",
      actionKind: "assessment"
    }));
}

export function displayTestType(item) {
  const labels = normalizeTestTypes(item.testType).map((type) => type === "其他" && item.customTestType ? item.customTestType : type);
  return labels.join("；") || "未分类";
}

export function assessmentSummaryBullets(item) {
  const summary = normalizeAssessmentSummary(item?.assessmentSummary);
  return summary?.conciseBullets || [];
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
    dueAt: normalizeMonthDay(item.dueAt),
    completedAt: normalizeMonthDay(item.completedAt),
    testPlatform: item.testPlatform || "",
    duration: item.duration || "",
    repeatEntry: item.repeatEntry || "",
    testUrl: item.testUrl || "",
    sourceMaterialIds: normalizeSourceMaterials(item).map((material) => material.materialId).join("；"),
    assessmentSummary: JSON.stringify(normalizeAssessmentSummary(item.assessmentSummary) || {}),
    analysisStatus: item.analysisStatus || "NEEDS_SOURCE",
    notes: item.notes || "",
    createdAt: excelDate(item.createdAt),
    updatedAt: excelDate(item.updatedAt),
    sourceOfTruth: item.sourceOfTruth || "repo"
  }));
  const worksheet = xlsx.utils.json_to_sheet(rows, { cellDates: true });
  worksheet["!cols"] = [
    { wch: 34 }, { wch: 20 }, { wch: 28 }, { wch: 34 }, { wch: 12 }, { wch: 30 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 42 },
    { wch: 42 }, { wch: 80 }, { wch: 16 }, { wch: 42 }, { wch: 20 }, { wch: 20 }, { wch: 16 }
  ];
  worksheet["!autofilter"] = { ref: `A1:T${Math.max(rows.length + 1, 1)}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Tests");
  const materialRows = records.flatMap((item) => normalizeSourceMaterials(item).map((material) => ({
    materialId: material.materialId,
    testId: item.testId || "",
    materialType: material.materialType,
    title: material.title,
    sourceUrl: material.sourceUrl,
    storageRef: material.storageRef,
    rawContent: material.rawContent,
    capturedAt: material.capturedAt,
    contentHash: material.contentHash
  })));
  const materialSheet = xlsx.utils.json_to_sheet(materialRows);
  materialSheet["!cols"] = [
    { wch: 34 }, { wch: 34 }, { wch: 14 }, { wch: 28 }, { wch: 42 }, { wch: 42 }, { wch: 80 }, { wch: 22 }, { wch: 66 }
  ];
  materialSheet["!autofilter"] = { ref: `A1:I${Math.max(materialRows.length + 1, 1)}` };
  xlsx.utils.book_append_sheet(workbook, materialSheet, "Source Materials");
  const fileName = `${formatShanghaiDate(now)}_assessment-tracker.xlsx`;
  return { workbook, fileName, rowCount: rows.length };
}

export function exportAssessmentsXlsx(records, xlsx = globalThis.XLSX, now = new Date()) {
  const output = buildAssessmentWorkbook(records, xlsx, now);
  xlsx.writeFile(output.workbook, output.fileName, { compression: true, cellDates: true });
  return output;
}

export function formatMonthDay(value) {
  const normalized = normalizeMonthDay(value);
  return normalized ? normalized.replace("-", "/") : "未记录";
}

function assessmentSortKey(item) {
  const priority = item.status === "待完成" ? "0" : item.status === "已完成" ? "1" : "2";
  return `${priority}-${item.dueAt || "9999"}-${item.company || ""}-${item.jobTitle || ""}`;
}

function normalizeAssessmentRecord(item) {
  const { summary, preparationFocus, ...rest } = item;
  const sourceMaterials = normalizeSourceMaterials(item);
  const legacyRaw = [
    String(summary || "").trim(),
    Array.isArray(preparationFocus) ? preparationFocus.join("；") : String(preparationFocus || "").trim()
  ].filter(Boolean).join("\n");
  if (legacyRaw && !sourceMaterials.some((material) => material.materialId === `material-legacy-${item.testId}`)) {
    sourceMaterials.push(normalizeSourceMaterial({
      materialId: `material-legacy-${item.testId}`,
      materialType: "text",
      title: "旧版未分析信息（待重新分析）",
      rawContent: legacyRaw,
      capturedAt: item.updatedAt || item.createdAt || ""
    }, new Date(), sourceMaterials.length));
  }
  const assessmentSummary = normalizeAssessmentSummary(item.assessmentSummary);
  let analysisStatus = item.analysisStatus;
  if (!sourceMaterials.length) analysisStatus = "NEEDS_SOURCE";
  else if (!assessmentSummary) analysisStatus = "NOT_ANALYZED";
  else if (!summaryCoversSources(assessmentSummary, sourceMaterials)) analysisStatus = "STALE";
  else analysisStatus = "CURRENT";
  return {
    ...rest,
    testType: normalizeTestTypes(item.testType),
    sourceMaterials,
    assessmentSummary,
    analysisStatus,
    localDraft: item.sourceOfTruth === "local-draft"
  };
}

function normalizeSourceMaterials(item) {
  const materials = Array.isArray(item?.sourceMaterials) ? item.sourceMaterials : [];
  return materials.map((material, index) => normalizeSourceMaterial(material, new Date(), index)).filter(Boolean);
}

function normalizeSourceMaterial(material, now, index) {
  if (!material || typeof material !== "object") return null;
  const rawContent = String(material.rawContent || "");
  const sourceUrl = String(material.sourceUrl || "").trim();
  const storageRef = String(material.storageRef || "").trim();
  if (!rawContent && !sourceUrl && !storageRef) return null;
  return {
    materialId: String(material.materialId || `material-${now.getTime()}-${index}`),
    materialType: ["excel", "image", "text", "web", "pdf", "word", "other"].includes(material.materialType) ? material.materialType : "other",
    title: String(material.title || `原始资料 ${index + 1}`),
    sourceUrl,
    storageRef,
    rawContent,
    capturedAt: String(material.capturedAt || now.toISOString()),
    contentHash: String(material.contentHash || "")
  };
}

function sourceMaterialKey(material) {
  return material.materialId || material.contentHash || `${material.materialType}|${material.title}|${material.sourceUrl}|${material.storageRef}|${material.rawContent}`;
}

function normalizeAssessmentSummary(summary) {
  if (!summary || typeof summary !== "object") return null;
  const normalized = {
    testComposition: normalizeTextList(summary.testComposition),
    keyQuestionTypes: normalizeTextList(summary.keyQuestionTypes),
    timingAndPacing: normalizeTextList(summary.timingAndPacing),
    competenciesAssessed: normalizeTextList(summary.competenciesAssessed),
    recurringSignals: normalizeTextList(summary.recurringSignals),
    preparationAdvice: normalizeTextList(summary.preparationAdvice),
    conflicts: normalizeTextList(summary.conflicts),
    conciseBullets: normalizeTextList(summary.conciseBullets).slice(0, 6),
    sourceMaterialIds: normalizeTextList(summary.sourceMaterialIds),
    analyzedAt: String(summary.analyzedAt || "")
  };
  return normalized.conciseBullets.length >= 3 ? normalized : null;
}

function normalizeTextList(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

function summaryCoversSources(summary, materials) {
  const analyzedIds = new Set(summary.sourceMaterialIds || []);
  return materials.every((material) => analyzedIds.has(material.materialId));
}

function isWithinNextDays(value, days, now) {
  const date = resolveMonthDay(value, now);
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

function normalizeMonthDay(value) {
  if (!value) return "";
  const text = String(value).trim();
  const shortMatch = text.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (shortMatch) return `${shortMatch[1].padStart(2, "0")}-${shortMatch[2].padStart(2, "0")}`;
  const date = parseDate(text);
  if (!date) return "";
  const parts = shanghaiDateParts(date);
  return parts.date ? parts.date.slice(5) : "";
}

function isValidMonthDay(value) {
  const normalized = normalizeMonthDay(value);
  if (!normalized) return false;
  const [month, day] = normalized.split("-").map(Number);
  const maxDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= maxDays[month - 1];
}

function excelDate(value) {
  return parseDate(value) || "";
}

function resolveMonthDay(value, now = new Date()) {
  const normalized = normalizeMonthDay(value);
  if (!normalized || !isValidMonthDay(normalized)) return null;
  const current = shanghaiDateParts(now);
  let year = Number(current.date.slice(0, 4));
  let candidate = new Date(`${year}-${normalized}T23:59:59+08:00`);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  if (candidate < sixMonthsAgo) candidate = new Date(`${year + 1}-${normalized}T23:59:59+08:00`);
  return candidate;
}

function shanghaiDateParts(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return { date: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}` };
}

function normalizeTestTypes(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.filter((item) => TEST_TYPE_OPTIONS.includes(item)))];
}

function formatShanghaiDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
