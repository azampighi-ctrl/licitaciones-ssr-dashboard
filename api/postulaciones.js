// Función de Vercel: registro de postulaciones HDG.
//   GET  /api/postulaciones  → { "<id>": {aplicamos, resultado_hdg, notas, actualizado, actualizado_por} }
//   POST /api/postulaciones  (Authorization: Bearer <CLAVE_EDICION>)
//        body {id, nombre, aplicamos, resultado_hdg, notas, por} → { ok, registro }
// El registro vive en data/postulaciones.json del repo (GitHub = base de datos). Cada cambio
// es un commit, por lo que queda historial de quién cambió qué. Vercel redespliega solo.
//
// Variables de entorno en Vercel:
//   GITHUB_TOKEN   token fine-grained con permiso Contents: Read and write, solo para este repo
//   CLAVE_EDICION  clave que comparte el equipo para editar desde el dashboard
//   GITHUB_REPO    (opcional) "dueño/repo"; si falta se usa el repo del deploy de Vercel
//   GITHUB_BRANCH  (opcional) rama, por defecto main
"use strict";
const crypto = require("crypto");

const RUTA = "data/postulaciones.json";
const RESULTADOS = ["Pendiente", "Adjudicada", "No adjudicada", "Desierta"];

function repo() {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO;
  const o = process.env.VERCEL_GIT_REPO_OWNER, s = process.env.VERCEL_GIT_REPO_SLUG;
  return o && s ? `${o}/${s}` : "";
}
const rama = () => process.env.GITHUB_BRANCH || "main";

async function gh(metodo, url, cuerpo) {
  const r = await fetch(`https://api.github.com${url}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "licitaciones-ssr-dashboard",
      ...(cuerpo ? { "Content-Type": "application/json" } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j };
}

async function leerRegistro() {
  const r = await gh("GET", `/repos/${repo()}/contents/${RUTA}?ref=${encodeURIComponent(rama())}`);
  if (r.status === 404) return { registro: {}, sha: undefined };
  if (r.status !== 200) throw new Error(`GitHub respondió ${r.status} al leer el registro`);
  return { registro: JSON.parse(Buffer.from(r.json.content, "base64").toString("utf8") || "{}"), sha: r.json.sha };
}

function claveValida(cabecera) {
  const esperada = process.env.CLAVE_EDICION || "";
  const dada = String(cabecera || "").replace(/^Bearer\s+/i, "");
  if (!esperada || !dada) return false;
  const a = crypto.createHash("sha256").update(esperada).digest();
  const b = crypto.createHash("sha256").update(dada).digest();
  return crypto.timingSafeEqual(a, b);
}

function ahoraChile() {
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).replace(/\//g, "-").replace(",", "");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.GITHUB_TOKEN || !repo()) {
    return res.status(503).json({ error: "Falta configurar GITHUB_TOKEN (y GITHUB_REPO) en Vercel" });
  }
  try {
    if (req.method === "GET") {
      const { registro } = await leerRegistro();
      return res.status(200).json(registro);
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Método no permitido" });
    }
    if (!claveValida(req.headers.authorization)) return res.status(401).json({ error: "Clave incorrecta" });

    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const id = String(b.id || "").trim();
    if (!/^[\w.-]{3,40}$/.test(id)) return res.status(400).json({ error: "ID de licitación no válido" });
    const resultado = RESULTADOS.includes(b.resultado_hdg) ? b.resultado_hdg : "Pendiente";
    const por = String(b.por || "").trim().slice(0, 60) || "sin nombre";
    const entrada = {
      aplicamos: b.aplicamos === true,
      resultado_hdg: resultado,
      notas: String(b.notas || "").trim().slice(0, 1000),
      actualizado: ahoraChile(),
      actualizado_por: por,
    };

    // Reintenta si otra persona guardó al mismo tiempo (conflicto de sha).
    for (let intento = 0; intento < 3; intento++) {
      const { registro, sha } = await leerRegistro();
      registro[id] = entrada;
      const contenido = Buffer.from(JSON.stringify(registro, null, 1) + "\n", "utf8").toString("base64");
      const nombre = String(b.nombre || "").slice(0, 60);
      const w = await gh("PUT", `/repos/${repo()}/contents/${RUTA}`, {
        message: `Postulación ${id}: ${entrada.aplicamos ? "postulada" : "no postulada"}, ${resultado} (${por})${nombre ? ` — ${nombre}` : ""}`,
        content: contenido,
        sha,
        branch: rama(),
      });
      if (w.status === 200 || w.status === 201) return res.status(200).json({ ok: true, registro });
      if (w.status !== 409 && w.status !== 422) throw new Error(`GitHub respondió ${w.status} al guardar`);
    }
    return res.status(409).json({ error: "Otra persona guardó al mismo tiempo. Intenta de nuevo." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
