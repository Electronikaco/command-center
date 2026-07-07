#!/bin/bash
# worker.sh — entrega next-task.md a un CLI headless (WORKER_CLI/WORKER_MODEL
# en config.sh) para que lo implemente.
# Cron: */5 * * * * (activo cuando WORKER_AGENT=opus en config.sh — el nombre
# "opus" es el valor que activa el cron; podés usar cualquier CLI vía WORKER_CLI).
#
# El worker implementa código y actualiza status.md.
# Un humano (o Cursor/otro chat) supervisa; supervisor.sh (cron) maneja Git PR/merge.

set -euo pipefail
source "$(dirname "$0")/config.sh"

if [ "${WORKER_AGENT:-opus}" != "opus" ]; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] worker desactivado — WORKER_AGENT=${WORKER_AGENT:-}. (Un humano/chat toma next-task.md manualmente; ver notify-delegation.sh)"
  exit 0
fi

NOTIFY="$ORCH_DIR/notify-slack.sh"
TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
TS_SAFE=$(date -u '+%Y%m%d_%H%M%S')
PROC_PATTERN="${WORKER_CLI:-claude} --print"

# Garantiza limpieza del lock incluso si el script muere abruptamente
trap 'rm -f "$LOCK"' EXIT

log() {
  local event="$1" msg="$2"
  echo "{\"ts\":\"$TS\",\"event\":\"$event\",\"agent\":\"worker\",\"msg\":$(echo "$msg" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}" >> "$LOG"
}

# Evita ejecuciones paralelas
if [ -f "$LOCK" ]; then
  LOCK_AGE=$(( ($(date +%s) - $(stat -c %Y "$LOCK")) / 60 ))
  if [ "$LOCK_AGE" -lt "${LOCK_MAX_AGE_MIN:-90}" ]; then
    echo "[$TS] Worker corriendo (lock ${LOCK_AGE} min). Saliendo."
    exit 0
  fi
  log "worker_lock_stale" "Lock viejo (${LOCK_AGE} min) removido"
  rm -f "$LOCK"
fi

# Red de seguridad adicional: el lock puede desaparecer sin que el proceso
# real haya terminado. Si hay un proceso del worker vivo, no lanzar uno nuevo
# aunque el lock esté ausente.
if pgrep -f "$PROC_PATTERN" > /dev/null 2>&1; then
  echo "[$TS] Proceso '$PROC_PATTERN' ya activo (sin lock). Saliendo."
  exit 0
fi

# Sin tarea nueva = registrar tick y salir
if [ ! -f "$NEXT_TASK" ]; then
  log "worker_tick" "Sin next-task.md — cron activo, nada que implementar"
  echo "[$TS] Sin next-task.md — nada que hacer."
  exit 0
fi

TASK_CONTENT=$(cat "$NEXT_TASK")

# Si el supervisor escribió WAIT, respetar
if echo "$TASK_CONTENT" | grep -q "^WAIT —"; then
  log "worker_wait" "Supervisor indicó esperar"
  exit 0
fi

# Lock + mueve tarea a procesada antes de arrancar
touch "$LOCK"
mv "$NEXT_TASK" "$ORCH_DIR/next-task-done-${TS_SAFE}.md"
log "worker_start" "Iniciando: $(echo "$TASK_CONTENT" | head -3 | tr '\n' ' ')"

bash "$NOTIFY" info \
  "Worker inicia nueva tarea" \
  "$(echo "$TASK_CONTENT" | grep -A2 '## Instrucción' | tail -2 | head -1)"

# Notas adicionales del proyecto (excepciones, reglas ad-hoc) que siempre
# deben inyectarse en el prompt. Editá PROJECT-NOTES.md; queda vacío por
# defecto y no rompe nada si no lo usás.
PROJECT_NOTES=""
if [ -f "$ORCH_DIR/PROJECT-NOTES.md" ]; then
  PROJECT_NOTES=$(cat "$ORCH_DIR/PROJECT-NOTES.md")
fi

# Construye prompt completo con la convención de status.md (debe coincidir
# EXACTO con lo que parsea get_status_field en supervisor.sh — ver OPUS-CONVENTION.md)
FULL_PROMPT="Eres un agente implementador trabajando en $PROJECT_NAME ($STACK_DESCRIPTION).
Repo: $REPO_DIR
Reglas del proyecto: lee $REPO_DIR/$RULES_FILE antes de empezar.
${SECONDARY_REPO_DIR:+Repo secundario: $SECONDARY_REPO_DIR}

## CONVENCIÓN DE COORDINACIÓN (obligatoria, siempre)

Al TERMINAR cada UC o tarea, actualiza $STATUS_FILE con este formato exacto:

\`\`\`
**Estado:** done
**Rama:** <rama de este repo: uc/, epic/, fix/, hotfix/, docs/>
**Tarea:** <una línea>
**Resumen:** <archivos cambiados, decisiones>
**Bloqueos:** ninguno
**Timestamp:** $TS
\`\`\`

Si cierras una épica completa, usa \`**Estado:** epic_done\` en vez de \`done\`.

El supervisor (no vos) se encarga de: commit, PR, merge y borrado de ramas.
Solo debes escribir código y actualizar status.md.

${PROJECT_NOTES:+## NOTAS DEL PROYECTO

$PROJECT_NOTES
}
## TAREA ASIGNADA

$TASK_CONTENT"

# Ejecuta el worker — cwd en el repo (trust + permisos) y sin prompts
# interactivos en cron.
OPUS_LOG="$ORCH_DIR/worker-output-${TS_SAFE}.log"
set +o pipefail
cd "$REPO_DIR"
WORKER_ARGS=(--print)
[ -n "${WORKER_MODEL:-}" ] && WORKER_ARGS+=(--model "$WORKER_MODEL")
WORKER_ARGS+=(--permission-mode "${WORKER_PERMISSION_MODE:-bypassPermissions}" --add-dir "$ORCH_DIR")
[ -n "${SECONDARY_REPO_DIR:-}" ] && WORKER_ARGS+=(--add-dir "$SECONDARY_REPO_DIR")

echo "$FULL_PROMPT" | "${WORKER_CLI:-claude}" "${WORKER_ARGS[@]}" 2>&1 | tee -a "$OPUS_LOG"
EXIT_CODE=${PIPESTATUS[0]:-1}
set -o pipefail

STALLED=0
if grep -qiE 'requires approval|requires your approval|¿me apruebas|apruebas los comandos' "$OPUS_LOG" 2>/dev/null; then
  STALLED=1
  log "worker_stalled" "El worker pidió aprobación interactiva — tarea probablemente incompleta"
fi

if [ $EXIT_CODE -ne 0 ] || [ "$STALLED" -eq 1 ]; then
  log "worker_error" "Worker terminó con error (exit $EXIT_CODE)"
  bash "$NOTIFY" error \
    "Worker terminó con error (exit $EXIT_CODE)" \
    "Ver: $OPUS_LOG"
  # Escribe status de error si el worker no lo hizo
  if ! grep -q "^\*\*Estado:\*\*" "$STATUS_FILE" 2>/dev/null; then
    cat >> "$STATUS_FILE" << EOF

**Estado:** error
**Rama:** desconocida
**Tarea:** $( echo "$TASK_CONTENT" | head -5 | tail -1)
**Resumen:** El worker terminó con exit $EXIT_CODE sin actualizar status correctamente.
**Bloqueos:** Revisar $OPUS_LOG
**Timestamp:** $TS
EOF
  fi
else
  log "worker_done" "Worker terminó correctamente"
fi

cd "$REPO_DIR"

rm -f "$LOCK"
