#!/usr/bin/env bash
#
# sync-github-repos-to-obsidian.sh
# ---------------------------------
# Clone or update a set of GitHub repositories into an Obsidian vault so their
# Markdown documentation (project "brain" files, READMEs, notes, etc.) can be
# browsed, linked, and annotated inside Obsidian.
#
# Designed for the Solux Hub, whose knowledge base lives in Markdown files
# (PROJECT_CONTEXT.md, CURRENT_STATE.md, DECISIONS.md, TASKS.md) spread across
# related repositories (e.g. solux-light/solux-doc-hub and mzouaisolux/solux),
# but it works for any list of repositories.
#
# Behaviour:
#   - For each configured repo, clone it if missing, otherwise fast-forward pull.
#   - Repos are placed under a "GitHub" subfolder of the vault (configurable).
#   - Optionally mirror only Markdown files into a clean, vault-friendly tree
#     (MARKDOWN_ONLY=1) instead of keeping full working trees.
#   - Uses the GitHub CLI (`gh`) for authentication when available (handy for
#     private repos); otherwise falls back to plain HTTPS git.
#
# Usage:
#   ./sync-github-repos-to-obsidian.sh [options] [owner/repo ...]
#
# Options:
#   -v, --vault PATH       Obsidian vault path (default: $OBSIDIAN_VAULT or
#                          ~/Obsidian/Solux).
#   -s, --subdir NAME      Subfolder inside the vault for synced repos
#                          (default: GitHub).
#   -m, --markdown-only    Mirror only *.md files into the vault instead of the
#                          full repository working tree.
#   -n, --dry-run          Print what would happen without changing anything.
#   -h, --help             Show this help and exit.
#
# Environment variables (used as defaults; flags/args override them):
#   OBSIDIAN_VAULT   Path to the Obsidian vault.
#   OBSIDIAN_SUBDIR  Subfolder name inside the vault (default: GitHub).
#   REPOS            Space/newline separated list of repos ("owner/repo" or a
#                    full git URL). Defaults to the Solux documentation repos.
#   GITHUB_HOST      Git host (default: github.com).
#   MARKDOWN_ONLY    Set to 1 to mirror only Markdown files.
#   DRY_RUN          Set to 1 to enable dry-run mode.
#
# Examples:
#   OBSIDIAN_VAULT=~/vaults/work ./sync-github-repos-to-obsidian.sh
#   ./sync-github-repos-to-obsidian.sh -v ~/vaults/work solux-light/solux-doc-hub
#   MARKDOWN_ONLY=1 ./sync-github-repos-to-obsidian.sh --dry-run
#
set -euo pipefail

# --- Defaults ---------------------------------------------------------------

OBSIDIAN_VAULT="${OBSIDIAN_VAULT:-$HOME/Obsidian/Solux}"
OBSIDIAN_SUBDIR="${OBSIDIAN_SUBDIR:-GitHub}"
GITHUB_HOST="${GITHUB_HOST:-github.com}"
MARKDOWN_ONLY="${MARKDOWN_ONLY:-0}"
DRY_RUN="${DRY_RUN:-0}"

# Default repositories to sync (Solux documentation ecosystem).
DEFAULT_REPOS=(
  "solux-light/solux-doc-hub"
  "mzouaisolux/solux"
)

# Number of network retries with exponential backoff.
MAX_RETRIES=4

# --- Logging ----------------------------------------------------------------

if [[ -t 1 ]]; then
  C_RESET="\033[0m"; C_BLUE="\033[34m"; C_GREEN="\033[32m"
  C_YELLOW="\033[33m"; C_RED="\033[31m"; C_DIM="\033[2m"
else
  C_RESET=""; C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_DIM=""
fi

_ts() { date "+%Y-%m-%d %H:%M:%S"; }
info()  { printf "%b[%s] %s%b\n" "$C_BLUE"   "$(_ts)" "$*" "$C_RESET"; }
ok()    { printf "%b[%s] %s%b\n" "$C_GREEN"  "$(_ts)" "$*" "$C_RESET"; }
warn()  { printf "%b[%s] %s%b\n" "$C_YELLOW" "$(_ts)" "$*" "$C_RESET" >&2; }
err()   { printf "%b[%s] %s%b\n" "$C_RED"    "$(_ts)" "$*" "$C_RESET" >&2; }
dim()   { printf "%b%s%b\n"      "$C_DIM"    "$*" "$C_RESET"; }

# --- Help -------------------------------------------------------------------

usage() {
  sed -n '2,/^set -euo/p' "$0" | sed '/^set -euo/d; s/^# \{0,1\}//'
}

# --- Argument parsing -------------------------------------------------------

CLI_REPOS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--vault)        OBSIDIAN_VAULT="${2:?--vault requires a path}"; shift 2 ;;
    -s|--subdir)       OBSIDIAN_SUBDIR="${2:?--subdir requires a name}"; shift 2 ;;
    -m|--markdown-only) MARKDOWN_ONLY=1; shift ;;
    -n|--dry-run)      DRY_RUN=1; shift ;;
    -h|--help)         usage; exit 0 ;;
    --)                shift; while [[ $# -gt 0 ]]; do CLI_REPOS+=("$1"); shift; done ;;
    -*)                err "Unknown option: $1"; echo; usage; exit 2 ;;
    *)                 CLI_REPOS+=("$1"); shift ;;
  esac
