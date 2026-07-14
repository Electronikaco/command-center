#!/bin/bash
# opus-worker.sh — Entrega next-task.md a Claude Opus para implementación
# Cron: */5 * * * * (activo cuando WORKER_AGENT=opus en config.sh)
#
# Claude implementa código y actualiza status.md.
# Cursor (chat) supervisa; supervisor.sh (cron) maneja Git PR/merge.

set -euo pipefail
source "$(dirname "$0")/config.sh"

if [ "${WORKER_AGENT:-opus}" = "cursor" ]; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] opus-worker desactivado — WORKER_AGENT=cursor."
  exit 0
fi

NOTIFY="$ORCH_DIR/notify-slack.sh"
TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
TS_SAFE=$(date -u '+%Y%m%d_%H%M%S')

# Garantiza limpieza del lock incluso si el script muere abruptamente
trap 'rm -f "$LOCK"' EXIT

log() {
  local event="$1" msg="$2"
  echo "{\"ts\":\"$TS\",\"event\":\"$event\",\"agent\":\"opus-worker\",\"msg\":$(echo "$msg" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}" >> "$LOG"
}

# Evita ejecuciones paralelas
if [ -f "$LOCK" ]; then
  LOCK_AGE=$(( ($(date +%s) - $(stat -c %Y "$LOCK")) / 60 ))
  if [ "$LOCK_AGE" -lt 90 ]; then
    echo "[$TS] Opus corriendo (lock ${LOCK_AGE} min). Saliendo."
    exit 0
  fi
  log "opus_lock_stale" "Lock viejo (${LOCK_AGE} min) removido"
  rm -f "$LOCK"
fi

# Red de seguridad adicional: el lock puede desaparecer sin que el proceso
# real haya terminado (incidente 2026-07-06, causa aún no confirmada). Si hay
# un "claude --model claude-opus-4-8" vivo, no lanzar uno nuevo aunque el
# lock esté ausente.
if pgrep -f "claude --print --model claude-opus-4-8" > /dev/null 2>&1; then
  echo "[$TS] Proceso claude-opus-4-8 ya activo (sin lock). Saliendo."
  exit 0
fi

# Sin tarea nueva = registrar tick y salir
if [ ! -f "$NEXT_TASK" ]; then
  log "opus_tick" "Sin next-task.md — cron activo, nada que implementar"
  echo "[$TS] Sin next-task.md — nada que hacer."
  exit 0
fi

TASK_CONTENT=$(cat "$NEXT_TASK")

# Si el supervisor escribió WAIT, respetar
if echo "$TASK_CONTENT" | grep -q "^WAIT —"; then
  log "opus_wait" "Supervisor indicó esperar"
  exit 0
fi

# Lock + mueve tarea a procesada antes de arrancar
touch "$LOCK"
mv "$NEXT_TASK" "$ORCH_DIR/next-task-done-${TS_SAFE}.md"
log "opus_start" "Iniciando: $(echo "$TASK_CONTENT" | head -3 | tr '\n' ' ')"

bash "$NOTIFY" info \
  "Opus inicia nueva tarea" \
  "$(echo "$TASK_CONTENT" | grep -A2 '## Instrucción' | tail -2 | head -1)"

# Construye prompt completo con la convención de status.md
FULL_PROMPT="Eres Claude Opus trabajando en DosMentes.ai (Next.js 16 · React 19 · TypeScript · pnpm · FSD · MSW).
Repo principal: $REPO_DIR
Repo contratos: $CONTRACTS_DIR
Reglas del proyecto: lee $REPO_DIR/AGENTS.md antes de empezar.

## CONVENCIÓN DE COORDINACIÓN (obligatoria, siempre)

Al TERMINAR cada UC o tarea, actualiza $STATUS_FILE con este formato exacto:

