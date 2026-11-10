# Dashboard de licitaciones SSR/APR y Gestión Hídrica

Monitoreo diario de licitaciones de ingeniería en Mercado Público para el área de estudios de
Hidrogestión SpA: diseños y diagnósticos SSR/APR, estudios tarifarios, estudios hidrogeológicos
y gestión hídrica.

Este repo reemplaza a `nparker-droid/licitaciones-ssr-dashboard`, al que se perdió el acceso. Se reconstruyó el
10-11-2026 a partir del sitio publicado, con las 69 licitaciones y las 5 postulaciones
registradas hasta el barrido del 05-11-2026.

## Cómo funciona

Todo corre en la nube; no se necesita un computador encendido.

```
GitHub Action (≈07:47)                     Tarea de Claude (09:13)
API oficial de Mercado Público  ──►  data/candidatas/  ──►  clasifica: incluir / descartar
actualiza hitos, estado y actas            │                integra y publica el barrido
        │                                  ▼                         │
        └──────────────►  data/*.json en este repo  ◄────────────────┘
                                   │  push
                                   ▼
                     Vercel: build → sitio  ◄── /api/postulaciones (el equipo marca postulaciones)
```

- **GitHub es la base de datos.** Todo vive en `data/` y cada cambio es un commit.
- **API de Mercado Público:** la consulta la GitHub Action con el ticket guardado como
  secreto `MP_TICKET` (Settings → Secrets and variables → Actions). El ticket es personal:
  si quien lo pidió deja la empresa, otra persona debe pedir uno nuevo y reemplazar el secreto.
- **Vercel** ejecuta `node scripts/build.js` en cada push y publica `public/`.
- **Postulaciones:** el equipo las marca en el dashboard («＋ Postulamos», resultado y notas).
  La función `api/postulaciones.js` las guarda en `data/postulaciones.json` con el nombre de
  quien hizo el cambio.

## Estructura

| Ruta | Qué es |
|---|---|
| `data/licitaciones.json` | Licitaciones registradas (datos del barrido) |
| `data/postulaciones.json` | Postulaciones HDG: postulada, resultado, notas, autor |
| `data/meta.json` | Fecha del último barrido y resumen |
| `data/candidatas/` | Candidatas que propone la Action cada día, con su detalle |
| `data/barridos/` | Archivo de cada barrido diario (nuevas, actualizaciones, descartadas) |
| `data/descartadas.json` | Licitaciones descartadas, para no volver a proponerlas |
| `template/index.html` | Interfaz del dashboard (HTML, estilos y lógica) |
| `scripts/build.js` | Genera `public/index.html` desde la plantilla y los datos |
| `scripts/actualizar_etapas.js` | Calcula la etapa de cada licitación según sus hitos |
| `scripts/integrar_barrido.js` | Valida e integra un barrido en `data/licitaciones.json` |
| `scripts/mp_api.js` | Barrido con la API oficial (lo ejecuta la Action) |
| `scripts/mp_navegador.js` | Respaldo manual: extractor para leer Mercado Público desde Chrome |
| `.github/workflows/barrido-api.yml` | GitHub Action «Barrido Mercado Público» |
| `api/postulaciones.js` | Función de Vercel para leer y guardar postulaciones |
| `config/criterios.md` | Palabras clave, categorías y exclusiones del barrido |
| `docs/tarea-diaria.md` | Cómo funciona el barrido diario, paso a paso |

## Configuración en Vercel

Variables de entorno del proyecto (Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `GITHUB_TOKEN` | Token fine-grained de GitHub, solo para este repo, permiso **Contents: Read and write** |
| `CLAVE_EDICION` | Clave que comparte el equipo para editar postulaciones |
| `GITHUB_REPO` | `dueño/licitaciones-ssr-dashboard` (opcional si el proyecto está conectado al repo) |

Después de cambiar variables hay que redesplegar.

## Comandos

```bash
node scripts/build.js                       # genera public/index.html
node scripts/actualizar_etapas.js --check   # muestra cambios de etapa sin guardarlos
node scripts/integrar_barrido.js data/barridos/2026-11-10.json
MP_TICKET=… node scripts/mp_api.js --diagnostico   # barrido por API (fuera de la nube de Claude)
```

Para ver el sitio en local: `node scripts/build.js && npx serve public`.

---
Hidrogestión SpA
