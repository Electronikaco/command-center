#!/bin/bash
# close-stale-issues.sh — cierra issues de GitHub ya completados según PRs mergeados.
# El orquestador no cierra issues automáticamente (CLOSE_GITHUB_ISSUES=false).
#
# Uso:
#   ./close-stale-issues.sh           # dry-run
#   ./close-stale-issues.sh --apply   # cierra issues

set -euo pipefail

ORCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ORCH_DIR/config.sh"

APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

GH_REPO="${GH_REPO:-electronikatm/dosmentes-front}"

log() { echo "[close-stale] $*"; }

# Issues épica mergeadas a develop (head epic/* en PRs merged → develop)
merged_epics=$(gh pr list --repo "$GH_REPO" --base "$BASE_BRANCH" --state merged \
  --json headRefName --jq '.[].headRefName' 2>/dev/null | grep '^epic/' || true)

# Mapeo épica → issue (conocido del backlog)
declare -A EPIC_ISSUE=(
  [epic/A-evaluacion-forense]=12
  [epic/B-metodologia-entrevista]=13
  [epic/C-metapericia]=14
  [epic/D-transcripcion-visor]=15
  [epic/E-biblioteca]=16
  [epic/F-piloto-observabilidad]=17
  [epic/G-consolidados-tenant]=18
  [epic/I-integracion-dashboard]=103
)

# Issues UC por épica (cuando la épica mergea a develop, cierran todos)
declare -A EPIC_UC_ISSUES=(
  [epic/A-evaluacion-forense]="27 28 29 30 31 32"
  [epic/B-metodologia-entrevista]="38"
  [epic/G-consolidados-tenant]="59"
  [epic/I-integracion-dashboard]="104 105 106 107 108"
)

# UCs con PR mergeado (cualquier base) — extrae código del head
merged_uc_heads=$(gh pr list --repo "$GH_REPO" --state merged \
  --json headRefName --jq '.[].headRefName' 2>/dev/null || true)

uc_codes_done=()
while IFS= read -r head; do
  [ -z "$head" ] && continue
  if [[ "$head" =~ (UC-DM-S[0-9]+-[0-9]+|UC-DM-INFRA-[0-9]+) ]]; then
    uc_codes_done+=("${BASH_REMATCH[1]}")
  fi
done <<< "$merged_uc_heads"

# Mapeo UC → issue (issues existentes en GitHub)
declare -A UC_ISSUE=(
  [UC-DM-S3-02]=27 [UC-DM-S3-03]=28 [UC-DM-S3-04]=29 [UC-DM-S3-05]=30
  [UC-DM-S3-06]=31 [UC-DM-S3-07]=32 [UC-DM-S4-06]=38
  [UC-DM-S8-01]=52 [UC-DM-S9-03]=59
  [UC-DM-S10-01]=104 [UC-DM-S10-02]=105 [UC-DM-S10-03]=106
  [UC-DM-S10-04]=107 [UC-DM-S10-05]=108
)

close_issue() {
  local num="$1" reason="$2"
  local state
  state=$(gh issue view "$num" --repo "$GH_REPO" --json state --jq .state 2>/dev/null || echo "MISSING")
  [ "$state" != "OPEN" ] && return 0
  if [ "$APPLY" = true ]; then
    gh issue close "$num" --repo "$GH_REPO" --comment "$reason" 2>/dev/null \
      && log "Cerrado #$num" || log "Error cerrando #$num"
  else
    log "DRY-RUN cerraría #$num — $reason"
  fi
}

log "Modo: $([ "$APPLY" = true ] && echo APPLY || echo DRY-RUN)"
log "Épicas mergeadas a $BASE_BRANCH: $(echo "$merged_epics" | tr '\n' ' ')"

# Cerrar épicas mergeadas (excepto F si aún activa)
while IFS= read -r epic; do
  [ -z "$epic" ] && continue
  [ "$epic" = "epic/F-piloto-observabilidad" ] && continue
  num="${EPIC_ISSUE[$epic]:-}"
  [ -n "$num" ] && close_issue "$num" "Épica mergeada a \`$BASE_BRANCH\` (PR evidencia en gh). Cierre automático post-auditoría."
  for uc_num in ${EPIC_UC_ISSUES[$epic]:-}; do
    close_issue "$uc_num" "UC de \`$epic\` incluida en merge a \`$BASE_BRANCH\`. Cierre automático post-auditoría."
  done
done <<< "$merged_epics"

# Cerrar UCs con PR mergeado
for uc in "${uc_codes_done[@]}"; do
  num="${UC_ISSUE[$uc]:-}"
  [ -n "$num" ] && close_issue "$num" "UC \`$uc\` con PR mergeado. Cierre automático post-auditoría."
done

log "Listo. Issues que deben permanecer OPEN: #17 (épica F), #53–56 (S8-02…05), #19 #60 (INFRA)."
