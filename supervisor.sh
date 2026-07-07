#!/bin/bash
# supervisor.sh — Supervisor de flujo Git DosMentes
# Cron: */10 * * * * /home/claude/dosmentes/.orchestrator/supervisor.sh
#
# Responsabilidades (solo estas, en este orden):
#   1. Detecta si Opus terminó una tarea (status.md → Estado: done)
#   2. Ejecuta el flujo Git: commit pendiente → PR → merge → borrar branch
#   3. Si cierra una épica: PR epic → develop, merge, borra epic branch
#   4. Notifica a Slack en cada evento relevante
#   5. Escribe next-task.md para que Opus continúe con la siguiente tarea
#   NO corre tests (eso lo manejan los subagentes de .claude)

set -euo pipefail
source "$(dirname "$0")/config.sh"
source "$(dirname "$0")/lib-issues.sh"
source "$(dirname "$0")/lib-contracts.sh"
source "$(dirname "$0")/lib-backlog.sh"
source "$(dirname "$0")/lib-auto-queue.sh"

# Delegación: backlog de épicas (default) o GitHub Issues (legacy)
find_next_uc() {
  if [ "${TASK_SOURCE:-backlog}" = "backlog" ]; then
    find_next_uc_from_backlog "$1"
  else
    find_next_uc_issue "$1"
  fi
}

render_next_uc_task_wrapped() {
  if [ "${TASK_SOURCE:-backlog}" = "backlog" ]; then
    render_next_uc_task_from_backlog "$@"
  else
    render_next_uc_task "$@"
  fi
}

NOTIFY="$ORCH_DIR/notify-slack.sh"
TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
TS_SAFE=$(date -u '+%Y%m%d_%H%M%S')

# ─── Helpers ──────────────────────────────────────────────────────────────────

log() {
  local event="$1" msg="$2"
  echo "{\"ts\":\"$TS\",\"event\":\"$event\",\"agent\":\"supervisor\",\"msg\":$(echo "$msg" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}" >> "$LOG"
}

die() { log "supervisor_error" "$1"; bash "$NOTIFY" error "$1"; exit 1; }

# Lee el campo del status.md: get_status_field "Estado"
# Tolera ambos formatos de campo: '**Campo:** valor' y '**Campo**: valor'.
get_status_field() {
  grep -iE "^\*\*$1:?\*\*:?" "$STATUS_FILE" 2>/dev/null | head -1 | sed -E 's/^\*\*[^*]+\*\*:? *//' | tr -d '\r\n' || echo ""
}

# True si la rama épica está en pausa (no autoiniciar por watchdog/fallback).
epic_is_paused() {
  local branch="$1"
  for paused in "${EPIC_PAUSED[@]:-}"; do
    [ "$branch" = "$paused" ] && return 0
  done
  return 1
}

# Determina la siguiente épica en el orden canónico
next_epic_after() {
  local current="$1"
  local found=0
  for entry in "${EPIC_ORDER[@]}"; do
    local branch="${entry%%:*}"
    if [ $found -eq 1 ]; then echo "$entry"; return; fi
    if [ "$branch" = "$current" ]; then found=1; fi
  done
  echo ""  # No hay siguiente (I es la última del flujo frontend; EPIC-H no participa, ver config.sh)
}

# ─── Verifica si hay algo que hacer ───────────────────────────────────────────

log "supervisor_start" "Ciclo de supervisión iniciado"

if [ ! -f "$STATUS_FILE" ]; then
  log "supervisor_skip" "No hay status.md — nada que supervisar"
  exit 0
fi

ESTADO=$(get_status_field "Estado")
RAMA_TRABAJO=$(get_status_field "Rama")
TAREA=$(get_status_field "Tarea")

log "supervisor_read" "Estado=$ESTADO | Rama=$RAMA_TRABAJO | Tarea=$TAREA"

RESUMEN=$(get_status_field "Resumen")
[ -n "$RESUMEN" ] && log_contract_from_resumen "$RESUMEN" || true

# Rama inválida (p.ej. feat/contract-* de dm-api-contracts) — no ejecutar git-flow
if echo "$ESTADO" | grep -qi "^done\|^epic_done" && ! is_valid_front_branch "$RAMA_TRABAJO"; then
  die "Rama inválida en status.md: '$RAMA_TRABAJO'. **Rama:** debe ser solo dosmentes-front (uc/, epic/, fix/, hotfix/, docs/). Documenta el PR de dm-api-contracts en **Resumen:**."
