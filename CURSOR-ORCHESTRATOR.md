# Cursor Orchestrator — DosMentes

**Traspaso activo desde 2026-07-06.** El Cloud agent ya no orquesta. **Cursor** supervisa épicas y delega implementación; el cron `supervisor.sh` solo automatiza el flujo Git (PR → merge → rama).

## Roles

| Rol | Quién | Responsabilidad |
|-----|-------|-----------------|
| **Supervisor estratégico** | Cursor (chat) | Lee `status.md`, backlog, contratos; escribe `next-task.md`; no implementa código |
| **Implementador** | Claude Opus (cron `opus-worker.sh` */5) | Código, tests, actualiza `status.md` |
| **Flujo Git automático** | `supervisor.sh` (cron */10) | PR, merge, Slack |

## Qué SÍ orquesta Cursor (épicas)

- Progresión por orden canónico (frontend, `EPIC_ORDER` en `config.sh`): A → B → C → D → E → F → J → G → I
- UCs dentro de cada épica según `docs/backlog/EPIC-*.md` (fuente: `TASK_SOURCE=backlog`)
- Contratos OpenAPI en `dm-api-contracts` al cierre de cada épica (PR abierto, merge manual)
- Auditorías en `docs/casos/_audit/UC-DM-*.md`

> **Bandera activa (2026-07-07):** `PROGRAM_PHASE="phase2"` en `config.sh`.
> Esto marca inicio de consolidación pre-backend y habilita EPIC-J como siguiente
> épica objetivo tras cerrar EPIC-F.

