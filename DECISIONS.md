—————# Solux Hub — Decisions

| Date | Decision | Reason | Status |
|---|---|---|---|
| — | Use HTML for core documents | Fast deployment, no framework overhead | Done |
| — | Deploy on Vercel | Simple CI/CD for static content | Done |
| — | Embed Hypothesis for annotation | Enable collaborative review of docs | Done |
| — | Merge Tender into P01 | Consolidate tender workflow under one phase | Done |
| 2026-07-05 | Treat github.com/mzouaisolux/solux (Mehdi's live codebase) as the primary source for platform capability, superseding the original §4 gap audit where they conflict | The gap audit predates SBM's build progress; the repo shows Quotation, Study Request (`project_requests` workflow), and RBAC already implemented, contradicting several "Absent" ratings | Done |
| 2026-07-05 | Append dated update notes to Business Analysis §4 and Working Doc rather than rewriting the original gap table | Preserves audit history per existing doc convention; original findings were accurate as of their own date | Done |
| 2026-07-05 | Require explicit confirmation before writing to this project's brain files (CURRENT_STATE.md / DECISIONS.md / TASKS.md) at end of session | Prevent silent/assumed edits; rule now lives in ai-brain/GLOBAL_RULES.md and applies here | Done |
| 2026-07-06 | Confirmed Study Lab (P02) step ownership: Steps 1–6 (Dialux Simulation through Battery Sizing) = Engineering; Steps 7–8 (Product Selection, Mechanical Study + 24/7 project assistance doc) = Sales | Direct confirmation from Andrew & Phi — resolves the "Phase 2*" ambiguity flagged in the working 8-step spreadsheet; Study Lab platform automation scope is now understood to end at Battery Sizing, not Mechanical Study | Done |
| 2026-07-06 | Going forward, pair every commit/push to the hub docs with an append-only update to CURRENT_STATE.md / DECISIONS.md / TASKS.md in the same push | Keeps the project brain in sync with actual doc changes across sessions, per Klairs's standing confirmation | Done |
| 2026-07-06 | Full hub consistency review: fixed stale "Phase 1 selects products" language in AI Initiatives P05 tab, added the 04 Jul (mzouaisolux) and 06 Jul (ownership) entries to the hub landing page Update log, added a forward-pointing banner to Working Doc §0 | Landing page and Working Doc had drifted behind the detail docs; Working Doc kept as historical Phase 1 record per existing convention, banner added instead of rewrite | Done |

| 2026-07-09 | Add `sync-github-repos-to-obsidian.sh` at repo root to clone/fast-forward the Solux documentation repos (solux-light/solux-doc-hub, mzouaisolux/solux) into an Obsidian vault, with an optional markdown-only mirror mode | Lets the team read/link/annotate the Markdown brain and repo docs inside Obsidian; script is config-driven (env vars + flags) so it stays generic without pulling in other-project context | Done |

## Open Decisions
[Fill in decisions that still need to be made]
