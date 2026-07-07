# DosMentes Orchestrator Dashboard

Panel de monitoreo del orquestador (Cursor supervisor + Claude Opus worker) y **vista portfolio** multi-proyecto GitHub.

- **Puerto:** `3099` (solo `127.0.0.1`)
- **Refresh:** portfolio 60 s · DosMentes detalle 30 s
- **Stack:** Vite + React + TypeScript + Express

## Rutas UI

| Ruta | Vista |
|------|-------|
| `/` | Portfolio gerencial (4 proyectos) |
| `/project/dosmentes` | Command Center detallado DosMentes |

## Proyectos monitorizados

Configuración en [`projects.registry.yaml`](projects.registry.yaml):

- **DosMentes** — orquestador local + `electronikatm/dosmentes-front`
- **Civok Back** — `Electronikaco/civok-back` (milestones)
- **Miliia Back** — `ia-saas/miliia_back` (actividad commits)
- **Civok Agentik** — `electronikatm/civok-agentik` (actividad en `develop`)

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
systemctl --user status dosmentes-orchestrator-dashboard

# Logs
journalctl --user -u dosmentes-orchestrator-dashboard -f

# Snapshot DosMentes (escribe status-api.json)
pnpm collector:once

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
| `GET /api/status` | Snapshot completo orquestador DosMentes |
| `GET /api/health` | `{ ok, generatedAt, statusAt }` |

## Variables de entorno

| Variable | Default |
|----------|---------|
| `PROJECTS_REGISTRY` | `./projects.registry.yaml` |
| `PORTFOLIO_POLL_SEC` | `60` |
| `POLL_SEC` | `30` |
| `ORCH_DIR` | `/home/claude/dosmentes/.orchestrator` |

El collector DosMentes escribe además `../status-api.json` en `.orchestrator/`.

## Publicación para jefes (GitHub Pages)

URL pública: **https://electronikaco.github.io/command-center/**

El workflow [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) regenera el snapshot **cada 15 min** (cron GitHub) y el VPS dispara un refresh de respaldo **cada 30 min**.

La UI en Pages **re-consulta el JSON cada 5 min** (con cache-bust) si dejas la pestaña abierta.

### Configuración única (admin del repo)

1. Crear un **Personal Access Token** (classic) con scope `repo` y acceso a las orgs `electronikatm`, `Electronikaco`, `ia-saas`.
2. En el repo **Electronikaco/command-center** → Settings → Secrets → Actions → crear `GH_TOKEN` con ese PAT.
3. Settings → Pages → Source: **GitHub Actions** (se activa automáticamente tras el primer deploy exitoso).

### Vista en vivo vs snapshot

| Modo | URL | Actualización |
|------|-----|----------------|
| **Snapshot (jefes)** | https://electronikaco.github.io/command-center/ | Cada 30 min vía GitHub Actions |
| **DosMentes detalle (Pages)** | https://electronikaco.github.io/command-center/#/project/dosmentes | Snapshot estático |
| **En vivo (VPS)** | túnel SSH → `localhost:3099` | Cada 30–60 s |

Los jefes no necesitan SSH; solo abrir el enlace de GitHub Pages.
