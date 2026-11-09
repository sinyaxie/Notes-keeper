const CACHE = "notes-vault-v1";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== "share-temp").map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function handleShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter(f => f && typeof f === "object" && "name" in f);
    const cache = await caches.open("share-temp");
    for (const k of await cache.keys()) await cache.delete(k);
    let i = 0;
    for (const f of files) {
      const key = new URL("./shared/" + i, self.registration.scope).href;
      await cache.put(key, new Response(f, {
        headers: {
          "Content-Type": f.type || "application/octet-stream",
          "X-Name": encodeURIComponent(f.name)
        }
      }));
      i++;
    }
    return Response.redirect(new URL("./?shared=" + i, self.registration.scope).href, 303);
  } catch (err) {
    return Response.redirect(new URL("./", self.registration.scope).href, 303);
  }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith(handleShare(req));
    return;
  }
  if (req.method !== "GET" || url.origin !== location.origin) return;

  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => null);
    const res = hit || await net;
    return res || caches.match("./index.html");
  })());
});