fi

# ─── Si hay error/bloqueado → notifica y escribe corrección ───────────────────

if echo "$ESTADO" | grep -qi "^blocked\|^error"; then
  BLOQUEO=$(get_status_field "Bloqueos")
  bash "$NOTIFY" blocked \
    "Opus está *bloqueado/con error* en \`$RAMA_TRABAJO\`" \
    "Tarea: $TAREA\nBloqueo: $BLOQUEO"
  log "supervisor_blocked" "Notificado bloqueo en $RAMA_TRABAJO"

  # Usa cursor para generar instrucción correctiva
  CORRECTIVE=$("$CURSOR" --print --trust --yolo \
    --workspace "$REPO_DIR" \
    "Lee /home/claude/dosmentes/.orchestrator/status.md. Opus está bloqueado. Escribe una instrucción correctiva corta y accionable (máx 10 líneas) para que supere el bloqueo. Solo texto plano, sin JSON, sin markdown innecesario." 2>/dev/null || echo "Revisar manualmente el bloqueo en status.md")

  cat > "$NEXT_TASK" << EOF
# Instrucción correctiva del supervisor
**Emitida por:** Supervisor (corrección de bloqueo)
**Timestamp:** $TS

## Contexto del bloqueo
$BLOQUEO

## Instrucción correctiva
$CORRECTIVE

---
Al terminar, actualiza status.md con Estado: done (o blocked si persiste).
<!-- Opus: mueve este archivo a next-task-done-${TS_SAFE}.md tras leer -->
EOF

  log "supervisor_corrective" "Instrucción correctiva escrita en next-task.md"
  exit 0
fi

# ─── Si no está done ni epic_done, no hay nada que hacer (salvo watchdog) ────

if ! echo "$ESTADO" | grep -qi "^done\|^epic_done"; then
  # Si ya hay una tarea en cola, Opus está corriendo (lock fresco), o hay un
  # proceso "claude --model claude-opus-4-8" vivo (el lock puede desaparecer
  # sin que el proceso real haya terminado — visto en incidente 2026-07-06),
  # es el caso normal: Opus está trabajando y todavía no terminó. No tocar nada.
  if [ -f "$NEXT_TASK" ] || [ -f "$LOCK" ] || pgrep -f "claude --print --model claude-opus-4-8" > /dev/null 2>&1; then
    log "supervisor_skip" "Estado=$ESTADO — Opus aún en progreso"
    exit 0
  fi

  # UC ya mergeada: reanudar pipeline sin esperar intervención manual.
  if echo "$ESTADO" | grep -qi "^procesado"; then
    if [ "${AUTO_RESUME_ON_PROCESADO:-true}" = "true" ]; then
      log "supervisor_auto_resume" "Estado=procesado sin cola — auto-encolando"
      auto_queue_next_work "$RAMA_TRABAJO" "resume tras procesado" || true
    else
      log "supervisor_skip" "Estado=procesado — AUTO_RESUME_ON_PROCESADO=false"
    fi
    exit 0
  fi

  # Watchdog: pipeline huérfano (idle, in_progress, etc.)
  log "supervisor_watchdog" "Estado=$ESTADO sin next-task.md ni lock — intentando autorrecuperar"
  auto_queue_next_work "$RAMA_TRABAJO" "watchdog: pipeline inactivo" || \
    log "supervisor_skip" "Estado=$ESTADO — sin UCs pendientes en épicas activas"
  exit 0
fi

# ─── done en rama de coordinación (develop/main) → sin PR, encolar siguiente ──

if echo "$ESTADO" | grep -qi "^done" && is_coordination_branch "$RAMA_TRABAJO"; then
  log "supervisor_coord_done" "Tarea coordinación en $RAMA_TRABAJO — sin flujo git"
  sed -i 's/^\*\*Estado:\*\* done/**Estado:** procesado/' "$STATUS_FILE" 2>/dev/null || true
  auto_queue_next_work "$RAMA_TRABAJO" "tarea coordinación completada" || true
  exit 0
fi

# ─── epic_done con rama ya mergeada manualmente → saltar git, generar siguiente épica ──

