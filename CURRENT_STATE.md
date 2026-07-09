—# Solux Hub — Current State

Last updated: 2026-07-06

## Where We Are
- 15 commits, deployed on Vercel (15 deployments)
- Core HTML documents live: main hub, AI initiatives, business analysis, working doc, style guide
- Hypothesis annotation layer embedded
- Tender content merged into P01; Study Lab in P02+P03
- Solux_byMehdi content layered in
- **(2026-07-05)** Confirmed SBM (Solux_byMehdi) = live codebase at github.com/mzouaisolux/solux (deployed: solux-hub-seven.vercel.app). Business Analysis §4 (CRM & ERP Assessment) and Working Doc updated with an "UPDATE — 2026-07-04" callout comparing the original gap audit against the actual repo.
- **(2026-07-05)** Verified the platform has real RBAC: `user_roles` table + capability-based permission matrix (`permissions` / `role_permissions`, migration 026), server-side enforcement via `requireCapability()`, and a "View-As" simulation layer for super-admins that doesn't affect real security checks.
- **(2026-07-06)** Confirmed Study Lab (P02) step ownership with Andrew & Phi: Steps 1–6 (Dialux through Battery Sizing) are Engineering; Steps 7–8 (Product Selection, Mechanical Study + 24/7 project assistance doc) are Sales, not part of the Study Lab automation platform. Business Analysis §2.3 rewritten with a full 8-step table (Phase / Input / Ownership / Process / Output) replacing the old flow diagram, resolving the "Phase 2*" ambiguity from the working spreadsheet.
- **(2026-07-06)** Reconciled a divergence: local hub docs and the live repo had drifted apart (repo had the mzouaisolux findings in §4; local had the Study Lab ownership work). Merged both into one push rather than overwriting either.
- **(2026-07-06)** Full consistency review across all four hub docs: fixed stale "Phase 1 selects products" language in AI Initiatives' P05 tab (Product Selection is Sales, not part of either Study Lab phase), backfilled the hub landing page's Update log with the 04 Jul (mzouaisolux) and 06 Jul (ownership) entries it was missing, and added a forward-pointing banner to Working Doc §0 noting it predates Solux_byMehdi naming and the live-codebase findings.

- **(2026-07-09)** Added `sync-github-repos-to-obsidian.sh` — a config-driven Bash script that clones or fast-forward-updates the Solux documentation repos into an Obsidian vault (default `~/Obsidian/Solux/GitHub`). Supports `--markdown-only` mirroring, `--dry-run`, custom repo lists, and uses `gh` for auth when available. Tested locally (clone, idempotent update, markdown-only mirror excludes non-md and `.git`).

## What's Working
- Vercel deployment pipeline
- Document structure across business layers

## What's Not Working / Unclear
- The original §4 gap table ("Quotation: Absent", "Study Request: Absent") is now known to be stale — both are implemented in the repo (`documents`/`quotation_reminders`, `project_requests` workflow). Table left as historical record with an update note appended, not rewritten.
- Some items in the original gap table are unverified against the live repo: Reporting/Dashboards, AI/Automation, After-Sales Cases, Partner/Distributor, Tender Pipeline — these still appear absent in the code but haven't been exhaustively checked file-by-file.
- Mehdi's own `PLAN_CRM_SOLUX.md` lists next steps (linking `project_requests` to `affairs` via `affair_id`, adding a `contacts` table, prospects/tenders sandbox, notification-rules refactor) — his notes mark step 1 (affair_id) done, but the rest haven't been confirmed with him directly.
- Whether Solux_byMehdi's planned "Study Lab module" will absorb the existing Phase 1 app or get rebuilt (§4b Open Question #4) is still unconfirmed with Mehdi — now sharper given the Engineering/Sales ownership split, but not resolved.

## Immediate Next Step
Confirm with Mehdi which items on his own PLAN_CRM_SOLUX.md build order are actually done vs. still planned (contacts table, planned_actions, prospects/tenders sandbox, notification_rules refactor) — don't assume from the repo snapshot alone, since it's a moving target. Also confirm the Study Lab module fate (existing app vs. rebuild) now that ownership is split cleanly between Engineering and Sales.
