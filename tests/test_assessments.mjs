import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  ASSESSMENT_STORAGE_KEY,
  assessmentPendingActions,
  assessmentUpcomingEvents,
  buildAssessmentWorkbook,
  computeAssessmentStats,
  createLocalAssessment,
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
  assessmentScope: "海测",
  testType: "AI 面试",
  status: "待完成",
  receivedAt: "2026-09-01T10:00",
  dueAt: "2026-09-04T18:00",
  testPlatform: "企业自建",
  duration: "30–60 分钟",
  repeatEntry: "不可重复进入",
  testUrl: "https://example.com/test",
  summary: "AI 问答与岗位动机",
  notes: "Local only"
}, { now, idFactory: () => "fixed" });

assert.equal(validateAssessment(draft).length, 0);
assert.deepEqual(validateAssessment({ company: "", jobTitle: "", receivedAt: "2026-09-02", dueAt: "2026-09-01" }), [
  "公司不能为空", "岗位不能为空", "截止时间不能早于收到时间"
]);
assert.deepEqual(validateAssessment({ company: "A", jobTitle: "B", status: "已完成" }), ["已完成状态请补充完成时间"]);

saveAssessmentDraft(draft, storage);
assert.equal(loadAssessmentDrafts(storage).length, 1);
assert.ok(storageData.has(ASSESSMENT_STORAGE_KEY));

const repoRecord = { ...draft, testId: "test-repo", sourceOfTruth: "repo", assessmentScope: "非海测", status: "已完成", completedAt: "2026-09-01T01:00:00.000Z" };
const merged = mergeAssessments([repoRecord], [draft]);
assert.equal(merged.length, 2);
assert.equal(merged[0].localDraft, true);
assert.deepEqual(computeAssessmentStats(merged, now), { pending: 1, dueWithin7Days: 1, completed: 1, assessmentScope: 1 });
const upcoming = assessmentUpcomingEvents(merged, now);
assert.equal(upcoming.length, 1);
assert.equal(upcoming[0].date, "2026-09-04");
assert.equal(upcoming[0].time, "18:00");
assert.equal(assessmentPendingActions(merged, now)[0].actionLabel, "开始测试");

const xlsxContext = { console, TextEncoder, TextDecoder, setTimeout, clearTimeout };
xlsxContext.global = xlsxContext;
xlsxContext.globalThis = xlsxContext;
vm.createContext(xlsxContext);
vm.runInContext(readFileSync(new URL("../app/vendor/xlsx.full.min.js", import.meta.url), "utf8"), xlsxContext);
const output = buildAssessmentWorkbook(merged, xlsxContext.XLSX, now);
assert.equal(output.fileName, "2026-09-01_assessment-tracker.xlsx");
assert.equal(output.rowCount, 2);
assert.deepEqual(Array.from(output.workbook.SheetNames), ["Tests"]);
const rows = xlsxContext.XLSX.utils.sheet_to_json(output.workbook.Sheets.Tests, { defval: "" });
assert.equal(rows[0].company, "示例公司");
assert.equal(rows[0].jobTitle, "HR 管培生");
assert.equal(rows[0].sourceOfTruth, "local-draft");

console.log("test_assessments: all checks passed");
