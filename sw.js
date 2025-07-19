// @ts-check

// --- Cache logic (Original) ---
const CACHE_KEY = "tabatApp";

const cacheFirstAssets = [
  "https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js",
  "https://cdn.jsdelivr.net/npm/quasar@2.12.5/dist/quasar.umd.prod.js",
  "https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900|Material+Icons",
  "https://cdn.jsdelivr.net/npm/quasar@2.12.5/dist/quasar.prod.css",
  "/assets/js/wakelock.js",
  "/assets/css/styles.css",
  "/assets/css/fonts/digital-7-mono.ttf",
  "/assets/audios/bell.mp3",
  "/assets/audios/buzzer.mp3",
];

const networkFirstAssets = ["/index.html", "/assets/js/app.js"];

async function deleteOldCaches() {
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames.map((name) => {
      if (name !== CACHE_KEY) return caches.delete(name);
    })
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting(); // Forces to service worker to start inmediately (for timer)
  event.waitUntil(
    caches.open(CACHE_KEY).then((cache) => cache.addAll(cacheFirstAssets))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteOldCaches());
});

self.addEventListener("fetch", function (event) {
  // Bug fix
  // https://stackoverflow.com/a/49719964
  if (
    event.request.cache === "only-if-cached" &&
    event.request.mode !== "same-origin"
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

// --- Timer logic ---
let timerId = null;
let timerState = {};

function showNotification(title, options) {
  self.registration.showNotification(title, {
    badge: "/assets/images/icon-192.png",
    icon: "/assets/images/icon-192.png",
    renotify: true,
    tag: "tabata-timer",
    ...options,
  });
}

function scheduleNext() {
  if (!timerId) return;

  if (timerState.isRecovering) {
    timerState.isRecovering = false;
    showNotification(
      `Ronda ${timerState.initialRounds - timerState.rounds + 1}: ¡A TRABAJAR!`,
      {
        body: `Prepárate para ${timerState.workTime} segundos.`,
        sound: timerState.workSound,
        vibrate: [500],
      }
    );
    timerId = setTimeout(scheduleNext, timerState.workTime * 1000);
  } else {
    timerState.rounds--;
    if (timerState.rounds < 0) {
      showNotification("¡Entrenamiento completado!", {
        body: "¡Buen trabajo!",
        sound: timerState.recoverSound,
        vibrate: [200, 100, 200],
      });
      clearTimeout(timerId);
      timerId = null;
      return;
    }
    timerState.isRecovering = true;
    showNotification("¡A DESCANSAR!", {
      body: `Tómate ${timerState.recoverTime} segundos.`,
      sound: timerState.recoverSound,
      vibrate: [200, 100, 200],
    });
    timerId = setTimeout(scheduleNext, timerState.recoverTime * 1000);
  }
}

self.addEventListener("message", (event) => {
  const { command, state } = event.data;
  if (command === "start") {
    if (timerId) return;
    timerState = { ...state, initialRounds: state.rounds };
    scheduleNext();
  } else if (command === "stop") {
    if (timerId) clearTimeout(timerId);
    timerId = null;
    self.registration
      .getNotifications({ tag: "tabata-timer" })
      .then((n) => n.forEach((notif) => notif.close()));
  }
});