done

# --- Resolve repo list ------------------------------------------------------

REPO_LIST=()
if [[ ${#CLI_REPOS[@]} -gt 0 ]]; then
  REPO_LIST=("${CLI_REPOS[@]}")
elif [[ -n "${REPOS:-}" ]]; then
  # Split REPOS env var on whitespace/newlines.
  # shellcheck disable=SC2206
  REPO_LIST=(${REPOS})
else
  REPO_LIST=("${DEFAULT_REPOS[@]}")
fi

# --- Helpers ----------------------------------------------------------------

run() {
  # Execute a command, honouring dry-run.
  if [[ "$DRY_RUN" == "1" ]]; then
    dim "DRY-RUN: $*"
    return 0
  fi
  "$@"
}

have() { command -v "$1" >/dev/null 2>&1; }

# Convert an "owner/repo" or URL into a clone URL and a local directory name.
repo_clone_url() {
  local ref="$1"
  if [[ "$ref" == *"://"* || "$ref" == git@* ]]; then
    printf "%s" "$ref"
  else
    printf "https://%s/%s.git" "$GITHUB_HOST" "$ref"
  fi
}

repo_dir_name() {
  local ref="$1" base
  base="${ref##*/}"          # strip owner/ or path
  base="${base%.git}"        # strip .git
  printf "%s" "$base"
}

# Retry a command with exponential backoff (for flaky networks).
retry() {
  local attempt=1 delay=4
  until "$@"; do
    if (( attempt >= MAX_RETRIES )); then
      err "Command failed after ${MAX_RETRIES} attempts: $*"
      return 1
    fi
    warn "Attempt ${attempt}/${MAX_RETRIES} failed; retrying in ${delay}s..."
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}

# Clone using gh when available (auth-aware), else plain git.
clone_repo() {
  local ref="$1" dest="$2" url
  url="$(repo_clone_url "$ref")"
  if have gh && [[ "$ref" != *"://"* && "$ref" != git@* ]]; then
    retry run gh repo clone "$ref" "$dest"
  else
    retry run git clone "$url" "$dest"
  fi
}

update_repo() {
  local dest="$1"
  run git -C "$dest" fetch --all --prune
  # Prefer a clean fast-forward; fall back to a plain pull if branches allow.
  if ! run git -C "$dest" pull --ff-only; then
    warn "Fast-forward pull failed in $dest (local changes or diverged history); skipping merge."
    return 0
  fi
}

# Mirror only markdown files from a repo working tree into the vault.
mirror_markdown() {
  local src="$1" dest="$2"
  info "Mirroring Markdown: $src -> $dest"
  run mkdir -p "$dest"
  # Walk tracked + untracked md files, excluding .git.
  while IFS= read -r -d '' f; do
    local rel="${f#"$src"/}"
    local target="$dest/$rel"
    run mkdir -p "$(dirname "$target")"
    run cp -f "$f" "$target"
  done < <(find "$src" -type d -name .git -prune -o -type f \
             \( -iname '*.md' -o -iname '*.markdown' \) -print0)
}

# --- Main -------------------------------------------------------------------

main() {
  info "Obsidian vault : $OBSIDIAN_VAULT"
  info "Vault subdir   : $OBSIDIAN_SUBDIR"
  info "Markdown only  : $([[ "$MARKDOWN_ONLY" == 1 ]] && echo yes || echo no)"
  info "Dry-run        : $([[ "$DRY_RUN" == 1 ]] && echo yes || echo no)"
  info "Repos          : ${REPO_LIST[*]}"

  if ! have git; then
    err "git is required but not found on PATH."
    exit 1
  fi

  local sync_root="$OBSIDIAN_VAULT/$OBSIDIAN_SUBDIR"
  run mkdir -p "$sync_root"

  local failures=0
  for ref in "${REPO_LIST[@]}"; do
    [[ -z "$ref" ]] && continue
    local name checkout
    name="$(repo_dir_name "$ref")"

    if [[ "$MARKDOWN_ONLY" == "1" ]]; then
      # Use a hidden cache for the full clone, then mirror md into the vault.
      checkout="$sync_root/.cache/$name"
    else
      checkout="$sync_root/$name"
    fi

    info "── Syncing $ref → $checkout"
    if [[ -d "$checkout/.git" ]]; then
      if ! update_repo "$checkout"; then
        err "Failed to update $ref"; failures=$((failures + 1)); continue
      fi
    else
      run mkdir -p "$(dirname "$checkout")"
      if ! clone_repo "$ref" "$checkout"; then
        err "Failed to clone $ref"; failures=$((failures + 1)); continue
      fi
    fi

    if [[ "$MARKDOWN_ONLY" == "1" && "$DRY_RUN" != "1" ]]; then
      mirror_markdown "$checkout" "$sync_root/$name"
    elif [[ "$MARKDOWN_ONLY" == "1" ]]; then
      dim "DRY-RUN: mirror markdown $checkout -> $sync_root/$name"
    fi

    ok "Synced $ref"
  done

  if (( failures > 0 )); then
    err "Completed with $failures failure(s)."
    exit 1
  fi
  ok "All repositories synced to $sync_root"
}

main "$@"
