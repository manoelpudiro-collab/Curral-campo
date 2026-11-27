// Curral Digital — guarda o app no celular para abrir sem internet.
// Os dados do rebanho ficam à parte (no armazenamento do app); aqui só ficam as telas.
// A cada versão nova, mude VERSAO: o celular baixa tudo de novo na próxima vez que tiver internet.
const VERSAO = 'curral-campo-2026-11-27b';
const ARQUIVOS = ['./', 'index.html', 'app.css', 'painel.js', 'lancar.js', 'curral.js', 'dg.js', 'relatorio.js', 'app.js', 'manifest.webmanifest',
  'icones/icone-180.png', 'icones/icone-192.png', 'icones/icone-512.png', 'mapas/3c-fundo.jpg', 'mapas/md-fundo.jpg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSAO)
      .then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('curral-campo-') && k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;            // pedidos ao Supabase (POST) passam direto
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const guardado = await cache.match(req, { ignoreSearch: true });
    const daRede = fetch(req)
      .then((r) => { if (r && r.ok && r.type === 'basic') cache.put(req, r.clone()); return r; })
      .catch(() => null);
    if (guardado) { e.waitUntil(daRede); return guardado; }   // abre na hora; atualiza por trás
    const r = await daRede;
    if (r) return r;
    if (req.mode === 'navigate') {
      const inicio = (await cache.match('index.html')) || (await cache.match('./'));
      if (inicio) return inicio;
    }
    return new Response('Sem internet', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
