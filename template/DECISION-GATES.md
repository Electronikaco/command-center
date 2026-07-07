# Decision Gates — Orquestador

Qué hace el pipeline **solo** y qué requiere **tu decisión**. Completá/ajustá
las filas marcadas `<proyecto>` con las particularidades del tuyo — el resto
es el comportamiento real de `supervisor.sh`/`worker.sh` tal como están en
esta plantilla.

## Automático (sin intervención)

| Evento | Quién | Acción |
|--------|-------|--------|
| Worker termina UC | Supervisor cron | PR `uc/*` → `epic/*`, merge, borra rama |
| Última UC de épica | Supervisor | Escribe `next-task` de cierre (`epic_done`) |
| Worker marca `epic_done` | Supervisor | PR `epic/*` → `BASE_BRANCH`, borra épica |
| Cierre de épica | Supervisor | Encola primera UC de la siguiente épica en `EPIC_ORDER` |
| `procesado` / `idle` sin cola | Supervisor | `auto_queue_next_work` — reanuda pipeline |
| `done` en rama de coordinación | Supervisor | Sin PR; marca `procesado` y encola siguiente trabajo |
| Commit pendiente | Supervisor | Pide commit al worker vía `next-task`, o lo commitea él mismo |
| Bloqueo / error | Supervisor | Notifica Slack + instrucción correctiva |
| Verificación (`VERIFY_CMD`) en cierre de épica | Worker | Obligatorio antes de `Estado: epic_done` |

## Requiere decisión humana

| Tema | Cuándo | Por qué |
|------|--------|---------|
| **Pausar épica** | Cambio de prioridad | Añadir rama a `EPIC_PAUSED` en `config.sh` |
| **Cambiar orden de épicas** | Replanificación | Editar `EPIC_ORDER` |
| **Merge conflicts en PR** | Supervisor falla merge | Resolución manual + re-run |
| **Spec/contrato en repo secundario** *(si aplica)* | Al cierre de cada épica | El worker genera PR en el repo secundario; **vos** mergeás manualmente (ver `lib-contracts.sh`) |
| **Auditoría stakeholder** | Hitos de release/piloto | Veredicto fuera del cron |
| **Higiene de issues obsoletos** | Tras auditorías de progreso | Limpieza manual (ver patrón en DosMentes: `scripts/close-stale-issues.sh`) |
| **Violación de rol / código erróneo** | Implementación fuera de lo esperado | Aceptar rama, revertir o rehacer |
| **Nueva UC no en backlog** | Scope nuevo | Actualizar `docs/backlog/EPIC-*.md` primero (o generarlo con el skill `generar-epics`) |
| `<proyecto>` — arranque de rama en cero | Primera UC de cada épica | El worker debe crear y pushear `epic/X-...` desde `BASE_BRANCH` antes de empezar — el supervisor nunca la crea |

## Flags en `config.sh`

```bash
AUTO_EPIC_CLOSE_TASK="true"                # false → espera que un humano marque epic_done
AUTO_EPIC_CLOSE_INCLUDES_CONTRACT="false"  # true solo si usás repo secundario
AUTO_RESUME_ON_PROCESADO="true"            # false → pipeline se detiene en procesado
EPIC_PAUSED=( )                            # épicas que el watchdog no debe iniciar
```

## Flujo objetivo (mínima fricción)

```
Worker implementa UC → status: done
       ↓
Supervisor: PR + merge → next UC (o cierre épica)
       ↓
Worker: epic_done (si épica completa)
       ↓
Supervisor: epic → BASE_BRANCH → siguiente épica
       ↓
[Vos] Repo secundario (si aplica) + cualquier gate humano pendiente
```

## Roles (recordatorio)

- **Humano / chat de planificación:** decide progresión, resuelve los
  "Decision Gates" de arriba — no implementa código de producto directamente.
- **Worker (cron o chat delegado):** implementa UCs y actualiza `status.md`.
- **Supervisor (cron):** solo Git y cola automática — nunca escribe código de
  producto.
