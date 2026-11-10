#!/usr/bin/env node
// Genera public/index.html a partir de la plantilla y los datos del repo.
// Uso: node scripts/build.js   (Vercel lo ejecuta en cada deploy)
"use strict";
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const leer = (p) => JSON.parse(fs.readFileSync(path.join(raiz, p), "utf8"));

const licitaciones = leer("data/licitaciones.json");
const postulaciones = leer("data/postulaciones.json");
const meta = leer("data/meta.json");

// El registro de postulaciones (editable desde el dashboard) prevalece sobre los datos del barrido.
const tenders = licitaciones.map((t) => {
  const p = postulaciones[t.id] || {};
  return {
    ...t,
    aplicamos: p.aplicamos === true,
    resultado_hdg: p.resultado_hdg || "Pendiente",
    notas_hdg: p.notas || "",
  };
});

const plantilla = fs.readFileSync(path.join(raiz, "template/index.html"), "utf8");
if (!plantilla.includes("/*__TENDERS__*/[]") || !plantilla.includes("__FECHA_BARRIDO__")) {
  throw new Error("La plantilla no tiene los marcadores /*__TENDERS__*/[] y __FECHA_BARRIDO__");
}
// "<\/" evita que un texto con </script> cierre el bloque de código.
const json = JSON.stringify(tenders).replace(/<\//g, "<\\/");
const html = plantilla
  .replace("/*__TENDERS__*/[]", () => json)
  .replace("__FECHA_BARRIDO__", () => String(meta.fecha_barrido || "").replace(/"/g, ""));

fs.mkdirSync(path.join(raiz, "public"), { recursive: true });
fs.writeFileSync(path.join(raiz, "public/index.html"), html);
console.log(`public/index.html generado: ${tenders.length} licitaciones, barrido ${meta.fecha_barrido}`);
