#!/usr/bin/env bash
# Secuencia correctiva supervisor 2026-07-07T05:50:01Z — UC-DM-S8-04 feedback in-app
# Crea la rama desde la base correcta (origin/epic/F-piloto-observabilidad),
# commitea el working tree de S8-04, verifica y solo pushea si todo pasa.
set -euo pipefail
REPO=/home/claude/dosmentes/dosmentes-front
BR=uc/UC-DM-S8-04-feedback-in-app
BASE=origin/epic/F-piloto-observabilidad
cd "$REPO"

echo "== 1) fetch =="
git fetch origin

echo "== 2) checkout -b $BR desde $BASE =="
if git checkout -b "$BR" "$BASE"; then
  echo "checkout directo OK"
else
  echo "checkout directo falló por cambios locales -> stash fallback"
  git stash push -u -m "s8-04-wip"
  git checkout -b "$BR" "$BASE"
  git stash pop
fi

echo "== HEAD tras checkout =="
git rev-parse --abbrev-ref HEAD
git log --oneline -1

echo "== 3) add =="
git add -A

echo "== 4) commit =="
git commit -m "feat: UC-DM-S8-04 feedback in-app contextual"

echo "== 5) verificación (pre-push) =="
pnpm exec tsc --noEmit
pnpm exec vitest run src/mocks/handlers/feedback.handlers.test.ts
pnpm lint
pnpm build

echo "== 6) push (solo si verificación pasó) =="
git push -u origin "$BR"
echo "== DONE =="
