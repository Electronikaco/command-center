# Flujo dual-repo — dosmentes-front + dm-api-contracts

El backend futuro consume contratos OpenAPI generados **al cierre de cada épica frontend** (UC-DM-INFRA-01). El orquestador coordina ambos repos con reglas distintas por repo.

## Repos

| Repo | Path | Rama base | Flujo Git automático |
|------|------|-----------|----------------------|
| Frontend | `dosmentes-front` | `develop` | ✅ Supervisor cron (PR → merge) |
| Contratos | `dm-api-contracts` | `main` | ❌ Merge **manual** del PR |

Config: `CONTRACTS_DIR`, `CONTRACTS_GH_REPO`, `CONTRACTS_BASE_BRANCH` en `config.sh`.

## Ciclo al cerrar una épica

```
Última UC mergeada en epic/X
        ↓
Supervisor escribe next-task (Part A auditoría + Part B tests + Part C contrato)
        ↓
Opus:
  · Auditoría en docs/casos/_audit/EPIC-*-CIERRE.md
  · OpenAPI en dm-api-contracts (rama feat/contract-<módulo>-sX)
  · status.md → Estado: epic_done, Rama: epic/X (SOLO front)
  · Resumen: documenta PR #N del contrato
        ↓
Supervisor cron:
  · Merge epic/X → develop (automático)
  · Slack: recordatorio merge manual del contrato si PR abierto
  · Encola primera UC de la siguiente épica
        ↓
[Tú] Merge manual PR contrato → dm-api-contracts/main
```

## Caso especial: hotfix post-merge (EPIC-I)

Si el squash `epic → develop` dejó artefactos de conflicto:

1. Épica ya en `develop` → tarea con rama `fix/epic-i-s10-05-merge-artifacts`
2. `status.md`: `Estado: done`, `Rama: fix/...` (solo front)
3. Part C contrato en la misma tarea si aún no existía
4. Supervisor mergea `fix/*` → `develop` automáticamente

Plantilla de referencia: `next-task-done-20260706_225501.md`

## Formato status.md (obligatorio)

```
**Estado:** done | epic_done
**Rama:** <solo dosmentes-front>
**Tarea:** ...
**Resumen:** ... Contrato dm-api-contracts en rama feat/contract-* — PR #N <URL>. Merge manual contra main.
**Bloqueos:** ninguno
**Timestamp:** YYYY-MM-DDTHH:MM:SSZ
```

### Prohibido en `**Rama:**`

- `feat/contract-*` (vive en dm-api-contracts)
- `uc/UC-DM-INFRA-01-*` en dosmentes-front
- `epic/H-backend-contratos-seguridad`
- Anotaciones tipo `(repo dm-api-contracts — ...)`

Si Opus pone una rama inválida, el supervisor **bloquea** el git-flow y notifica error.

## Mapeo épica → contrato

Definido en `lib-contracts.sh` (`load_contract_spec`):

| Épica | Archivo OpenAPI | Rama contrato |
|-------|-----------------|---------------|
| A | `case-evaluation.openapi.yaml` | `feat/contract-case-evaluation-s3` |
| B | `case-methodology-interviews.openapi.yaml` | `feat/contract-case-methodology-interviews-s4` |
| C | `case-metapericia.openapi.yaml` | `feat/contract-case-metapericia-s5` |
| D | `case-transcription.openapi.yaml` | `feat/contract-case-transcription-s6` |
| E | `knowledge-library.openapi.yaml` | `feat/contract-knowledge-library-s7` |
| F | `pilot-observability.openapi.yaml` | `feat/contract-pilot-observability-s8` |
| G | `consolidated-tenant.openapi.yaml` | `feat/contract-consolidated-tenant-s9` |
| I | `dashboard-integration.openapi.yaml` | `feat/contract-dashboard-integration-s10` |

## Flags

```bash
AUTO_EPIC_CLOSE_INCLUDES_CONTRACT="true"  # Part C en tarea de cierre
```

## Archivos del orquestador

- `lib-contracts.sh` — specs, plantillas, validación de rama, notificaciones
- `opus-worker.sh` — prompt dual-repo para Opus
- `supervisor.sh` — valida Rama, logea contrato del Resumen, avisa post-merge

## Decisiones humanas

- Merge manual de cada PR en `dm-api-contracts` (revisión de paridad MSW ↔ OpenAPI)
- Cerrar issue #60 (INFRA-01) al mergear contrato
- EPIC-H backend (INFRA-02…07) — fuera de este flujo hasta go explícito
