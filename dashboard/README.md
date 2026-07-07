# DosMentes Orchestrator Dashboard

Panel de monitoreo del orquestador (Cursor supervisor + Claude Opus worker).

- **Puerto:** `3099` (solo `127.0.0.1`)
- **Refresh:** cada 30 s (servidor + UI)
- **Stack:** Vite + React + TypeScript + Express

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

# Recolectar snapshot manual (escribe status-api.json)
pnpm collector:once

# Desarrollo local (Vite :5173 + API :3099)
pnpm dev
```

## API

| Endpoint        | Descripción              |
|-----------------|--------------------------|
| `GET /api/status` | Snapshot completo JSON |
| `GET /api/health` | `{ ok, generatedAt }`  |

El collector escribe además `../status-api.json` en `.orchestrator/`.
