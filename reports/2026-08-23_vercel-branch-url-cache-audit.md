# Vercel Branch URL and PWA Cache Audit - 2026-08-23

## Deployment Finding

- GitHub is connected to Vercel and every push to `feature/campus-job-os-v2` creates a Preview deployment.
- Vercel automatically maintains a stable Git branch URL that follows the latest successful deployment on the branch.
- Commit-specific Preview URLs are immutable snapshots and must not be bookmarked as the daily V2 URL.
- Verified stable branch alias: `https://job-hunting-buddy-git-feature-campus-688ec5-hayley08s-projects.vercel.app`.
- The alias was recovered from the Vercel Preview check output for `feature/campus-job-os-v2`. It is the URL to bookmark on desktop and mobile.
- Vercel Deployment Protection is enabled: an unauthenticated request redirects to Vercel login. This does not make the alias unstable; use it while signed into the authorized Vercel account, or adjust Preview Deployment Protection separately if broader access is desired.

## Previous Cache Strategy

- `data/*.json`: network-first with `fetch(..., { cache: "no-store" })` and cached offline fallback.
- HTML, JavaScript, CSS, and manifest: cache-first under a fixed cache name.
- Vercel already sent `no-store` for JSON and `no-cache` for the service worker, but did not explicitly revalidate HTML and app assets.

## Corrected Cache Strategy

- Navigation/HTML: network-first, browser HTTP cache bypassed, cached offline fallback.
- JavaScript/CSS/manifest: network-first, browser HTTP cache bypassed, cached offline fallback.
- `data/*.json`: network-first with `no-store`, cached offline fallback.
- Cache-busting query parameters are removed from the Cache Storage key, so every successful online JSON response replaces the same offline fallback entry instead of accumulating older timestamped copies.
- Vercel headers: JSON `no-store`; HTML, app assets, manifest, and service worker `no-cache, max-age=0, must-revalidate`.
- Cache name versioned so activation removes the old cache.

## Operational Rule

Use the stable branch URL on desktop and mobile. A URL containing a random deployment hash points permanently to that commit and cannot become the latest deployment merely by refreshing.
