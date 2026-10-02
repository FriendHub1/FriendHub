const CACHE = "xoxo-pwa-v1";

const ASSETS = [
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/manifest.webmanifest"
];

/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
    return;
  }

  if (ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches
        .match(event.request)
        .then(cached => cached || fetch(event.request))
    );
  }
});


/* =========================================================
   XOXO AVENUE — PUSH BADGE STORAGE
   ========================================================= */

const BADGE_DB_NAME = "xoxo-push-db";
const BADGE_STORE_NAME = "badge";
const BADGE_KEY = "unread";


function openBadgeDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BADGE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(BADGE_STORE_NAME)) {
        db.createObjectStore(BADGE_STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


async function getBadgeCount() {
  try {
    const db = await openBadgeDB();

    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(
        BADGE_STORE_NAME,
        "readonly"
      );

      const store = transaction.objectStore(BADGE_STORE_NAME);
      const request = store.get(BADGE_KEY);

      request.onsuccess = () => {
        const value = Number(request.result || 0);
        resolve(value);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    return 0;
  }
}


async function setBadgeCount(count) {
  const safeCount = Math.max(0, Number(count) || 0);

  try {
    const db = await openBadgeDB();

    await new Promise((resolve, reject) => {
      const transaction = db.transaction(
        BADGE_STORE_NAME,
        "readwrite"
      );

      const store = transaction.objectStore(BADGE_STORE_NAME);

      const request =
        safeCount > 0
          ? store.put(safeCount, BADGE_KEY)
          : store.delete(BADGE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    /* Storage failure should never break Push notifications. */
  }

  try {
    if (
      "setAppBadge" in navigator &&
      typeof navigator.setAppBadge === "function"
    ) {
      if (safeCount > 0) {
        await navigator.setAppBadge(safeCount);
      } else if (
        "clearAppBadge" in navigator &&
        typeof navigator.clearAppBadge === "function"
      ) {
        await navigator.clearAppBadge();
      }
    }
  } catch (error) {
    /* Badge failure should never break Push notifications. */
  }
}


async function increaseBadgeCount() {
  const current = await getBadgeCount();
  const next = current + 1;

  await setBadgeCount(next);

  return next;
}


async function clearBadgeCount() {
  await setBadgeCount(0);

  try {
    if (
      "clearAppBadge" in navigator &&
      typeof navigator.clearAppBadge === "function"
    ) {
      await navigator.clearAppBadge();
    }
  } catch (error) {
    /* Ignore badge clearing errors. */
  }
}


/* =========================================================
   XOXO AVENUE — WEB PUSH NOTIFICATIONS
   ========================================================= */

self.addEventListener("push", event => {

  event.waitUntil(
    (async () => {

      let data = {};

      try {
        data = event.data
          ? event.data.json()
          : {};
      } catch (error) {

        data = {
          body: event.data
            ? event.data.text()
            : ""
        };

      }


      /* -----------------------------------------------------
         INCREASE XOXO AVENUE APP ICON BADGE
         ----------------------------------------------------- */

      const unreadCount = await increaseBadgeCount();


      /* -----------------------------------------------------
         NOTIFICATION
         ----------------------------------------------------- */

      const title =
        data.title ||
        "XOXO Avenue";


      const options = {

        body:
          data.body ||
          "You have a new notification.",

        icon:
          data.icon ||
          "/icon-192x192.png",

        badge:
          data.badge ||
          "/favicon-32x32.png",

        tag:
          data.tag ||
          undefined,

        renotify:
          Boolean(data.renotify),

        data: {

          url:
            data.url ||
            "/",

          unreadCount:
            unreadCount

        }

      };


      await self.registration.showNotification(
        title,
        options
      );

    })()
  );

});


/* =========================================================
   XOXO AVENUE — NOTIFICATION CLICK
   ========================================================= */

self.addEventListener(
  "notificationclick",
  event => {

    event.notification.close();


    event.waitUntil(
      (async () => {

        /*
         * User opened a notification.
         * Clear the XOXO Avenue icon badge.
         */

        await clearBadgeCount();


        const targetUrl =
          event.notification &&
          event.notification.data &&
          event.notification.data.url
            ? event.notification.data.url
            : "/";


        const absoluteUrl =
          new URL(
            targetUrl,
            self.location.origin
          ).href;


        const windowClients =
          await clients.matchAll({
            type: "window",
            includeUncontrolled: true
          });


        for (const client of windowClients) {

          if ("focus" in client) {

            if (
              "navigate" in client &&
              client.url !== absoluteUrl
            ) {

              return client
                .navigate(absoluteUrl)
                .then(() => client.focus());

            }

            return client.focus();
          }
        }


        if (clients.openWindow) {
          return clients.openWindow(
            absoluteUrl
          );
        }

      })()
    );

  }
);
