#!/bin/bash
# trigger-pages-refresh.sh — dispara rebuild de GitHub Pages (snapshot para jefes)
set -euo pipefail

REPO="Electronikaco/command-center"
LOG="${ORCH_DIR:-/home/claude/dosmentes/.orchestrator}/cron-pages-refresh.log"

if ! gh workflow run pages.yml --repo "$REPO" >> "$LOG" 2>&1; then
  echo "$(date -Is) ERROR al disparar pages.yml" >> "$LOG"
  exit 1
fi

echo "$(date -Is) OK workflow pages.yml disparado" >> "$LOG"
