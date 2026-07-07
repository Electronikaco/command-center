#!/bin/bash
# lib-issues.sh — resuelve la próxima tarea (UC) desde GitHub Issues.
# Fuente de verdad: issues abiertas con label "uc"/"epic" en $GH_REPO.
# Se sourcea desde supervisor.sh — no se ejecuta solo.

GH_REPO="electronikatm/dosmentes-front"

# Bloque S (o INFRA) asociado a una rama epic/
snum_for_epic() {
  case "$1" in
    epic/A*) echo "3" ;;
    epic/B*) echo "4" ;;
    epic/C*) echo "5" ;;
    epic/D*) echo "6" ;;
    epic/E*) echo "7" ;;
    epic/F*) echo "8" ;;
    epic/G*) echo "9" ;;
    epic/I*) echo "10" ;;
    epic/H*) echo "INFRA" ;;
    *) echo "" ;;
  esac
}

# Busca el issue "uc" abierto de número de UC más bajo para la épica dada.
# Deja el resultado en NEXT_ISSUE_NUMBER / NEXT_ISSUE_TITLE / NEXT_ISSUE_BODY.
# Retorna 1 si no hay ninguno abierto (o si la rama no mapea a ningún bloque S).
find_next_uc_issue() {
  local epic_branch="$1"
  local snum; snum=$(snum_for_epic "$epic_branch")
  [ -z "$snum" ] && return 1

  local prefix="UC-DM-S${snum}-"
  [ "$snum" = "INFRA" ] && prefix="UC-DM-INFRA-"

  local jq_filter
  jq_filter='[.[] | select(.title | startswith("'"$prefix"'"))] | sort_by(.title | capture("-(?<u>[0-9]+) ").u | tonumber) | .[0] // empty'

  local issue_json
  issue_json=$(gh issue list --repo "$GH_REPO" --label uc --state open \
    --json number,title,body --limit 200 --jq "$jq_filter" 2>/dev/null || echo "")

  if [ -z "$issue_json" ] || [ "$issue_json" = "null" ]; then
    return 1
  fi

  NEXT_ISSUE_NUMBER=$(echo "$issue_json" | jq -r '.number')
  NEXT_ISSUE_TITLE=$(echo "$issue_json" | jq -r '.title')
  NEXT_ISSUE_BODY=$(echo "$issue_json" | jq -r '.body')
  return 0
}

# Busca el issue "epic" abierto cuyo título referencia el bloque S de la rama dada.
find_epic_issue() {
  local epic_branch="$1"
  local snum; snum=$(snum_for_epic "$epic_branch")
  [ -z "$snum" ] && return 1
  gh issue list --repo "$GH_REPO" --label epic --state open \
    --json number,title --jq ".[] | select(.title | test(\"UC-DM-S${snum}\")) | .number" 2>/dev/null | head -1
}

# Cierra (best-effort) el issue "uc" cuyo título empieza con el código UC de la rama mergeada.
close_uc_issue_for_branch() {
  local branch="$1" pr_number="$2" pr_base="$3"
  local uc_code
  uc_code=$(echo "$branch" | grep -oP 'UC-DM-[A-Z0-9]+-[0-9]+' | head -1)
  [ -z "$uc_code" ] && return 0

  local issue_num
  issue_num=$(gh issue list --repo "$GH_REPO" --state open \
    --json number,title --jq ".[] | select(.title | startswith(\"$uc_code\")) | .number" 2>/dev/null | head -1)

  if [ -n "$issue_num" ]; then
    gh issue close "$issue_num" --repo "$GH_REPO" \
      --comment "Cerrado automáticamente por el orquestador — mergeado en PR #$pr_number (\`$branch\` → \`$pr_base\`)." 2>/dev/null || true
    echo "$issue_num"
  fi
}

# Cierra (best-effort) el issue "epic" asociado a la rama épica mergeada.
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
  uc_code=$(echo "$NEXT_ISSUE_TITLE" | grep -oP 'UC-DM-[A-Z0-9]+-[0-9]+' | head -1)
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

<!-- Opus: mueve este archivo a next-task-done-${ts_safe}.md tras leer -->
TASKEOF
}
