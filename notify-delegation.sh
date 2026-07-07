#!/bin/bash
# notify-delegation.sh — Cursor avisa a Slack al iniciar implementación de una UC/épica
# Uso: ./notify-delegation.sh "UC-DM-S9-03" "epic/G-consolidados-tenant" ["detalle opcional"]

set -euo pipefail
ORCH_DIR="$(dirname "$0")"
NOTIFY="$ORCH_DIR/notify-slack.sh"

UC="${1:-tarea}"
EPIC="${2:-épica desconocida}"
DETAIL="${3:-Cursor tomó la tarea de next-task.md y comenzó implementación.}"

bash "$NOTIFY" info \
  "Cursor inicia: *$UC*" \
  "Épica: \`$EPIC\`\n$DETAIL"
