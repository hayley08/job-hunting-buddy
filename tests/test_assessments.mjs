import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  ASSESSMENT_STORAGE_KEY,
  appendSourceMaterials,
  applyAssessmentAnalysis,
  assessmentPendingActions,
  assessmentSummaryBullets,
  assessmentUpcomingEvents,
  buildAssessmentWorkbook,
  computeAssessmentStats,
  createLocalAssessment,
  displayTestType,
  formatMonthDay,
  loadAssessmentDrafts,
  mergeAssessments,
  saveAssessmentDraft,
  validateAssessment
} from "../app/assessments.js";

const storageData = new Map();
const storage = {
  getItem: (key) => storageData.get(key) ?? null,
  setItem: (key, value) => storageData.set(key, value)
};
const now = new Date("2026-09-01T02:00:00.000Z");
const draft = createLocalAssessment({
  company: "示例公司",
  jobTitle: "HR 管培生",
  jobId: "job-example",
  testType: ["AI 面试", "英语面试"],
  status: "待完成",
  dueAt: "09-04",
  testPlatform: "企业自建",
  duration: "30–60 分钟",
  repeatEntry: "不可重复进入",
  testUrl: "https://example.com/test",
  sourceMaterialText: "通知原文：包含 AI 问答、英语问答和岗位动机题。",
  notes: "Local only"
}, { now, idFactory: () => "fixed" });

assert.equal(validateAssessment(draft).length, 0);
assert.deepEqual(validateAssessment({ company: "", jobTitle: "", testType: [] }), [
  "公司不能为空", "岗位不能为空", "请至少选择一种测试类型"
]);
assert.deepEqual(validateAssessment({ company: "A", jobTitle: "B", testType: ["AI 笔试"], dueAt: "02-30" }), ["截止日期格式无效"]);
assert.deepEqual(validateAssessment({ company: "A", jobTitle: "B", testType: ["AI 笔试"], status: "已完成" }), ["已完成状态请补充完成日期"]);
assert.equal(draft.assessmentScope, "海测");
assert.ok(!("receivedAt" in draft));
assert.deepEqual(draft.testType, ["AI 面试", "英语面试"]);
assert.equal(displayTestType(draft), "AI 面试；英语面试");
assert.equal(formatMonthDay(draft.dueAt), "09/04");
assert.equal(draft.sourceMaterials.length, 1);
assert.equal(draft.sourceMaterials[0].rawContent, "通知原文：包含 AI 问答、英语问答和岗位动机题。");
assert.equal(draft.assessmentSummary, null);
assert.equal(draft.analysisStatus, "NOT_ANALYZED");
assert.ok(!("summary" in draft) && !("preparationFocus" in draft));

saveAssessmentDraft(draft, storage);
assert.equal(loadAssessmentDrafts(storage).length, 1);
assert.ok(storageData.has(ASSESSMENT_STORAGE_KEY));

const analyzed = applyAssessmentAnalysis(draft, {
  testComposition: ["AI 中文问答", "英语问答"],
  keyQuestionTypes: ["岗位动机", "英文自我介绍"],
  timingAndPacing: ["材料仅说明每题限时，具体时长待确认"],
  competenciesAssessed: ["岗位动机", "英语表达"],
  recurringSignals: ["两段材料均提到岗位动机"],
  preparationAdvice: ["准备 60 秒中英文自我介绍", "整理岗位动机证据", "进行限时录音练习"],
  conflicts: ["每题具体时长信息不一致/待确认"],
  conciseBullets: ["包含 AI 中文与英语问答", "重点准备岗位动机和英文自我介绍", "存在单题限时压力", "具体时长待确认"]
}, { now });
assert.equal(analyzed.analysisStatus, "CURRENT");
assert.deepEqual(assessmentSummaryBullets(analyzed), ["包含 AI 中文与英语问答", "重点准备岗位动机和英文自我介绍", "存在单题限时压力", "具体时长待确认"]);

const stale = appendSourceMaterials(analyzed, [{
  materialId: "material-web-2",
  materialType: "web",
  title: "补充说明网页",
  sourceUrl: "https://example.com/assessment-guide",
  rawContent: "网页补充：英语题有 60 秒准备时间。",
  capturedAt: "2026-09-01T03:00:00.000Z"
}], { now: new Date("2026-09-01T03:00:00.000Z") });
assert.equal(stale.sourceMaterials.length, 2);
assert.equal(stale.analysisStatus, "STALE");
assert.equal(stale.sourceMaterials[0].rawContent, draft.sourceMaterials[0].rawContent);

