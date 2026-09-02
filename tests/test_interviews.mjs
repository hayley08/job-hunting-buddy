import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  INTERVIEW_STORAGE_KEY,
  buildInterviewWorkbook,
  createLocalInterview,
  loadInterviewDrafts,
  mergeInterviews,
  saveInterviewDraft,
  validateInterview
} from "../app/interviews.js";

const storageData = new Map();
const storage = {
  getItem: (key) => storageData.get(key) ?? null,
  setItem: (key, value) => storageData.set(key, value)
};
const now = new Date("2026-09-02T02:00:00.000Z");
const draft = createLocalInterview({
  company: "宝洁",
  jobId: "opp-single-url-cnc003210",
  round: "HR Interview",
  date: "2026-09-10",
  questions: "Why P&G?\n请介绍一次影响业务方的经历\nWhy P&G?"
}, { now, idFactory: () => "fixed" });

assert.deepEqual(validateInterview(draft), []);
assert.deepEqual(validateInterview({ company: "", round: "", date: "09-10" }), [
  "公司不能为空", "面试轮次不能为空", "请选择有效的面试日期"
]);
assert.equal(draft.interviewId, "interview-local-fixed");
assert.deepEqual(draft.questions, ["Why P&G?", "请介绍一次影响业务方的经历"]);
assert.equal(draft.localDraft, true);

saveInterviewDraft(draft, storage);
assert.equal(loadInterviewDrafts(storage).length, 1);
assert.ok(storageData.has(INTERVIEW_STORAGE_KEY));

const repo = {
  interviewId: "interview-repo-1",
  company: "雀巢",
  jobId: "job-nestle",
  round: "Phone Interview",
  date: "2026-09-12",
  questions: ["Self introduction"],
  sourceOfTruth: "repo",
  createdAt: "2026-09-02T01:00:00.000Z",
  updatedAt: "2026-09-02T01:00:00.000Z"
};
const merged = mergeInterviews([repo], [draft]);
assert.equal(merged.length, 2);
assert.equal(merged[0].company, "雀巢");
assert.equal(merged[1].company, "宝洁");

const xlsxContext = { console, TextEncoder, TextDecoder, setTimeout, clearTimeout };
xlsxContext.global = xlsxContext;
xlsxContext.globalThis = xlsxContext;
vm.createContext(xlsxContext);
vm.runInContext(readFileSync(new URL("../app/vendor/xlsx.full.min.js", import.meta.url), "utf8"), xlsxContext);
const output = buildInterviewWorkbook(merged, xlsxContext.XLSX, now);
assert.equal(output.fileName, "2026-09-02_interview-tracker.xlsx");
assert.equal(output.rowCount, 2);
assert.deepEqual(Array.from(output.workbook.SheetNames), ["Interviews"]);
const rows = xlsxContext.XLSX.utils.sheet_to_json(output.workbook.Sheets.Interviews, { defval: "" });
assert.equal(rows[1].company, "宝洁");
assert.equal(rows[1].jobId, "opp-single-url-cnc003210");
assert.ok(rows[1].questions.includes("Why P&G?"));
assert.equal(rows[1].sourceOfTruth, "local-draft");

console.log("test_interviews: all checks passed");
