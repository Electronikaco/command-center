# Orquestador + Supervisor — plantilla portable

Esta carpeta vive dentro de `command-center` (el mismo repo que ya usa
DosMentes en producción — mirá la raíz del repo para ver esa instancia real
funcionando). Es una generalización de ese orquestador para que cualquier
compañero del equipo pueda clonar `command-center`, copiar esta carpeta y
levantar el **mismo patrón de desarrollo continuo supervisado por agentes**
en su propio proyecto, con su propio repo.

Si no conocés el original: es un sistema de 3 roles que se coordinan
**solo por archivos de texto** (nada de colas, bases de datos ni servicios
extra), pensado para que un agente LLM implemente casos de uso sin baby-sitting
constante, mientras Git (PR, merge, siguiente tarea) lo maneja un script
determinístico, no el LLM.

## 1. Arquitectura (los 3 roles)

| Rol | Qué hace | Cuándo corre |
|---|---|---|
| **Vos / chat de planificación** | Decide progresión de épicas, resuelve bloqueos, toma las decisiones de `DECISION-GATES.md` | Cuando querés — no es un cron |
| **`worker.sh`** | Lee `next-task.md`, invoca un CLI headless (`claude --print`, configurable) para que implemente, el modelo escribe código y actualiza `status.md` | cron, cada `CRON_WORKER_SCHEDULE` (default 5 min) |
| **`supervisor.sh`** | Lee `status.md`, y **solo** hace Git: crea PR, mergea, borra rama, encola la siguiente UC/épica, notifica Slack | cron, cada `CRON_SUPERVISOR_SCHEDULE` (default 10 min) |

Los tres se comunican exclusivamente a través de archivos en la carpeta del
orquestador (`status.md`, `next-task.md`, `log.jsonl`, un lock). **El
supervisor nunca escribe código de producto** y **el worker nunca toca Git**
más allá de commitear si hace falta — esa separación es la que hace que el
pipeline sea auditable: cualquier corte se ve en `log.jsonl` y en los
`next-task-done-*.md`/`worker-output-*.log` acumulados.

La fuente de verdad de qué hay que construir es **el backlog en markdown**
(`docs/backlog/EPIC-*.md` en tu repo — el mismo formato que produce el skill
`generar-epics`), no GitHub Issues. Podés usar Issues como fuente alternativa
(`TASK_SOURCE="issues"`), ver sección 6.

## 2. Prerrequisitos

En la máquina donde corre el cron:

- `git`, `gh` (GitHub CLI, autenticado: `gh auth status`) con acceso al repo.
- `claude` (Claude Code CLI) instalado y autenticado, o cualquier otro CLI
  headless que soporte un modo `--print` — configurable vía `WORKER_CLI`.
- `python3`, `curl`, `jq` (usados por los scripts para JSON/notificaciones).
- Opcional: un CLI headless adicional (`CURSOR` en config.sh) que el
  supervisor use solo para redactar instrucciones correctivas cuando el
  worker queda bloqueado. Si no lo tenés, usa un mensaje genérico y listo.
- Opcional: un webhook de Slack. Sin él, las notificaciones solo quedan en
  `notifications.log`.
- `cron` disponible y con permiso de editar tu propio crontab (`crontab -e`).

## 3. Puesta en marcha

```bash
# 0) Clonate command-center (una sola vez; podés borrar el clon después de
#    copiar lo que necesitás, no hace falta mantenerlo)
git clone https://github.com/Electronikaco/command-center.git

# 1) Copiá ESTA carpeta (template/) AL LADO de tu repo (no adentro) — igual
#    que en DosMentes, donde .orchestrator/ es hermana de dosmentes-front/,
#    no una subcarpeta. Así el cron nunca versiona su propio estado ni
#    interfiere con el .git del repo que edita.
cp -r command-center/template /ruta/a/tu/proyecto/.orchestrator
cd /ruta/a/tu/proyecto/.orchestrator

# 2) Configurá
cp config.sh.example config.sh
chmod +x config.sh
$EDITOR config.sh   # ver sección 5 — como mínimo: PROJECT_NAME, REPO_DIR,
                     # GH_REPO, EPIC_ORDER, BASE_BRANCH, VERIFY_CMD

# 3) Arrancá el status.md inicial
cp status.md.example status.md

# 4) Copiá la convención al repo (ver sección 4)

# 5) Instalá el skill "generar-epics" en tu proyecto y usalo para redactar
#    tu backlog inicial en docs/backlog/EPIC-*.md (o armalo a mano con el
#    mismo formato issue-ready)
cp -r generar-epics /ruta/a/tu/proyecto/.claude/skills/generar-epics

# 6) Instalá los crons
chmod +x *.sh
./install-cron.sh

# 7) Verificá
./status-check.sh
```

