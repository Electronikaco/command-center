# Command Center Dashboard

Vista portfolio multi-proyecto: estado de salud, PRs abiertos y avance
(milestones/issues/actividad) de cada repo monitorizado, leído directo de
GitHub vía `gh`.

- **Puerto:** `3099` (solo `127.0.0.1`)
- **Refresh:** portfolio cada 60 s
- **Stack:** Vite + React + TypeScript + Express

## Rutas UI

| Ruta | Vista |
|------|-------|
| `/` | Portfolio gerencial (proyectos registrados) |

## Proyectos monitorizados

Configuración en [`projects.registry.yaml`](projects.registry.yaml). Cada
entry define `ghRepo`, la rama a trackear y el modo de progreso
(`milestones`, `issues`, `activity`) que mejor calce con cómo ese equipo
gestiona su trabajo:

- **DosMentes** — `electronikatm/dosmentes-front` (milestones)
- **Civok Back** — `Electronikaco/civok-back` (milestones)
- **Miliia Back** — `ia-saas/miliia_back` (issues)
- **Civok Agentik** — `electronikatm/civok-agentik` (actividad en `develop`)

### Agregar un proyecto nuevo

Agregar un entry en `projects.registry.yaml` con `ghRepo`, `type: github` y
el modo de `progress` que corresponda — no requiere cambios de código.

## Instalación (VPS)

```bash
cd /home/claude/dosmentes/.orchestrator/dashboard
chmod +x install-dashboard.sh
./install-dashboard.sh
```

## Acceso desde Windows (SSH tunnel)

En PowerShell:

```powershell
ssh -L 3099:localhost:3099 claude@<tu-vps>
```

Abrir en el navegador: http://localhost:3099

## Comandos útiles

```bash
# Estado del servicio
systemctl --user status command-center-dashboard

# Logs
journalctl --user -u command-center-dashboard -f

# Snapshot portfolio completo
pnpm collector:portfolio:once

# Desarrollo local (Vite :5173 + API :3099)
pnpm dev
```

## API

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/portfolio` | Snapshot agregado de todos los proyectos |
| `GET /api/projects/:id` | Detalle de un proyecto |
| `GET /api/health` | `{ ok, generatedAt }` |

## Variables de entorno

| Variable | Default |
|----------|---------|
| `PROJECTS_REGISTRY` | `./projects.registry.yaml` |
| `PORTFOLIO_POLL_SEC` | `60` |

## Publicación para gerencia (GitHub Pages)

URL pública: **https://electronikaco.github.io/command-center/**

El VPS dispara un refresh cada **30 min** (`scripts/trigger-pages-refresh.sh`)
que publica `portfolio.json` y dispara [`.github/workflows/pages.yml`](../.github/workflows/pages.yml).
Ese mismo workflow corre además cada 30 min por cron de GitHub como respaldo
(genera el snapshot en CI si no hay uno reciente del VPS).

La UI en Pages **re-consulta el JSON cada 5 min** (con cache-bust) si dejas la pestaña abierta.

### Configuración única (admin del repo)

1. Crear un **Personal Access Token** (classic) con scope `repo` y acceso a las orgs `electronikatm`, `Electronikaco`, `ia-saas`.
2. En el repo **Electronikaco/command-center** → Settings → Secrets → Actions → crear `GH_TOKEN` con ese PAT.
3. Settings → Pages → Source: **GitHub Actions** (se activa automáticamente tras el primer deploy exitoso).

### Vista en vivo vs snapshot

| Modo | URL | Actualización |
|------|-----|----------------|
| **Snapshot (gerencia)** | https://electronikaco.github.io/command-center/ | Cada 30 min vía GitHub Actions |
| **En vivo (VPS)** | túnel SSH → `localhost:3099` | Cada 60 s |

Gerencia no necesita SSH; solo abrir el enlace de GitHub Pages.
