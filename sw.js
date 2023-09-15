const CACHE_KEY = 'tabatApp';

const cacheFirstAssets = [
  'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js',
  'https://cdn.jsdelivr.net/npm/quasar@2.12.5/dist/quasar.umd.prod.js',
  'https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900|Material+Icons',
  'https://cdn.jsdelivr.net/npm/quasar@2.12.5/dist/quasar.prod.css',
  '/assets/js/wakelock.js',
  '/assets/css/styles.css',
  '/assets/css/fonts/digital-7-mono.ttf',
  '/assets/audio/bell.mp3',
  '/assets/audio/buzzer.mp3',
];

const networkFirstAssets = ['/index.html', '/assets/js/app.js'];

async function deleteOldCaches() {
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames.map((name) => {
      if (name !== CACHE_KEY) return caches.delete(name);
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_KEY).then((cache) => cache.addAll(cacheFirstAssets))
  );

  // self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', function (event) {
  // Bug fix
  // https://stackoverflow.com/a/49719964
  if (
    event.request.cache === 'only-if-cached' &&
    event.request.mode !== 'same-origin'
  )
    return;

  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);

      if (
        (cachedResponse && !navigator.onLine) ||
        (cachedResponse &&
          !networkFirstAssets.some((url) => event.request.url.includes(url)))
      )
        return cachedResponse;

      let response;

      try {
        response = await fetch(event.request);

        const clone = response.clone();

        event.waitUntil(
          caches
            .open(CACHE_KEY)
            .then((cache) => cache.put(event.request, clone))
        );

        return response;
      } catch (error) {
        if (cachedResponse) return cachedResponse;

        throw error;
      }
    })()
  );
});
