---
name: generar-epics
description: Redacta EPICs y sus issues/UCs hijas listas para pegar (o subir con `gh`) a GitHub Issues, a partir de un roadmap, un PRD, una conversación o una lista suelta de features. Úsalo cuando el usuario pida "crear epics", "armar el backlog de issues", "convertir esto en issues de GitHub", "planificar issues para X módulo/feature", o cuando falte una forma ordenada de trazar trabajo pendiente hacia GitHub Projects/Issues. No lo uses para issues sueltas de un bug puntual (eso es una issue normal, no una épica).
---

# Generar EPICs e issues para GitHub

Convierte una fuente de trabajo pendiente (roadmap, PRD, transcripción de reunión,
lista de features, auditoría de brechas) en **archivos Markdown "issue-ready"**:
una épica con sus issues hijas, con todos los campos que GitHub Issues necesita
(título, labels, checklist de criterios de aceptación, dependencias).

> **Si el proyecto usa `orquestador-plantilla`** (el orquestador/supervisor de
> desarrollo continuo, en `skills-compartidos/orquestador-plantilla/`) en modo
> `TASK_SOURCE="issues"`: la épica lleva labels `epic` + `feature:<slug>` y
> cada issue hija lleva `uc` + `feature:<slug>`, donde `<slug>` es la rama de
> `EPIC_ORDER` sin el prefijo `epic/` (ej. `epic/A-mi-modulo` → label
> `feature:A-mi-modulo`). Usá ese mismo `<slug>` como el `<paquete o carpeta
> afectada>` del encabezado de la épica para que ambos queden alineados.

Este skill **no sube nada a GitHub por sí solo**. Su salida es Markdown para que
un humano lo revise antes de crear las issues reales. Subir a GitHub es un paso
aparte y explícito (ver "Paso opcional: subir con gh").

## Cuándo usarlo

- El usuario tiene una iniciativa/feature grande y quiere partirla en una épica +
  varias issues antes de llevarla a GitHub.
- Hay una fuente de verdad (roadmap, PRD, spec, backlog en Excel, notas de reunión)
  que hay que traducir a issues trazables.
- El usuario pide explícitamente "generar epics", "armar issues", "backlog de
  GitHub", "plan de issues para X".

No lo uses para una sola issue de bug/tarea chica — eso se crea directo con
`gh issue create`, sin pasar por una épica.

## Paso 1 — Entender el proyecto destino

Antes de escribir nada, confirmá con el usuario (o inferí del repo si es obvio):

1. **Repo destino**: `git remote get-url origin` dentro del proyecto, o preguntar.
   Necesitás `owner/repo` para el paso opcional de `gh`.
2. **Convención de numeración existente**: ¿el proyecto ya tiene un esquema tipo
   `EPIC-A`, `EPIC-01`, `PROJ-123`? Buscá en `docs/backlog/`, `docs/roadmap/`,
   issues/milestones ya creados (`gh issue list --label epic`) antes de inventar uno
   nuevo. Si no hay nada, proponé `EPIC-<letra o número>-<slug>` y una carpeta
   `docs/backlog/` para guardarlos (mismo patrón que ya usa el equipo en
   dosmentes-front).
3. **Labels y milestones existentes**: `gh label list` y
   `gh api repos/{owner}/{repo}/milestones` — reusá lo que ya exista en vez de
   inventar labels nuevas cada vez.
4. **Fuente del contenido**: pedile al usuario el material (roadmap, PRD, lista de
   features) si no lo pegó. No inventes alcance o criterios de aceptación que el
   usuario no haya dado o que no se puedan derivar razonablemente del contexto —
   preguntá lo que falte en vez de rellenar con supuestos.

## Paso 2 — Plantilla de la épica

Un archivo por épica, `docs/backlog/EPIC-<ID>-<slug>.md` (creá la carpeta si no
existe). Encabezado + sección "issue épica" pegable tal cual en GitHub:

