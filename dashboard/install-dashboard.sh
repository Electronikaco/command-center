#!/usr/bin/env bash
set -euo pipefail

DASH_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="command-center-dashboard.service"
USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

echo "==> Instalando dependencias (pnpm)..."
cd "$DASH_DIR"
pnpm install

echo "==> Compilando dashboard..."
npx tsc -p tsconfig.server.json
npx vite build

echo "==> Instalando unidad systemd user..."
mkdir -p "$USER_UNIT_DIR"
cp "$DASH_DIR/systemd/$SERVICE_NAME" "$USER_UNIT_DIR/"
systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"
systemctl --user restart "$SERVICE_NAME"

echo ""
echo "Dashboard activo en http://127.0.0.1:3099"
echo "Estado: systemctl --user status $SERVICE_NAME"
echo ""
echo "Desde tu PC (PowerShell):"
echo "  ssh -L 3099:localhost:3099 claude@<tu-vps>"
echo "  Abrir http://localhost:3099"
