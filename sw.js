// =============================================================
// sw.js — « service worker » : garde une copie de l'app sur le téléphone
// pour qu'elle marche SANS Internet après la première ouverture.
//
// ⚠️ À CHAQUE MISE À JOUR DE L'APP : augmente le numéro VERSION ci-dessous
// (ex. 'v1.0.1'), sinon les téléphones garderont l'ancienne version en cache.
// Tes données (IndexedDB) ne sont jamais touchées par une mise à jour.
// =============================================================
const VERSION = 'v1.0.0';
const CACHE = 'forge-' + VERSION;

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/util.js',
  './js/calc.js',
  './js/data.js',
  './js/db.js',
  './js/ui.js',
  './js/logic.js',
  './js/timer.js',
  './js/views/accueil.js',
  './js/views/nutrition.js',
  './js/views/seance.js',
  './js/views/calis.js',
  './js/views/progres.js',
  './js/views/reglages.js',
  './js/views/aide.js',
  './js/views/sante.js',
  './js/views/bienvenue.js',
  './GUIDE-RACCOURCI.md',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// Installation : on télécharge tous les fichiers (en ignorant le cache du navigateur)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// Activation : on supprime les anciennes versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('forge-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Chaque requête : d'abord la copie locale (rapide, hors ligne), sinon le réseau
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      // hors ligne et page inconnue : on renvoie l'app
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
