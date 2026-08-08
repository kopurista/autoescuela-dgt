/* Autoescuela DGT · versión móvil (PWA)
   La lógica de historial, banco de fallos y análisis es la misma que la de
   la aplicación de escritorio (dgtapp/analisis.py), portada a JavaScript.   */
"use strict";

const CFG = {
  preguntasAleatorio: 20,
  preguntasTema: 20,
  preguntasFallos: 20,
  preguntasOficial: 30,
  fallosMaximosOficial: 3,
  minutosOficial: 30,
  aciertosParaSuperar: 2,   // para salir del banco de fallos
};

const LETRAS = ["A", "B", "C", "D"];
const CLAVE = "dgt.progreso.v1";

let BANCO = null;            // {temas, preguntas, porId}
let progreso = { intentos: [], respuestas: [] };
let test = null;             // estado del test en curso

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */
const $ = (sel) => document.querySelector(sel);
const crear = (tag, clase, texto) => {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
};

function barajar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

function colorTasa(t) {
  return t >= 0.9 ? "var(--verde)" : t >= 0.75 ? "var(--acento)" : "var(--rojo)";
}

const pct = (t) => `${Math.round(t * 100)} %`;

/* ------------------------------------------------------------------ */
/*  Progreso                                                           */
/* ------------------------------------------------------------------ */
function cargarProgreso() {
  try {
    const bruto = localStorage.getItem(CLAVE);
    if (bruto) progreso = JSON.parse(bruto);
  } catch (e) {
    console.warn("No se ha podido leer el progreso guardado", e);
  }
  progreso.intentos ||= [];
  progreso.respuestas ||= [];
}

function guardarProgreso() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(progreso));
  } catch (e) {
    console.warn("No se ha podido guardar el progreso", e);
  }
}

/* ------------------------------------------------------------------ */
/*  Historial y selección de preguntas                                 */
/* ------------------------------------------------------------------ */
function historial() {
  const h = new Map();
  for (const r of progreso.respuestas) {
    let d = h.get(r.p);
    if (!d) { d = { vistas: 0, aciertos: 0, fallos: 0, racha: 0 }; h.set(r.p, d); }
    d.vistas++;
    if (r.c) { d.aciertos++; d.racha++; } else { d.fallos++; d.racha = 0; }
  }
  return h;
}

function esPendiente(d) {
  return !!d && d.fallos > 0 && d.racha < CFG.aciertosParaSuperar;
}

function bancoDeFallos() {
  const h = historial();
  return BANCO.preguntas
    .filter((p) => esPendiente(h.get(p.id)))
    .sort((a, b) => {
      const da = h.get(a.id), db = h.get(b.id);
      return (db.fallos - da.fallos) || (da.racha - db.racha);
    });
}

function examenOficial(cuantas) {
  const temas = Object.keys(BANCO.temas).map(Number).sort((a, b) => a - b);
  const porTema = Math.max(1, Math.floor(cuantas / temas.length));
  let sel = [];
  for (const t of temas) {
    sel.push(...barajar(BANCO.preguntas.filter((p) => p.tema === t)).slice(0, porTema));
  }
  if (sel.length < cuantas) {
    const ya = new Set(sel.map((p) => p.id));
    sel.push(...barajar(BANCO.preguntas.filter((p) => !ya.has(p.id)))
      .slice(0, cuantas - sel.length));
  }
  return barajar(sel).slice(0, cuantas);
}

/* ------------------------------------------------------------------ */
/*  Análisis                                                           */
/* ------------------------------------------------------------------ */
function resumenGlobal() {
  const total = progreso.respuestas.length;
  const aciertos = progreso.respuestas.filter((r) => r.c).length;
  const terminados = progreso.intentos.filter((i) => i.estado === "terminado");
  const oficiales = terminados.filter((i) => i.modo === "oficial");
  const h = historial();
  return {
    respuestas: total,
    aciertos,
    fallos: total - aciertos,
    tasa: total ? aciertos / total : null,
    tests: terminados.length,
    abandonados: progreso.intentos.filter((i) => i.estado === "abandonado").length,
    oficiales: oficiales.length,
    oficialesAprobados: oficiales.filter((i) => i.aprobado).length,
    vistas: h.size,
    totales: BANCO.preguntas.length,
    pendientes: BANCO.preguntas.filter((p) => esPendiente(h.get(p.id))).length,
  };
}