if echo "$ESTADO" | grep -qi "^epic_done"; then
  cd "$REPO_DIR"
  git fetch --all --prune 2>/dev/null || true
  EPIC_BRANCH=$(get_status_field "Rama")
  BRANCH_EXISTS=$(git ls-remote --heads origin "$EPIC_BRANCH" 2>/dev/null | wc -l)

  if [ "$BRANCH_EXISTS" -eq 0 ]; then
    log "supervisor_epic_manual" "Épica $EPIC_BRANCH ya mergeada manualmente — saltando flujo git"
    bash "$NOTIFY" info \
      "Épica \`$EPIC_BRANCH\` ya mergeada manualmente" \
      "Generando siguiente tarea automáticamente..."

    NEXT_ENTRY=$(next_epic_after "$EPIC_BRANCH")
    if [ -z "$NEXT_ENTRY" ]; then
      bash "$NOTIFY" epic_done \
        "TODAS LAS ÉPICAS COMPLETADAS — MVP feature-complete" \
        "No hay más épicas en el backlog. Revisa EPIC-H si corresponde."
      log "supervisor_all_done" "No hay más épicas"
    else
      NEXT_BRANCH="${NEXT_ENTRY%%:*}"
      bash "$NOTIFY" info \
        "Iniciando *$(echo "$NEXT_BRANCH" | sed 's|epic/||')*" \
        "Buscando primera UC pendiente en el backlog de la épica..."
      if find_next_uc "$NEXT_BRANCH"; then
        render_next_uc_task_wrapped "$NEXT_BRANCH" "cierre manual de épica detectado automáticamente" "$TS" "$TS_SAFE" "$STATUS_FILE" > "$NEXT_TASK"
        log "supervisor_next_epic" "Siguiente épica: $NEXT_BRANCH — UC ${NEXT_UC_CODE:-#$NEXT_ISSUE_NUMBER} escrito en next-task.md"
        bash "$NOTIFY" info \
          "Desarrollo iniciado en \`$NEXT_BRANCH\`" \
          "Primera UC en cola: *${NEXT_UC_CODE:-UC}* — ${NEXT_UC_TITLE:-$NEXT_ISSUE_TITLE}"
      else
        bash "$NOTIFY" warning \
          "No encontré UCs pendientes en el backlog para \`$NEXT_BRANCH\`" \
          "Revisa \`docs/backlog/EPIC-$(echo "$NEXT_BRANCH" | sed 's|epic/||' | tr '[:lower:]' '[:upper:]' | cut -c1).md\` antes de continuar."
        log "supervisor_no_issues" "Sin issues uc abiertos para $NEXT_BRANCH"
      fi
    fi

    sed -i 's/^\*\*Estado:\*\* epic_done/**Estado:** procesado/' "$STATUS_FILE" 2>/dev/null || true
    exit 0
  fi
  # Si la rama SÍ existe remotamente, cae al flujo normal (git + PR + siguiente)
fi

# ─── Opus terminó → ejecuta flujo Git ─────────────────────────────────────────

log "supervisor_git_start" "Opus terminó. Iniciando flujo Git en $RAMA_TRABAJO"

cd "$REPO_DIR"
git fetch --all --prune 2>/dev/null || true

# Detecta si la rama de trabajo es una uc/ o una epic/ directamente
BRANCH_TYPE=""
PARENT_EPIC=""

if echo "$RAMA_TRABAJO" | grep -q "^uc/"; then
  BRANCH_TYPE="uc"
  UC_BLOCK=$(echo "$RAMA_TRABAJO" | grep -oP 'UC-DM-S\K[0-9]+' | head -1 || echo "")
  for entry in "${EPIC_ORDER[@]}"; do
    BRANCH="${entry%%:*}"
    # Mapeo bloque → epic: S3→A, S4→B, S5→C, S6→D, S7→E, S8→F, S9→G
    case "$UC_BLOCK" in
      3) [[ "$BRANCH" == epic/A* ]] && PARENT_EPIC="$BRANCH" ;;
      4) [[ "$BRANCH" == epic/B* ]] && PARENT_EPIC="$BRANCH" ;;
      5) [[ "$BRANCH" == epic/C* ]] && PARENT_EPIC="$BRANCH" ;;
      6) [[ "$BRANCH" == epic/D* ]] && PARENT_EPIC="$BRANCH" ;;
      7) [[ "$BRANCH" == epic/E* ]] && PARENT_EPIC="$BRANCH" ;;
      8) [[ "$BRANCH" == epic/F* ]] && PARENT_EPIC="$BRANCH" ;;
      9) [[ "$BRANCH" == epic/G* ]] && PARENT_EPIC="$BRANCH" ;;
      10) [[ "$BRANCH" == epic/I* ]] && PARENT_EPIC="$BRANCH" ;;
    esac
  done
  # UC-DM-INFRA-* NUNCA se crea en dosmentes-front (ver config.sh) — no se
  # mapea a epic/H aquí a propósito; si aparece, cae a BASE_BRANCH abajo y
  # se debe investigar cómo se generó.
  [ -z "$PARENT_EPIC" ] && PARENT_EPIC="$BASE_BRANCH"