> **EPIC-H NO está en `EPIC_ORDER`.** Su único UC vigente, `UC-DM-INFRA-01`, no
> es una épica secuencial del front: se ejecuta manualmente (Cursor/Opus) cada
> vez que otra épica cierra, y su entregable vive **solo** en `dm-api-contracts`
> — rama `feat/contract-<módulo>-sX` directo contra `main`, igual que A/B/C/D/E.
> Nunca crear `epic/H-backend-contratos-seguridad` ni `uc/UC-DM-INFRA-01-*` en
> `dosmentes-front`. (Incidente 2026-07-06: se crearon por error, generaron un
> PR fantasma #113 en CONFLICTING; se cerró y las ramas se borraron.)

## Qué NO orquesta (issues GitHub)

- **No** busca tareas en GitHub Issues (`lib-issues.sh` en modo legacy)
- **No** cierra issues automáticamente (`CLOSE_GITHUB_ISSUES=false`)
- Issues se gestionan manualmente en GitHub; el backlog markdown es la fuente de verdad

## Archivos de coordinación

```
/home/claude/dosmentes/.orchestrator/
├── status.md          ← implementador escribe al terminar (Estado: done | blocked | error)
├── next-task.md       ← supervisor escribe la siguiente UC
├── next-task-done-*   ← archivado tras leer
├── config.sh          ← SUPERVISOR_AGENT, WORKER_AGENT, TASK_SOURCE
├── supervisor.sh      ← cron: flujo Git
├── lib-backlog.sh     ← próxima UC desde EPIC-*.md
├── lib-auto-queue.sh  ← auto-encolado (watchdog, procesado, coordinación)
├── lib-contracts.sh   ← UC-DM-INFRA-01, dm-api-contracts al cierre de épica
├── CONTRACTS-WORKFLOW.md ← flujo dual-repo front + contratos
├── DECISION-GATES.md  ← qué requiere humano vs automático
└── log.jsonl          ← auditoría de eventos
```

## Ciclo de trabajo (automatizado, dual-repo)

```
1. Supervisor escribe next-task.md (UC, cierre épica + contrato, o hotfix)
2. Opus implementa en dosmentes-front (+ dm-api-contracts si INFRA-01)
3. status.md: Rama SOLO front; PR contrato en Resumen
4. Supervisor: PR/merge front; aviso merge manual contrato
5. [Tú] Merge PR contrato → dm-api-contracts/main
```

Ver `CONTRACTS-WORKFLOW.md` y `DECISION-GATES.md`.

## Formato status.md (obligatorio)

**UC normal:**
```
**Estado:** done
**Rama:** uc/UC-DM-S9-03-panel-revision-calidad-tenant
**Tarea:** UC-DM-S9-03 — Panel de revisión de calidad del tenant
**Resumen:** ...
**Bloqueos:** ninguno
**Timestamp:** YYYY-MM-DDTHH:MM:SSZ
```

**Cierre épica + contrato (dual-repo):**
```
**Estado:** epic_done
**Rama:** epic/I-integracion-dashboard
**Tarea:** Épica I cierre — auditoría + contrato OpenAPI dashboard-integration
**Resumen:** Auditoría APTO. Contrato dm-api-contracts en rama feat/contract-dashboard-integration-s10 — PR #8 https://github.com/.../pull/8. Merge manual contra main.
**Bloqueos:** ninguno
**Timestamp:** YYYY-MM-DDTHH:MM:SSZ
```

**Hotfix post-merge:**
```
**Estado:** done
**Rama:** fix/epic-i-s10-05-merge-artifacts
**Tarea:** EPIC-I cierre — hotfix merge S10-05 + contrato
**Resumen:** Hotfix front: dashboard.mock.ts, handlers. tsc/tests OK. Contrato … PR #8 …
```

## Repos

| Repo | Path | Rama base |
|------|------|-----------|
| Frontend | `/home/claude/dosmentes/dosmentes-front` | `develop` |
| Contratos | `/home/claude/dosmentes/dm-api-contracts` | `main` |

Flujo ramas: `uc/UC-DM-SX-XX-*` → `epic/X-nombre` → `develop`

## Estado actual (2026-07-07)

- **Fase activa:** `phase2` (consolidación pre-backend)
- **Transición objetivo:** tras cierre operativo de EPIC-F, iniciar `epic/J-consolidacion-pre-backend`
- **Épicas cerradas previas relevantes:** `epic/G-consolidados-tenant`, `epic/I-integracion-dashboard`
- **Automatización:** `AUTO_EPIC_CLOSE_TASK` + `AUTO_RESUME_ON_PROCESADO` activos (ver DECISION-GATES.md)
- **Modo EPIC-F:** MSW + localStorage (EPIC-H diferido)

## Comandos útiles

```bash
/home/claude/dosmentes/.orchestrator/status-check.sh
/home/claude/dosmentes/.orchestrator/install-cron.sh   # reinstalar cron supervisor
```

## Slack

Webhook en `config.sh`. Log de entregas en `notifications.log` (HTTP code por envío).

### Eventos que recibirás (épicas y progreso)

| Momento | Tipo Slack | Mensaje típico |
|---------|------------|----------------|
| UC mergeada dentro de épica | `done` ✅ | `UC mergeado: uc/... → epic/...` |
| Siguiente UC en la misma épica | `info` ℹ️ | `Siguiente UC de epic/X en cola` |
| Todas las UCs de una épica listas | `epic_ready` 📋 | `Épica epic/X lista para cerrar` |
| Épica mergeada a develop | `epic_done` 🏁 | `ÉPICA CERRADA: epic/X mergeada a develop` |
| Inicio de la siguiente épica | `info` ℹ️ | `Iniciando *nombre-épica*` |
| Primera UC de la nueva épica | `info` ℹ️ | `Desarrollo iniciado en epic/X` + código UC |
| MVP completo | `epic_done` 🎉 | `TODAS LAS ÉPICAS COMPLETADAS` |
| Bloqueo / error | `blocked` / `error` | Detalle del bloqueo |
| Cursor inicia tarea (manual) | `info` ℹ️ | vía `notify-delegation.sh` |

### Flujo de notificaciones al cerrar épica G → iniciar I

```
S9-03 mergeada → ✅ UC mergeado
sin más UCs    → 📋 Épica G lista para cerrar
Cursor marca epic_done → 🏁 ÉPICA CERRADA (PR epic→develop)
               → (manual/Cursor, fuera de EPIC_ORDER) UC-DM-INFRA-01: PR de
                 contrato en dm-api-contracts (feat/contract-consolidados-s9 → main)
               → ℹ️ Iniciando *I-integracion-dashboard*
               → ℹ️ Desarrollo iniciado — primera UC en cola
```

**Nota:** Con `WORKER_AGENT=cursor`, ya no llega el aviso legacy `Opus inicia nueva tarea`. El supervisor cron cubre merges y transiciones de épica; Cursor puede llamar `notify-delegation.sh` al empezar cada UC.
