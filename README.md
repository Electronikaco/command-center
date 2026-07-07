# Command Center — Orquestador DosMentes

Orquestador de desarrollo asistido por IA (Cursor supervisor + Claude Opus worker) y dashboard de monitoreo en tiempo casi real.

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
