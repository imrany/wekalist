const staticCacheName = 'site-static-v0.26.0'; // also Versioning static cache
const dynamicCache = 'site-dynamic-v0.26.0'; // Versioning dynamic cache

const assets = [
    // '/',
    '/index.html',
    '/assets',
    '/icons',
];

// Installing service worker
self.addEventListener('install', (evt) => {
    evt.waitUntil(
        caches.open(staticCacheName).then((cache) => {
            console.log('Assets have been added to the cache');
            return cache.addAll(assets);
        }).then(() => {
            self.skipWaiting(); // Forces the waiting service worker to become the active service worker
        })
    );
});

// Activating service worker
self.addEventListener('activate', (evt) => {
    evt.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== staticCacheName && key !== dynamicCache)
                   .map((key) => caches.delete(key))
                // keys.map((key) => caches.delete(key)) // Delete all caches
            );
        }).then(() => {
            return self.clients.claim(); // Ensures the new service worker controls all the clients
        })
    );
});

// Cache limit function
// const limitCacheSize = (name, size) => {
//     caches.open(name).then((cache) => {
//         cache.keys().then((keys) => {
//             if (keys.length > size) {
//                 cache.delete(keys[0]).then(() => {
//                     limitCacheSize(name, size);
//                 });
//             }
//         });
//     });
// };

// Fetch event
// self.addEventListener('fetch', (evt) => {
//     if (evt.request.url.startsWith('http')) { // Ensure the request URL is HTTP(S)
//         evt.respondWith(
//             caches.match(evt.request).then((cacheRes) => {
//                 return cacheRes || fetch(evt.request).then((fetchRes) => {
//                     return caches.open(dynamicCache).then((cache) => {
//                         cache.put(evt.request.url, fetchRes.clone());
//                         limitCacheSize(dynamicCache, 15); // Limit the cache size to 15 items
//                         return fetchRes;
//                     });
//                 });
//             }).catch(() => {
//                 // Fallback if fetch fails
//                 if (evt.request.url.indexOf('.html') > -1) {
//                     return caches.match('/');
//                 }
//             })
//         );
//     }
// });

self.addEventListener("push", event => {
    console.log("Push event received:", event);
    const data = event.data.json();

    self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon?data.icon:'/icons/web-app-manifest-128x128.png',
        badge:'/icons/web-app-manifest-72x72.png',
        data: { link: data.link } // Ensure the link is stored within the data
    });
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const link = event.notification.data.link;
    if (link) {
        event.waitUntil(
            clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
                const matchingClient = windowClients.find(client => client.url === link);
                if (matchingClient) {
                    return matchingClient.focus();
                } else {
                    return clients.openWindow(link);
                }
            })
        );
    }
});
