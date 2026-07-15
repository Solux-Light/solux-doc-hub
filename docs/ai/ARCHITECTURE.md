# Architecture — Solux Doc Hub

## Type
Static site: hand-authored HTML documents, no framework, no build framework. Served as-is by Vercel.

## Deploy (vercel.json)
- `cleanUrls: true` (so `/Solux` serves `Solux.html`)
- `trailingSlash: false`
- redirect: `/` -> `/Solux` (landing page)
- rewrite: `/triggers/github` -> `/api/triggers/github` (Vercel Connect webhook receiver)
- `buildCommand: node sync-smbke.js && node inject-hypothesis.js`
- `outputDirectory: "."` (the repo root is the site root)

## Build steps
`buildCommand`: `node sync-smbke.js && node inject-hypothesis.js`

### sync-smbke.js
Pulls app truth from **SMBKE** into `Solux_Platform_Live.html` at build time. Does **not** rewrite hand-authored hub docs (Working Doc, Business Analysis, AI Initiatives, Application Map).

Sources (first match wins):
1. Local checkout via `SMBKE_LOCAL_PATH`, or auto-detect sibling `../../SMBKE`
2. GitHub API for `SMBKE_GITHUB_REPO` (default `Ngamei/SMBKE`) at `SMBKE_GITHUB_REF` (default `main`) — requires `GITHUB_TOKEN` / `SMBKE_GITHUB_TOKEN` because the repo is private

Synced markdown (SMBKE paths):
- `docs/current-implementation/PRODUCT_OVERVIEW.md`
- `docs/current-implementation/USER_ROLES.md`
- `docs/current-implementation/ORDER_LIFECYCLE.md`
- `docs/ai/NEXT_STEPS.md`

### inject-hypothesis.js
Runs after sync. Walks the repo from `__dirname` (skips `node_modules` and any dotdir), and for each `.html`:
- if `hypothes.is/embed.js` is already present -> skip
- if there is no `</body>` -> skip
- otherwise inject `<script src="https://hypothes.is/embed.js" async></script>` before `</body>`

The check-before-inject logic keeps the script idempotent, so the Hypothesis annotation layer is present on every page even if a doc is regenerated without it.

## Annotation layer
Hypothesis (hypothes.is) provides collaborative highlighting/annotation on the deployed docs.

## Content model
Each business topic is its own top-level `.html` file (see FOLDER_STRUCTURE.md). Cross-navigation is via in-page links (e.g. `Solux.html` links into `Solux_AI_Initiatives.html#t-p01` and `Solux_Business_Analysis.html#w3`). Style is centralised in `Style_Guide.html`.

## Cross-repo auto-sync (SMBKE → hub)
1. SMBKE push → Vercel Connect → `POST /triggers/github`
2. `api/triggers/github.js` POSTs `VERCEL_DEPLOY_HOOK_URL` → hub redeploy
3. Hub build runs `sync-smbke.js` → refreshes `Solux_Platform_Live.html` from SMBKE

Required Vercel env (Production):
- `VERCEL_DEPLOY_HOOK_URL` — deploy hook for this project
- `GITHUB_TOKEN` or `SMBKE_GITHUB_TOKEN` — fine-grained/classic token with read access to `Ngamei/SMBKE`
- optional: `SMBKE_GITHUB_REPO`, `SMBKE_GITHUB_REF`

## No product-app runtime here
No auth, no database, no product API in this repo. The hub only documents/mirrors; the app lives in SMBKE.
