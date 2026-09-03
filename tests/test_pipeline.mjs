import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  PIPELINE_STORAGE_KEY,
  buildPipelineWorkbook,
  createLocalPipelineDraft,
  loadPipelineDrafts,
  mergePipelineApplications,
  savePipelineDraft,
  validatePipelineDraft
} from "../app/pipeline.js";

const storageData = new Map();
const storage = { getItem: (key) => storageData.get(key) ?? null, setItem: (key, value) => storageData.set(key, value) };
const baseRecord = {
  jobId: "app-example",
  company: "示例公司",
  title: "HR 管培生",
  location: "北京",
  currentStatus: "Applied",
  appliedDate: "2026-09-01",
  statusUpdatedAt: "2026-09-01",
  statusHistory: [{ status: "Applied", date: "2026-09-01", sourceOfTruth: "user", notes: "submitted" }],
  applyUrl: "https://example.com/job",
  sourceOfTruth: "user",
  archived: false
};

assert.deepEqual(validatePipelineDraft({ company: "", title: "", currentStatus: "Applied", statusUpdatedAt: "", appliedDate: "" }), [
  "公司不能为空", "岗位不能为空", "请选择有效的状态日期", "已投递或后续状态请补充投递日期"
]);
assert.deepEqual(validatePipelineDraft({ company: "A", title: "B", currentStatus: "Applied", statusUpdatedAt: "2026-09-03", appliedDate: "2026-09-03", applyUrl: "http://unsafe" }), ["岗位链接必须是有效的 HTTPS URL"]);

const updated = createLocalPipelineDraft({
  jobId: baseRecord.jobId,
  company: baseRecord.company,
  title: baseRecord.title,
  location: baseRecord.location,
  currentStatus: "Resume Screening",
  statusUpdatedAt: "2026-09-03",
  appliedDate: baseRecord.appliedDate,
  applyUrl: baseRecord.applyUrl,
  notes: "等待筛选"
}, { baseRecord, now: new Date("2026-09-03T10:00:00Z"), idFactory: () => "fixed" });

assert.equal(updated.jobId, baseRecord.jobId);
assert.equal(updated.statusHistory.length, 2);
assert.equal(updated.statusHistory.at(-1).status, "Resume Screening");
assert.equal(updated.sourceOfTruth, "local-draft");
assert.equal(updated.localDraft, true);
savePipelineDraft(updated, storage);
assert.ok(storageData.has(PIPELINE_STORAGE_KEY));
assert.equal(loadPipelineDrafts(storage)[0].currentStatus, "Resume Screening");
const merged = mergePipelineApplications([baseRecord], loadPipelineDrafts(storage));
assert.equal(merged.length, 1);
assert.equal(merged[0].currentStatus, "Resume Screening");

const xlsxContext = { console, TextEncoder, TextDecoder, setTimeout, clearTimeout };
xlsxContext.global = xlsxContext;
xlsxContext.globalThis = xlsxContext;
vm.createContext(xlsxContext);
vm.runInContext(readFileSync(new URL("../app/vendor/xlsx.full.min.js", import.meta.url), "utf8"), xlsxContext);
const assessments = [{
  testId: "test-example", company: "示例公司", jobTitle: "HR 管培生", jobId: "app-example", assessmentScope: "海测",
  testType: ["AI 面试"], status: "待完成", dueAt: "09-08", sourceMaterials: [{ materialId: "m1", rawContent: "原文" }],
  assessmentSummary: { conciseBullets: ["重点"] }, analysisStatus: "CURRENT", sourceOfTruth: "repo"
}];
const output = buildPipelineWorkbook(merged, assessments, xlsxContext.XLSX, new Date("2026-09-03T10:00:00Z"));
assert.equal(output.fileName, "2026-09-03_pipeline-assessment-tracker.xlsx");
assert.deepEqual(Array.from(output.workbook.SheetNames), ["流程", "测评"]);
const pipelineRows = xlsxContext.XLSX.utils.sheet_to_json(output.workbook.Sheets["流程"], { defval: "" });
const assessmentRows = xlsxContext.XLSX.utils.sheet_to_json(output.workbook.Sheets["测评"], { defval: "" });
assert.equal(pipelineRows[0].jobId, "app-example");
assert.equal(pipelineRows[0].currentStatus, "Resume Screening");
assert.ok(pipelineRows[0].statusHistory.includes("Resume Screening"));
assert.equal(assessmentRows[0].testId, "test-example");
assert.ok(assessmentRows[0].sourceMaterials.includes("原文"));

console.log("test_pipeline: all checks passed");