```markdown
# EPIC-<ID> · <Nombre de la épica>

> **Feature/módulo destino:** `<paquete o carpeta afectada>` · **Prioridad:** Must/Should/Could

## Issue épica (pegar como issue `epic`)

**Título:** `[EPIC] <nombre corto y accionable>`

**Objetivo:** <qué se logra de punta a punta, en 1-2 frases>

**Por qué:** <motivación — qué brecha cierra, qué desbloquea, qué pide el negocio>

**Alcance (issues hijas):** <ID-01 … ID-0N>

**Fuera de alcance:** <qué NO cubre esta épica, para evitar scope creep>

**Dependencias:** <otras épicas/sistemas de los que depende o a los que alimenta>

**Labels:** `epic`, `<feature:x>`, `<prioridad>`
```

## Paso 3 — Plantilla de cada issue hija

Una sección por issue dentro del mismo archivo:

```markdown
## <ID>-0N · <Nombre corto>

- **Título issue:** `<ID>-0N · <título accionable>`
- **Actor/usuario:** <quién lo usa o pide — rol o persona>
- **Objetivo/valor:** <qué logra y por qué importa>
- **Precondiciones:** <estado previo necesario, si aplica>
- **Alcance:** <qué incluye, concreto>
- **Fuera de alcance:** <qué NO incluye, si hay ambigüedad>
- **Criterios de aceptación:**
  - [ ] <criterio verificable 1>
  - [ ] <criterio verificable 2>
  - [ ] <...>
- **Dependencias:** <otra issue, sistema externo, o "—"> · **Prioridad:** Must/Should/Could
- **Labels:** `<feature:x>`, `<tipo>`, `<prioridad>`
```

Reglas al llenarla:

- **Criterios de aceptación siempre verificables** (checklist, no prosa vaga) —
  son lo que se marca al cerrar la issue.
- **Fuera de alcance explícito** cuando haya riesgo de que alguien asuma más de
  lo que la issue cubre.
- **Dependencias entre issues hijas** usando su propio ID (`<ID>-01`), no
  descripciones sueltas — así se pueden convertir en referencias `#123` al subir.
- No inventes trazabilidad (a un PRD, ticket, sección de roadmap) que el usuario
  no haya mencionado; si no aplica, omití el campo en vez de rellenarlo.

## Paso 4 — Índice y orden de ejecución

Si se generan varias épicas en la misma sesión, agregá o actualizá un
`docs/backlog/README.md` (o el índice que ya use el repo) con:

- Tabla: bloque/ID → épica → feature destino → archivo.
- Orden recomendado de ejecución si hay dependencias entre épicas (qué desbloquea
  a qué).

## Paso 5 — Mostrar y confirmar antes de tocar GitHub

Mostrale al usuario el Markdown generado (o el path del archivo) y esperá
confirmación explícita antes de crear nada en GitHub. Este skill termina acá por
defecto.

## Paso opcional: subir con `gh` (solo si el usuario lo pide explícitamente)

Nunca lo hagas automáticamente — bulk-crear issues en el repo del equipo es una
acción visible para todos y difícil de deshacer en limpio (borrar issues no es
igual a que nunca hayan existido: quedan huecos de numeración, notificaciones, etc.).
Si el usuario confirma que quiere subirlas:

1. Asegurate de que las labels usadas existen (`gh label create <nombre> --color
   <hex> -R owner/repo` para las que falten) y que el milestone existe si aplica.
2. Creá primero la épica:
   ```bash
   gh issue create -R owner/repo \
     --title "[EPIC] <nombre>" \
     --body-file <epic-body.md> \
     --label "epic,<otras labels>"
   ```
3. Guardá el número que devuelve y creá cada issue hija referenciándolo en el
   cuerpo (`Parent: #<n>`) o, si el repo tiene habilitadas **sub-issues** nativas
   de GitHub, usá `gh api` para asociarlas (`POST
   /repos/{owner}/{repo}/issues/{epic_number}/sub_issues`).
4. Al terminar, agregá a la issue épica una checklist con `- [ ] #<n>` por cada
   hija creada, para que quede navegable aunque el repo no tenga sub-issues
   nativas.
5. Reportá al usuario la lista de URLs creadas al final.

## Cómo llevar este skill a otro repo

Este archivo vive fuera de cualquier repo de git en
`/home/claude/dosmentes/skills-compartidos/generar-epics/`. Para que el resto del
equipo lo tenga disponible en un proyecto: copiar la carpeta completa a
`.claude/skills/generar-epics/` dentro de ese repo y comitearla (mismo patrón que
`dosmentes-front/.claude/skills/run-app`), para que quede versionada y disponible
para todo el equipo al clonar.
