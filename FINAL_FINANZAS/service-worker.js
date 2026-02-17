const CACHE_NAME = 'finanzas-v1';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './css/variables.css',
    './js/app.js',
    './js/auth.js',
    './js/firestore.js',
    './js/api.js',
    './js/utils.js',
    './js/i18n.js',
    './js/firebase-config.js',
    './manifest.json',
    './assets/logo.svg'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((role) => {
            return role || fetch(e.request);
        })
    );
});