A partir de acá, en el primer ciclo el supervisor va a ver `status.md` en
`Estado: idle` (ni done ni blocked), entra al watchdog, busca la primera UC
pendiente en `EPIC_ORDER` y escribe `next-task.md` solo — no hace falta que
armes la primera tarea a mano.

## 4. Convención obligatoria en tu repo

Copiá el contenido de `WORKER-CONVENTION.md` dentro del archivo que pusiste
en `RULES_FILE` (por defecto `AGENTS.md`) de tu repo. `worker.sh` ya inyecta
esa convención automáticamente en cada prompt si `WORKER_AGENT=opus`, pero
igual tiene que estar documentada en el repo para que cualquiera (humano o
agente) que trabaje ahí sepa las reglas de convivencia con el cron.

Revisá también `DECISION-GATES.md` — es la tabla de "qué es automático vs.
qué requiere que decidas vos". Ajustala a tu proyecto antes de arrancar.

## 5. Variables de configuración — las que de verdad tenés que tocar

`config.sh.example` ya trae un comentario por variable. Las que **no** son
opcionales:

- `PROJECT_NAME`, `STACK_DESCRIPTION`, `RULES_FILE` — identidad + qué lee el
  worker antes de implementar.
- `REPO_DIR`, `GH_REPO`, `BASE_BRANCH` — tu repo.
- `EPIC_ORDER` — el orden de épicas, cada una apuntando a su doc en
  `docs/backlog/`. **Esto es lo primero que vas a llenar** — un elemento por
  épica, en el orden en que querés que se ejecuten.
- `UC_CODE_REGEX` — cómo se ve el código de un caso de uso en tus nombres de
  rama (`UC-01`, `PROJ-123`, `UC-DM-S3-01`...). El default
  `[A-Z][A-Z0-9]*-[0-9]+(-[0-9]+)?` cubre la mayoría de las convenciones
  típicas; ajustalo si la tuya es distinta.
- `VERIFY_CMD` — el comando de verificación (typecheck/test/build) que corre
  el worker antes de cerrar una épica.

El resto (`TASK_SOURCE`, `CLOSE_GITHUB_ISSUES`, flags `AUTO_*`,
`COORDINATION_BRANCHES`, horarios de cron) tiene defaults razonables — leelos
una vez, pero no hace falta tocarlos para arrancar.

## 6. Fuente de tareas: backlog (default) vs. GitHub Issues

- **`TASK_SOURCE="backlog"`** (recomendado): lee directo
  `docs/backlog/EPIC-*.md`. Es el mismo formato issue-ready que genera el
  skill `generar-epics` — si ya lo usaste para redactar tu backlog, no hace
  falta ningún paso extra, `lib-backlog.sh` lo lee tal cual.
- **`TASK_SOURCE="issues"`**: lee GitHub Issues. Convención de labels (la
  misma que recomienda `generar-epics`): la issue épica lleva `epic` +
  `feature:<slug>`, cada UC hija lleva `uc` + `feature:<slug>`, donde
  `<slug>` es la parte de `EPIC_ORDER` después de `epic/` (ej.
  `epic/A-mi-modulo` → label `feature:A-mi-modulo`). Con eso alcanza — no
  hace falta ningún mapeo numérico de bloque.

## 7. ¿Quién es el "worker"? — dos modos

- **`WORKER_AGENT="opus"`** (o cualquier valor que no sea el string que
  desactiva): se instala el cron de `worker.sh`, que invoca
  `$WORKER_CLI --print` sin supervisión humana en cada ciclo. Es el modo
  "piloto automático" completo.
- **`WORKER_AGENT="cursor"`** (o cualquier otro valor): `worker.sh` no se
  instala en el cron. Vos (u otro humano/chat) tomás `next-task.md` a mano,
  implementás, y al terminar corrés `notify-delegation.sh "<UC>" "<epica>"`
  para dejar el mismo rastro en Slack/logs que dejaría el cron automático.
  El **supervisor sigue corriendo igual** en ambos modos — el único que
  cambia es quién escribe código.

Empezar en modo `cursor` (manual) y pasar a `opus` (automático) cuando
confiés en tu `EPIC_ORDER`/backlog es razonable — así no arriesgás ramas
fantasma mientras estás ajustando la configuración.

## 8. Cursor como agente auditor externo (por qué)

