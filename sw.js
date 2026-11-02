/* Revolte Postmaker: opent ook zonder internet, en met internet altijd de nieuwste versie. */
/* Verhoog CACHE als een icoon of het manifest verandert; de app zelf (index.html) komt vanzelf mee. */
const CACHE = 'postmaker-1';
const APP = new URL('./', location).href;
const EIGEN = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const FONT = 'https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&display=swap';
const EXTERN = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const WACHT = 5000; /* zo lang wachten op het netwerk, daarna tonen we de bewaarde versie */

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.add(new Request(APP, { cache:'reload' }));
  await c.addAll(EIGEN.map(u => new Request(u, { cache:'reload' })));
  /* van een andere server: een storing daar mag de installatie niet tegenhouden */
  try {
    await c.add(new Request(JSZIP, { mode:'cors' }));
    const css = await fetch(FONT, { mode:'cors' });
    await c.put(FONT, css.clone());
    const urls = (await css.text()).match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g) || [];
    /* zelfde bestand voor elk gewicht: dubbele adressen laat addAll niet toe */
    await c.addAll([...new Set(urls)].map(u => new Request(u, { mode:'cors' })));
  } catch(err){ console.warn(err); }
  await self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  /* alleen de eigen oude versies: andere sites op github.io delen deze opslag */
  for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('postmaker-')) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url), pad = u.origin + u.pathname;
  if (r.method !== 'GET') return;
  if (pad === APP || pad === APP + 'index.html') return e.respondWith(nieuwste(e));
  if (EXTERN.includes(u.hostname) || EIGEN.some(x => new URL(x, APP).href === pad)) e.respondWith(bewaard(r));
});

/* de app: eerst het netwerk, en de bewaarde versie als dat niet lukt of te lang duurt */
async function nieuwste(e){
  const net = fetch(APP, { cache:'no-cache' }).then(async r => {
    if (r.ok && !r.redirected) await (await caches.open(CACHE)).put(APP, r.clone());
    return r;
  });
  e.waitUntil(net.catch(() => {}));
  const oud = await (await caches.open(CACHE)).match(APP);
  if (!oud) return net;
  return Promise.race([
    net.then(r => r.ok && !r.redirected ? r : oud).catch(() => oud),
    new Promise(ok => setTimeout(() => ok(oud), WACHT))
  ]);
}

/* de rest verandert niet: eerst wat bewaard is */
async function bewaard(r){
  const c = await caches.open(CACHE), oud = await c.match(r, { ignoreVary:true });
  if (oud) return oud;
  const nieuw = await fetch(r);
  if (nieuw.ok || nieuw.type === 'opaque') await c.put(r, nieuw.clone());
  return nieuw;
}
