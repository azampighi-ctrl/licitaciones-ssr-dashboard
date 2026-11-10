#!/usr/bin/env node
// Integra el resultado del barrido diario (data/barridos/AAAA-MM-DD.json) en data/licitaciones.json.
// Uso: node scripts/integrar_barrido.js data/barridos/2026-11-10.json
//
// Formato del archivo de barrido (lo escribe la tarea diaria, ver docs/tarea-diaria.md):
// {
//   "fecha_barrido": "10-11-2026 09:20",
//   "nuevas":          [ {registro completo con los campos de data/licitaciones.json} ],
//   "actualizaciones": [ {"id": "...", ...solo los campos que cambiaron} ],
//   "descartadas":     [ {"id": "...", "nombre": "...", "motivo": "..."} ]
// }
// Reglas: nunca borra licitaciones; no sobrescribe un ID existente con «nuevas»; los campos
// de postulación (aplicamos, resultado_hdg, notas_hdg) se ignoran porque viven en
// data/postulaciones.json y los edita el equipo desde el dashboard.
"use strict";
const fs = require("fs");
const path = require("path");
const { etapa } = require("./actualizar_etapas.js");

const raiz = path.join(__dirname, "..");
const ARCH = path.join(raiz, "data", "licitaciones.json");
const META = path.join(raiz, "data", "meta.json");
const PROTEGIDOS = new Set(["aplicamos", "resultado_hdg", "notas_hdg", "id"]);
const OBLIGATORIOS = ["id", "nombre", "entidad", "region", "categoria", "fcierre_raw", "fcierre_iso"];
const LINK = (id) => `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${id}`;
const CATEGORIAS = ["Diseños SSR/APR", "Estudios Hidrogeológicos", "Estudio Tarifario", "Diagnósticos Técnicos", "Gestión Hídrica"];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

// Valores por defecto para que el dashboard nunca reciba campos ausentes.
const BASE = {
  comuna: "", interes: "Medio", fpub: "", monto_raw: "No informado en ficha pública", monto_num: null,
  plazo: "No especificado en ficha", estado: "Revisar", observaciones: "", fdeteccion: "",
  finicio_preguntas_raw: "", finicio_preguntas_iso: "", ffinal_preguntas_raw: "", ffinal_preguntas_iso: "",
  frespuestas_raw: "", frespuestas_iso: "", estado_mp: "Publicada",
  fapertura_tecnica_raw: "", fapertura_tecnica_iso: "", fapertura_economica_raw: "", fapertura_economica_iso: "",
  fadjudicacion_raw: "", fadjudicacion_iso: "", categoria_display: "", n_grupo: 1, visita_terreno: "No exige", oferentes: [],
};

function validar(r, donde) {
  const err = [];
  for (const k of Object.keys(r)) {
    if (/_iso$/.test(k) && r[k] && !ISO.test(r[k])) err.push(`${k}="${r[k]}" no es AAAA-MM-DDTHH:MM:SS`);
  }
  if (r.categoria && !CATEGORIAS.includes(r.categoria)) err.push(`categoría desconocida "${r.categoria}"`);
  if (r.oferentes && !Array.isArray(r.oferentes)) err.push("oferentes debe ser una lista");
  if (err.length) throw new Error(`${donde} ${r.id}: ${err.join("; ")}`);
}

function ahoraChileISO() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).replace(" ", "T");
}

function main() {
  const archivo = process.argv[2];
  if (!archivo) throw new Error("Indica el archivo del barrido: node scripts/integrar_barrido.js data/barridos/AAAA-MM-DD.json");
  const b = JSON.parse(fs.readFileSync(archivo, "utf8"));
  const datos = JSON.parse(fs.readFileSync(ARCH, "utf8"));
  const porId = new Map(datos.map((t) => [t.id, t]));
  const hoy = (b.fecha_barrido || "").slice(0, 10);
  let nuevas = 0, actualizadas = 0;

  for (const r of b.nuevas || []) {
    for (const k of OBLIGATORIOS) if (!r[k]) throw new Error(`Nueva ${r.id || "(sin id)"}: falta "${k}"`);
    validar(r, "Nueva");
    if (porId.has(r.id)) { console.warn(`  ${r.id} ya estaba registrada: se trata como actualización`); (b.actualizaciones = b.actualizaciones || []).push(r); continue; }
    const reg = { ...BASE, fdeteccion: hoy, link: LINK(r.id), ...Object.fromEntries(Object.entries(r).filter(([k]) => !PROTEGIDOS.has(k) || k === "id")) };
    datos.push(reg); porId.set(reg.id, reg); nuevas++;
  }
  for (const u of b.actualizaciones || []) {
    const t = porId.get(u.id);
    if (!t) { console.warn(`  ${u.id}: no está registrada, se omite la actualización`); continue; }
    validar(u, "Actualización");
    let cambio = false;
    for (const [k, v] of Object.entries(u)) {
      if (PROTEGIDOS.has(k) || k === "categoria_display") continue;
      if (JSON.stringify(t[k]) !== JSON.stringify(v)) { t[k] = v; cambio = true; }
    }
    if (cambio) actualizadas++;
  }
  // Recalcular etapas con la fecha actual.
  const ahora = ahoraChileISO();
  for (const t of datos) t.categoria_display = etapa(t, ahora);

  fs.writeFileSync(ARCH, JSON.stringify(datos, null, 1) + "\n");
  if (b.fecha_barrido) {
    const meta = JSON.parse(fs.readFileSync(META, "utf8"));
    meta.fecha_barrido = b.fecha_barrido;
    meta.ultimo_resumen = { nuevas, actualizadas, descartadas: (b.descartadas || []).length };
    fs.writeFileSync(META, JSON.stringify(meta, null, 1) + "\n");
  }
  console.log(`Barrido ${b.fecha_barrido}: ${nuevas} nuevas, ${actualizadas} actualizadas, ${(b.descartadas || []).length} descartadas. Total: ${datos.length}.`);
}

main();
