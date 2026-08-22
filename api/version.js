export default function handler(request, response) {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || "local";
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.status(200).json({
    commitSha,
    commitShortSha: commitSha === "local" ? "local" : commitSha.slice(0, 7),
    branch: process.env.VERCEL_GIT_COMMIT_REF || "local"
  });
}
