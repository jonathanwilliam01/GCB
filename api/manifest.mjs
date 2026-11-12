// Manifest com o nome personalizado (?n=); URL http para o Android gerar o atalho com o nome
export async function GET(req) {
  const url = new URL(req.url);
  const n = (url.searchParams.get('n') ?? '').trim().slice(0, 30);
  const m = await (await fetch(new URL('/manifest.webmanifest', url))).json();
  m.id = m.start_url = m.scope = '/';
  m.icons = m.icons.map((i) => ({ ...i, src: '/' + i.src }));
  if (n) m.name = m.short_name = n;
  return new Response(JSON.stringify(m), {
    headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' },
  });
}
