#!/usr/bin/env node
// Barrido automático con la API oficial de Mercado Público (ChileCompra).
// Corre en la GitHub Action «Barrido Mercado Público»; necesita el secreto MP_TICKET.
//
//  1. Trae todas las licitaciones publicadas (estado=activas) y filtra por las palabras clave
//     de config/criterios.md. Las que no están registradas ni descartadas se guardan con su
//     detalle en data/candidatas/AAAA-MM-DD.json para que la tarea de Claude las clasifique.
//  2. Actualiza estado e hitos de las licitaciones en seguimiento (todas menos «Pasadas»).
//  3. Si hay acta de adjudicación, lee oferentes, montos y adjudicado desde la página pública.
//  4. Recalcula etapas (scripts/actualizar_etapas.js).
//
// Uso: MP_TICKET=xxxx node scripts/mp_api.js [--diagnostico] [--sin-seguimiento]
"use strict";
const fs = require("fs");
const path = require("path");
const { etapa } = require("./actualizar_etapas.js");

const API = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json";
const raiz = path.join(__dirname, "..");
const P = (...p) => path.join(raiz, ...p);
const TICKET = process.env.MP_TICKET || "";
const ARGS = new Set(process.argv.slice(2));
const PAUSA_MS = 1200; // la API rechaza peticiones simultáneas: siempre de a una
const LINK = (id) => `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${id}`;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const leer = (p, def) => { try { return JSON.parse(fs.readFileSync(P(p), "utf8")); } catch { return def; } };
const escribir = (p, v) => { fs.mkdirSync(path.dirname(P(p)), { recursive: true }); fs.writeFileSync(P(p), JSON.stringify(v, null, 1) + "\n"); };
// Toma el primer campo presente entre varios nombres posibles (la API ha variado mayúsculas).
const campo = (o, ...ks) => { for (const k of ks) { if (o && o[k] != null && o[k] !== "") return o[k]; } return undefined; };

let peticiones = 0;
async function api(params, intentos = 4) {
  const q = new URLSearchParams({ ...params, ticket: TICKET });
  for (let i = 1; i <= intentos; i++) {
    await dormir(PAUSA_MS * (i === 1 ? 1 : i * 2));
    peticiones++;
    let r, texto;
    try {
      r = await fetch(`${API}?${q}`, { headers: { Accept: "application/json" } });
      texto = await r.text();
    } catch (e) { if (i === intentos) throw e; continue; }
    let j; try { j = JSON.parse(texto); } catch { j = null; }
    if (r.ok && j && !j.Codigo) return j;
    const msg = (j && (j.Mensaje || j.mensaje)) || texto.slice(0, 160);
    if (/ticket/i.test(msg) && /inv[aá]lido|no existe|bloqueado/i.test(msg)) throw new Error(`Ticket rechazado por la API: ${msg}`);
    if (i === intentos) throw new Error(`API ${r.status}: ${msg}`);
  }
}

// ── Fechas ────────────────────────────────────────────────────────────────
function fecha(v) {
  const m = String(v || "").match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return { raw: "", iso: "" };
  const hh = m[4] || "00", mi = m[5] || "00";
  if (m[1] < "2000") return { raw: "", iso: "" };
  return { raw: `${m[3]}-${m[2]}-${m[1]} ${hh}:${mi}`, iso: `${m[1]}-${m[2]}-${m[3]}T${hh}:${mi}:00` };
}
const hoyChile = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date());
const ahoraChile = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).replace(" ", "T");

// ── Normalizaciones a los valores que usa el dashboard ─────────────────────
const ESTADOS = { 5: "Publicada", 6: "Cerrada", 7: "Desierta (o art. 3 ó 9 Ley 19.886)", 8: "Adjudicada", 18: "Revocada", 19: "Suspendida" };
const REGIONES = [
  [/arica/, "Arica y Parinacota"], [/tarapac/, "Tarapacá"], [/antofagasta/, "Antofagasta"], [/atacama/, "Atacama"],
  [/coquimbo/, "Coquimbo"], [/valpara/, "Valparaíso"], [/metropolitana|santiago/, "Metropolitana"],
  [/higgins|libertador/, "O'Higgins"], [/maule/, "Maule"], [/nuble/, "Ñuble"], [/bio ?bio/, "Biobío"],
  [/araucan/, "La Araucanía"], [/los rios/, "Los Ríos"], [/los lagos/, "Los Lagos"], [/ays[eé]n|aisen/, "Aysén"],
  [/magallanes/, "Magallanes"],
];
const region = (s) => { const n = norm(s); const r = REGIONES.find(([re]) => re.test(n)); return r ? r[1] : String(s || "").trim(); };
const UNIDAD_TIEMPO = { 1: "horas", 2: "días", 3: "semanas", 4: "meses", 5: "años" };
const clp = (n) => "$" + Math.round(n).toLocaleString("es-CL");

