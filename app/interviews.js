export const INTERVIEW_STORAGE_KEY = "campus-os-interview-drafts-v1";

export function loadInterviewDrafts(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(INTERVIEW_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeInterview).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveInterviewDraft(record, storage = globalThis.localStorage) {
  if (!storage) throw new Error("当前浏览器不支持本地保存");
  const drafts = loadInterviewDrafts(storage);
  const next = [...drafts.filter((item) => item.interviewId !== record.interviewId), normalizeInterview(record)].filter(Boolean);
  storage.setItem(INTERVIEW_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function mergeInterviews(repoRecords = [], localRecords = []) {
  const merged = new Map();
  for (const item of [...repoRecords, ...localRecords]) {
    const normalized = normalizeInterview(item);
    if (!normalized) continue;
    merged.set(normalized.interviewId, normalized);
  }
  return [...merged.values()].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || "")) ||
    String(a.company || "").localeCompare(String(b.company || "")) ||
    String(a.round || "").localeCompare(String(b.round || ""))
  );
}

export function validateInterview(input) {
  const errors = [];
  if (!String(input.company || "").trim()) errors.push("公司不能为空");
  if (!String(input.round || "").trim()) errors.push("面试轮次不能为空");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ""))) errors.push("请选择有效的面试日期");
  return errors;
}

export function createLocalInterview(input, options = {}) {
  const now = options.now || new Date();
  const idFactory = options.idFactory || (() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const createdAt = now.toISOString();
  return normalizeInterview({
    interviewId: `interview-local-${idFactory()}`,
    company: String(input.company || "").trim(),
    jobId: String(input.jobId || "").trim(),
    round: String(input.round || "").trim(),
    date: String(input.date || "").trim(),
    questions: normalizeQuestions(input.questions),
    sourceOfTruth: "local-draft",
    createdAt,
    updatedAt: createdAt
  });
}

export function buildInterviewWorkbook(records, xlsx = globalThis.XLSX, now = new Date()) {
  if (!xlsx?.utils?.json_to_sheet || !xlsx?.writeFile) throw new Error("Excel 导出组件尚未加载，请刷新后重试");
  const rows = records.map((item) => ({
    interviewId: item.interviewId || "",
    company: item.company || "",
    jobId: item.jobId || "",
    round: item.round || "",
    date: item.date || "",
    questions: normalizeQuestions(item.questions).join("\n"),
    sourceOfTruth: item.sourceOfTruth || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || ""
  }));
  const worksheet = xlsx.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 34 }, { wch: 22 }, { wch: 36 }, { wch: 18 }, { wch: 14 }, { wch: 70 }, { wch: 18 }, { wch: 22 }, { wch: 22 }
  ];
  worksheet["!autofilter"] = { ref: `A1:I${Math.max(rows.length + 1, 1)}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Interviews");
  return { workbook, fileName: `${formatShanghaiDate(now)}_interview-tracker.xlsx`, rowCount: rows.length };
}

export function exportInterviewsXlsx(records, xlsx = globalThis.XLSX, now = new Date()) {
  const output = buildInterviewWorkbook(records, xlsx, now);
  xlsx.writeFile(output.workbook, output.fileName, { compression: true });
  return output;
}

function normalizeInterview(item) {
  if (!item || typeof item !== "object") return null;
  const interviewId = String(item.interviewId || legacyInterviewId(item)).trim();
  if (!interviewId) return null;
  return {
    interviewId,
    company: String(item.company || "").trim(),
    jobId: String(item.jobId || "").trim(),
    round: String(item.round || "").trim(),
    date: String(item.date || "").trim(),
    questions: normalizeQuestions(item.questions),
    sourceOfTruth: item.sourceOfTruth || "repo",
    createdAt: String(item.createdAt || ""),
    updatedAt: String(item.updatedAt || ""),
    localDraft: item.sourceOfTruth === "local-draft"
  };
}

function normalizeQuestions(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/\r?\n|；|;/);
  return [...new Set(values.map((item) => String(item).trim().replace(/^[-•·]\s*/, "")).filter(Boolean))];
}

function legacyInterviewId(item) {
  const parts = [item.jobId, item.company, item.round, item.date].map((value) => String(value || "").trim()).filter(Boolean);
  return parts.length ? `interview-${parts.join("-").toLocaleLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, "-").replace(/^-|-$/g, "")}` : "";
}

function formatShanghaiDate(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
