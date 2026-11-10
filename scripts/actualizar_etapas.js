#!/usr/bin/env node
// Recalcula la etapa (categoria_display) de cada licitación según sus hitos.
// No consulta Mercado Público: solo usa las fechas ya registradas en data/licitaciones.json.
// Uso: node scripts/actualizar_etapas.js [--fecha 2026-11-05T09:20:00] [--check]
//
// Reglas (las mismas que explica el pie del dashboard):
//  - Antes de la fecha de cierre: la categoría temática (Diseños SSR/APR, Estudios Hidrogeológicos…).
//  - Después del cierre, la etapa nombra el siguiente hito pendiente:
//    "Apertura Oferta Técnica" → "Apertura Oferta Económica" → "Resultados".
//  - 5 días corridos después de la fecha de adjudicación pasa en forma definitiva a "Pasadas".
//    Una licitación en "Pasadas" nunca retrocede.
// Validado contra las 69 licitaciones del dashboard original (09/11/2026): 69/69 coinciden.
"use strict";
const fs = require("fs");
const path = require("path");

const ARCHIVO = path.join(__dirname, "..", "data", "licitaciones.json");
const DIAS_A_PASADAS = 5;

function ahoraChile() {
  // Las fechas del repo están en hora de Chile sin zona; se compara en esa misma hora.
  const f = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date());
  return f.replace(" ", "T");
}
const ms = (iso) => (iso ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).getTime() : NaN);

function etapa(t, ahora) {
  if (t.categoria_display === "Pasadas") return "Pasadas";
  const now = ms(ahora);
  const cierre = ms(t.fcierre_iso);
  if (!(cierre <= now)) return t.categoria; // vigente (o sin fecha de cierre)

  // La etapa nombra el siguiente hito pendiente de la ficha.
  const adj = ms(t.fadjudicacion_iso);
  if (Number.isFinite(adj) && now - adj >= DIAS_A_PASADAS * 864e5) return "Pasadas";
  const eco = ms(t.fapertura_economica_iso);
  if (Number.isFinite(eco) && eco <= now) return "Resultados";
  const tec = ms(t.fapertura_tecnica_iso);
  if (Number.isFinite(tec) && tec <= now) return "Apertura Oferta Económica";
  return "Apertura Oferta Técnica";
}

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--fecha");
  const ahora = i >= 0 ? args[i + 1] : ahoraChile();
  const check = args.includes("--check");

  const datos = JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
  const cambios = [];
  for (const t of datos) {
    const nueva = etapa(t, ahora);
    if (nueva !== t.categoria_display) {
      cambios.push(`${t.id}: ${t.categoria_display} → ${nueva}`);
      t.categoria_display = nueva;
    }
  }
  console.log(`Fecha de referencia ${ahora}. ${cambios.length} cambio(s) de etapa.`);
  cambios.forEach((c) => console.log("  " + c));
  if (!check && cambios.length) fs.writeFileSync(ARCHIVO, JSON.stringify(datos, null, 1) + "\n");
}

if (require.main === module) main();
module.exports = { etapa };