function agrupar(clave) {
  const acc = new Map();
  for (const r of progreso.respuestas) {
    const p = BANCO.porId.get(r.p);
    if (!p) continue;
    const valores = clave(p);
    for (const nombre of (Array.isArray(valores) ? valores : [valores])) {
      let d = acc.get(nombre);
      if (!d) { d = { nombre, respuestas: 0, aciertos: 0 }; acc.set(nombre, d); }
      d.respuestas++;
      if (r.c) d.aciertos++;
    }
  }
  return [...acc.values()]
    .map((d) => ({ ...d, fallos: d.respuestas - d.aciertos, tasa: d.aciertos / d.respuestas }))
    .sort((a, b) => (a.tasa - b.tasa) || (b.fallos - a.fallos));
}

const porTema = () => agrupar((p) => String(p.tema))
  .map((d) => ({ ...d, tema: Number(d.nombre), nombre: BANCO.temas[d.nombre] }));

const porEtiqueta = (minimo = 3) =>
  agrupar((p) => (p.etiquetas.length ? p.etiquetas : ["sin clasificar"]))
    .filter((d) => d.respuestas >= minimo);

function evolucion(limite = 20) {
  return progreso.intentos
    .filter((i) => i.estado === "terminado" && (i.ok + i.ko) > 0)
    .slice(-limite)
    .map((i) => ({ tasa: i.ok / (i.ok + i.ko), modo: i.modo }));
}

