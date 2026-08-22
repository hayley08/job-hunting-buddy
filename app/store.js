const DATA_FILES = {
  applications: "data/applications.json",
  opportunities: "data/opportunities.json",
  events: "data/events.json",
  interviews: "data/interviews.json",
  interviewPacks: "data/interview-packs.json",
  storyBank: "data/story-bank.json",
  resumes: "data/resumes.json",
  companies: "data/companies.json",
  archive: "data/archive.json",
  feedback: "data/user-feedback.json",
  pending: "data/pending.json",
  daily: "data/daily/latest.json"
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
    if (error) errors.push(error);
  }

  state.loadErrors = errors;
  return state;
}

function fallbackFor(key) {
  if (["storyBank", "resumes", "daily"].includes(key)) return {};
  return [];
}

export function saveNavigation(tab) {
  localStorage.setItem("campus-os-tab", tab);
}

export function loadNavigation() {
  return localStorage.getItem("campus-os-tab") || "home";
}
