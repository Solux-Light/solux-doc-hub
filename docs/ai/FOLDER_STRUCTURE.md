# Folder Structure — Solux Doc Hub

## Content (deployed pages)
- `Solux.html` — main hub / landing page (`/` redirects here; title "Solux Hub by Klairs")
- `Solux_AI_Initiatives.html` — AI & product initiatives (P01 / P02 / P05 tabs)
- `Solux_Application_Map.html` — SOLUX application map: page inventory, flows & status lifecycles, roles & cross-cutting systems, data model
- `Solux_Business_Analysis.html` — business analysis & AI ROI roadmap (incl. §4 CRM & ERP Assessment and §4b Solux_byMehdi Platform Overview)
- `Solux_Working_Doc.html` — internal working document v2 (historical Phase 1 record; carries a forward-pointing banner)
- `Solux_Platform_Live.html` — **generated** mirror of SMBKE app truth (do not hand-edit)
- `Style_Guide.html` — design/style standard for all docs

## Build / config
- `vercel.json` — Vercel deploy + build config (incl. rewrite `/triggers/github` → `/api/triggers/github`)
- `sync-smbke.js` — build step: pull SMBKE markdown → generate `Solux_Platform_Live.html`
- `inject-hypothesis.js` — build step that injects the Hypothesis embed into every `.html`
- `api/triggers/github.js` — serverless function: on POST from Vercel Connect, ping `VERCEL_DEPLOY_HOOK_URL` to rebuild this site

## Generated (do not hand-edit)
- `Solux_Platform_Live.html` — SMBKE truth mirror (overview, roles, lifecycle, next steps)

## Meta (not deployed as content)
- `CLAUDE.md` — AI entry point
- `.cursor/rules/project.mdc` — Cursor rules
- `docs/ai/*` — implementation-truth docs (this folder)
- `PROJECT_CONTEXT.md`, `CURRENT_STATE.md`, `DECISIONS.md`, `TASKS.md` — project brain (high-level state)
