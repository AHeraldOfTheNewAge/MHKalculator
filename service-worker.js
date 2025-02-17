const CACHE_NAME = "pwa-cache-v1";
const urlsToCache = [
	"/",
	"/index.html",
	"/style3.css",
	"/script.js",
	"/favicon.ico",
	"/Tone.js",
	"/icons/icon-192.png",
	"/icons/icon-512.png",
	"/icons/icon-192-maskable.png",
	"/icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(urlsToCache);
		})
	);
});

self.addEventListener("fetch", (event) => {
	event.respondWith(
		caches.match(event.request).then((response) => {
			return response || fetch(event.request);
		})
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cache) => {
					if (cache !== CACHE_NAME) {
						return caches.delete(cache);
					}
				})
			);
		})
	);
});
