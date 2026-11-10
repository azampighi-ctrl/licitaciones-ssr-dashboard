# Tarea diaria de barrido

La tarea programada de Claude corre de lunes a domingo a las 09:13 (hora de Chile). Lee
Mercado Público con un navegador real (Claude in Chrome en el computador designado), registra
las licitaciones nuevas, actualiza los hitos de las que están en seguimiento y publica el
resultado con un commit a este repo. Vercel redespliega el dashboard en cada push.

No usa ticket ni API de Mercado Público: solo las páginas públicas.

## Requisitos

- El computador designado encendido, con Chrome abierto y la extensión Claude in Chrome conectada.
- Permiso de la extensión para `www.mercadopublico.cl`.
- Este repo agregado a la sesión con permiso de escritura (push).

## Pasos

1. **Preparar.** Clonar el repo, leer `config/criterios.md` y `data/licitaciones.json`.
   Anotar la fecha y hora del barrido (DD-MM-AAAA HH:MM, hora de Chile).
2. **Abrir Mercado Público** en una pestaña nueva:
   `https://www.mercadopublico.cl/Home/BusquedaLicitacion`. Pegar el contenido completo de
   `scripts/mp_navegador.js` con la herramienta de JavaScript; debe responder `MP listo`.
   Hay que volver a pegarlo después de cada navegación.
3. **Buscar.** Para cada palabra clave de `config/criterios.md`:
   `await MP.buscar("<palabra>", {dias: 3})` (7 días los lunes o si el último barrido tiene
   más de 2 días). Juntar los IDs que no estén en `data/licitaciones.json`.
4. **Clasificar candidatas.** Con nombre, descripción y organismo decidir según los criterios:
   incluir (con categoría) o descartar (con motivo). En caso de duda, abrir la ficha.
5. **Leer fichas nuevas.** Para cada incluida, abrir
   `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=<ID>`,
   pegar el extractor y ejecutar `MP.ficha()`. Armar el registro con los campos de
   `data/licitaciones.json` (fechas `_raw` en DD-MM-AAAA HH:MM y `_iso` en AAAA-MM-DDTHH:MM:SS).
   Si el monto o el plazo no aparecen en la ficha, escribir «No informado en ficha pública» o
   «No especificado en ficha». Proponer `interes` y una línea de `observaciones`.
6. **Actualizar las registradas.** Para cada licitación cuya etapa no sea «Pasadas»:
   abrir su ficha, ejecutar `MP.ficha()` y anotar solo los campos que cambiaron (estado_mp,
   fechas de hitos, etc.).
   - Si ya pasó la apertura y hay cuadro de ofertas (`MP.ofertas().disponible`), abrir la URL
     que entrega, ir a «Resumen de Ofertas» y leer oferentes y montos con
     `MP.oferentesEnPagina()` (o con el texto de la página si la tabla no se reconoce).
   - Si quedó adjudicada, `await MP.acta()` entrega oferentes, montos y quién ganó.
   - Hidrogestión SpA aparece como «Hidrogestión» en los oferentes: el dashboard la resalta.
7. **Escribir el barrido** en `data/barridos/AAAA-MM-DD.json`:
   ```json
   {
     "fecha_barrido": "10-11-2026 09:20",
     "nuevas": [ { "id": "...", "nombre": "...", "...": "..." } ],
     "actualizaciones": [ { "id": "...", "estado_mp": "Cerrada" } ],
     "descartadas": [ { "id": "...", "nombre": "...", "motivo": "..." } ]
   }
   ```
8. **Integrar y verificar.**
   `node scripts/integrar_barrido.js data/barridos/AAAA-MM-DD.json && node scripts/build.js`.
   Si falla la validación, corregir el archivo del barrido y repetir.
9. **Publicar.** Commit con el mensaje
   `Barrido DD-MM-AAAA: N nuevas, M actualizadas, K descartadas` y push a `main`.
10. **Avisar.** Resumen corto: nuevas (con nombre, organismo y cierre), cambios relevantes
    (adjudicaciones, en especial si participa Hidrogestión) y cualquier problema.

## Si algo falla

- **Chrome no responde o la extensión no está conectada:** no inventar datos. Registrar el
  fallo en el resumen y terminar sin commit. El barrido siguiente buscará 7 días hacia atrás.
- **Mercado Público caído o con cambios de diseño:** si `MP.buscar` no devuelve resultados para
  ninguna palabra, leer el texto de la página de búsqueda manualmente; si tampoco funciona,
  avisar y terminar.
- **Captcha o bloqueo:** no intentar resolverlo. Avisar y terminar.

## Qué no hace la tarea

- No modifica `data/postulaciones.json` (lo edita el equipo desde el dashboard).
- No borra licitaciones: las antiguas pasan a «Pasadas» y se conservan.
- La etapa (`categoria_display`) la calcula `scripts/actualizar_etapas.js`, también a diario
  mediante la GitHub Action «Actualizar etapas».
