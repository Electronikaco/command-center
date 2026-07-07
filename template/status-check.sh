#!/bin/bash
# status-check.sh — resumen del estado del orquestador
# Uso: ./status-check.sh

source "$(dirname "$0")/config.sh"

echo "══════════════════════════════════════════════"
echo "  $PROJECT_NAME — Orquestador — Estado"
echo "══════════════════════════════════════════════"
echo ""
echo "Modo: SUPERVISOR=$SUPERVISOR_AGENT · WORKER=$WORKER_AGENT · FUENTE=$TASK_SOURCE"
echo ""

echo "── STATUS.MD (escrito por el worker) ─────────"
grep -E "^\*\*Estado|\*\*Rama|\*\*Tarea|\*\*Bloqueos|\*\*Timestamp" "$STATUS_FILE" 2>/dev/null || cat "$STATUS_FILE" 2>/dev/null | head -10 || echo "[vacío]"
echo ""

echo "── NEXT-TASK.MD (pendiente para el worker) ───"
if [ -f "$NEXT_TASK" ]; then
  head -10 "$NEXT_TASK"
  echo "..."
else
  echo "[ninguna — la última tarea ya fue procesada]"
fi
echo ""

echo "── WORKER LOCK ────────────────────────────────"
if [ -f "$LOCK" ]; then
  LOCK_AGE=$(( ($(date +%s) - $(stat -c %Y "$LOCK")) / 60 ))
  echo "ACTIVO — ${LOCK_AGE} min"
else
  echo "Libre"
fi
echo ""

echo "── RAMAS GIT ACTIVAS ─────────────────────────"
cd "$REPO_DIR"
git branch -a 2>/dev/null | grep -E "uc/|epic/" | grep -v "remotes/origin/HEAD" | head -15
echo ""

echo "── PRs ABIERTAS ──────────────────────────────"
gh pr list --repo "$GH_REPO" --state open --json number,title,headRefName,baseRefName \
  --jq '.[] | "#\(.number) \(.headRefName) → \(.baseRefName): \(.title)"' 2>/dev/null | head -10 || echo "[ninguna o error gh]"
echo ""

echo "── LOG (últimas 5 entradas) ──────────────────"
tail -5 "$LOG" 2>/dev/null | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        d = json.loads(line)
        ts = d['ts'][11:16]  # HH:MM
        print(f\"[{ts}] {d['event']}: {d['msg'][:100]}\")
    except:
        print(line.strip())
"
echo ""

echo "── TAREAS PROCESADAS ─────────────────────────"
ls -t "$ORCH_DIR"/next-task-done-*.md 2>/dev/null | head -5 || echo "[ninguna]"
echo ""