const reanalyzed = applyAssessmentAnalysis(stale, {
  ...analyzed.assessmentSummary,
  timingAndPacing: ["英语题有 60 秒准备时间", "其他模块时长待确认"],
  preparationAdvice: ["准备 60 秒中英文自我介绍", "整理岗位动机证据", "按 60 秒准备窗口进行录音练习"],
  conciseBullets: ["包含 AI 中文与英语问答", "重点准备岗位动机和英文自我介绍", "英语题准备时间为 60 秒", "其他模块时长待确认"]
}, { now: new Date("2026-09-01T04:00:00.000Z") });
assert.equal(reanalyzed.analysisStatus, "CURRENT");
assert.deepEqual(reanalyzed.assessmentSummary.sourceMaterialIds, reanalyzed.sourceMaterials.map((item) => item.materialId));

const legacyRecord = {
  ...draft,
  testId: "test-repo",
  sourceOfTruth: "repo",
  assessmentScope: "非海测",
  testType: "笔试｜性格测试",
  status: "已完成",
  completedAt: "08-30",
  sourceMaterials: [],
  summary: "旧版直接复制的原文",
  preparationFocus: ["旧版原文片段"]
};
const merged = mergeAssessments([legacyRecord], [reanalyzed]);
assert.equal(merged.length, 2);
assert.equal(merged[0].localDraft, true);
assert.equal(merged[1].analysisStatus, "NOT_ANALYZED");
assert.equal(merged[1].assessmentSummary, null);
assert.ok(merged[1].sourceMaterials[0].rawContent.includes("旧版直接复制的原文"));
assert.deepEqual(computeAssessmentStats(merged, now), { pending: 1, dueWithin7Days: 1, completed: 1, assessmentScope: 1 });
const upcoming = assessmentUpcomingEvents(merged, now);
assert.equal(upcoming.length, 1);
assert.equal(upcoming[0].date, "2026-09-04");
assert.equal(upcoming[0].displayDate, "09/04");
assert.equal(upcoming[0].time, "");
assert.equal(assessmentPendingActions(merged, now)[0].actionLabel, "开始测试");

const xlsxContext = { console, TextEncoder, TextDecoder, setTimeout, clearTimeout };
xlsxContext.global = xlsxContext;
xlsxContext.globalThis = xlsxContext;
vm.createContext(xlsxContext);
vm.runInContext(readFileSync(new URL("../app/vendor/xlsx.full.min.js", import.meta.url), "utf8"), xlsxContext);
const output = buildAssessmentWorkbook(merged, xlsxContext.XLSX, now);
assert.equal(output.fileName, "2026-09-01_assessment-tracker.xlsx");
assert.equal(output.rowCount, 2);
assert.deepEqual(Array.from(output.workbook.SheetNames), ["Tests", "Source Materials"]);
assert.equal(output.workbook.Sheets.Tests["!cols"].length, 20);
assert.equal(output.workbook.Sheets["Source Materials"]["!cols"].length, 9);
const rows = xlsxContext.XLSX.utils.sheet_to_json(output.workbook.Sheets.Tests, { defval: "" });
assert.equal(rows[0].company, "示例公司");
assert.equal(rows[0].jobTitle, "HR 管培生");
assert.equal(rows[0].sourceOfTruth, "local-draft");
assert.equal(rows[0].dueAt, "09-04");
assert.equal(rows[0].testType, "AI 面试；英语面试");
assert.ok(!Object.hasOwn(rows[0], "receivedAt"));
assert.ok(!Object.hasOwn(rows[0], "summary") && !Object.hasOwn(rows[0], "preparationFocus"));
assert.equal(rows[0].analysisStatus, "CURRENT");
const materialRows = xlsxContext.XLSX.utils.sheet_to_json(output.workbook.Sheets["Source Materials"], { defval: "" });
assert.equal(materialRows.length, 3);
assert.ok(materialRows.some((row) => row.rawContent.includes("通知原文")));
assert.ok(materialRows.some((row) => row.sourceUrl === "https://example.com/assessment-guide"));

console.log("test_assessments: all checks passed");
