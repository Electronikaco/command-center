#!/bin/bash
# lib-contracts.sh — UC-DM-INFRA-01 al cierre de épica (repo dm-api-contracts).
# Se sourcea desde supervisor.sh y lib-backlog.sh.

# Carga metadatos del contrato para una rama épica → variables CONTRACT_*.
load_contract_spec() {
  local epic_branch="$1"
  CONTRACT_FILE=""
  CONTRACT_BRANCH=""
  CONTRACT_REFERENCE="dashboard-integration.openapi.yaml"
  CONTRACT_MODULE=""
  CONTRACT_BLOCK=""
  CONTRACT_OPS_HINT=""

  case "$epic_branch" in
    epic/A-evaluacion-forense)
      CONTRACT_FILE="case-evaluation.openapi.yaml"
      CONTRACT_BRANCH="feat/contract-case-evaluation-s3"
      CONTRACT_MODULE="evaluación forense (EPIC-A / S3)"
      CONTRACT_BLOCK="S3"
      CONTRACT_OPS_HINT="CRUD evaluación: anamnesis, fuentes, pruebas, validez, triangulación, limitaciones, conclusión — paridad con \`evaluation.handlers.ts\` + \`src/domain/case-evaluation.ts\`."
      ;;
    epic/B-metodologia-entrevista)
      CONTRACT_FILE="case-methodology-interviews.openapi.yaml"
      CONTRACT_BRANCH="feat/contract-case-methodology-interviews-s4"
      CONTRACT_MODULE="metodología y entrevistas (EPIC-B / S4)"
      CONTRACT_BLOCK="S4"
      CONTRACT_OPS_HINT="Plan metodológico, checklist antisesgo, guion, modalidad, entorno, cierre entrevista — paridad MSW entrevistas + metodología."
      ;;
    epic/C-metapericia)
      CONTRACT_FILE="case-metapericia.openapi.yaml"
      CONTRACT_BRANCH="feat/contract-case-metapericia-s5"
      CONTRACT_MODULE="metapericia (EPIC-C / S5)"
      CONTRACT_BLOCK="S5"
      CONTRACT_OPS_HINT="Pericia externa, checklists, hallazgos, matriz, preguntas audiencia, informe refutación — paridad \`case-metapericia\` handlers."
      ;;
    epic/D-transcripcion-visor)
      CONTRACT_FILE="case-transcription.openapi.yaml"
      CONTRACT_BRANCH="feat/contract-case-transcription-s6"
      CONTRACT_MODULE="transcripción y evidencia (EPIC-D / S6)"
      CONTRACT_BLOCK="S6"
      CONTRACT_OPS_HINT="Hash evidencia, importar/generar transcripción, segmentación, visor, material previo — paridad handlers transcripción/evidencia."
      ;;
    epic/E-biblioteca)
      CONTRACT_FILE="knowledge-library.openapi.yaml"
      CONTRACT_BRANCH="feat/contract-knowledge-library-s7"
      CONTRACT_MODULE="biblioteca de conocimiento (EPIC-E / S7)"
      CONTRACT_BLOCK="S7"
      CONTRACT_OPS_HINT="Assets, versionado, IP, trazabilidad, glosario — paridad \`knowledge-library\` handlers."
      ;;
    epic/F-piloto-observabilidad)
      CONTRACT_FILE="pilot-observability.openapi.yaml"
      CONTRACT_BRANCH="feat/contract-pilot-observability-s8"
      CONTRACT_REFERENCE="dashboard-integration.openapi.yaml"
      CONTRACT_MODULE="piloto y observabilidad (EPIC-F / S8)"
      CONTRACT_BLOCK="S8"
      CONTRACT_OPS_HINT="KPIs piloto (\`pilot-metrics\`), baseline manual (\`pilot-baseline\`), onboarding/feedback si aplica — paridad handlers \`pilot-*\` y \`dashboard\`."
      ;;
    epic/G-consolidados-tenant)
      CONTRACT_FILE="consolidated-tenant.openapi.yaml"
      CONTRACT_BRANCH="feat/contract-consolidated-tenant-s9"
      CONTRACT_MODULE="consolidados tenant (EPIC-G / S9)"
      CONTRACT_BLOCK="S9"
      CONTRACT_OPS_HINT="Informes tenant, custodia, revisión calidad — patrón ya en \`consolidated-tenant.openapi.yaml\`."
      ;;
    epic/I-integracion-dashboard)
      CONTRACT_FILE="dashboard-integration.openapi.yaml"
      CONTRACT_BRANCH="feat/contract-dashboard-integration-s10"
      CONTRACT_MODULE="integración dashboard (EPIC-I / S10)"
      CONTRACT_BLOCK="S10"
      CONTRACT_OPS_HINT="\`GET /dashboard/summary\`, \`GET /cases/{caseId}/module-status\` — espejo de \`dashboard.handlers.ts\` + \`case-module-status\`."
      ;;
    *)
      return 1
      ;;
  esac
  return 0
}

