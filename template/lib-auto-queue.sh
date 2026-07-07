#!/bin/bash
# lib-auto-queue.sh — encola siguiente UC o cierre de épica sin intervención manual.
# Se sourcea desde supervisor.sh.

# Deriva rama épica desde uc/* o epic/*. Reusa resolve_epic_for_uc_branch de
# lib-backlog.sh (búsqueda genérica por código de UC, sin mapeo numérico).
resolve_epic_from_rama() {
  local rama="$1"

  if echo "$rama" | grep -q "^epic/"; then
    echo "$rama"
    return 0
  fi

  if echo "$rama" | grep -q "^uc/"; then
    resolve_epic_for_uc_branch "$rama" && return 0
  fi

  return 1
}

# True si la rama es solo coordinación (sin PR de producto).
is_coordination_branch() {
  local rama="$1"
  for b in "${COORDINATION_BRANCHES[@]:-main}"; do
    [ "$rama" = "$b" ] && return 0
  done
  return 1
}

# Encola próxima UC, cierre de épica, o no hace nada.
# Retorna 0 si escribió next-task.md, 1 si no había trabajo.
auto_queue_next_work() {
  local rama="${1:-}"
  local reason="${2:-auto-resume}"

  local watchdog_epic=""
  local epic_complete=""

  if epic=$(resolve_epic_from_rama "$rama" 2>/dev/null); then
    watchdog_epic="$epic"
    if ! find_next_uc "$watchdog_epic"; then
      epic_complete="$watchdog_epic"
      watchdog_epic=""
    fi
  fi

  if [ -z "$watchdog_epic" ] && [ -z "$epic_complete" ]; then
    for entry in "${EPIC_ORDER[@]}"; do
      local candidate="${entry%%:*}"
      epic_is_paused "$candidate" && continue
      if find_next_uc "$candidate"; then
        watchdog_epic="$candidate"
        break
      fi
    done
  fi

  if [ -n "$watchdog_epic" ]; then
    render_next_uc_task_wrapped "$watchdog_epic" "$reason" "$TS" "$TS_SAFE" "$STATUS_FILE" > "$NEXT_TASK"
    log "supervisor_auto_queued" "Encolada UC ${NEXT_UC_CODE:-?} en $watchdog_epic ($reason)"
    bash "$NOTIFY" info \
      "Pipeline auto-encolado" \
      "Siguiente: *${NEXT_UC_CODE:-UC}* en \`$watchdog_epic\` ($reason)."
    return 0
  fi

  if [ -n "$epic_complete" ]; then
    if [ "${AUTO_EPIC_CLOSE_TASK:-true}" = "true" ]; then
      render_epic_close_next_task "$epic_complete" "$TS" "$TS_SAFE" "$STATUS_FILE" > "$NEXT_TASK"
      log "supervisor_auto_epic_close" "Cierre épica $epic_complete encolado ($reason)"
      bash "$NOTIFY" epic_ready \
        "Épica \`$epic_complete\` lista para cerrar" \
        "Todas las UCs mergeadas. Tarea de cierre escrita en next-task.md (automático)."
      return 0
    fi
    bash "$NOTIFY" epic_ready \
      "Épica \`$epic_complete\` lista para cerrar" \
      "Todas las UCs mergeadas. Marca \`Estado: epic_done\` en status.md o activa AUTO_EPIC_CLOSE_TASK."
    log "supervisor_epic_waiting" "Épica $epic_complete completa — esperando epic_done manual"
    return 1
  fi

  log "supervisor_auto_idle" "Sin UCs pendientes ni épica para cerrar ($reason)"
  return 1
}