**UC normal (solo front):**
\`\`\`
**Estado:** done
**Rama:** <rama dosmentes-front: uc/, epic/, fix/, hotfix/, docs/>
**Tarea:** <una línea>
**Resumen:** <archivos cambiados, decisiones>
**Bloqueos:** ninguno
**Timestamp:** $TS
\`\`\`

**Cierre de épica o tarea con contrato (dos repos):**
\`\`\`
**Estado:** epic_done   (o done si es hotfix post-merge)
**Rama:** <SOLO rama dosmentes-front — nunca feat/contract-* ni ramas de dm-api-contracts>
**Tarea:** Épica X cierre — auditoría + contrato OpenAPI <archivo>
**Resumen:** Hotfix/auditoría front: <archivos>. tsc/tests/build OK. Contrato dm-api-contracts en rama feat/contract-<módulo>-sX — PR #<N> <URL>. Merge manual del contrato contra main.
**Bloqueos:** ninguno
**Timestamp:** $TS
\`\`\`

El supervisor (no tú) se encarga de: commit, PR, merge y borrado de ramas **solo en dosmentes-front**.
El PR en \`$CONTRACTS_DIR\` (\`$CONTRACTS_GH_REPO\`) requiere **merge manual** contra \`$CONTRACTS_BASE_BRANCH\`.
Solo debes escribir código y actualizar status.md.

## REPOS Y RAMAS (obligatorio, incidente 2026-07-06)

- Progresión de épicas FRONTEND (\`EPIC_ORDER\` en config.sh): A → B → C → D → E → F → G → I, todas en \`$REPO_DIR\` (rama \`uc/UC-DM-SX-XX-*\` → \`epic/X-nombre\` → \`develop\`).
- \`EPIC-H\` (backend-contratos-seguridad) NO participa de esa progresión. Su único UC vigente, \`UC-DM-INFRA-01\` (contrato OpenAPI al cerrar cada módulo), NO toca \`$REPO_DIR\`: genera un archivo \`.openapi.yaml\` a partir de los Zod schemas + handlers MSW del módulo cerrado, y ese archivo se commitea en \`$CONTRACTS_DIR\` en una rama propia \`feat/contract-<módulo>-sX\` **directo contra \`main\`** (igual que los contratos ya abiertos de EPIC-A/B/C/D/E). NUNCA crear \`epic/H-backend-contratos-seguridad\` ni \`uc/UC-DM-INFRA-01-*\` en \`$REPO_DIR\` — si next-task.md lo pide, avisa en status.md (Estado: blocked) en vez de crear esas ramas.
- \`epic/F-piloto-observabilidad\` depende del backend diferido (EPIC-H) — no se autoinicia; si el backlog scanner lo sugiere sin instrucción explícita de Cursor, trátalo como bloqueo y pregunta antes de implementar.

## TAREA ASIGNADA

$TASK_CONTENT"

# Ejecuta Opus — cwd en repo front (trust + permisos) y sin prompts interactivos en cron
OPUS_LOG="$ORCH_DIR/opus-output-${TS_SAFE}.log"
set +o pipefail
cd "$REPO_DIR"
echo "$FULL_PROMPT" | claude --print --model claude-opus-4-8 \
  --permission-mode bypassPermissions \
  --add-dir "$ORCH_DIR" --add-dir "$CONTRACTS_DIR" 2>&1 | tee -a "$OPUS_LOG"
EXIT_CODE=${PIPESTATUS[0]:-1}
set -o pipefail

STALLED=0
if grep -qiE 'requires approval|requires your approval|¿me apruebas|apruebas los comandos' "$OPUS_LOG" 2>/dev/null; then
  STALLED=1
  log "opus_stalled" "Opus pidió aprobación interactiva — tarea probablemente incompleta"
fi

if [ $EXIT_CODE -ne 0 ] || [ "$STALLED" -eq 1 ]; then
  log "opus_error" "Opus terminó con error (exit $EXIT_CODE)"
  bash "$NOTIFY" error \
    "Opus terminó con error (exit $EXIT_CODE)" \
    "Ver: $ORCH_DIR/opus-output-${TS_SAFE}.log"
  # Escribe status de error si Opus no lo hizo
  if ! grep -q "^\*\*Estado:\*\*" "$STATUS_FILE" 2>/dev/null; then
    cat >> "$STATUS_FILE" << EOF

**Estado:** error
**Rama:** desconocida
**Tarea:** $( echo "$TASK_CONTENT" | head -5 | tail -1)
**Resumen:** Opus terminó con exit $EXIT_CODE sin actualizar status correctamente.
**Bloqueos:** Revisar opus-output-${TS_SAFE}.log
**Timestamp:** $TS
EOF
  fi
else
  log "opus_done" "Opus terminó correctamente"
fi

cd "$REPO_DIR"

rm -f "$LOCK"