elif echo "$RAMA_TRABAJO" | grep -q "^epic/"; then
  BRANCH_TYPE="epic"
  PARENT_EPIC="$RAMA_TRABAJO"

elif echo "$RAMA_TRABAJO" | grep -qE "^(fix|hotfix|docs)/"; then
  BRANCH_TYPE="hotfix"
  PARENT_EPIC="$BASE_BRANCH"
fi

# ── Paso 1: Verificar y manejar cambios sin commitear ─────────────────────────

git checkout "$RAMA_TRABAJO" 2>/dev/null || {
  log "supervisor_warn" "No se puede hacer checkout a $RAMA_TRABAJO — puede estar solo en remoto"
  git checkout -b "$RAMA_TRABAJO" "origin/$RAMA_TRABAJO" 2>/dev/null || true
}

UNCOMMITTED=$(git status --porcelain 2>/dev/null \
  | { grep -vE '^\?\? |^.. \.claude/' || true; } \
  | { grep -vE '^.. \.cursor/' || true; } \
  | { grep -vE '^.. docs/backlog/' || true; } \
  | wc -l)
if [ "$UNCOMMITTED" -gt 0 ]; then
  log "supervisor_commit_needed" "Hay $UNCOMMITTED archivos sin commitear — el supervisor ejecuta git (no Opus)"

  # Handoff explícito en Resumen (p. ej. scripts/s8-04-commit.sh tras UC en rama distinta)
  HANDOFF_SCRIPT=$(echo "$RESUMEN" | grep -oE 'scripts/[a-zA-Z0-9_.-]+\.sh' | head -1 || true)
  if [ -z "$HANDOFF_SCRIPT" ]; then
    HANDOFF_BASENAME=$(echo "$RESUMEN" | grep -oE '[a-zA-Z0-9_.-]+-commit\.sh' | head -1 || true)
    [ -n "$HANDOFF_BASENAME" ] && HANDOFF_SCRIPT="scripts/$HANDOFF_BASENAME"
  fi
  if [ -n "$HANDOFF_SCRIPT" ] && [ -f "$ORCH_DIR/$HANDOFF_SCRIPT" ]; then
    log "supervisor_handoff" "Ejecutando $HANDOFF_SCRIPT"
    bash "$NOTIFY" info \
      "Handoff git en \`$RAMA_TRABAJO\`" \
      "Ejecutando \`$HANDOFF_SCRIPT\` (supervisor, no Opus)."
    bash "$ORCH_DIR/$HANDOFF_SCRIPT" || die "Falló $HANDOFF_SCRIPT"
    git fetch --all --prune 2>/dev/null || true
    git checkout "$RAMA_TRABAJO" 2>/dev/null || true
  else
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
    if [ "$CURRENT_BRANCH" != "$RAMA_TRABAJO" ]; then
      die "Hay cambios sin commitear pero HEAD=$CURRENT_BRANCH ≠ $RAMA_TRABAJO. Documenta un script de handoff en **Resumen:** (scripts/*.sh) o corrige la rama."
    fi
    UC_CODE=$(echo "$RAMA_TRABAJO" | grep -oE 'UC-DM-S[0-9]+-[0-9]+' | head -1 || echo "$RAMA_TRABAJO")
    COMMIT_TITLE=$(echo "$TAREA" | sed 's/;.*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    git add -A
    git commit -m "feat: $UC_CODE — $COMMIT_TITLE" || die "git commit falló en $RAMA_TRABAJO"
    git push origin "$RAMA_TRABAJO" || die "git push falló en $RAMA_TRABAJO"
    log "supervisor_committed" "Commit y push directos en $RAMA_TRABAJO"
  fi

  UNCOMMITTED=$(git status --porcelain 2>/dev/null \
    | { grep -vE '^\?\? |^.. \.claude/' || true; } \
    | { grep -vE '^.. \.cursor/' || true; } \
    | { grep -vE '^.. docs/backlog/' || true; } \
    | wc -l)
  [ "$UNCOMMITTED" -gt 0 ] && die "Persisten $UNCOMMITTED archivos sin commitear tras handoff/commit del supervisor"
fi

# ── Paso 2: Asegura que la rama está pusheada ─────────────────────────────────

git push origin "$RAMA_TRABAJO" 2>/dev/null || true

# Si el PR va a apuntar a una rama epic/, asegura que esa base también exista en origin.
# Sin esto, `gh pr create --base epic/X` falla en bucle cuando la epic branch
# se creó solo localmente y nadie la pusheó (p.ej. al arrancar una épica nueva).
if [ "$BRANCH_TYPE" = "uc" ] && echo "$PARENT_EPIC" | grep -q "^epic/"; then
  EPIC_EXISTS_REMOTE=$(git ls-remote --heads origin "$PARENT_EPIC" 2>/dev/null | wc -l)
  if [ "$EPIC_EXISTS_REMOTE" -eq 0 ]; then
    if git show-ref --verify --quiet "refs/heads/$PARENT_EPIC"; then
      git push origin "$PARENT_EPIC" 2>/dev/null || true
      log "supervisor_epic_pushed" "Rama épica $PARENT_EPIC no existía en origin — pusheada automáticamente"
      bash "$NOTIFY" info \
        "Rama épica \`$PARENT_EPIC\` no estaba en origin" \
        "Pusheada automáticamente por el supervisor antes de crear el PR de \`$RAMA_TRABAJO\`."
    else
      die "La rama épica $PARENT_EPIC no existe ni local ni remotamente. Opus debe crearla (git checkout -b $PARENT_EPIC $BASE_BRANCH) antes de continuar."
    fi
  fi
fi

# ── Paso 3: Crear PR y mergear ────────────────────────────────────────────────

if [ "$BRANCH_TYPE" = "uc" ]; then
  PR_BASE="$PARENT_EPIC"
  PR_TITLE="$TAREA"
  PR_BODY="UC completado. Mergeado automáticamente por el orquestador desde \`$RAMA_TRABAJO\` → \`$PR_BASE\`."
elif [ "$BRANCH_TYPE" = "epic" ]; then
  PR_BASE="$BASE_BRANCH"
  PR_TITLE="[EPIC] $(echo "$RAMA_TRABAJO" | sed 's|epic/||')"
  PR_BODY="Épica completada. Mergeada automáticamente por el orquestador desde \`$RAMA_TRABAJO\` → \`$BASE_BRANCH\`."
elif [ "$BRANCH_TYPE" = "hotfix" ]; then
  PR_BASE="$BASE_BRANCH"
  PR_TITLE="$TAREA"
  PR_BODY="Fix mergeado automáticamente por el orquestador desde \`$RAMA_TRABAJO\` → \`$BASE_BRANCH\`."
else
  die "Rama no reconocida para flujo git: $RAMA_TRABAJO (esperado uc/, epic/, fix/, hotfix/ o docs/)"
fi

# Verifica si ya existe PR abierta para esta rama
EXISTING_PR=$(gh pr list --head "$RAMA_TRABAJO" --base "$PR_BASE" --state open --json number --jq '.[0].number' 2>/dev/null || echo "")

if [ -z "$EXISTING_PR" ]; then
  PR_URL=$(gh pr create \
    --head "$RAMA_TRABAJO" \
    --base "$PR_BASE" \
    --title "$PR_TITLE" \
    --body "$PR_BODY" \
    --repo electronikatm/dosmentes-front 2>/dev/null) || { die "Error al crear PR de $RAMA_TRABAJO → $PR_BASE"; }
  PR_NUMBER=$(echo "$PR_URL" | grep -oP '\d+$')
  log "supervisor_pr_created" "PR #$PR_NUMBER: $RAMA_TRABAJO → $PR_BASE"
else
  PR_NUMBER="$EXISTING_PR"
  PR_URL="https://github.com/electronikatm/dosmentes-front/pull/$PR_NUMBER"
  log "supervisor_pr_existing" "PR #$PR_NUMBER ya existía"
fi

# ── Paso 4: Merge de la PR ────────────────────────────────────────────────────

gh pr merge "$PR_NUMBER" \
  --squash \
  --delete-branch \
  --repo electronikatm/dosmentes-front 2>/dev/null || { die "Error al mergear PR #$PR_NUMBER"; }

log "supervisor_pr_merged" "PR #$PR_NUMBER mergeada y rama remota eliminada"

# Elimina rama local si existe
git branch -D "$RAMA_TRABAJO" 2>/dev/null || true
log "supervisor_branch_deleted" "Rama local $RAMA_TRABAJO eliminada"

# Cierra (best-effort) el issue de GitHub — solo si CLOSE_GITHUB_ISSUES=true
CLOSED_ISSUE=""
if [ "${CLOSE_GITHUB_ISSUES:-false}" = "true" ]; then
  CLOSED_ISSUE=$(close_uc_issue_for_branch "$RAMA_TRABAJO" "$PR_NUMBER" "$PR_BASE")
fi
[ -n "$CLOSED_ISSUE" ] && log "supervisor_issue_closed" "Issue #$CLOSED_ISSUE cerrado tras merge de $RAMA_TRABAJO"

# ─── Notifica merge de UC ─────────────────────────────────────────────────────

if [ "$BRANCH_TYPE" = "uc" ]; then
  bash "$NOTIFY" done \
    "UC mergeado: \`$RAMA_TRABAJO\` → \`$PR_BASE\`" \
    "PR #$PR_NUMBER · $PR_URL\nTarea: $TAREA"

  # ── Paso 5: ¿Quedan UCs pendientes en la épica? ──────────────────────────────
  # Busca ramas uc/ remotas que apunten a la misma épica y no estén mergeadas
  PENDING_UCS=$(gh pr list \
    --base "$PARENT_EPIC" \
    --state open \
    --json headRefName \
    --jq '.[].headRefName' \
    --repo electronikatm/dosmentes-front 2>/dev/null | { grep -c "^uc/" || true; })

  if [ "$PENDING_UCS" -eq 0 ]; then
    log "supervisor_epic_check" "No hay PRs uc/ pendientes en $PARENT_EPIC — consultando GitHub Issues"

    if find_next_uc "$PARENT_EPIC"; then
      render_next_uc_task_wrapped "$PARENT_EPIC" "continuación automática de la épica" "$TS" "$TS_SAFE" "$STATUS_FILE" > "$NEXT_TASK"
      log "supervisor_next_uc" "Siguiente UC de $PARENT_EPIC (${NEXT_UC_CODE:-issue #$NEXT_ISSUE_NUMBER}) escrita en next-task.md"
      bash "$NOTIFY" info \
        "Siguiente UC de \`$PARENT_EPIC\` en cola" \
        "${NEXT_UC_CODE:-Issue #$NEXT_ISSUE_NUMBER} — ${NEXT_UC_TITLE:-$NEXT_ISSUE_TITLE}"
    else
      log "supervisor_epic_check" "No hay UCs pendientes en backlog para $PARENT_EPIC"
      if [ "${AUTO_EPIC_CLOSE_TASK:-true}" = "true" ]; then
        render_epic_close_next_task "$PARENT_EPIC" "$TS" "$TS_SAFE" "$STATUS_FILE" > "$NEXT_TASK"
        log "supervisor_epic_close_queued" "Cierre épica $PARENT_EPIC encolado tras última UC"
        bash "$NOTIFY" epic_ready \
          "Épica \`$PARENT_EPIC\` lista para cerrar" \
          "Todas las UCs mergeadas. Tarea epic_done en next-task.md (automático)."
      else
        bash "$NOTIFY" epic_ready \
          "Épica \`$PARENT_EPIC\` lista para cerrar" \
          "Todas las UCs del backlog están mergeadas. Marca \`Estado: epic_done\` en status.md."
      fi
    fi
  fi
fi

# ─── Si la épica está done → merge epic → develop ─────────────────────────────

if [ "$BRANCH_TYPE" = "epic" ] || echo "$ESTADO" | grep -qi "epic_done"; then
  EPIC_BRANCH="${PARENT_EPIC:-$RAMA_TRABAJO}"

  # Crea PR epic → develop
  EPIC_PR_URL=$(gh pr create \
    --head "$EPIC_BRANCH" \
    --base "$BASE_BRANCH" \
    --title "[EPIC CLOSE] $(echo "$EPIC_BRANCH" | sed 's|epic/||')" \
    --body "Épica completa. Mergeada automáticamente por orquestador." \
    --repo electronikatm/dosmentes-front 2>/dev/null) || { die "Error al crear PR de épica $EPIC_BRANCH → $BASE_BRANCH"; }

  EPIC_PR_NUMBER=$(echo "$EPIC_PR_URL" | grep -oP '\d+$')

  gh pr merge "$EPIC_PR_NUMBER" \
    --squash \
    --delete-branch \
    --repo electronikatm/dosmentes-front 2>/dev/null || { die "Error al mergear PR épica #$EPIC_PR_NUMBER"; }

  git branch -D "$EPIC_BRANCH" 2>/dev/null || true

  log "supervisor_epic_merged" "ÉPICA $EPIC_BRANCH mergeada a $BASE_BRANCH y eliminada"

  CLOSED_EPIC_ISSUE=""
  if [ "${CLOSE_GITHUB_ISSUES:-false}" = "true" ]; then
    CLOSED_EPIC_ISSUE=$(close_epic_issue_for_branch "$EPIC_BRANCH" "$EPIC_PR_NUMBER")
  fi
  [ -n "$CLOSED_EPIC_ISSUE" ] && log "supervisor_epic_issue_closed" "Issue épica #$CLOSED_EPIC_ISSUE cerrado tras merge de $EPIC_BRANCH"

  bash "$NOTIFY" epic_done \
    "🏁 *ÉPICA CERRADA:* \`$EPIC_BRANCH\` mergeada a \`$BASE_BRANCH\`" \
    "PR #$EPIC_PR_NUMBER · $EPIC_PR_URL"

  notify_pending_contract_merge "$EPIC_BRANCH"

  # ── Determina siguiente épica ─────────────────────────────────────────────────
  NEXT_ENTRY=$(next_epic_after "$EPIC_BRANCH")

  if [ -z "$NEXT_ENTRY" ]; then
    bash "$NOTIFY" epic_done \
      "🎉 *TODAS LAS ÉPICAS COMPLETADAS* — MVP feature-complete" \
      "No hay más épicas en el backlog. Revisa EPIC-H (backend diferido) si corresponde."
    log "supervisor_all_done" "No hay más épicas"
    exit 0
  fi

  NEXT_BRANCH="${NEXT_ENTRY%%:*}"

  bash "$NOTIFY" info \
    "Iniciando *$(echo "$NEXT_BRANCH" | sed 's|epic/||')*" \
    "Buscando primera UC pendiente en el backlog de la épica..."

  if find_next_uc "$NEXT_BRANCH"; then
    render_next_uc_task_wrapped "$NEXT_BRANCH" "cierre automático de épica anterior" "$TS" "$TS_SAFE" "$STATUS_FILE" > "$NEXT_TASK"
    log "supervisor_next_epic" "Siguiente épica: $NEXT_BRANCH — UC ${NEXT_UC_CODE:-#$NEXT_ISSUE_NUMBER} escrito en next-task.md"
    bash "$NOTIFY" info \
      "Desarrollo iniciado en \`$NEXT_BRANCH\`" \
      "Primera UC en cola: *${NEXT_UC_CODE:-UC}* — ${NEXT_UC_TITLE:-$NEXT_ISSUE_TITLE}"
  else
    bash "$NOTIFY" warning \
      "No encontré UCs pendientes en el backlog para \`$NEXT_BRANCH\`" \
      "Revisa el markdown de la épica en \`docs/backlog/\` antes de continuar."
    log "supervisor_no_issues" "Sin issues uc abiertos para $NEXT_BRANCH"
  fi
fi

# ─── Fin de ciclo ─────────────────────────────────────────────────────────────

# Marca status.md como procesado para que el supervisor no lo relea
sed -i 's/^\*\*Estado:\*\* done/**Estado:** procesado/' "$STATUS_FILE" 2>/dev/null || true

log "supervisor_end" "Ciclo completado"
echo "[$TS] Supervisor finalizado OK"
