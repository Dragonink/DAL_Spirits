const openCache = () => caches.open(CACHE_NAME);

self.addEventListener("install", event => {
	console.info("Installing...");

	self.skipWaiting();

	event.waitUntil(
		openCache()
			.then(cache => cache.addAll(ASSETS))
			.then(() => console.log("Cached", ASSETS))
	);
});

self.addEventListener("activate", event => {
	console.info("Activating...");

	if (registration.navigationPreload)
		event.waitUntil(registration.navigationPreload.enable());

	event.waitUntil(clients.claim());

	const KEEP = new Set([CACHE_NAME]);
	event.waitUntil(
		caches.keys().then(keys => Promise.all(
			keys
				.filter(key => !KEEP.has(key))
				.map(key => caches.delete(key).then(_ => console.log("Deleted cache", key)))
		))
	);
});

self.addEventListener("fetch", event => {
	if (event.request.method !== "GET") return;
	console.info("Intercepted fetch @", event.request.url);

	event.respondWith((async () => {
		let res = await caches.match(event.request);
		if (res) {
			console.log("Fetched %s from cache", event.request.url);
			return res;
		}
		res = await event.preloadResponse ?? await fetch(event.request);
		void openCache()
			.then(cache => cache.put(event.request, res.clone()))
			.then(() => console.log("Cached", event.request.url));
		console.log("Fetched %s from network", event.request.url);
		return res;
	})());
});

self.addEventListener("message", event => {
	void openCache()
		.then(cache => cache.addAll(event.data))
		.then(() => console.log("Cached", event.data));
});
