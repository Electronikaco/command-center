#!/bin/bash
# install-cron.sh — instala los crons del orquestador DosMentes

set -euo pipefail

ORCH_DIR="/home/claude/dosmentes/.orchestrator"
source "$ORCH_DIR/config.sh"

chmod +x "$ORCH_DIR/supervisor.sh"
chmod +x "$ORCH_DIR/opus-worker.sh"
chmod +x "$ORCH_DIR/status-check.sh"

CRON_PATH="PATH=/home/claude/.local/bin:/home/claude/.local/node/bin:/usr/local/bin:/usr/bin:/bin"

EXISTING_CRON=$(crontab -l 2>/dev/null | grep -v "orchestrator\|supervisor.sh\|opus-worker.sh" || true)

OPUS_CRON_LINE="# opus-worker DESACTIVADO (WORKER_AGENT=$WORKER_AGENT)"
if [ "${WORKER_AGENT:-opus}" = "opus" ]; then
  OPUS_CRON_LINE="*/5 * * * * $ORCH_DIR/opus-worker.sh >> $ORCH_DIR/cron-opus.log 2>&1"
fi

NEW_CRON=$(cat << EOF
$CRON_PATH

$EXISTING_CRON

# DosMentes Orchestrator — flujo Git cada 10 min (supervisor cron)
*/10 * * * * $ORCH_DIR/supervisor.sh >> $ORCH_DIR/cron-supervisor.log 2>&1

# DosMentes Orchestrator — Claude Opus recoge tareas cada 5 min (WORKER_AGENT=$WORKER_AGENT)
$OPUS_CRON_LINE
EOF
)

echo "$NEW_CRON" | crontab -
echo "Crons instalados (SUPERVISOR=$SUPERVISOR_AGENT · WORKER=$WORKER_AGENT):"
crontab -l | grep -E "supervisor|opus-worker|WORKER" || true
