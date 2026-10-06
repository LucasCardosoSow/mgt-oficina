// Guarda as telas do app no celular para abrir rápido mesmo com sinal fraco.
// Os dados (Supabase) sempre vêm da internet.
const VERSAO = 'mgt-v1';
const ARQUIVOS = [
  './', './index.html', './styles.css', './app.js', './lib.js', './config.js',
  './cliente.html', './cliente.js', './manifest.webmanifest',
  './assets/logo.png', './assets/icon-192.png', './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Rede primeiro (pega atualizações), cache se estiver sem internet.
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(VERSAO).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