// Campos de hitos y estado que la API mantiene al día (se actualizan en cada barrido).
function hitos(d) {
  const F = d.Fechas || {};
  const par = (pref, ...ks) => { const f = fecha(campo(F, ...ks)); return { [`${pref}_raw`]: f.raw, [`${pref}_iso`]: f.iso }; };
  const est = ESTADOS[campo(d, "CodigoEstado")] || campo(d, "Estado") || "";
  return {
    estado_mp: est,
    ...par("fcierre", "FechaCierre"),
    ...par("finicio_preguntas", "FechaInicio"),
    ...par("ffinal_preguntas", "FechaFinal"),
    ...par("frespuestas", "FechaPubRespuestas"),
    ...par("fapertura_tecnica", "FechaActoAperturaTecnica"),
    ...par("fapertura_economica", "FechaActoAperturaEconomica"),
    ...(campo(F, "FechaAdjudicacion") ? par("fadjudicacion", "FechaAdjudicacion") : par("fadjudicacion", "FechaEstimadaAdjudicacion")),
  };
}

// Registro completo (para candidatas nuevas). La tarea de Claude completa categoría,
// interés y observaciones, y puede mejorar los textos.
function registro(d) {
  const C = d.Comprador || {};
  const F = d.Fechas || {};
  const monto = Number(campo(d, "MontoEstimado")) || null;
  const visible = String(campo(d, "VisibilidadMonto") ?? "1") !== "0";
  const tdur = campo(d, "TiempoDuracionContrato"), udur = UNIDAD_TIEMPO[campo(d, "UnidadTiempoDuracionContrato")];
  const visita = fecha(campo(F, "FechaVisitaTerreno"));
  const dirVisita = String(campo(d, "DireccionVisita") || "").trim();
  const r = {
    id: campo(d, "CodigoExterno"),
    nombre: String(campo(d, "Nombre") || "").trim(),
    entidad: [campo(C, "NombreOrganismo"), campo(C, "NombreUnidad")].filter(Boolean).join(" - "),
    region: region(campo(C, "RegionUnidad")),
    comuna: String(campo(C, "ComunaUnidad") || "").trim(),
    fpub: fecha(campo(F, "FechaPublicacion", "FechaCreacion")).raw.slice(0, 10),
    monto_raw: monto && visible ? clp(monto) : "No informado en ficha pública",
    monto_num: monto && visible ? monto : null,
    plazo: Number(tdur) > 0 && udur ? `${tdur} ${udur}` : "No especificado en ficha",
    link: LINK(campo(d, "CodigoExterno")),
    // La API casi nunca trae la fecha de visita; si informa dirección de visita, la hay.
    visita_terreno: visita.raw || dirVisita.length > 3 ? "Exige" : "No exige",
    ...(visita.raw ? { visita_terreno_fecha: visita.raw } : {}),
    ...hitos(d),
  };
  return r;
}

// Datos extra para que Claude clasifique (no se guardan en licitaciones.json).
function contexto(d) {
  const items = ((d.Items || {}).Listado || []).map((i) => [campo(i, "Categoria"), campo(i, "NombreProducto"), campo(i, "Descripcion")].filter(Boolean).join(" · ")).slice(0, 6);
  return {
    descripcion: String(campo(d, "Descripcion") || "").slice(0, 1500),
    tipo: campo(d, "Tipo") || "",
    items,
    fuente_financiamiento: campo(d, "FuenteFinanciamiento") || "",
  };
}