function recomendaciones() {
  const r = resumenGlobal();
  const out = [];
  if (r.respuestas < 30) {
    out.push("Todavía hay pocos datos. Haz un par de tests más y aquí aparecerá un diagnóstico de en qué fallas.");
    return out;
  }
  const flojos = porTema().filter((t) => t.respuestas >= 5 && t.tasa < 0.75).slice(0, 3);
  for (const t of flojos) {
    out.push(`Tema ${t.tema} · ${t.nombre}: aciertas el ${pct(t.tasa)} (${t.fallos} fallos). Hazte un test de este tema.`);
  }
  const etq = porEtiqueta(4).filter((e) => e.tasa < 0.7).slice(0, 4);
  if (etq.length) {
    out.push("Los puntos concretos que peor llevas: " +
      etq.map((e) => `${e.nombre} (${pct(e.tasa)})`).join(", ") + ".");
  }
  if (r.pendientes) {
    out.push(`Tienes ${r.pendientes} preguntas en el banco de fallos. Se quitan de ahí acertándolas dos veces seguidas.`);
  }
  const sinVer = r.totales - r.vistas;
  if (sinVer > 0) out.push(`Aún no has visto ${sinVer} preguntas del temario.`);
  if (r.oficiales) {
    out.push(`Exámenes oficiales simulados: ${r.oficialesAprobados} aprobados de ${r.oficiales}.`);
  } else {
    out.push("Todavía no has hecho ningún examen oficial simulado. Pruébalo cuando te veas suelto.");
  }
  if (!flojos.length && !etq.length) {
    out.unshift("Vas bien: no hay ningún tema por debajo del 75 % de aciertos.");
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Navegación                                                         */
/* ------------------------------------------------------------------ */
const PANTALLAS = ["menu", "temas", "test", "resultado", "estadisticas"];

function mostrar(nombre) {
  for (const p of PANTALLAS) {
    $(`#pantalla-${p}`).classList.toggle("oculta", p !== nombre);
  }
  const sc = $(`#pantalla-${nombre}`)?.querySelector(".scroll");
  if (sc) sc.scrollTop = 0;
}

/* ------------------------------------------------------------------ */
/*  Diálogo                                                            */
/* ------------------------------------------------------------------ */
function dialogo({ titulo, texto, si, no = "Cerrar", alAceptar }) {
  $("#dialogo-titulo").textContent = titulo;
  $("#dialogo-texto").textContent = texto;
  $("#dialogo-no").textContent = no;
  const btnSi = $("#dialogo-si");
  btnSi.classList.toggle("oculta", !si);
  if (si) btnSi.textContent = si;
  btnSi.onclick = () => { cerrarDialogo(); alAceptar && alAceptar(); };
  $("#dialogo").classList.remove("oculta");
}
const cerrarDialogo = () => $("#dialogo").classList.add("oculta");

/* ------------------------------------------------------------------ */
/*  Pantalla: menú                                                     */
/* ------------------------------------------------------------------ */
function pintarMenu() {
  const r = resumenGlobal();
  $("#menu-sub").textContent =
    `Permiso B · ${r.totales} preguntas en ${Object.keys(BANCO.temas).length} temas`;
  $("#desc-fallos").textContent = r.pendientes
    ? `${r.pendientes} preguntas pendientes de dominar`
    : "Sin preguntas pendientes ahora mismo";

  const cifras = $("#menu-cifras");
  cifras.textContent = "";
  if (!r.respuestas) {
    cifras.append(crear("p", "sub", "Aún no has contestado ninguna pregunta."));
  } else {
    const datos = [
      [pct(r.tasa), "de acierto", colorTasa(r.tasa)],
      [String(r.tests), "tests hechos", "var(--texto)"],
      [`${r.vistas}/${r.totales}`, "vistas", "var(--texto)"],
      [String(r.pendientes), "por dominar", r.pendientes ? "var(--rojo)" : "var(--verde)"],
    ];
    for (const [valor, rotulo, color] of datos) {
      const caja = crear("div", "cifra");
      const b = crear("b", null, valor);
      b.style.color = color;
      caja.append(b, crear("span", null, rotulo));
      cifras.append(caja);
    }
  }
  mostrar("menu");
}

/* ------------------------------------------------------------------ */
/*  Pantalla: temas                                                    */
/* ------------------------------------------------------------------ */
function pintarTemas() {
  const stats = new Map(porTema().map((d) => [d.tema, d]));
  const lista = $("#lista-temas");
  lista.textContent = "";

  for (const num of Object.keys(BANCO.temas).map(Number).sort((a, b) => a - b)) {
    const d = stats.get(num);
    const n = BANCO.preguntas.filter((p) => p.tema === num).length;
    const caja = crear("div", "tema");
    caja.append(crear("h4", null, `Tema ${num}. ${BANCO.temas[num]}`));
    caja.append(crear("p", "detalle", d
      ? `${n} preguntas · ${pct(d.tasa)} de acierto · ${d.fallos} fallos`
      : `${n} preguntas · sin practicar todavía`));

    const barra = crear("div", "mini-barra");
    const relleno = crear("i");
    relleno.style.width = d ? `${d.tasa * 100}%` : "0";
    relleno.style.background = d ? colorTasa(d.tasa) : "transparent";
    barra.append(relleno);
    caja.append(barra);

    const btn = crear("button", "btn-principal ancho", "Practicar");
    btn.onclick = () => iniciarTest("tema", num);
    caja.append(btn);
    lista.append(caja);
  }
  mostrar("temas");
}

/* ------------------------------------------------------------------ */
/*  Test                                                               */
/* ------------------------------------------------------------------ */
function iniciarTest(modo, tema = null) {
  let preguntas, titulo, feedback = true, limite = null, maxFallos = null;

  if (modo === "aleatorio") {
    preguntas = barajar([...BANCO.preguntas]).slice(0, CFG.preguntasAleatorio);
    titulo = "Test aleatorio";
  } else if (modo === "tema") {
    preguntas = barajar(BANCO.preguntas.filter((p) => p.tema === tema))
      .slice(0, CFG.preguntasTema);
    titulo = `Tema ${tema}`;
  } else if (modo === "oficial") {
    preguntas = examenOficial(CFG.preguntasOficial);
    titulo = "Examen oficial";
    feedback = false;
    limite = CFG.minutosOficial * 60;
    maxFallos = CFG.fallosMaximosOficial;
  } else {
    const pendientes = bancoDeFallos();
    if (!pendientes.length) {
      dialogo({
        titulo: "Banco de fallos vacío",
        texto: "No tienes ninguna pregunta pendiente. O acabas de empezar, o las llevas todas dominadas.",
        no: "Entendido",
      });
      return;
    }
    preguntas = barajar(pendientes.slice(0, CFG.preguntasFallos * 2))
      .slice(0, Math.min(CFG.preguntasFallos, pendientes.length));
    titulo = "Test de fallos";
  }

  // Se barajan las opciones para que la buena no caiga siempre en la A.
  const preparadas = preguntas.map((p) => {
    const orden = barajar(p.opciones.map((_, i) => i));
    return {
      ...p,
      opciones: orden.map((i) => p.opciones[i]),
      correcta: orden.indexOf(p.correcta),
    };
  });

  test = {
    modo, tema, titulo, preguntas: preparadas, feedback, maxFallos,
    indice: 0, aciertos: 0, fallos: 0, respondida: false,
    registro: [], inicio: Date.now(), limite, terminado: false, tarea: null,
  };

  $("#test-titulo").textContent = titulo;
  mostrar("test");
  pintarPregunta();
  if (limite) tictac(); else $("#test-reloj").textContent = "";
}

function tictac() {
  if (!test || test.terminado) return;
  const restante = test.limite - (Date.now() - test.inicio) / 1000;
  if (restante <= 0) { terminarTest(true); return; }
  const m = Math.floor(restante / 60), s = Math.floor(restante % 60);
  const reloj = $("#test-reloj");
  reloj.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  reloj.classList.toggle("urgente", restante < 120);
  test.tarea = setTimeout(tictac, 500);
}

function refrescarMarcador() {
  const m = $("#test-marcador");
  if (!test.feedback) {
    // Como en el examen real: no se sabe cuántas llevas bien.
    m.textContent = `Respondidas ${test.registro.length}/${test.preguntas.length}` +
      (test.maxFallos ? ` · máx. ${test.maxFallos} fallos` : "");
  } else {
    m.textContent = `✔ ${test.aciertos}  ✘ ${test.fallos}`;
  }
}

function pintarPregunta() {
  const p = test.preguntas[test.indice];
  test.respondida = false;
  test.inicioPregunta = Date.now();

  $("#test-contador").textContent =
    `Pregunta ${test.indice + 1} de ${test.preguntas.length} · Tema ${p.tema}`;
  $("#test-enunciado").textContent = p.texto;
  $("#test-barra").style.width = `${(test.indice / test.preguntas.length) * 100}%`;
  refrescarMarcador();

  const ilu = $("#test-ilustracion");
  ilu.textContent = "";
  if (p.imagen) {
    const img = crear("img");
    img.src = `datos/senales/${p.imagen}`;
    img.alt = p.senal ? `Señal ${p.senal}` : "Ilustración de la pregunta";
    ilu.append(img);
  }

  const cont = $("#test-opciones");
  cont.textContent = "";
  p.opciones.forEach((texto, i) => {
    const b = crear("button", "opcion");
    b.append(crear("span", "letra", `${LETRAS[i]}.`), crear("span", null, texto));
    b.onclick = () => responder(i);
    cont.append(b);
  });

  $("#test-feedback").classList.add("oculta");
  $("#btn-siguiente").classList.add("oculta");
  $("#test-scroll").scrollTop = 0;
}

function responder(elegida) {
  if (test.respondida || test.terminado) return;
  test.respondida = true;

  const p = test.preguntas[test.indice];
  const acierta = elegida === p.correcta;
  if (acierta) test.aciertos++; else test.fallos++;

  progreso.respuestas.push({ p: p.id, c: acierta ? 1 : 0, t: Date.now() });
  test.registro.push({ pregunta: p, elegida, acierta });
  guardarProgreso();

  const botones = [...$("#test-opciones").children];
  botones.forEach((b) => (b.disabled = true));
  $("#test-barra").style.width =
    `${((test.indice + 1) / test.preguntas.length) * 100}%`;
  refrescarMarcador();

  if (test.feedback) {
    botones[p.correcta].classList.add("buena");
    if (!acierta) botones[elegida].classList.add("mala");
    const fb = $("#test-feedback");
    fb.textContent = "";
    const h = crear("h5", null, acierta
      ? "Correcto"
      : `Incorrecto · La respuesta buena es la ${LETRAS[p.correcta]}`);
    h.style.color = acierta ? "var(--verde)" : "var(--rojo)";
    fb.append(h, crear("p", null, p.explicacion));
    fb.classList.remove("oculta");
  } else {
    botones[elegida].classList.add("elegida");
  }

  const btn = $("#btn-siguiente");
  btn.textContent = test.indice + 1 >= test.preguntas.length
    ? "Ver resultado →" : "Siguiente →";
  btn.classList.remove("oculta");
}

function siguiente() {
  if (!test.respondida) return;
  if (test.indice + 1 >= test.preguntas.length) terminarTest(false);
  else { test.indice++; pintarPregunta(); }
}

function cerrarIntento(estado, aprobado) {
  progreso.intentos.push({
    ts: Date.now(), modo: test.modo, tema: test.tema,
    n: test.preguntas.length, ok: test.aciertos, ko: test.fallos,
    estado, aprobado,
    dur: Math.round((Date.now() - test.inicio) / 1000),
  });
  guardarProgreso();
}

function abandonarTest() {
  if (!test || test.terminado) return;
  test.terminado = true;
  clearTimeout(test.tarea);
  cerrarIntento("abandonado", null);
  test = null;
  pintarMenu();
}

function terminarTest(porTiempo) {
  if (test.terminado) return;
  test.terminado = true;
  clearTimeout(test.tarea);

  const sinContestar = test.preguntas.length - test.registro.length;
  let aprobado = null;
  if (test.maxFallos !== null) {
    aprobado = test.fallos <= test.maxFallos && sinContestar === 0;
  }
  cerrarIntento("terminado", aprobado);
  pintarResultado(aprobado, porTiempo, sinContestar);
}

/* ------------------------------------------------------------------ */
/*  Pantalla: resultado                                                */
/* ------------------------------------------------------------------ */
function pintarResultado(aprobado, porTiempo, sinContestar) {
  const sc = $("#resultado-scroll");
  sc.textContent = "";

  const contestadas = Math.max(1, test.registro.length);
  const tasa = test.aciertos / contestadas;

  const titular = crear("div", "titular",
    aprobado === null ? "Test terminado" : aprobado ? "APTO" : "NO APTO");
  titular.style.color =
    aprobado === null ? "var(--acento)" : aprobado ? "var(--verde)" : "var(--rojo)";
  sc.append(titular);

  if (porTiempo) {
    const p = crear("p", null, "Se ha agotado el tiempo.");
    p.style.color = "var(--rojo)";
    sc.append(p);
  }

  const cifras = crear("div", "cifras");
  const dur = test.registro.length
    ? Math.round((Date.now() - test.inicio) / 1000) : 0;
  const datos = [
    [String(test.aciertos), "aciertos", "var(--verde)"],
    [String(test.fallos), "fallos", "var(--rojo)"],
    [pct(tasa), "de acierto", "var(--acento)"],
    [`${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}`, "tiempo", "var(--suave)"],
  ];
  for (const [v, r, c] of datos) {
    const caja = crear("div", "cifra");
    const b = crear("b", null, v);
    b.style.color = c;
    caja.append(b, crear("span", null, r));
    cifras.append(caja);
  }
  sc.append(cifras);

  if (sinContestar) {
    const p = crear("p", "detalle", `${sinContestar} preguntas sin contestar.`);
    p.style.color = "var(--rojo)";
    sc.append(p);
  }

  const fallados = test.registro.filter((r) => !r.acierta);
  if (fallados.length) {
    sc.append(crear("h4", null, `Repasa estos ${fallados.length} fallos`));
    for (const { pregunta: p, elegida } of fallados) {
      const caja = crear("div", "repaso");
      caja.append(crear("div", "tema-mini", `Tema ${p.tema} · ${BANCO.temas[p.tema]}`));
      caja.append(crear("h5", null, p.texto));
      if (p.imagen) {
        const img = crear("img");
        img.src = `datos/senales/${p.imagen}`;
        img.alt = "";
        caja.append(img);
      }
      caja.append(crear("p", "mal", `✘ Tu respuesta: ${p.opciones[elegida]}`));
      caja.append(crear("p", "bien", `✔ Correcta: ${p.opciones[p.correcta]}`));
      if (p.explicacion) caja.append(crear("p", "exp", p.explicacion));
      sc.append(caja);
    }
  } else {
    const p = crear("h4", null, "Ni un solo fallo. Impecable.");
    p.style.color = "var(--verde)";
    sc.append(p);
  }

  test = null;
  mostrar("resultado");
}

/* ------------------------------------------------------------------ */
/*  Pantalla: estadísticas                                             */
/* ------------------------------------------------------------------ */
function bloqueBarras(titulo, filas, nota) {
  const b = crear("div", "bloque");
  b.append(crear("h4", null, titulo));
  if (nota) b.append(crear("p", "detalle", nota));
  for (const f of filas) {
    const fila = crear("div", "fila-barra");
    const etq = crear("div", "etq");
    etq.append(crear("span", null, f.rotulo),
      crear("span", null, `${pct(f.tasa)} · ${f.fallos} fallos de ${f.respuestas}`));
    const barra = crear("div", "mini-barra");
    const relleno = crear("i");
    relleno.style.width = `${f.tasa * 100}%`;
    relleno.style.background = colorTasa(f.tasa);
    barra.append(relleno);
    fila.append(etq, barra);
    b.append(fila);
  }
  return b;
}

function pintarEstadisticas() {
  const sc = $("#estadisticas-scroll");
  sc.textContent = "";
  const r = resumenGlobal();

  if (!r.respuestas) {
    sc.append(crear("p", "detalle",
      "Todavía no hay datos que analizar. Haz un test y vuelve por aquí."));
    mostrar("estadisticas");
    return;
  }

  const cifras = crear("div", "cifras");
  for (const [v, rot, c] of [
    [pct(r.tasa), "acierto global", colorTasa(r.tasa)],
    [String(r.respuestas), "respuestas", "var(--texto)"],
    [String(r.fallos), "fallos", "var(--rojo)"],
    [String(r.tests), "tests", "var(--texto)"],
    [`${r.oficialesAprobados}/${r.oficiales}`, "oficiales", "var(--azul)"],
  ]) {
    const caja = crear("div", "cifra");
    const b = crear("b", null, v);
    b.style.color = c;
    caja.append(b, crear("span", null, rot));
    cifras.append(caja);
  }
  sc.append(cifras);

  const cons = crear("div", "consejos");
  cons.append(crear("h4", null, "Qué te conviene estudiar"));
  const ul = crear("ul");
  for (const c of recomendaciones()) ul.append(crear("li", null, c));
  cons.append(ul);
  sc.append(cons);

  sc.append(bloqueBarras("Aciertos por tema",
    porTema().map((d) => ({ ...d, rotulo: `T${d.tema}. ${d.nombre}` }))));

  const etq = porEtiqueta(3).slice(0, 14);
  if (etq.length) {
    sc.append(bloqueBarras("Aciertos por tipo de pregunta",
      etq.map((d) => ({ ...d, rotulo: d.nombre })),
      "Los apartados concretos que atraviesan los temas, de peor a mejor."));
  }

  const ev = evolucion();
  if (ev.length >= 2) {
    const b = crear("div", "bloque");
    b.append(crear("h4", null, "Evolución de los últimos tests"));
    const c = crear("canvas");
    c.id = "grafica";
    b.append(c);
    sc.append(b);
    requestAnimationFrame(() => pintarGrafica(c, ev));
  }

  const zona = crear("div", "bloque");
  const borrar = crear("button", "btn-plano", "Borrar todo mi progreso");
  borrar.onclick = () => dialogo({
    titulo: "¿Borrar todo el progreso?",
    texto: "Se eliminarán todos los tests, respuestas y estadísticas de este móvil. No se puede deshacer.",
    si: "Sí, borrar", no: "Cancelar",
    alAceptar: () => {
      progreso = { intentos: [], respuestas: [] };
      guardarProgreso();
      pintarMenu();
    },
  });
  zona.append(borrar);
  sc.append(zona);

  mostrar("estadisticas");
}

function pintarGrafica(canvas, datos) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  g.clearRect(0, 0, w, h);

  const mx = 36, my = 14;
  const uw = w - mx - 14, uh = h - my * 2;
  g.font = "10px system-ui";
  for (const p of [0, 50, 75, 100]) {
    const y = my + uh * (1 - p / 100);
    g.strokeStyle = "#2b3a50"; g.setLineDash([2, 4]);
    g.beginPath(); g.moveTo(mx, y); g.lineTo(w - 8, y); g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#93a5bb"; g.textAlign = "right"; g.textBaseline = "middle";
    g.fillText(`${p}%`, mx - 6, y);
  }
  const paso = uw / Math.max(1, datos.length - 1);
  g.strokeStyle = "#f0a500"; g.lineWidth = 2; g.beginPath();
  datos.forEach((d, i) => {
    const x = mx + paso * i, y = my + uh * (1 - d.tasa);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.stroke();
  datos.forEach((d, i) => {
    const x = mx + paso * i, y = my + uh * (1 - d.tasa);
    g.fillStyle = d.tasa >= 0.9 ? "#2f9e5f" : d.tasa >= 0.75 ? "#f0a500" : "#d1495b";
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
  });
}

/* ------------------------------------------------------------------ */
/*  Arranque                                                           */
/* ------------------------------------------------------------------ */
async function arrancar() {
  cargarProgreso();
  const datos = await fetch("datos/banco.json").then((r) => {
    if (!r.ok) throw new Error(`banco.json: HTTP ${r.status}`);
    return r.json();
  });
  BANCO = {
    temas: datos.temas,
    preguntas: datos.preguntas,
    porId: new Map(datos.preguntas.map((p) => [p.id, p])),
  };

  document.querySelectorAll("[data-ir]").forEach((b) => {
    b.onclick = () => {
      const destino = b.dataset.ir;
      if (destino === "menu") pintarMenu();
      else if (destino === "estadisticas") pintarEstadisticas();
    };
  });
  document.querySelectorAll("[data-modo]").forEach((b) => {
    b.onclick = () => {
      const m = b.dataset.modo;
      if (m === "temas") pintarTemas(); else iniciarTest(m);
    };
  });
  $("#btn-siguiente").onclick = siguiente;
  $("#btn-abandonar").onclick = () => dialogo({
    titulo: "¿Abandonar el test?",
    texto: "Se guardarán las respuestas que ya hayas dado, pero el test constará como abandonado en tus estadísticas.",
    si: "Sí, abandonar", no: "Seguir con el test",
    alAceptar: abandonarTest,
  });
  $("#dialogo-no").onclick = cerrarDialogo;

  // Evita salir del test sin querer con el gesto de "atrás".
  window.addEventListener("popstate", () => {
    if (test && !test.terminado) history.pushState(null, "");
  });
  history.pushState(null, "");

  $("#cargando").classList.add("oculta");
  pintarMenu();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(
      (e) => console.warn("Service worker no registrado", e));
  }
}

arrancar().catch((e) => {
  $("#cargando").innerHTML =
    `<p style="color:#d1495b;padding:24px;text-align:center">No se ha podido cargar el temario.<br><small>${e.message}</small></p>`;
  console.error(e);
});
