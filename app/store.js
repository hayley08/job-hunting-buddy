const DATA_FILES = {
  applications: "data/applications.json",
  applicationBackfill20260823: "data/application-backfills/2026-08-23.json",
  opportunities: "data/opportunities.json",
  historicalOpportunities: "data/historical-opportunities.json",
  opportunityHistory: "data/opportunity-history.json",
  targetCompanyWatchlist: "data/target-company-watchlist.json",
  events: "data/events.json",
  tests: "data/tests.json",
  interviews: "data/interviews.json",
  interviewPacks: "data/interview-packs.json",
  storyBank: "data/story-bank.json",
  resumes: "data/resumes.json",
  companies: "data/companies.json",
  reminders: "data/reminders.json",
  jds: "data/jds.json",
  archive: "data/archive.json",
  feedback: "data/user-feedback.json",
  pending: "data/pending.json",
  daily: "data/daily/latest.json",
  version: "/api/version"
};

export async function loadData() {
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, url]) => {
      try {
        const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return [key, await response.json(), null];
      } catch (error) {
        return [key, null, `${url}: ${error.message}`];
      }
    })
  );

  const state = {};
  const errors = [];
  for (const [key, value, error] of entries) {
    state[key] = value ?? fallbackFor(key);
    if (error && !key.startsWith("applicationBackfill") && key !== "version") errors.push(error);
  }

  state.applications = mergeApplications(state.applications, [state.applicationBackfill20260823]);
  state.loadErrors = errors;
  return state;
}

function mergeApplications(base, backfillSets) {
  const merged = [...(Array.isArray(base) ? base : [])];
  const seen = new Set(merged.map((item) => item.jobId).filter(Boolean));

  for (const backfill of backfillSets) {
    for (const item of Array.isArray(backfill) ? backfill : []) {
      if (!item.jobId || seen.has(item.jobId)) continue;
      merged.push(item);
      seen.add(item.jobId);
    }
  }

  return merged;
}

function fallbackFor(key) {
  if (["storyBank", "resumes", "daily", "version", "opportunityHistory", "targetCompanyWatchlist"].includes(key)) return {};
  return [];
}

export function saveNavigation(tab) {
  localStorage.setItem("campus-os-tab", tab);
}

export function loadNavigation() {
  return localStorage.getItem("campus-os-tab") || "home";
}
