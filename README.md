# Command Center — Dashboard de portfolio multi-repo

Dashboard de estatus para gerencia: lee issues, milestones, PRs y actividad
de commits directamente desde GitHub (vía `gh`) para cada proyecto
registrado, sin depender de reportes manuales del equipo de desarrollo.

## Contenido

| Componente | Descripción |
|------------|-------------|
| `dashboard/` | Command Center UI + API (puerto 3099) |
| `scripts/trigger-pages-refresh.sh` | Cron VPS que publica el snapshot cada 30 min |

Ver [dashboard/README.md](dashboard/README.md) para instalación, proyectos
monitoreados y cómo agregar uno nuevo.

## GitHub Pages (vista para gerencia)

- **URL:** https://electronikaco.github.io/command-center/
- **Workflow:** `.github/workflows/pages.yml`
- **Secret requerido:** `GH_TOKEN` (PAT con acceso `repo` a todas las organizaciones monitorizadas)

Ver [dashboard/README.md](dashboard/README.md) para detalles de configuración.