El diseño separa **quién implementa** (Claude, vía `worker.sh`) de **quién
audita/decide** (Cursor). No es antojadizo: que el mismo modelo que escribió
el código sea también el único que lo revisa es un punto ciego — un agente
externo, de otro proveedor, que no comparte el mismo sesgo de implementación,
detecta cosas que Claude revisándose a sí mismo tiende a pasar por alto.

Dónde entra Cursor en este pipeline:

- **Supervisión continua (manual):** vos (o quien tenga Cursor abierto) mirás
  `status.md`, `log.jsonl` y los `next-task-done-*.md` para seguir qué hizo
  Claude en cada ciclo, y resolvés ahí los "Decision Gates" de
  `DECISION-GATES.md` (pausar épica, reordenar, resolver conflictos...).
  Este es el rol principal de auditoría — Cursor como quien mira el trabajo
  de Claude antes/después de cada merge, no un script.
- **Corrección automática (opcional):** si configurás `CURSOR` en `config.sh`
  (ruta al binario `cursor-agent` u otro CLI headless), el supervisor lo
  invoca automáticamente cuando Claude queda en `blocked`/`error`, para que
  redacte la instrucción correctiva — un segundo agente, no el mismo que se
  bloqueó, decide cómo destrabar.
- **Regla dura:** Cursor **nunca** implementa código de producto en este
  pipeline (ver la fila "Cursor (chat)" en `DECISION-GATES.md`) — su rol es
  siempre de revisión/decisión, para que la separación entre "quien construye"
  y "quien valida" no se diluya con el tiempo.

Si tu equipo prefiere invertir los roles (Cursor implementa, Claude audita),
el pipeline funciona igual — `WORKER_CLI`/`WORKER_MODEL` en `config.sh`
apuntan a cualquier CLI headless con un modo `--print`, no están atados a
Claude. Lo importante es mantener la separación entre roles, no cuál
proveedor cumple cada uno.

## 9. Repo secundario opcional (specs/contratos en otro repo)

Si tu equipo, como DosMentes con `dm-api-contracts`, cierra cada épica
generando/actualizando specs en un **segundo repositorio** con merge manual,
descomentá las 4 variables `SECONDARY_REPO_*` en `config.sh` y completá el
`case` de `load_contract_spec` en `lib-contracts.sh` (hay un ejemplo comentado
adentro). Si no tenés ese patrón, no toques nada — `lib-contracts.sh` ya
viene armado para no hacer nada con el repo secundario por defecto (Part A y
B del cierre de épica — auditoría y verificación — funcionan igual sin él).

## 10. Gotchas conocidos (aprendidos en producción con DosMentes)

Checklist para no repetir los mismos incidentes:

1. **La primera UC de cada épica debe crear y pushear `epic/X-...` desde
   `BASE_BRANCH` antes de empezar.** El supervisor nunca crea la rama épica,
   solo la usa como base del PR — si no existe en origin, `gh pr create`
   falla en bucle. (Mitigado parcialmente: si existe local pero no remota, el
   supervisor la pushea solo; si no existe ni local, se detiene con `die()`.)
2. **Formato exacto de `status.md`.** Los dos puntos van DENTRO de los
   asteriscos (`**Estado:**`, no `**Estado**:`). Un desvío hace que
   `get_status_field` no lea el campo y el pipeline se estanca en silencio —
   revisá `log.jsonl` si algo no avanza.
3. **Lock huérfano.** Si el proceso del worker muere sin limpiar el lock (o
   viceversa, el lock desaparece sin que el proceso haya terminado),
   `worker.sh` tiene doble chequeo (`$LOCK` + `pgrep`) — igual, si ves un
   ciclo raro, mirá `ps aux | grep "$WORKER_CLI --print"` a mano.
4. **Nunca mezclar ramas de dos repos en el mismo `status.md`.** El campo
   `**Rama:**` es siempre del repo principal; si hay repo secundario,
   documentá su PR en `**Resumen:**`, nunca en `**Rama:**`
   (`is_valid_front_branch` en `lib-contracts.sh` lo rechaza si detecta el
   marcador de rama del repo secundario).
5. **El worker puede quedar "stalled" pidiendo aprobación interactiva** en
   modo headless aunque el exit code sea 0 — `worker.sh` ya grepea el log en
   busca de frases típicas ("requires approval", "¿me apruebas") y lo trata
   como error si aparecen. Si tu CLI usa otra frase, agregala al patrón en
   `worker.sh`.
6. **No corras `install-cron.sh` de dos proyectos con el mismo `ORCH_DIR`.**
   El filtro de idempotencia usa la ruta absoluta como tag — si dos
   orquestadores comparten carpeta, se van a pisar.
