#!/bin/bash
# lib-issues.sh — resuelve la próxima tarea (UC) desde GitHub Issues.
# Fuente alternativa a lib-backlog.sh (activar con TASK_SOURCE="issues").
# Se sourcea desde supervisor.sh — no se ejecuta solo.
#
# Convención de labels (misma que usa el skill "generar-epics"):
#   - La issue épica lleva labels: "epic", "feature:<slug>"
#   - Cada UC hija de esa épica lleva labels: "uc", "feature:<slug>"
#   donde <slug> es la parte de EPIC_ORDER después de "epic/"
#   (ej. "epic/A-nombre-descriptivo" → label "feature:A-nombre-descriptivo").
# Así no hace falta ningún mapeo numérico de bloque: alcanza con el label.

# Busca la issue "uc" abierta de menor número para la épica dada.
# Deja el resultado en NEXT_ISSUE_NUMBER / NEXT_ISSUE_TITLE / NEXT_ISSUE_BODY.
# Retorna 1 si no hay ninguna abierta.
find_next_uc_issue() {
  local epic_branch="$1"
  local slug="${epic_branch#epic/}"
  local feature_label="feature:${slug}"

  local issue_json
  issue_json=$(gh issue list --repo "$GH_REPO" --label uc --label "$feature_label" --state open \
    --json number,title,body --limit 200 --jq 'sort_by(.number) | .[0] // empty' 2>/dev/null || echo "")

  if [ -z "$issue_json" ] || [ "$issue_json" = "null" ]; then
    return 1
  fi

  NEXT_ISSUE_NUMBER=$(echo "$issue_json" | jq -r '.number')
  NEXT_ISSUE_TITLE=$(echo "$issue_json" | jq -r '.title')
  NEXT_ISSUE_BODY=$(echo "$issue_json" | jq -r '.body')
  return 0
}

# Busca la issue "epic" abierta asociada a la rama épica dada.
find_epic_issue() {
  local epic_branch="$1"
  local slug="${epic_branch#epic/}"
  gh issue list --repo "$GH_REPO" --label epic --label "feature:${slug}" --state open \
    --json number --jq '.[0].number // empty' 2>/dev/null
}

# Cierra (best-effort) la issue "uc" cuyo título empieza con el código de UC
# de la rama mergeada (UC_CODE_REGEX de config.sh).
close_uc_issue_for_branch() {
  local branch="$1" pr_number="$2" pr_base="$3"
  local uc_code
  uc_code=$(echo "$branch" | grep -oE "$UC_CODE_REGEX" | head -1)
  [ -z "$uc_code" ] && return 0

  local issue_num
  issue_num=$(gh issue list --repo "$GH_REPO" --state open \
    --json number,title --jq ".[] | select(.title | startswith(\"$uc_code\")) | .number" 2>/dev/null | head -1)

  if [ -n "$issue_num" ]; then
    gh issue close "$issue_num" --repo "$GH_REPO" \
      --comment "Cerrada automáticamente por el orquestador — mergeada en PR #$pr_number (\`$branch\` → \`$pr_base\`)." 2>/dev/null || true
    echo "$issue_num"
  fi
}

# Cierra (best-effort) la issue "epic" asociada a la rama épica mergeada.
close_epic_issue_for_branch() {
  local epic_branch="$1" pr_number="$2"
  local issue_num
  issue_num=$(find_epic_issue "$epic_branch")
  if [ -n "$issue_num" ]; then
    gh issue close "$issue_num" --repo "$GH_REPO" \
      --comment "Épica cerrada automáticamente por el orquestador — mergeada en PR #$pr_number." 2>/dev/null || true
    echo "$issue_num"
  fi
}

# Genera el Markdown de next-task.md para el issue ya resuelto por find_next_uc_issue.
render_next_uc_task() {
  local epic_branch="$1" reason="$2" ts="$3" ts_safe="$4" status_file="$5"

  local uc_code slug branch_name desc
  uc_code=$(echo "$NEXT_ISSUE_TITLE" | grep -oE "$UC_CODE_REGEX" | head -1)
  desc=$(echo "$NEXT_ISSUE_TITLE" | sed -E 's/^[^·]*·[[:space:]]*//')
  slug=$(echo "$desc" | tr '[:upper:]' '[:lower:]' \
    | iconv -f utf8 -t ascii//TRANSLIT 2>/dev/null \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40)
  branch_name="uc/${uc_code}-${slug}"

  cat << TASKEOF
# Próxima tarea — $(echo "$epic_branch" | sed 's|epic/||')

**Emitida por:** Supervisor ($reason)
**Timestamp:** $ts
**Épica:** $epic_branch
**Issue:** #$NEXT_ISSUE_NUMBER — $NEXT_ISSUE_TITLE

## Instrucción

Implementa el issue #$NEXT_ISSUE_NUMBER en la rama \`$branch_name\`, creada desde \`$epic_branch\`.

$NEXT_ISSUE_BODY

---
**Convención obligatoria al terminar cada UC:**
- Actualiza \`$status_file\` con:
  - \`**Estado:** done\`
  - \`**Rama:** <rama-actual>\`
  - \`**Tarea:** <descripción>\`
  - \`**Bloqueos:** ninguno\` (o describe el bloqueo)
- El supervisor se encarga del commit pendiente, PR, merge, cierre del issue #$NEXT_ISSUE_NUMBER y borrado de rama.

<!-- Worker: mueve este archivo a next-task-done-${ts_safe}.md tras leer -->
TASKEOF
}
