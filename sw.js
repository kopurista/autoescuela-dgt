/* Service worker: deja la aplicación funcionando sin conexión.
   La lista de señales no está escrita a mano: se deduce de banco.json,
   así que al añadir preguntas nuevas basta con subir la versión de abajo. */
"use strict";

const VERSION = "dgt-v4";
const NUCLEO = [
  ".",
  "index.html",
  "app.css",
  "app.js",
  "manifest.webmanifest",
  "iconos/icono-192.png",
  "iconos/icono-512.png",
  "iconos/icono-maskable.png",
  "iconos/favicon.png",
  "datos/banco.json",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(NUCLEO);

    // Las imágenes que realmente se usan, sacadas del propio banco.
    try {
      const banco = await (await fetch("datos/banco.json")).json();
      const imagenes = [...new Set(
        banco.preguntas.filter((p) => p.imagen).map((p) => `datos/senales/${p.imagen}`)
      )];
      await Promise.allSettled(imagenes.map((u) => cache.add(u)));
    } catch (e) {
      // Sin imágenes precargadas la app sigue funcionando: se piden al vuelo.
      console.warn("No se han podido precargar las señales", e);
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    for (const clave of await caches.keys()) {
      if (clave !== VERSION) await caches.delete(clave);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;
  if (new URL(peticion.url).origin !== self.location.origin) return;

  evento.respondWith((async () => {
    const enCache = await caches.match(peticion, { ignoreSearch: true });
    if (enCache) return enCache;
    try {
      const red = await fetch(peticion);
      if (red.ok) {
        const cache = await caches.open(VERSION);
        cache.put(peticion, red.clone());
      }
      return red;
    } catch (e) {
      // Sin red y sin cache: si es una navegación, se sirve la portada.
      if (peticion.mode === "navigate") {
        return (await caches.match("index.html")) || Response.error();
      }
      throw e;
    }
  })());
});
