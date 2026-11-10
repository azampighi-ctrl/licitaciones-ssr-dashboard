# Dashboard de licitaciones SSR/APR y Gestión Hídrica

Monitoreo diario de licitaciones de ingeniería en Mercado Público para el área de estudios de
Hidrogestión SpA: diseños y diagnósticos SSR/APR, estudios tarifarios, estudios hidrogeológicos
y gestión hídrica.

Este repo reemplaza a `nparker-droid/licitaciones-ssr-dashboard`, al que se perdió el acceso. Se reconstruyó el
10-11-2026 a partir del sitio publicado, con las 69 licitaciones y las 5 postulaciones
registradas hasta el barrido del 05-11-2026.

## Cómo funciona

```
Tarea diaria de Claude (09:13)          GitHub Action (07:17)
lee Mercado Público con Chrome          recalcula etapas por fecha
        │                                       │
        └──► data/*.json en este repo ◄─────────┘
                     │  push
                     ▼
              Vercel: build → sitio  ◄── /api/postulaciones (el equipo marca postulaciones)
```

- **GitHub es la base de datos.** Todo vive en `data/` y cada cambio es un commit.
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
| `data/barridos/` | Archivo de cada barrido diario (nuevas, actualizaciones, descartadas) |
| `template/index.html` | Interfaz del dashboard (HTML, estilos y lógica) |
| `scripts/build.js` | Genera `public/index.html` desde la plantilla y los datos |
| `scripts/actualizar_etapas.js` | Calcula la etapa de cada licitación según sus hitos |
| `scripts/integrar_barrido.js` | Valida e integra un barrido en `data/licitaciones.json` |
| `scripts/mp_navegador.js` | Extractor que corre dentro de las páginas de Mercado Público |
| `api/postulaciones.js` | Función de Vercel para leer y guardar postulaciones |
| `config/criterios.md` | Palabras clave, categorías y exclusiones del barrido |
| `docs/tarea-diaria.md` | Instrucciones paso a paso de la tarea diaria |

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
```

Para ver el sitio en local: `node scripts/build.js && npx serve public`.

---
Hidrogestión SpA
