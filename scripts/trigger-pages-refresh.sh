#!/bin/bash
# trigger-pages-refresh.sh — publica snapshots VIVOS en command-center y despliega Pages
set -euo pipefail

ORCH_DIR="/home/claude/dosmentes/.orchestrator"
DASH="$ORCH_DIR/dashboard"
REPO="Electronikaco/command-center"
LOG="$ORCH_DIR/cron-pages-refresh.log"

log() { echo "$(date -Is) $*" >>"$LOG"; }

cd "$DASH"
log "START prepare:pages-data"
pnpm prepare:pages-data >>"$LOG" 2>&1

push_json() {
  local file=$1
  local path="dashboard/public/data/$file"
  local b64 sha
  b64=$(base64 -w0 "public/data/$file")
  sha=$(gh api "repos/$REPO/contents/$path" --jq .sha 2>/dev/null || true)
  if [ -n "$sha" ]; then
    gh api "repos/$REPO/contents/$path" --method PUT \
      -f message="chore: snapshot VPS $file $(date -u +%Y-%m-%dT%H:%MZ)" \
      -f content="$b64" \
      -f sha="$sha" >>"$LOG" 2>&1
  else
    gh api "repos/$REPO/contents/$path" --method PUT \
      -f message="chore: snapshot VPS $file $(date -u +%Y-%m-%dT%H:%MZ)" \
      -f content="$b64" >>"$LOG" 2>&1
  fi
}

push_json portfolio.json
push_json status.json
log "OK snapshots pushed"

gh workflow run pages.yml --repo "$REPO" >>"$LOG" 2>&1
log "OK workflow pages.yml disparado"
