#!/bin/bash
# notify-delegation.sh — avisa a Slack cuando un humano (no el cron) toma
# manualmente la siguiente tarea de next-task.md, para que quede el mismo
# rastro de eventos que si la hubiera tomado el worker automático.
# Uso: ./notify-delegation.sh "UC-01" "epic/A-nombre" ["detalle opcional"]

set -euo pipefail
ORCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$ORCH_DIR/notify-slack.sh"

UC="${1:-tarea}"
EPIC="${2:-épica desconocida}"
DETAIL="${3:-Se tomó la tarea de next-task.md manualmente y comenzó la implementación.}"

bash "$NOTIFY" info \
  "Implementación manual iniciada: *$UC*" \
  "Épica: \`$EPIC\`\n$DETAIL"
