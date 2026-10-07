const CACHE_NAME = "rishi-music-v3";

const BASE_PATH = "/rishi30/";

const APP_FILES = [
    BASE_PATH,
    BASE_PATH + "index.html",
    BASE_PATH + "style.css",
    BASE_PATH + "app.js",
    BASE_PATH + "manifest.json",
    BASE_PATH + "icon-192.png",
    BASE_PATH + "icon-512.png"
];


/* =========================================
   INSTALL
========================================= */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))

    );

    self.skipWaiting();
});


/* =========================================
   ACTIVATE
========================================= */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames.map(cacheName => {

                        if (
                            cacheName.startsWith("rishi-music-") &&
                            cacheName !== CACHE_NAME
                        ) {

                            return caches.delete(cacheName);

                        }

                        return null;

                    })

                );

            })
            .then(() => self.clients.claim())

    );

});


/* =========================================
   FETCH
========================================= */

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    const requestURL = new URL(event.request.url);

    /* Only handle our own GitHub Pages site */
    if (requestURL.origin !== self.location.origin) {
        return;
    }

    /* Do not interfere with IndexedDB/blob URLs */
    if (
        event.request.url.startsWith("blob:") ||
        event.request.url.startsWith("data:")
    ) {
        return;
    }

    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(networkResponse => {

                        if (
                            !networkResponse ||
                            networkResponse.status !== 200
                        ) {
                            return networkResponse;
                        }

                        const responseCopy =
                            networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {

                                cache.put(
                                    event.request,
                                    responseCopy
                                );

                            });

                        return networkResponse;

                    })
                    .catch(() => {

                        /*
                           If the user is offline and
                           requests a page, return the
                           cached application.
                        */

                        return caches.match(
                            BASE_PATH + "index.html"
                        );

                    });

            })

    );

});