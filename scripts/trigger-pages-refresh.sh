#!/bin/bash
# trigger-pages-refresh.sh — publica snapshot VIVO de portfolio.json en command-center y despliega Pages
set -euo pipefail

ORCH_DIR="/home/claude/dosmentes/.orchestrator"
DASH="$ORCH_DIR/dashboard"
REPO="Electronikaco/command-center"
LOG="$ORCH_DIR/cron-pages-refresh.log"
WORK="/tmp/command-center-pages-refresh"

log() { echo "$(date -Is) $*" >>"$LOG"; }

cd "$DASH"
log "START prepare:pages-data"
pnpm prepare:pages-data >>"$LOG" 2>&1

rm -rf "$WORK"
git clone --depth 1 "https://github.com/$REPO.git" "$WORK" >>"$LOG" 2>&1
mkdir -p "$WORK/dashboard/public/data"
cp public/data/portfolio.json "$WORK/dashboard/public/data/portfolio.json"

cd "$WORK"
if git diff --quiet -- dashboard/public/data/portfolio.json; then
  log "SKIP snapshot sin cambios"
else
  export GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-Electronika}"
  export GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-33184090+electronikatm@users.noreply.github.com}"
  export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
  export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
  git add dashboard/public/data/portfolio.json
  git commit -m "chore: snapshot VPS $(date -u +%Y-%m-%dT%H:%MZ)" >>"$LOG" 2>&1
  git push origin HEAD:main >>"$LOG" 2>&1
  log "OK snapshot pushed"
fi

# Un solo dispatch; el push ya dispara pages.yml, pero el dispatch cubre
# el caso "sin cambios en JSON" tras un fix de UI.
gh workflow run pages.yml --repo "$REPO" >>"$LOG" 2>&1
log "OK workflow pages.yml disparado"

rm -rf "$WORK"
