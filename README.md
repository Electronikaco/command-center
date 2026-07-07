# Command Center — Orquestador DosMentes

Orquestador de desarrollo asistido por IA (Cursor supervisor + Claude Opus worker) y dashboard de monitoreo en tiempo casi real.

## Este repo tiene dos partes

- **La raíz** (`supervisor.sh`, `opus-worker.sh`, `lib-*.sh`, `dashboard/`...)
  es la **instancia real de DosMentes**, corriendo en producción ahora mismo.
  Sirve como referencia funcionando, pero está atada a ese proyecto
  específico (rutas, convención `UC-DM-Sx`, repo `dosmentes-front`).
- **[`template/`](template/README.md)** es la versión **genérica**, lista
  para que cualquier compañero del equipo la copie a su propio proyecto y
  levante el mismo pipeline con su propio repo. Incluye además el skill
  `generar-epics` para redactar el backlog inicial. **Si vas a montar esto en
  un proyecto que no es DosMentes, empezá por ahí, no por la raíz.**

## Contenido

| Componente | Descripción |
|------------|-------------|
| `supervisor.sh` | Flujo Git: PR, merge, encolado de tareas |
| `opus-worker.sh` | Worker que implementa `next-task.md` |
| `dashboard/` | Command Center UI + API (puerto 3099) |
| `config.sh.example` | Plantilla de configuración (copiar a `config.sh`) |

## Instalación en VPS

```bash
cp config.sh.example config.sh
# Editar config.sh con rutas, GH_REPO y SLACK_WEBHOOK

./install-cron.sh
cd dashboard && ./install-dashboard.sh
```

## Dashboard

Ver [dashboard/README.md](dashboard/README.md).

## Documentación

- [CURSOR-ORCHESTRATOR.md](CURSOR-ORCHESTRATOR.md)
- [DECISION-GATES.md](DECISION-GATES.md)
- [CONTRACTS-WORKFLOW.md](CONTRACTS-WORKFLOW.md)

## Nota

Los archivos de estado runtime (`status.md`, `log.jsonl`, etc.) no se versionan — permanecen solo en el VPS de despliegue.

## GitHub Pages (vista para jefes)

- **URL:** https://electronikaco.github.io/command-center/
- **Workflow:** `.github/workflows/pages.yml`
- **Secret requerido:** `GH_TOKEN` (PAT con acceso `repo` a todas las organizaciones monitorizadas)

Ver [dashboard/README.md](dashboard/README.md) para detalles de configuración.
