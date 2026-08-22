const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.resolve(__dirname, "..");
const oldPath = "D:/hr-live-dashboard(2).html";
const text = fs.readFileSync(oldPath, "utf8");

function extractArray(name) {
  const start = text.indexOf(`const ${name} = [`);
  if (start < 0) throw new Error(`Missing array: ${name}`);
  const open = text.indexOf("[", start);
  let depth = 0;
  let quote = null;
  let escape = false;
  let templateExprDepth = 0;

  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (quote === "`" && c === "$" && next === "{") {
        templateExprDepth += 1;
        i += 1;
        continue;
      }
      if (quote === "`" && c === "}" && templateExprDepth > 0) {
        templateExprDepth -= 1;
        continue;
      }
      if (quote === "`" && c === "`" && templateExprDepth === 0) {
        quote = null;
        continue;
      }
      if (quote !== "`" && c === quote) {
        quote = null;
        continue;
      }
      continue;
    }

    if (c === "\"" || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "[") depth += 1;
    if (c === "]") {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  throw new Error(`Unterminated array: ${name}`);
}

function readJson(relativePath, fallback) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(relativePath, value) {
  const file = path.join(root, relativePath);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeSalary(job) {
  return job.salary || job.compensation || "Not listed";
}

function normalizeExperience(job) {
  return job.experience || job.requirement || "Not listed";
}

function migrateJob(job) {
  return {
    title: job.title || "",
    company: job.company || "",
    location: job.location || "",
    source: job.source || "",
    salary: normalizeSalary(job),
    experience: normalizeExperience(job),
    url: job.url || "",
    foundDate: job.foundDate || "",
    postedDate: job.postedDate || "",
    jobDescription: job.direction || job.followup || "",
    companySize: job.companySize || "",
    industry: job.industry || "",
    matchScore: Number(job.score || job.matchScore || 0),
    matchReason: job.reason || job.scoreReason || "",
    risk: job.risk || "",
    status: job.status || "",
    statusGroup: job.statusGroup || "",
    appliedDate: job.appliedDate || "",
    followup: job.followup || "",
    openingMessage: job.openingMessage || "",
    coverLetter: job.coverLetter || "",
    recommended: Boolean(job.recommended)
  };
}

function migrateResumeClip(clip) {
  return {
    id: clip.id,
    title: `${clip.company} - ${clip.role}`,
    period: clip.date || "",
    location: clip.location || "",
    chinese: clip.zh || "",
    english: clip.en || ""
  };
}

const oldJobs = vm.runInNewContext(`(${extractArray("jobs")})`);
const oldResumeClips = vm.runInNewContext(`(${extractArray("resumeClips")})`);

const existingJobs = readJson("data/jobs.json", []);
const migratedJobs = oldJobs.map(migrateJob);
const merged = new Map();

for (const job of [...migratedJobs, ...existingJobs]) {
  const key = [
    String(job.foundDate || ""),
    String(job.source || "").toLowerCase(),
    String(job.company || "").toLowerCase(),
    String(job.title || "").toLowerCase(),
    String(job.url || "").toLowerCase()
  ].join("|");
  merged.set(key, job);
}

const jobs = [...merged.values()].sort((a, b) => {
  const byDate = String(b.foundDate || "").localeCompare(String(a.foundDate || ""));
  if (byDate) return byDate;
  return Number(b.matchScore || 0) - Number(a.matchScore || 0);
});

const resume = readJson("data/resume.json", { profile: {}, sections: [] });
const resumeById = new Map();
for (const section of oldResumeClips.map(migrateResumeClip)) resumeById.set(section.id, section);
for (const section of resume.sections || []) {
  if (!resumeById.has(section.id)) resumeById.set(section.id, section);
}
resume.sections = [...resumeById.values()];

const applications = readJson("data/applications.json", { summary: {}, todos: [], records: [] });
const appliedJobs = jobs.filter(job => job.appliedDate || job.statusGroup === "已投递" || job.status === "已投递");
const recordsByKey = new Map((applications.records || []).map(record => [
  `${String(record.company || "").toLowerCase()}|${String(record.title || "").toLowerCase()}`,
  record
]));

for (const job of appliedJobs) {
  const key = `${String(job.company || "").toLowerCase()}|${String(job.title || "").toLowerCase()}`;
  if (recordsByKey.has(key)) continue;
  recordsByKey.set(key, {
    company: job.company,
    title: job.title,
    source: job.source,
    status: "applied",
    appliedDate: job.appliedDate || "",
    nextAction: job.followup || "Watch Gmail for confirmation or status update."
  });
}

applications.records = [...recordsByKey.values()];
applications.summary = {
  saved: jobs.filter(job => job.statusGroup === "建议投递" || job.recommended).length,
  toApply: jobs.filter(job => job.statusGroup === "建议投递" || job.recommended).length,
  applied: applications.records.filter(record => record.status === "applied").length,
  interviewing: applications.records.filter(record => record.status === "interviewing").length,
  rejected: applications.records.filter(record => record.status === "rejected").length
};

writeJson("data/jobs.json", jobs);
writeJson("data/resume.json", resume);
writeJson("data/applications.json", applications);

console.log(JSON.stringify({
  migratedJobs: migratedJobs.length,
  totalJobs: jobs.length,
  dates: [...new Set(jobs.map(job => job.foundDate))],
  resumeSections: resume.sections.length,
  applicationRecords: applications.records.length
}, null, 2));
