# Convención de coordinación Worker ↔ Supervisor

Copia el bloque de abajo en el `<RULES_FILE>` del repo (AGENTS.md/CLAUDE.md,
lo que hayas puesto en `RULES_FILE` en config.sh), o pásaselo como system
prompt adicional a quien implemente (worker.sh ya lo inyecta automáticamente
si `WORKER_AGENT=opus`; si el worker sos vos en una sesión interactiva de
chat, copialo a mano).

**Regla crítica de formato:** el bloque de abajo debe coincidir EXACTAMENTE
con lo que parsea `get_status_field` en `supervisor.sh`. Cada campo es
`**Campo:** valor` — los dos puntos van **DENTRO** de los asteriscos
(`**Estado:**`, no `**Estado**:`). Un desvío de formato hace que el
supervisor no lea el campo y el pipeline se estanca en silencio.

---

## Coordinación con el supervisor (cron)

Existe un agente supervisor (cron) que revisa tu trabajo cada
`CRON_SUPERVISOR_SCHEDULE` (por defecto cada 10 min) y te da tu siguiente
tarea. El canal de comunicación es la carpeta del orquestador (`ORCH_DIR`).

### Al TERMINAR cualquier tarea:

Reemplaza TODO `status.md` con este formato **exacto**:

```
**Estado:** done
**Rama:** <nombre-exacto-de-la-rama-git-donde-trabajaste>
**Tarea:** <una línea describiendo qué implementaste>
**Resumen:** <2-3 líneas: qué archivos cambiaste, qué decisiones tomaste>
**Bloqueos:** ninguno
**Timestamp:** YYYY-MM-DD HH:MM UTC
```

- **Estado**: `done` (terminaste y listo para PR/merge) · `epic_done` (cerraste
  la épica completa: todas sus UCs ya mergeadas + tu auditoría de cierre) ·
  `blocked` · `error`.
- **Rama**: exacta, tal cual la creaste (`uc/<codigo>-slug`). El supervisor la
  usa para el PR/merge; si está mal, el flujo falla.
- **Bloqueos**: `ninguno`, o —si `blocked`/`error`— qué necesitas para continuar.
- Campo opcional: podés añadir `**Tests:** N/M` como info; el supervisor no lo
  lee, pero ayuda a auditar a mano.

El supervisor (no vos) se encarga de: commit pendiente, PR, merge y borrado de
ramas. Solo debes escribir código y actualizar `status.md`.

> **Gotcha de rama épica:** el supervisor NO crea la rama `epic/X-...`; la
> asume como base del PR. La PRIMERA tarea de cada épica debe crear y
> **pushear** `epic/X-...` desde `BASE_BRANCH` antes del primer UC, o
> `gh pr create --base epic/X` fallará en bucle.

### Al INICIAR cualquier ciclo de trabajo:

1. Revisa si existe `next-task.md` en la carpeta del orquestador.
2. Si existe y tiene contenido nuevo (distinto al último que procesaste):
   - Trátalo como tu instrucción prioritaria.
   - Muévelo a `next-task-done-<timestamp>.md` ANTES de empezar (para no
     reprocesarlo si te interrumpen a mitad de camino).
3. Si no hay `next-task.md` nuevo: continúa con el trabajo que ya tenías
   planeado, o esperá la siguiente pasada del supervisor.

### Reglas de convivencia:

- Nunca esperes indefinidamente por `next-task.md` — si no hay nada nuevo
  después de revisar, seguí trabajando o avisá.
- El supervisor puede tardar hasta el intervalo configurado (default 10 min)
  en reaccionar — es normal.
- Si ves `WAIT —` en `next-task.md`, el supervisor pidió pausa; terminá lo que
  estás haciendo y actualizá `status.md`.
- La carpeta del orquestador está **fuera del repo git** — no la versiones,
  no la limpies (contiene el historial de log.jsonl y next-task-done-*.md que
  sirve para auditar el pipeline).
