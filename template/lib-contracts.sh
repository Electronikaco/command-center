#!/bin/bash
# lib-contracts.sh — cierre de épica: auditoría + verificación + (opcional)
# repo secundario de specs/contratos con merge manual.
# Se sourcea desde supervisor.sh y lib-backlog.sh/lib-issues.sh — no se ejecuta solo.
#
# Por defecto (sin repo secundario configurado) esta lib solo aporta:
#   - is_valid_front_branch: guardarraíl de ramas válidas para el flujo git
#   - render_epic_close_next_task: Part A (auditoría) + Part B (verificación)
# Si en config.sh definís SECONDARY_REPO_* (ver config.sh.example), se activa
# además la Part C: instrucción para generar/actualizar specs en ese repo.
# Este es el mismo patrón que usa DosMentes con dm-api-contracts — mirá el
# README de esta plantilla, sección "Repo secundario", para el caso completo.

# Carga metadatos del "contrato" (spec) para una rama épica → variables CONTRACT_*.
# Plantilla genérica: no hay mapeo por defecto. Si tu equipo usa un repo
# secundario, agregá acá un `case "$epic_branch" in ... esac` como el de
# DosMentes (ver .orchestrator/lib-contracts.sh en el repo dosmentes-front
# para un ejemplo completo ya en producción).
load_contract_spec() {
  local epic_branch="$1"
  [ -z "${SECONDARY_REPO_DIR:-}" ] && return 1

  CONTRACT_FILE=""
  CONTRACT_BRANCH=""
  CONTRACT_MODULE=""
  CONTRACT_OPS_HINT=""

  case "$epic_branch" in
    # epic/A-nombre-descriptivo)
    #   CONTRACT_FILE="modulo-a.spec.yaml"
    #   CONTRACT_BRANCH="feat/contract-modulo-a"
    #   CONTRACT_MODULE="módulo A"
    #   CONTRACT_OPS_HINT="Describe qué debe cubrir el spec de este módulo."
    #   ;;
    *)
      return 1
      ;;
  esac
  return 0
}

# Estado del PR de spec en el repo secundario: merged | open | missing
contract_pr_state() {
  local epic_branch="$1"
  load_contract_spec "$epic_branch" || { echo "missing"; return; }
  local repo="${SECONDARY_REPO_GH:-}"
  [ -z "$repo" ] && { echo "missing"; return; }
  local state
  state=$(gh pr list --repo "$repo" --head "$CONTRACT_BRANCH" --state all \
    --json state --jq '.[0].state' 2>/dev/null || echo "")
  [ -z "$state" ] && echo "missing" && return
  echo "$state" | tr '[:upper:]' '[:lower:]'
}

# True si la rama es válida para el flujo git del repo principal (nunca una
# rama del repo secundario, si hay uno configurado).
is_valid_front_branch() {
  local rama="$1"
  if [ -n "${SECONDARY_REPO_BRANCH_MARKER:-}" ] && echo "$rama" | grep -qF "$SECONDARY_REPO_BRANCH_MARKER"; then
    return 1
  fi
  echo "$rama" | grep -qE '^(uc/|epic/|fix/|hotfix/|docs/)' && return 0
  is_coordination_branch "$rama" 2>/dev/null && return 0
  return 1
}

