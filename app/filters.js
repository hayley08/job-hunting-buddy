export const ACTIVE_MARKET = "Mainland";

export const STATUS_LABELS = {
  Saved: "收藏",
  Recommended: "建议投递",
  "Application In Progress": "投递中",
  Applied: "已投递",
  "Resume Screening": "简历筛选",
  "Online Assessment": "在线测评",
  "Written Test": "笔试",
  "HR Interview": "HR面",
  "Business Interview": "业务面",
  "Case Interview": "Case面",
  "Final Interview": "终面",
  Offer: "Offer",
  Rejected: "拒绝",
  Withdrawn: "主动放弃",
  Closed: "岗位关闭",
  Archived: "历史归档"
};

export function activeApplications(applications) {
  return applications.filter((job) => job.market === ACTIVE_MARKET && !job.archived);
}

export function activeOpportunities(opportunities) {
  return opportunities.filter((job) => job.market === ACTIVE_MARKET && !job.archived);
}

export function archivedRecords(applications, archive) {
  const archiveRecords = Array.isArray(archive) ? archive : archive.records || [];
  return [...applications.filter((job) => job.archived), ...archiveRecords];
}

export function byUpcomingDate(events) {
  const today = startOfDay(new Date());
  return events
    .filter((event) => !event.completed && event.status !== "cancelled")
    .map((event) => ({ ...event, dateObject: parseDate(event.date) }))
    .filter((event) => event.dateObject && event.dateObject >= today)
    .sort((a, b) => a.dateObject - b.dateObject);
}

export function computeKpis(applications) {
  const active = activeApplications(applications);
  return {
    inProgress: active.filter((job) => isApplicationInProgress(job)).length,
    applied: active.filter((job) => hasReached(job, "Applied")).length,
    screening: active.filter((job) => hasReached(job, "Resume Screening")).length,
    assessment: active.filter((job) => hasReached(job, "Online Assessment") || hasReached(job, "Written Test")).length,
    interview: active.filter((job) => ["HR Interview", "Business Interview", "Case Interview", "Final Interview"].some((status) => hasReached(job, status))).length,
    offer: active.filter((job) => hasReached(job, "Offer")).length,
    last7Applied: active.filter((job) => hasReached(job, "Applied") && withinDays(job.appliedDate, 7)).length,
    last7Interview: active.filter((job) => (job.statusHistory || []).some((item) => item.status?.includes("Interview") && withinDays(item.date, 7))).length
  };
}

export function applicationInProgress(applications) {
  return activeApplications(applications).filter((job) => isApplicationInProgress(job));
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "未记录";
}

export function groupByStatus(applications) {
  const active = activeApplications(applications);
  return active.reduce((groups, job) => {
    const key = job.currentStatus || "Saved";
    groups[key] = groups[key] || [];
    groups[key].push(job);
    return groups;
  }, {});
}

export function currentResume(resumes) {
  const version = resumes.currentVersion;
  return (resumes.versions || []).find((item) => item.version === version) || (resumes.versions || [])[0] || {};
}

function hasReached(job, status) {
  return (job.statusHistory || []).some((item) => item.status === status) || job.currentStatus === status;
}

function isApplicationInProgress(job) {
  return job.currentStatus === "Application In Progress";
}

function withinDays(value, days) {
  const date = parseDate(value);
  if (!date) return false;
  const now = startOfDay(new Date());
  const diff = now - startOfDay(date);
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
