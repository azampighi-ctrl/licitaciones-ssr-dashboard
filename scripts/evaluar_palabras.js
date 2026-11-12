#!/usr/bin/env node
// Evalúa palabras clave candidatas contra licitaciones reales, sin cambiar el barrido diario.
// Revisa las activas de hoy y todo lo publicado en los últimos N días, y para cada palabra
// informa cuántas licitaciones agregaría que las palabras actuales no traen.
// Uso (GitHub Action «Evaluar palabras clave»): MP_TICKET=… node scripts/evaluar_palabras.js
// Resultado: data/diagnostico/palabras-AAAA-MM-DD.json
"use strict";
const fs = require("fs");
const path = require("path");
const { api, campo, coincide, palabrasClave, exclusiones, excluida } = require("./mp_api.js");

const DIAS = Number(process.env.DIAS || 60);
const MAX_DETALLES = Number(process.env.MAX_DETALLES || 220);
// Palabras a evaluar. Se pueden cambiar con la variable PALABRAS (separadas por «;»).
const PRUEBA = (process.env.PALABRAS ||
  "infiltración;recarga;recarga artificial;medición y control;medición;automatización;telemetría;" +
  "calidad del agua;calidad de agua;calidad de aguas;sensor;seguridad hídrica;riego;eficiencia hídrica")
  .split(";").map((s) => s.trim()).filter(Boolean);
const ESTADOS = { 5: "Publicada", 6: "Cerrada", 7: "Desierta", 8: "Adjudicada", 18: "Revocada", 19: "Suspendida" };

const raiz = path.join(__dirname, "..");
const hoyCL = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date());

async function main() {
  const actuales = palabrasClave();
  const ex = exclusiones();
  const universo = new Map();
  const agregar = (l, origen) => {
    const id = campo(l, "CodigoExterno");
    if (!id || universo.has(id)) return;
    universo.set(id, { id, nombre: String(campo(l, "Nombre") || "").trim(), estado: ESTADOS[campo(l, "CodigoEstado")] || "", cierre: String(campo(l, "FechaCierre") || "").slice(0, 10), origen });
  };
  let errores = 0;
  for (const l of (await api({ estado: "activas" })).Listado || []) agregar(l, "activa");
  const hoy = new Date();
  for (let d = 0; d < DIAS; d++) {
    const f = new Date(hoy.getTime() - d * 864e5);
    const ddmmaaaa = f.toISOString().slice(0, 10).split("-").reverse().join("");
    try { for (const l of (await api({ fecha: ddmmaaaa })).Listado || []) agregar(l, "fecha"); }
    catch (e) { errores++; console.log(`  ! fecha ${ddmmaaaa}: ${e.message}`); }
  }
  const lista = [...universo.values()];
  console.log(`Universo: ${lista.length} licitaciones (activas + publicadas en ${DIAS} días), ${errores} días con error`);

  const yaTraidas = new Set(lista.filter((l) => coincide(l.nombre, actuales).length).map((l) => l.id));
  const resumen = [];
  const nuevas = new Map(); // id → {…, palabras: []}
  for (const p of PRUEBA) {
    const hits = lista.filter((l) => coincide(l.nombre, [p]).length);
    const nuevasP = hits.filter((l) => !yaTraidas.has(l.id));
    const excl = nuevasP.filter((l) => excluida(l.nombre, ex));
    const pasan = nuevasP.filter((l) => !excluida(l.nombre, ex));
    resumen.push({ palabra: p, coincidencias: hits.length, ya_traidas_por_actuales: hits.length - nuevasP.length,
      excluidas_obra_mantencion: excl.length, nuevas_candidatas: pasan.length });
    for (const l of pasan) {
      const n = nuevas.get(l.id) || { ...l, palabras: [] };
      n.palabras.push(p); nuevas.set(l.id, n);
    }
  }
  // Detalle (organismo y descripción) de las nuevas candidatas, para evaluar su relevancia.
  const det = [...nuevas.values()].sort((a, b) => (a.origen === "activa" ? 0 : 1) - (b.origen === "activa" ? 0 : 1));
  let conDetalle = 0;
  for (const n of det.slice(0, MAX_DETALLES)) {
    try {
      const d = ((await api({ codigo: n.id })).Listado || [])[0];
      if (!d) continue;
      const C = d.Comprador || {};
      n.organismo = [campo(C, "NombreOrganismo"), campo(C, "NombreUnidad")].filter(Boolean).join(" - ");
      n.region = campo(C, "RegionUnidad") || "";
      n.tipo = campo(d, "Tipo") || "";
      n.descripcion = String(campo(d, "Descripcion") || "").replace(/\s+/g, " ").slice(0, 500);
      conDetalle++;
    } catch (e) { n.error = e.message; }
  }
  const salida = { generado: new Date().toISOString(), dias: DIAS, universo: lista.length,
    traidas_por_palabras_actuales: yaTraidas.size, resumen, con_detalle: conDetalle, nuevas: det };
  const archivo = path.join(raiz, "data", "diagnostico", `palabras-${hoyCL()}.json`);
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, JSON.stringify(salida, null, 1) + "\n");
  console.table(resumen);
  console.log(`Nuevas candidatas únicas: ${det.length} (${conDetalle} con detalle). Archivo: ${path.relative(raiz, archivo)}`);
}

main().catch((e) => { console.error("ERROR: " + e.message); process.exit(1); });