# Estado del PR de contrato: merged | open | missing
contract_pr_state() {
  local epic_branch="$1"
  load_contract_spec "$epic_branch" || { echo "missing"; return; }
  local repo="${CONTRACTS_GH_REPO:-electronikatm/dm-api-contracts}"
  local state
  state=$(gh pr list --repo "$repo" --head "$CONTRACT_BRANCH" --state all \
    --json state --jq '.[0].state' 2>/dev/null || echo "")
  [ -z "$state" ] && echo "missing" && return
  echo "$state" | tr '[:upper:]' '[:lower:]'
}

# True si Rama es válida para flujo git del front (nunca dm-api-contracts).
is_valid_front_branch() {
  local rama="$1"
  # Rechaza ramas de contratos o anotaciones de otro repo
  if echo "$rama" | grep -qiE 'dm-api-contracts|feat/contract-|repo dm-api'; then
    return 1
  fi
  echo "$rama" | grep -qE '^(uc/|epic/|fix/|hotfix/|docs/)' && return 0
  is_coordination_branch "$rama" 2>/dev/null && return 0
  return 1
}

# Bloque reutilizable: formato status.md dual-repo (front + contrato en Resumen).
render_status_dual_repo_block() {
  local front_branch="$1" task_desc="$2" estado="${3:-epic_done}"
  cat << EOF
## Al terminar — status.md (formato exacto)

\`\`\`
**Estado:** $estado
**Rama:** $front_branch
**Tarea:** $task_desc
**Resumen:** <cambios front si aplica>. Contrato dm-api-contracts en rama $CONTRACT_BRANCH — PR #<N> <URL>. Merge manual del contrato contra $CONTRACTS_BASE_BRANCH.
**Bloqueos:** ninguno
**Timestamp:** <ISO UTC>
\`\`\`

**Importante:** \`**Rama:**\` debe ser **solo** la rama de \`dosmentes-front\` (el supervisor cron no entiende ramas de \`dm-api-contracts\`). Documenta el PR del contrato en \`**Resumen:**\`.

**Notas para el supervisor cron:**

- Rama front (\`$front_branch\`) → flujo automático según tipo (\`uc/\`, \`epic/\`, \`fix/\` → \`$BASE_BRANCH\`).
- El contrato en \`dm-api-contracts\` **no** pasa por uc→epic; merge **manual** del PR contra \`$CONTRACTS_BASE_BRANCH\`.
- **No** crear ramas \`uc/UC-DM-INFRA-01-*\` ni \`epic/H-*\` en dosmentes-front.
EOF
}

# Part C — instrucción UC-DM-INFRA-01 para dm-api-contracts.
render_contract_part() {
  local epic_branch="$1"
  load_contract_spec "$epic_branch" || return 1
  local pr_state
  pr_state=$(contract_pr_state "$epic_branch")

  cat << EOF
## Part C — UC-DM-INFRA-01 contrato OpenAPI (\`dm-api-contracts\`)

**Repo:** \`$CONTRACTS_DIR\`
**Base:** \`$CONTRACTS_BASE_BRANCH\`
**Rama:** \`$CONTRACT_BRANCH\`
**Archivo:** \`$CONTRACT_FILE\`
**Patrón de referencia:** \`$CONTRACT_REFERENCE\` (u otro contrato ya mergeado en \`main\`).

**Módulo:** $CONTRACT_MODULE

$CONTRACT_OPS_HINT

**Criterios:**
- Esquemas espejados de Zod/dominio front; \`tenantId\` / \`x-tenant-id\` + Bearer.
- Validar: \`pnpm exec openapi-typescript $CONTRACT_FILE -o /tmp/contract-check.d.ts\` sin error.
- PR contra \`$CONTRACTS_BASE_BRANCH\` en \`${CONTRACTS_GH_REPO:-electronikatm/dm-api-contracts}\`.

**Git (si el contrato aún no está en main):**

\`\`\`bash
cd $CONTRACTS_DIR
git checkout $CONTRACTS_BASE_BRANCH && git pull origin $CONTRACTS_BASE_BRANCH
git checkout -b $CONTRACT_BRANCH 2>/dev/null || git checkout $CONTRACT_BRANCH
# crear/actualizar $CONTRACT_FILE
git add $CONTRACT_FILE
git commit -m "feat(contracts): OpenAPI $CONTRACT_MODULE"
git push -u origin $CONTRACT_BRANCH
gh pr create --base $CONTRACTS_BASE_BRANCH --title "feat(contracts): $CONTRACT_MODULE" \\
  --body "UC-DM-INFRA-01 al cierre de \`$epic_branch\`."
\`\`\`
EOF

  if [ "$pr_state" = "merged" ]; then
    echo ""
    echo "**Estado actual del PR:** ya **mergeado** a \`$CONTRACTS_BASE_BRANCH\` — verifica paridad con el front; no abras PR duplicado."
  elif [ "$pr_state" = "open" ]; then
    echo ""
    echo "**Estado actual del PR:** **abierto** en \`$CONTRACT_BRANCH\` — actualiza si falta cobertura; no dupliques rama."
  fi
}

# next-task.md completo: auditoría + contrato + epic_done.
render_epic_close_next_task() {
  local epic_branch="$1" ts="$2" ts_safe="$3" status_file="$4"
  local epic_slug
  epic_slug=$(echo "$epic_branch" | sed 's|epic/||')
  local audit_file="docs/casos/_audit/EPIC-$(echo "$epic_slug" | tr '[:lower:]' '[:upper:]' | sed 's/-/_/g')-CIERRE.md"

  load_contract_spec "$epic_branch" || true

  cat << TASKEOF
# Cierre de épica — $epic_slug (+ contrato OpenAPI)

**Emitida por:** Supervisor ($ts)
**Timestamp:** $ts
**Épica:** $epic_branch
**UC contrato:** UC-DM-INFRA-01 (recurrente al cierre)

## Instrucción

Todas las UCs del backlog de \`$epic_branch\` están mergeadas en la rama épica.

### Part A — Auditoría de cierre (dosmentes-front)

1. Redacta o actualiza \`$audit_file\` con veredicto **APTO** / **APTO CON REMEDIACIÓN** / **NO APTO**.
2. Si hay remediación obligatoria en \`develop\`, créala en rama \`fix/epic-<letra>-...\` **antes** de marcar \`epic_done\` (el supervisor mergeará el fix a \`$BASE_BRANCH\`).

### Part B — Verificación local

\`\`\`bash
cd $REPO_DIR
pnpm exec tsc --noEmit && pnpm test --run && pnpm build
\`\`\`

TASKEOF

  if [ "${AUTO_EPIC_CLOSE_INCLUDES_CONTRACT:-true}" = "true" ] && load_contract_spec "$epic_branch"; then
    render_contract_part "$epic_branch"
    echo ""
  fi

  render_status_dual_repo_block "$epic_branch" "Épica $epic_slug completa — auditoría + contrato OpenAPI $CONTRACT_FILE" "epic_done"

  cat << TASKEOF

3. Tras Part A–C, actualiza \`$status_file\` con el formato de arriba (\`Estado: epic_done\`, \`Rama: $epic_branch\` salvo que uses rama \`fix/\` para remediación).

El supervisor cron mergeará \`$epic_branch\` → \`$BASE_BRANCH\` y encolará la siguiente épica.

<!-- Opus: mueve este archivo a next-task-done-${ts_safe}.md tras leer -->
TASKEOF
}

# Notifica Slack tras merge de épica si el contrato sigue pendiente de merge manual.
notify_pending_contract_merge() {
  local epic_branch="$1"
  load_contract_spec "$epic_branch" || return 0
  local pr_state pr_url pr_num
  pr_state=$(contract_pr_state "$epic_branch")
  pr_num=$(gh pr list --repo "${CONTRACTS_GH_REPO}" --head "$CONTRACT_BRANCH" --state open \
    --json number --jq '.[0].number' 2>/dev/null || echo "")
  pr_url="https://github.com/${CONTRACTS_GH_REPO}/pull/${pr_num}"

  case "$pr_state" in
    merged)
      log "supervisor_contract_ok" "Contrato $CONTRACT_FILE ya en $CONTRACTS_BASE_BRANCH"
      ;;
    open)
      bash "$NOTIFY" info \
        "Contrato \`$CONTRACT_FILE\` pendiente merge manual" \
        "Épica \`$epic_branch\` cerrada en front. PR #$pr_num → \`$CONTRACTS_BASE_BRANCH\`: $pr_url"
      log "supervisor_contract_pending" "PR contrato #$pr_num abierto — merge manual requerido"
      ;;
    *)
      bash "$NOTIFY" warning \
        "Contrato \`$CONTRACT_FILE\` sin PR" \
        "Épica \`$epic_branch\` cerrada pero falta UC-DM-INFRA-01 en \`dm-api-contracts\`."
      log "supervisor_contract_missing" "Sin PR de contrato para $epic_branch"
      ;;
  esac
}

# Extrae PR de contrato del Resumen en status.md (best-effort).
log_contract_from_resumen() {
  local resumen="$1"
  if echo "$resumen" | grep -qiE 'dm-api-contracts|feat/contract-'; then
    local pr_ref
    pr_ref=$(echo "$resumen" | grep -oE 'PR #[0-9]+[^ ]*' | head -1 || echo "contrato documentado")
    log "supervisor_contract_noted" "Contrato en Resumen: $pr_ref (merge manual en $CONTRACTS_BASE_BRANCH)"
  fi
}