7. **La carpeta del orquestador queda fuera del repo git a propósito.** No la
   versiones dentro del repo que edita el worker: mezclarías el estado que
   cambia cada 5 minutos (`log.jsonl`, `status.md`) con el historial de
   producto, y arriesgás que un `git clean`/`reset` en el repo te borre el
   estado del pipeline.

## 11. Si vas a correr una sesión interactiva (chat) sobre el MISMO repo

Este es el riesgo real que ya vivimos en DosMentes: el cron y cualquier
sesión de chat interactiva comparten el mismo checkout (`REPO_DIR`). Si vos
estás trabajando a mano en el repo mientras el cron también hace `git
checkout`/commit/push, pueden pisarse.

- El pipeline mitiga esto marcando `Estado: procesado` en cuanto termina de
  procesar un `done`/`epic_done`, para que ningún ciclo posterior lo vuelva a
  tratar dos veces.
- De tu lado: evitá dejar cambios sin commitear en `REPO_DIR` mientras el
  cron está activo, y si vas a hacer una intervención manual larga (rebase,
  merge conflict), pausá el cron (`WORKER_AGENT` a otro valor + comentar la
  línea de `supervisor.sh` en el crontab) mientras dure.
- Si podés, usá un checkout separado (worktree o clon aparte) para tus
  sesiones interactivas y dejá `REPO_DIR` exclusivo del cron. Es la forma más
  segura de eliminar el riesgo de raíz.

## 12. Dashboard (opcional)

Existe un dashboard de portafolio (Vite+React+Express) que puede leer el
estado de **varios** proyectos a la vez — algunos como `type: github` (solo
lee `gh api`/PRs/milestones, no necesita orquestador propio) y como máximo
**uno** como `type: orchestrator` (lee `status.md`/`log.jsonl`/etc. de un
`.orchestrator/` concreto) por instancia del dashboard. Dos formas de
sumarte:

- **Sumar tu proyecto al dashboard existente del equipo**, como entrada
  `type: github` en su `projects.registry.yaml` — no requiere que tengas
  orquestador propio, solo que `gh` tenga acceso a tu repo. Pedile a quien lo
  administra que agregue tu entrada.
- **Clonar el dashboard para vos** si querés ver tu propio pipeline
  (`type: orchestrator`) en detalle: el código fuente completo está en
  `dashboard/` en la **raíz de este mismo repo** `command-center` (hermano de
  esta carpeta `template/`, no lo duplicamos acá para no arrastrar
  node_modules/lockfiles innecesarios) — copialo a tu VPS/máquina, ajustá
  `ORCH_DIR`/`REPO_DIR`/`GH_REPO` en su `systemd/*.service` o `.env`, y
  `pnpm install && pnpm dev` (o `install-dashboard.sh` para producción).

## 13. Qué se generalizó respecto al original de DosMentes

Para que sepas qué esperar si comparás con `.orchestrator/` en
`dosmentes-front`:

- El mapeo "bloque de UC → épica" (un `case` numérico hardcodeado repetido en
  3 archivos en el original) se reemplazó por `resolve_epic_for_uc_branch` en
  `lib-backlog.sh`: busca en qué doc de `EPIC_ORDER` aparece el código de UC
  de la rama. Funciona con cualquier convención de nombres, no solo
  `UC-DM-Sx-yy`.
- `--repo electronikatm/dosmentes-front` estaba hardcodeado en 5 lugares de
  `supervisor.sh` pese a existir `$GH_REPO` en config — acá usa `$GH_REPO`
  consistentemente.
- `install-cron.sh` tenía un bug de no-idempotencia (el filtro no capturaba
  sus propios comentarios por un mismatch de mayúsculas/minúsculas, y la
  línea `PATH=` se duplicaba en cada reinstalación) — acá está corregido y
  verificado (ver más abajo).
- El "contrato dual-repo" (`lib-contracts.sh`) quedó como scaffolding
  opcional y apagado por defecto en vez de código 100% específico de
  DosMentes/`dm-api-contracts`.
- Todo lo demás (locks, formato de `status.md`, decision gates, flujo PR →
  merge → siguiente tarea) es el mismo diseño que ya está probado en
  producción.

Estos scripts se probaron en un sandbox local (repo git de prueba, sin red)
antes de compartirlos: se verificó la resolución genérica de épica, la
generación de `next-task.md`, el flujo de commit/push del supervisor, y la
idempotencia de `install-cron.sh` tras reinstalaciones repetidas. Lo único
que un sandbox sin credenciales no puede probar es la llamada real a
`gh pr create`/`gh pr merge` — probalo primero contra un repo de juguete
antes de apuntarlo a tu repo real.