// ── Acta de adjudicación (página pública; lista todos los oferentes con montos) ──
function celdas(trHtml) {
  return [...trHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
      .replace(/\s+/g, " ").trim());
}
const montoTxt = (s) => { const m = String(s || "").replace(/\$/g, "").match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d{4,}/); return m ? Math.round(Number(m[0].replace(/\./g, "").replace(",", "."))) : null; };
async function oferentesActa(url) {
  await dormir(PAUSA_MS);
  const r = await fetch(url.replace(/^http:/, "https:"), { headers: { "User-Agent": "Mozilla/5.0 (licitaciones-ssr-dashboard)" } });
  if (!r.ok) throw new Error(`acta HTTP ${r.status}`);
  return leerActa(await r.text());
}
function leerActa(html) {
  // Tablas hoja: sin tablas anidadas. Encabezado con «Proveedor» y ≥3 columnas.
  const out = [];
  for (const t of html.split(/<table/i).slice(1)) {
    const filas = [...t.split(/<\/table>/i)[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => celdas(m[0]));
    const h = filas.findIndex((f) => f.length >= 3 && f.some((c) => /^proveedor/i.test(c)));
    if (h < 0) continue;
    const cols = filas[h].map(norm);
    const ix = (re) => cols.findIndex((c) => re.test(c));
    const iP = ix(/^proveedor/), iM = ix(/monto( unitario)? (de la )?oferta|^monto/), iE = ix(/^estado/), iT = ix(/total neto adjudicado/);
    for (const f of filas.slice(h + 1)) {
      if (f.length !== cols.length) continue;
      const nombre = f[iP].replace(/^\s*\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\s*/, "").trim();
      if (!nombre || /^total/i.test(nombre)) continue;
      const estado = iE >= 0 ? f[iE] : "";
      const total = iT >= 0 ? montoTxt(f[iT]) : null;
      if (out.some((o) => o.nombre === nombre)) continue;
      out.push({
        nombre,
        monto: iM >= 0 ? montoTxt(f[iM]) : null,
        adjudicado: /^adjudicad/i.test(estado) || (total != null && total > 0),
        estado: /rechaz|inadmis|fuera de bases/i.test(f.join(" ")) ? "Rechazada" : "Aceptada",
      });
    }
  }
  return out;
}

// ── Palabras clave desde config/criterios.md ───────────────────────────────
const items = (txt) => txt.split("\n").map((l) => l.match(/^\s*-\s+(.+?)\s*$/)).filter(Boolean).map((m) => m[1]);
function seccion(re) {
  const md = fs.readFileSync(P("config/criterios.md"), "utf8");
  return md.split(/^## /m).find((s) => re.test(s)) || "";
}
function palabrasClave() { return items(seccion(/^palabras clave/i)); }
// Exclusión automática (construcción y mantención): {excluir: [...], salvo: [...]}
function exclusiones() {
  const [excluir, salvo = ""] = seccion(/^exclusi[oó]n autom/i).split(/\*\*Excepciones/i);
  return { excluir: items(excluir), salvo: items(salvo) };
}
const excluida = (nombre, ex) => coincide(nombre, ex.excluir).length > 0 && coincide(nombre, ex.salvo).length === 0;
// Coincidencia por palabra completa, aceptando plural y cambio de género: "piezómetro" encuentra
// "piezómetros", "hidrogeológico" encuentra "hidrogeológica", "humedal" encuentra "humedales",
// pero "cuenca" no encuentra "cuentas" ni "humedal" encuentra "humedad". Las siglas se aceptan
// escritas con puntos (S.S.R., A.P.R.) y sin mayúsculas ni tildes.
const tokens = (s) => norm(s).replace(/\b([a-z])\.(?=[a-z]\.?)/g, "$1").replace(/\./g, "").split(/[^a-z0-9ñ]+/).filter(Boolean);
function variantes(w) {
  const v = new Set([w, w + "s", w + "es"]);
  if (/[oa]$/.test(w)) { const g = w.slice(0, -1) + (w.endsWith("o") ? "a" : "o"); v.add(g); v.add(g + "s"); }
  return v;
}
// Una clave con « + » exige que TODAS sus partes aparezcan en el nombre, en cualquier orden
// (p. ej. «diseño + aguas lluvias»). Cada parte se busca como frase seguida.
function frase(t, k) {
  const kt = tokens(k).map(variantes);
  for (let i = 0; i + kt.length <= t.length; i++) {
    if (kt.every((v, j) => v.has(t[i + j]))) return true;
  }
  return false;
}
function coincide(nombre, claves) {
  const t = tokens(nombre);
  return claves.filter((k) => k.split(/\s\+\s/).every((parte) => frase(t, parte)));
}

async function main() {
  if (!TICKET) throw new Error("Falta MP_TICKET (secreto del repo en GitHub)");
  const hoy = hoyChile();
  const datos = leer("data/licitaciones.json", []);
  const descartadas = leer("data/descartadas.json", {});
  const porId = new Map(datos.map((t) => [t.id, t]));
  const claves = palabrasClave();
  const ex = exclusiones();
  const informe = { fecha: ahoraChile(), activas: 0, candidatas: 0, excluidas: 0, actualizadas: 0, actas: 0, errores: [] };

  // 1. Candidatas nuevas
  const act = await api({ estado: "activas" });
  const lista = act.Listado || [];
  informe.activas = lista.length;
  const candidatas = [];
  const previas = leer(`data/candidatas/${hoy}.json`, { candidatas: [] }).candidatas || [];
  for (const l of lista) {
    const id = campo(l, "CodigoExterno");
    if (!id || porId.has(id) || descartadas[id]) continue;
    const hits = coincide(campo(l, "Nombre"), claves);
    if (!hits.length) continue;
    if (excluida(campo(l, "Nombre"), ex)) { informe.excluidas++; continue; }
    const ya = previas.find((c) => c.registro.id === id);
    if (ya) { candidatas.push(ya); continue; }
    try {
      const d = ((await api({ codigo: id })).Listado || [])[0];
      if (!d) continue;
      if (ARGS.has("--diagnostico") && !informe.muestra) informe.muestra = estructura(d);
      candidatas.push({ palabras: hits, registro: registro(d), contexto: contexto(d) });
    } catch (e) { informe.errores.push(`${id}: ${e.message}`); }
  }
  informe.candidatas = candidatas.length;
  // fecha_barrido ya en el formato del dashboard (DD-MM-AAAA HH:MM, hora de Chile): la tarea
  // de Claude la copia tal cual en el archivo del barrido.
  const fb = informe.fecha.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  const fecha_barrido = `${fb[3]}-${fb[2]}-${fb[1]} ${fb[4]}:${fb[5]}`;
  escribir(`data/candidatas/${hoy}.json`, { generado: informe.fecha, fecha_barrido, candidatas });

  // 2-3. Seguimiento de registradas
  if (!ARGS.has("--sin-seguimiento")) {
    for (const t of datos) {
      if (t.categoria_display === "Pasadas") continue;
      try {
        const d = ((await api({ codigo: t.id })).Listado || [])[0];
        if (!d) continue;
        if (ARGS.has("--diagnostico") && !informe.muestra) informe.muestra = estructura(d);
        let cambio = false;
        for (const [k, v] of Object.entries(hitos(d))) {
          if (v && v !== t[k]) { t[k] = v; cambio = true; }
        }
        const adj = d.Adjudicacion || {};
        const url = campo(adj, "UrlActa");
        const sinAdjudicado = !(t.oferentes || []).some((o) => o.adjudicado);
        if (url && sinAdjudicado) {
          const of = await oferentesActa(url);
          if (of.length) { t.oferentes = of; cambio = true; informe.actas++; }
        }
        if (cambio) informe.actualizadas++;
      } catch (e) { informe.errores.push(`${t.id}: ${e.message}`); }
    }
  }

  // 4. Etapas
  const ahora = ahoraChile();
  for (const t of datos) t.categoria_display = etapa(t, ahora);
  escribir("data/licitaciones.json", datos);

  const meta = leer("data/meta.json", {});
  meta.api = { fecha: informe.fecha, peticiones, activas: informe.activas, candidatas: informe.candidatas,
    excluidas_construccion_mantencion: informe.excluidas,
    actualizadas: informe.actualizadas, actas: informe.actas, errores: informe.errores.length };
  escribir("data/meta.json", meta);
  if (ARGS.has("--diagnostico")) escribir("data/diagnostico/api.json", { ...informe, peticiones });

  console.log(`API: ${peticiones} peticiones · ${informe.activas} activas · ${informe.candidatas} candidatas · ` +
    `${informe.actualizadas} registradas actualizadas · ${informe.actas} actas leídas · ${informe.errores.length} errores`);
  informe.errores.slice(0, 20).forEach((e) => console.log("  ! " + e));
  if (informe.activas === 0) process.exitCode = 1;
}

// Estructura de una respuesta (solo nombres de campo y tipos, sin valores), para diagnosticar cambios de la API.
function estructura(o, d = 0) {
  if (Array.isArray(o)) return o.length ? [estructura(o[0], d + 1)] : [];
  if (o && typeof o === "object") return d > 3 ? "{…}" : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, estructura(v, d + 1)]));
  return o === null ? "null" : typeof o;
}

if (require.main === module) main().catch((e) => { console.error("ERROR: " + e.message); process.exit(1); });
module.exports = { api, campo, registro, hitos, coincide, palabrasClave, exclusiones, excluida, region, fecha, leerActa };
