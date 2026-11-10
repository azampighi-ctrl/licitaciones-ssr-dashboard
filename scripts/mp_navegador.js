// Extractor de Mercado Público — corre DENTRO de una página de www.mercadopublico.cl
// (navegador de la tarea diaria). Se pega completo con la herramienta de JavaScript del
// navegador y luego se llama a las funciones de window.MP. No usa ticket ni API: solo lee
// las mismas páginas públicas que ve cualquier persona.
//
//   await MP.buscar("agua potable rural", {dias: 3})   → [{id, nombre, organismo, fpub, fcierre, estado, monto}]
//   MP.ficha()            (en DetailsAcquisition.aspx) → campos de la ficha + hitos
//   MP.ofertas()          (en DetailsAcquisition.aspx) → URL del cuadro de ofertas para abrirla
//   MP.oferentesEnPagina() (en la pestaña «Resumen de Ofertas») → oferentes y montos
//   await MP.acta()       (en DetailsAcquisition.aspx) → oferentes del acta, con adjudicado sí/no
//
// Las funciones devuelven solo los campos que usa data/licitaciones.json, sin URLs ni RUT
// (el enlace a la ficha lo arma scripts/integrar_barrido.js a partir del ID). Las fechas salen en formato DD-MM-AAAA HH:MM (como en el repo).
(function () {
  "use strict";
  const ID_RE = /\b\d{2,7}-\d{1,4}-[A-Z]{1,2}\d{2,3}\b/;
  const limpio = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  const txt = (id) => {
    const e = document.getElementById(id) || document.getElementById("ctl00_" + id);
    return e ? limpio(e.textContent) : "";
  };
  const fecha = (s) => {
    const m = limpio(s).match(/(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (!m) return { raw: "", iso: "" };
    const hh = m[4] || "00", mm = m[5] || "00";
    return { raw: `${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${hh}:${mm}` : ""}`, iso: `${m[3]}-${m[2]}-${m[1]}T${hh}:${mm}:00` };
  };
  const monto = (s) => {
    const m = limpio(s).replace(/\$/g, "").match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d{4,}/);
    return m ? Math.round(Number(m[0].replace(/\./g, "").replace(",", "."))) : null;
  };
  // Busca un valor por la etiqueta visible (para campos sin id estable: monto, plazo, visita).
  function porEtiqueta(re) {
    for (const el of document.querySelectorAll("td, th, span, label, strong, b")) {
      const t = limpio(el.textContent);
      if (t.length > 80 || !re.test(t)) continue;
      const sig = el.nextElementSibling || (el.parentElement && el.parentElement.nextElementSibling);
      const v = sig ? limpio(sig.textContent) : "";
      if (v && v.length < 400) return v;
    }
    return "";
  }
  async function html(url) {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(`HTTP ${r.status} en ${url.split("?")[0]}`);
    return new DOMParser().parseFromString(await r.text(), "text/html");
  }
  // URL de una subpágina de la ficha. Mercado Público guarda el destino en el atributo href
  // de botones <input type=image>: #imgCuadroOferta (OpeningFrame.aspx → cuadro de ofertas) y
  // #imgAdjudicacion (PreviewAwardAct.aspx → acta de adjudicación).
  function urlSubpagina(cual) {
    const id = cual === "acta" ? "imgAdjudicacion" : "imgCuadroOferta";
    const el = document.getElementById(id);
    const href = el && (el.getAttribute("href") || "");
    return href && !/^\s*$/.test(href) ? new URL(href.replace(/&amp;/g, "&"), location.href).href : "";
  }

  function ficha() {
    if (!/DetailsAcquisition/i.test(location.pathname)) throw new Error("Abre primero la ficha DetailsAcquisition.aspx");
    const f = (id) => fecha(txt(id));
    const cierre = f("lblFicha3Cierre").raw ? f("lblFicha3Cierre") : f("lblCierre");
    const montoTxt = porEtiqueta(/^monto (total )?estimado|^presupuesto/i);
    const visita = porEtiqueta(/visita a terreno/i);
    const out = {
      id: txt("lblNumLicitacion"),
      nombre: txt("lblFicha1Nombre") || txt("lblNombreLicitacion"),
      descripcion: txt("lblFicha1Descripcion"),
      estado_mp: txt("lblFicha1Estado"),
      tipo: txt("lblFicha1Tipo"),
      entidad: txt("lblFicha2Unidad") || txt("lnkResponsable"),
      region: txt("lblFicha2Region").replace(/^Región (de |del |de la )?/i, ""),
      comuna: txt("lblFicha2Comuna"),
      fpub: fecha(txt("lblFicha3Publicacion")).raw.slice(0, 10),
      fcierre: cierre,
      finicio_preguntas: f("lblFicha3Inicio"),
      ffinal_preguntas: f("lblFicha3Fin"),
      frespuestas: f("lblFicha3PublicacionRespuestas"),
      fapertura_tecnica: f("lblFicha3ActoAperturaTecnica"),
      fapertura_economica: f("lblFicha3ActoAperturaEconomica"),
      fadjudicacion: f("lblFicha3Adjudicacion"),
      monto_raw: montoTxt,
      monto_num: monto(montoTxt),
      plazo: porEtiqueta(/duraci[oó]n del contrato|plazo (de ejecuci[oó]n|del contrato)/i),
      visita_terreno_texto: visita,
      hay_cuadro_ofertas: !!urlSubpagina("cuadro"),
      hay_acta: !!urlSubpagina("acta"),
    };
    return out;
  }

  // Lee una tabla y devuelve filas como objetos {encabezado: valor}.
  function filas(doc) {
    const res = [];
    for (const tabla of doc.querySelectorAll("table")) {
      const trs = [...tabla.querySelectorAll("tr")];
      // Encabezado = primera fila cuyas celdas nombran al proveedor (puede ser <th> o <td>).
      // (≥3 columnas, para no confundirla con la tabla «Razón Social | valor» del organismo).
      const head = trs.find((tr) => tr.children.length >= 3 &&
        [...tr.children].some((c) => /^(proveedor|oferente|raz[oó]n social)/i.test(limpio(c.textContent))));
      if (!head || tabla.querySelector("table")) continue; // solo tablas hoja
      const cols = [...head.children].map((c) => limpio(c.textContent).toLowerCase());
      for (const tr of trs.slice(trs.indexOf(head) + 1)) {
        const celdas = [...tr.children].map((c) => limpio(c.textContent));
        if (celdas.length !== cols.length) continue;
        res.push(Object.fromEntries(cols.map((c, i) => [c, celdas[i]])));
      }
    }
    return res;
  }
  const col = (fila, re) => { const k = Object.keys(fila).find((c) => re.test(c)); return k ? fila[k] : ""; };

  // Cuadro de ofertas: OpeningFrame.aspx carga sus pestañas con postbacks, por lo que no se
  // puede leer con fetch. Devuelve la URL para abrirla en el navegador y leer el texto de la
  // pestaña «Resumen de Ofertas» (ver docs/tarea-diaria.md). Si ya hay acta, usar MP.acta().
  function ofertas() {
    const url = urlSubpagina("cuadro");
    return url ? { disponible: true, abrir: url } : { disponible: false };
  }

  // Lee filas de oferentes en una página ya abierta (Resumen de Ofertas o acta).
  function oferentesEnPagina(doc) {
    return filas(doc || document).map((r) => {
      const prov = col(r, /^(proveedor|oferente|raz[oó]n)/);
      const nombre = prov.replace(/^\s*\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\s*/, "").trim();
      const estado = col(r, /^estado/);
      const total = monto(col(r, /total neto adjudicado/));
      return {
        nombre,
        monto: monto(col(r, /monto( unitario)? (de la )?oferta|^monto|total oferta/)),
        adjudicado: /^adjudicad/i.test(estado) || (total != null && total > 0),
        estado: /rechaz|inadmis|no admis|fuera de bases/i.test(Object.values(r).join(" ")) ? "Rechazada" : "Aceptada",
      };
    }).filter((o) => o.nombre && !/^total/i.test(o.nombre));
  }

  async function acta() {
    const url = urlSubpagina("acta");
    if (!url) return { disponible: false, oferentes: [] };
    return { disponible: true, oferentes: oferentesEnPagina(await html(url)) };
  }

  // Búsqueda interna del buscador público. Devuelve resultados de la primera página.
  async function buscar(texto, opciones) {
    const op = Object.assign({ dias: 7, pagina: 1 }, opciones || {});
    const hasta = new Date(), desde = new Date(Date.now() - op.dias * 864e5);
    const d = (x) => x.toISOString().slice(0, 10);
    const cuerpo = {
      textoBusqueda: texto, idEstado: "-1", codigoRegion: "-1", idTipoLicitacion: "-1",
      fechaInicio: d(desde), fechaFin: d(hasta), registrosPorPagina: "50", idTipoFecha: [], idOrden: "1",
      compradores: [], garantias: null, proveedores: [], montoEstimadoTipo: [0], pagina: op.pagina - 1,
    };
    const r = await fetch("/BuscarLicitacion/Home/Buscar", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify(cuerpo),
    });
    if (!r.ok) throw new Error(`Búsqueda: HTTP ${r.status}`);
    const doc = new DOMParser().parseFromString(await r.text(), "text/html");
    const res = [];
    // Cada resultado es un .responsive-resultado: ID, estado, nombre, descripción, monto,
    // fechas de publicación y cierre (DD/MM/AAAA) y organismo comprador.
    for (const card of doc.querySelectorAll(".responsive-resultado")) {
      const id = (limpio((card.querySelector(".id-licitacion") || card).textContent).match(ID_RE) || [])[0];
      if (!id || res.some((x) => x.id === id)) continue;
      const ligeros = [...card.querySelectorAll(".text-weight-light")].map((e) => limpio(e.textContent));
      const tras = (re) => {
        const st = [...card.querySelectorAll("strong")].find((e) => re.test(limpio(e.textContent)));
        const sig = st && (st.nextElementSibling || (st.parentElement && st.parentElement.nextElementSibling));
        return sig ? limpio(sig.textContent) : "";
      };
      const dmy = (s) => limpio(s).replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$1-$2-$3");
      const org = [...card.querySelectorAll("p")].pop(); // el último <p> es el organismo comprador
      res.push({
        id,
        nombre: ligeros[0] || "",
        descripcion: ligeros[1] || "",
        estado: limpio((card.querySelector(".estado-texto") || {}).textContent),
        monto: tras(/^monto/i),
        fpub: dmy(tras(/publicaci/i)),
        fcierre: dmy(tras(/cierre/i)),
        organismo: org ? limpio(org.textContent) : "",
      });
    }
    if (!res.length) {
      // Respaldo si cambia el diseño: cualquier ID de licitación en la respuesta.
      for (const m of limpio(doc.body ? doc.body.textContent : "").matchAll(new RegExp(ID_RE.source, "g"))) {
        if (!res.some((x) => x.id === m[0])) res.push({ id: m[0] });
      }
    }
    return res;
  }

  window.MP = { ficha, ofertas, acta, oferentesEnPagina, buscar, version: "2026-11-10" };
  return "MP listo: " + Object.keys(window.MP).join(", ");
})();
