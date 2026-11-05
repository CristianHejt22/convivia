// sw.js - Service Worker Ligero para CONVIVIA PWA
const CACHE_NAME = 'convivia-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/assets/css/style.css',
  '/assets/img/convivia-logo-transparente.png',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(e => console.warn('PWA Cache preload warning:', e));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Estrategia Network-First para APIs y catálogo (siempre precios frescos) y Cache-Fallback para estáticos
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // APIs y JSONs dinámicos van directo a red sin cachear en SW
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/assets/data/')) {
    return;
  }

  // Para navegación y recursos estáticos
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
