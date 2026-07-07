#!/bin/bash
# install-cron.sh — instala los crons del orquestador para este proyecto.
#
# Idempotente: puede correrse varias veces sin acumular líneas/comentarios
# duplicados en el crontab (se identifica por el marcador ORCH_TAG, que
# incluye la ruta absoluta de esta carpeta — así conviven varios orquestadores
# de proyectos distintos en el mismo crontab sin pisarse).

set -euo pipefail

ORCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ORCH_DIR/config.sh"

chmod +x "$ORCH_DIR/supervisor.sh"
chmod +x "$ORCH_DIR/worker.sh"
chmod +x "$ORCH_DIR/status-check.sh"

CRON_PATH="PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin"
ORCH_TAG="# ORCHESTRATOR:$ORCH_DIR"

# Quita SOLO las líneas que llevan nuestro tag (ejecutables o comentario,
# anclado al path exacto, para no tocar crons de otros proyectos ni acumular
# comentarios huérfanos entre reinstalaciones) y la línea PATH= que agregamos
# nosotros mismos más abajo (si no, se duplicaría en cada reinstalación).
EXISTING_CRON=$(crontab -l 2>/dev/null | grep -vF "$ORCH_TAG" | grep -v '^PATH=' || true)

OPUS_CRON_LINE="# worker.sh DESACTIVADO (WORKER_AGENT=$WORKER_AGENT) $ORCH_TAG"
if [ "${WORKER_AGENT:-opus}" = "opus" ]; then
  OPUS_CRON_LINE="${CRON_WORKER_SCHEDULE:-*/5 * * * *} $ORCH_DIR/worker.sh >> $ORCH_DIR/cron-worker.log 2>&1 $ORCH_TAG"
fi

NEW_CRON=$(cat << EOF
$CRON_PATH

$EXISTING_CRON

$ORCH_TAG — flujo Git (supervisor)
${CRON_SUPERVISOR_SCHEDULE:-*/10 * * * *} $ORCH_DIR/supervisor.sh >> $ORCH_DIR/cron-supervisor.log 2>&1 $ORCH_TAG

$ORCH_TAG — worker recoge tareas (WORKER_AGENT=$WORKER_AGENT)
$OPUS_CRON_LINE
EOF
)

echo "$NEW_CRON" | crontab -
echo "Crons instalados para $PROJECT_NAME (SUPERVISOR=$SUPERVISOR_AGENT · WORKER=$WORKER_AGENT):"
crontab -l | grep -F "$ORCH_TAG" || true