# Bloque reutilizable: formato status.md cuando hay repo secundario involucrado.
render_status_dual_repo_block() {
  local front_branch="$1" task_desc="$2" estado="${3:-epic_done}"
  cat << EOF
## Al terminar — status.md (formato exacto)

\`\`\`
**Estado:** $estado
**Rama:** $front_branch
**Tarea:** $task_desc
**Resumen:** <cambios en $REPO_DIR si aplica>. Spec en rama $CONTRACT_BRANCH del repo secundario — PR #<N> <URL>. Merge manual contra ${SECONDARY_REPO_BASE_BRANCH:-main}.
**Bloqueos:** ninguno
**Timestamp:** <ISO UTC>
\`\`\`

**Importante:** \`**Rama:**\` debe ser **solo** una rama de este repo (el supervisor cron no entiende ramas del repo secundario). Documenta el PR del repo secundario en \`**Resumen:**\`.
EOF
}

# Part C — instrucción para actualizar el spec en el repo secundario.
render_contract_part() {
  local epic_branch="$1"
  load_contract_spec "$epic_branch" || return 1
  local pr_state
  pr_state=$(contract_pr_state "$epic_branch")

  cat << EOF
## Part C — spec en repo secundario (\`${SECONDARY_REPO_GH:-}\`)

**Repo:** \`$SECONDARY_REPO_DIR\`
**Base:** \`${SECONDARY_REPO_BASE_BRANCH:-main}\`
**Rama:** \`$CONTRACT_BRANCH\`
**Archivo:** \`$CONTRACT_FILE\`

**Módulo:** $CONTRACT_MODULE

$CONTRACT_OPS_HINT

**Git (si el spec aún no está mergeado):**

\`\`\`bash
cd $SECONDARY_REPO_DIR
git checkout ${SECONDARY_REPO_BASE_BRANCH:-main} && git pull origin ${SECONDARY_REPO_BASE_BRANCH:-main}
git checkout -b $CONTRACT_BRANCH 2>/dev/null || git checkout $CONTRACT_BRANCH
# crear/actualizar $CONTRACT_FILE
git add $CONTRACT_FILE
git commit -m "feat(spec): $CONTRACT_MODULE"
git push -u origin $CONTRACT_BRANCH
gh pr create --base ${SECONDARY_REPO_BASE_BRANCH:-main} --title "feat(spec): $CONTRACT_MODULE" \\
  --body "Spec al cierre de \`$epic_branch\`."
\`\`\`
EOF

  if [ "$pr_state" = "merged" ]; then
    echo ""
    echo "**Estado actual del PR:** ya **mergeado** — verifica paridad con el repo principal; no abras PR duplicado."
  elif [ "$pr_state" = "open" ]; then
    echo ""
    echo "**Estado actual del PR:** **abierto** en \`$CONTRACT_BRANCH\` — actualiza si falta cobertura; no dupliques rama."
  fi
}

# next-task.md completo de cierre de épica: auditoría + verificación + (si
# aplica) spec en repo secundario + epic_done.
render_epic_close_next_task() {
  local epic_branch="$1" ts="$2" ts_safe="$3" status_file="$4"
  local epic_slug
  epic_slug=$(echo "$epic_branch" | sed 's|epic/||')
  local audit_file="${AUDIT_DIR:-docs/audits}/EPIC-$(echo "$epic_slug" | tr '[:lower:]' '[:upper:]' | sed 's/-/_/g')-CIERRE.md"

  load_contract_spec "$epic_branch" || true

  cat << TASKEOF
# Cierre de épica — $epic_slug

**Emitida por:** Supervisor ($ts)
**Timestamp:** $ts
**Épica:** $epic_branch

## Instrucción

Todas las UCs del backlog de \`$epic_branch\` están mergeadas en la rama épica.

### Part A — Auditoría de cierre

1. Redacta o actualiza \`$audit_file\` con veredicto **APTO** / **APTO CON REMEDIACIÓN** / **NO APTO**.
2. Si hay remediación obligatoria en \`$BASE_BRANCH\`, créala en rama \`fix/epic-<letra>-...\` **antes** de marcar \`epic_done\` (el supervisor mergeará el fix a \`$BASE_BRANCH\`).

### Part B — Verificación local

\`\`\`bash
cd $REPO_DIR
$VERIFY_CMD
\`\`\`

TASKEOF

  if [ "${AUTO_EPIC_CLOSE_INCLUDES_CONTRACT:-false}" = "true" ] && load_contract_spec "$epic_branch"; then
    render_contract_part "$epic_branch"
    echo ""
    render_status_dual_repo_block "$epic_branch" "Épica $epic_slug completa — auditoría + spec $CONTRACT_FILE" "epic_done"
  else
    cat << EOF
## Al terminar — status.md (formato exacto)

\`\`\`
**Estado:** epic_done
**Rama:** $epic_branch
**Tarea:** Épica $epic_slug completa — auditoría + verificación
**Resumen:** <archivos/decisiones relevantes de la auditoría>
**Bloqueos:** ninguno
**Timestamp:** <ISO UTC>
\`\`\`
EOF
  fi

  cat << TASKEOF

El supervisor cron mergeará \`$epic_branch\` → \`$BASE_BRANCH\` y encolará la siguiente épica.

<!-- Worker: mueve este archivo a next-task-done-${ts_safe}.md tras leer -->
TASKEOF
}

# Notifica Slack tras merge de épica si el spec del repo secundario sigue
# pendiente de merge manual. No-op si no hay repo secundario configurado.
notify_pending_contract_merge() {
  local epic_branch="$1"
  load_contract_spec "$epic_branch" || return 0
  local pr_state pr_num pr_url
  pr_state=$(contract_pr_state "$epic_branch")
  pr_num=$(gh pr list --repo "${SECONDARY_REPO_GH}" --head "$CONTRACT_BRANCH" --state open \
    --json number --jq '.[0].number' 2>/dev/null || echo "")
  pr_url="https://github.com/${SECONDARY_REPO_GH}/pull/${pr_num}"

  case "$pr_state" in
    merged)
      log "supervisor_contract_ok" "Spec $CONTRACT_FILE ya en ${SECONDARY_REPO_BASE_BRANCH:-main}"
      ;;
    open)
      bash "$NOTIFY" info \
        "Spec \`$CONTRACT_FILE\` pendiente merge manual" \
        "Épica \`$epic_branch\` cerrada. PR #$pr_num → \`${SECONDARY_REPO_BASE_BRANCH:-main}\`: $pr_url"
      log "supervisor_contract_pending" "PR spec #$pr_num abierto — merge manual requerido"
      ;;
    *)
      bash "$NOTIFY" warning \
        "Spec \`$CONTRACT_FILE\` sin PR" \
        "Épica \`$epic_branch\` cerrada pero falta el spec en el repo secundario."
      log "supervisor_contract_missing" "Sin PR de spec para $epic_branch"
      ;;
  esac
}

# Extrae referencia a PR del repo secundario desde el Resumen en status.md
# (best-effort, solo para log).
log_contract_from_resumen() {
  local resumen="$1"
  [ -z "${SECONDARY_REPO_BRANCH_MARKER:-}" ] && return 0
  if echo "$resumen" | grep -qF "$SECONDARY_REPO_BRANCH_MARKER"; then
    local pr_ref
    pr_ref=$(echo "$resumen" | grep -oE 'PR #[0-9]+[^ ]*' | head -1 || echo "spec documentado")
    log "supervisor_contract_noted" "Spec en Resumen: $pr_ref (merge manual en ${SECONDARY_REPO_BASE_BRANCH:-main})"
  fi
}
