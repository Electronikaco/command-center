#!/bin/bash
# lib-backlog.sh — próxima UC desde docs/backlog/EPIC-*.md (no GitHub Issues).
# Fuente de verdad: markdown de épicas en el repo (mismo formato que produce
# el skill "generar-epics"). Se sourcea desde supervisor.sh — no se ejecuta solo.

# Ruta del markdown de épica para una rama epic/
epic_doc_for_branch() {
  local epic_branch="$1"
  for entry in "${EPIC_ORDER[@]}"; do
    local branch="${entry%%:*}"
    local doc="${entry#*:}"
    if [ "$branch" = "$epic_branch" ]; then
      echo "$REPO_DIR/$doc"
      return 0
    fi
  done
  return 1
}

# Lista códigos de UC (según UC_CODE_REGEX, ej. UC-01, PROJ-123) en orden de
# aparición en el doc de épica.
list_uc_codes_from_epic_doc() {
  local doc="$1"
  [ -f "$doc" ] || return 1
  grep -oE "$UC_CODE_REGEX" "$doc" | awk '!seen[$0]++'
}

# Deriva la rama épica padre de una rama uc/<UC-CODE>-slug buscando en qué
# doc de EPIC_ORDER aparece ese código de UC. Genérico: no depende de ninguna
# convención de numeración de bloque, solo de que el código de UC de la rama
# también aparezca en el doc de exactamente una épica de EPIC_ORDER.
resolve_epic_for_uc_branch() {
  local rama="$1"
  local uc_code
  uc_code=$(echo "$rama" | grep -oE "$UC_CODE_REGEX" | head -1) || return 1
  [ -z "$uc_code" ] && return 1

  local entry branch doc
  for entry in "${EPIC_ORDER[@]}"; do
    branch="${entry%%:*}"
    doc="$REPO_DIR/${entry#*:}"
    if list_uc_codes_from_epic_doc "$doc" 2>/dev/null | grep -qx "$uc_code"; then
      echo "$branch"
      return 0
    fi
  done
  return 1
}

# True si la UC ya está mergeada en la rama épica (PR merged uc/* → epic/*).
uc_merged_in_epic() {
  local epic_branch="$1" uc_code="$2"
  local count
  count=$(gh pr list --repo "$GH_REPO" \
    --base "$epic_branch" \
    --state merged \
    --json headRefName \
    --jq "[.[] | select(.headRefName | test(\"${uc_code}\"))] | length" 2>/dev/null || echo "0")
  [ "$count" -gt 0 ]
}

# Busca la primera UC del backlog de la épica que aún no está mergeada.
# Deja resultado en NEXT_UC_CODE / NEXT_UC_TITLE / NEXT_UC_BODY / NEXT_UC_SECTION.
find_next_uc_from_backlog() {
  local epic_branch="$1"
  local doc
  doc=$(epic_doc_for_branch "$epic_branch") || return 1

  local codes
  codes=$(list_uc_codes_from_epic_doc "$doc") || return 1

  local uc_code
  for uc_code in $codes; do
    if uc_merged_in_epic "$epic_branch" "$uc_code"; then
      continue
    fi
    NEXT_UC_CODE="$uc_code"
    _extract_uc_section_from_doc "$doc" "$uc_code" || return 1
    return 0
  done
  return 1
}

# Extrae título y cuerpo de la sección ## <UC-CODE> del markdown.
_extract_uc_section_from_doc() {
  local doc="$1" uc_code="$2"
  local section
  section=$(awk -v code="$uc_code" '
    $0 ~ "^## " code { found=1; print; next }
    found && /^## / { exit }
    found { print }
  ' "$doc")
  [ -n "$section" ] || return 1

  NEXT_UC_TITLE=$(echo "$section" | head -1 | sed -E 's/^## //')
  NEXT_UC_BODY="$section"
  NEXT_UC_SECTION="$section"
  return 0
}

# Genera next-task.md desde backlog (sin referencia a GitHub Issue).
render_next_uc_task_from_backlog() {
  local epic_branch="$1" reason="$2" ts="$3" ts_safe="$4" status_file="$5"

  local uc_code="$NEXT_UC_CODE"
  local desc
  desc=$(echo "$NEXT_UC_TITLE" | sed -E 's/^[^·]*·[[:space:]]*//')
  local slug
  slug=$(echo "$desc" | tr '[:upper:]' '[:lower:]' \
    | iconv -f utf8 -t ascii//TRANSLIT 2>/dev/null \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40)
  local branch_name="uc/${uc_code}-${slug}"

  cat << TASKEOF
# Próxima tarea — $(echo "$epic_branch" | sed 's|epic/||')

**Emitida por:** Supervisor ($reason)
**Timestamp:** $ts
**Épica:** $epic_branch
**UC:** $uc_code — $desc

## Instrucción

Implementa \`$uc_code\` en la rama \`$branch_name\`, creada desde \`$epic_branch\`.

$NEXT_UC_BODY

---
**Convención obligatoria al terminar cada UC:**
- Actualiza \`$status_file\` con:
  - \`**Estado:** done\`
  - \`**Rama:** <rama-actual>\`
  - \`**Tarea:** <descripción>\`
  - \`**Bloqueos:** ninguno\` (o describe el bloqueo)
- El supervisor (cron) se encarga del PR, merge y borrado de rama.
- Las GitHub Issues (si existen) se gestionan manualmente; el orquestador usa el backlog de épicas.

<!-- Worker: mueve este archivo a next-task-done-${ts_safe}.md tras leer -->
TASKEOF
}

# render_epic_close_next_task → lib-contracts.sh
