# Decision Gates — Orquestador DosMentes

Qué hace el pipeline **solo** y qué requiere **tu decisión**.

## Automático (sin intervención)

| Evento | Quién | Acción |
|--------|-------|--------|
| Opus termina UC | Supervisor cron | PR `uc/*` → `epic/*`, merge, borra rama |
| Última UC de épica | Supervisor | Escribe `next-task` de cierre (`epic_done`) |
| Opus marca `epic_done` | Supervisor | PR `epic/*` → `develop`, borra épica |
| Cierre de épica | Supervisor | Encola primera UC de la siguiente épica en `EPIC_ORDER` |
| `procesado` / `idle` sin cola | Supervisor | `auto_queue_next_work` — reanuda pipeline |
| `done` en `develop`/`main` | Supervisor | Sin PR; marca `procesado` y encola siguiente trabajo |
| Commit pendiente | Supervisor | Pide commit a Opus vía `next-task` |
| Bloqueo / error | Supervisor | Notifica Slack + instrucción correctiva |
| Tests en UC | Opus | Obligatorio antes de `Estado: done` |

## Requiere decisión humana

| Tema | Cuándo | Por qué |
|------|--------|---------|
| **EPIC-H / backend real** | Antes de conectar KPIs a API productiva | Arquitectura, seguridad, despliegue |
| **Pausar épica** | Cambio de prioridad | Añadir rama a `EPIC_PAUSED` en `config.sh` |
| **Cambiar orden de épicas** | Replanificación MVP | Editar `EPIC_ORDER` |
| **Merge conflicts en PR** | Supervisor falla merge | Resolución manual + re-run |
| **Contrato OpenAPI (UC-DM-INFRA-01)** | Al cierre de cada épica | Opus genera PR en `dm-api-contracts`; **tú** mergeas a `main` (ver `CONTRACTS-WORKFLOW.md`) |
| **Auditoría stakeholder** | Hitos de release / piloto | Veredicto APTO fuera del cron |
| **Higiene GitHub Issues** | Tras auditoría de progreso | ~20 issues obsoletos; usar `scripts/close-stale-issues.sh` |
| **Violación de rol / código erróneo** | Implementación fuera de Opus | Aceptar rama, revertir o rehacer |
| **Nueva UC no en backlog** | Scope nuevo | Actualizar `docs/backlog/EPIC-*.md` primero |

## Flags en `config.sh`

```bash
AUTO_EPIC_CLOSE_TASK="true"       # false → espera que Cursor marque epic_done
AUTO_EPIC_CLOSE_INCLUDES_CONTRACT="true"  # Part C contrato en cierre de épica
AUTO_RESUME_ON_PROCESADO="true"   # false → pipeline se detiene en procesado
EPIC_PAUSED=( )                   # épicas que el watchdog no debe iniciar
```

## Flujo objetivo (mínima fricción)

```
Opus implementa UC → status: done
       ↓
Supervisor: PR + merge → next UC (o cierre épica)
       ↓
Opus: epic_done (si épica completa)
       ↓
Supervisor: epic → develop → siguiente épica
       ↓
[Tú] Contrato dm-api-contracts + EPIC-H cuando corresponda
```

## Roles (recordatorio)

- **Cursor (chat):** orquestar, decisiones, `DECISION_GATES` — no implementar código de producto.
- **Opus (cron):** implementar UCs y actualizar `status.md`.
- **Supervisor (cron):** solo Git y cola automática.
