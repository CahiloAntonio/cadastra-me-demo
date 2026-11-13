"use strict";
// Incremente VERSION sempre que alterar ficheiros em cache.
const VERSION = "demo-v1";
const SHELL = ["./", "index.html", "style.css", "validacoes.js", "app.js", "manifest.webmanifest", "icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== VERSION).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(
      (em) =>
        em ||
        fetch(e.request).catch(() => caches.match("index.html")),
    ),
  );
});
