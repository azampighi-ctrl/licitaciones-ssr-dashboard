# Barrido diario

El barrido corre completo en la nube, en dos partes:

| Hora (Chile) | Quién | Qué hace |
|---|---|---|
| 07:00 | GitHub Action «Barrido Mercado Público» | Consulta la API oficial con el secreto `MP_TICKET`. Propone candidatas nuevas, actualiza estado, hitos y oferentes de las licitaciones en seguimiento y recalcula etapas. |
| 07:30 | Tarea programada de Claude | Clasifica las candidatas del día (incluir o descartar), completa los datos que requieren criterio, integra y publica. |

Ninguna de las dos necesita un computador encendido. GitHub programa en hora UTC, por lo que
la Action tiene dos disparos (10:00 y 11:00 UTC) y corre solo en el que cae a las 07:00 de
Chile, en horario de verano y de invierno. GitHub puede retrasar la Action entre 15 y 60
minutos en horas de alta demanda; la tarea de Claude lo tolera (ver paso 2).

## Parte 1 — GitHub Action (automática)

`scripts/mp_api.js` hace, en este orden:

1. Trae todas las licitaciones publicadas (`estado=activas`, ≈5.000) y filtra por las palabras
   clave de `config/criterios.md`, contra el nombre de la licitación.
2. Para cada coincidencia que no está en `data/licitaciones.json` ni en `data/descartadas.json`,
   consulta el detalle y la guarda en `data/candidatas/AAAA-MM-DD.json` con:
   - `registro`: campos ya en el formato del dashboard (fechas, organismo, región, monto, plazo…).
   - `contexto`: descripción, tipo de licitación e ítems, para clasificar.
   - `palabras`: qué palabras clave coincidieron.
3. Para cada licitación registrada que no está en «Pasadas», consulta el detalle y actualiza
   `estado_mp` y las fechas de hitos. Si la licitación tiene acta de adjudicación y aún no
   registra adjudicado, lee la página pública del acta y guarda los oferentes con sus montos.
4. Recalcula `categoria_display` y anota el resumen en `data/meta.json` (`api`).

Usa ≈150 consultas por día; el límite del ticket es 10.000. Se puede lanzar a mano desde
GitHub → Actions → «Barrido Mercado Público» → Run workflow.

## Parte 2 — Tarea de Claude

1. **Preparar.** Clonar el repo y leer `config/criterios.md`.
2. **Esperar la Action si hace falta.** El archivo del día es `data/candidatas/AAAA-MM-DD.json`
   (fecha de Chile). Si no existe, esperar y hacer `git pull` cada 10 minutos, hasta 60 minutos.
   Si no aparece, revisar `data/meta.json` → `api` y avisar en el resumen; terminar sin commit.
3. **Clasificar cada candidata** según `config/criterios.md`, usando nombre, organismo y
   `contexto` (descripción, tipo, ítems):
   - **Incluir** si es ingeniería o estudio de alguna categoría. Tomar `registro` y agregar
     `categoria`, `interes`, `estado` («Revisar», o «Revisar - relevante» / «Revisar - ALTA
     RELEVANCIA» si calza muy bien) y una línea de `observaciones` con el alcance.
     Mejorar `entidad` si viene poco legible, sin inventar datos.
   - **Descartar** construcción de obra, AIF, suministro, operación, mantención, servicios
     bancarios o lo que no corresponda, con un `motivo` breve.
   - En caso de duda razonable, incluir con `estado` «Revisar - Verificar Alcance».
4. **Escribir el barrido** en `data/barridos/AAAA-MM-DD.json`:
   ```json
   {
     "fecha_barrido": "DD-MM-AAAA HH:MM",
     "nuevas": [ { "...registro con categoria, interes, estado y observaciones..." } ],
     "actualizaciones": [],
     "descartadas": [ { "id": "...", "nombre": "...", "motivo": "..." } ]
   }
   ```
   `fecha_barrido` se copia tal cual del archivo de candidatas (ya está en hora de Chile; no
   convertir). `integrar_barrido.js` la toma de ahí de todos modos.
   Toda candidata debe quedar en `nuevas` o en `descartadas`.
5. **Integrar y verificar.**
   `node scripts/integrar_barrido.js data/barridos/AAAA-MM-DD.json && node scripts/build.js`.
   Si falla la validación, corregir el archivo y repetir.
6. **Publicar.** `git pull --rebase origin main`, commit
   `Barrido DD-MM-AAAA: N nuevas, M actualizadas, K descartadas` y push a `main`.
   «M actualizadas» es `data/meta.json` → `api.actualizadas`.
7. **Resumen** para el equipo: nuevas incluidas (nombre, organismo, región, cierre), cambios
   relevantes del día en el seguimiento (adjudicaciones, en especial si participa Hidrogestión),
   cuántas se descartaron y cualquier problema.

## Qué no hace la tarea

- No modifica `data/postulaciones.json` (lo edita el equipo desde el dashboard).
- No borra licitaciones: las antiguas pasan a «Pasadas» y se conservan.
- No consulta Mercado Público directamente: todo dato viene de la Action.

## Respaldo manual con navegador

Si la API deja de funcionar, `scripts/mp_navegador.js` permite leer las páginas públicas de
Mercado Público desde Chrome con Claude in Chrome (búsqueda, ficha y acta). Se pega en la
página con la herramienta de JavaScript y se usa `window.MP`.

## Si algo falla

- **La Action falla con «Ticket rechazado»:** el ticket venció o fue bloqueado. Quien lo pidió
  debe revisarlo en chilecompra.cl/api y actualizar el secreto `MP_TICKET`.
- **Cero activas:** la API está caída o cambió. Revisar el registro de la Action y lanzarla
  con «diagnostico» activado para ver la estructura de la respuesta en `data/diagnostico/`.
