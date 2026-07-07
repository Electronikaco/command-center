# Convención de coordinación Worker ↔ Supervisor (Cursor)

Copia el bloque de abajo en el CLAUDE.md del repo (o pásaselo al implementador como system prompt adicional).
Este documento es el **espejo humano** del flujo en `CURSOR-ORCHESTRATOR.md`: el formato de abajo debe coincidir EXACTAMENTE con el que lee `supervisor.sh` (`get_status_field`).

**Modo actual (2026-07-06):** implementación vía **Cursor chat** (`WORKER_AGENT=cursor`). Opus cron desactivado.

---

## Coordinación con supervisor externo (Cursor)

Existe un agente supervisor (Cursor + cron) que revisa tu trabajo cada 20 minutos y te da tu siguiente tarea.
El canal de comunicación es `/home/claude/dosmentes/.orchestrator/`.

### Al TERMINAR cualquier tarea:

Reemplaza TODO `/home/claude/dosmentes/.orchestrator/status.md` con este formato **exacto**.
Regla crítica de formato: cada campo es `**Campo:** valor` — los dos puntos van **DENTRO** de los asteriscos (`**Estado:**`, no `**Estado**:`). El supervisor parsea así los campos.

```
**Estado:** done
**Rama:** <nombre-exacto-de-la-rama-git-donde-trabajaste>
**Tarea:** <una línea describiendo qué implementaste>
**Resumen:** <2-3 líneas: qué archivos cambiaste, qué decisiones tomaste>
**Bloqueos:** ninguno
**Timestamp:** YYYY-MM-DD HH:MM UTC
```

- **Estado**: `done` (terminaste y listo para PR/merge) · `blocked` · `error`.
- **Rama**: exacta, tal cual la creaste (`uc/UC-DM-S7-01-repositorio-conocimiento`). El supervisor la usa para el PR/merge; si está mal, el flujo falla.
- **Bloqueos**: `ninguno`, o —si `blocked`/`error`— qué necesitas para continuar.
- Campo opcional: puedes añadir `**Tests:** N/M` como info; el supervisor no lo lee, pero ayuda a auditar.

El supervisor (no tú) se encarga de: commit pendiente, PR, merge y borrado de ramas.
Solo debes escribir código y actualizar `status.md`.

> **Gotcha de rama épica:** el supervisor NO crea la rama `epic/X-...`; la asume como base del PR. La PRIMERA tarea de cada épica debe crear y **pushear** `epic/X-...` desde `develop` antes del primer UC, o `gh pr create --base epic/X` fallará.

### Al INICIAR cualquier ciclo de trabajo:

1. Revisa si existe `/home/claude/dosmentes/.orchestrator/next-task.md`
2. Si existe y tiene contenido nuevo (distinto al último que procesaste):
   - Trátalo como tu instrucción prioritaria
   - Muévelo a `next-task-done-<timestamp>.md` ANTES de empezar (para no reprocesarlo)
3. Si no hay `next-task.md` nuevo: continúa con el trabajo que ya tenías planeado

### Reglas de convivencia:

- Nunca esperes indefinidamente por `next-task.md` — si no hay nada nuevo después de revisar, sigue trabajando
- El supervisor puede tardarse hasta 20-30 min en responder — eso es normal
- Si ves `WAIT —` en `next-task.md`, el supervisor pidió pausa; termina lo que estás haciendo y actualiza status.md
- El directorio `.orchestrator/` está fuera del repo git — no lo versiones, no lo limpies
