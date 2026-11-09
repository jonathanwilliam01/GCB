// Envia os lembretes vencidos (chamada pelo pg_cron). Deploy: supabase functions deploy push --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

interface Pendente {
  endpoint: string;
  p256dh: string;
  auth: string;
  chave: string;
  titulo: string;
  corpo: string;
}

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) return new Response('não autorizado', { status: 401 });
  const { data, error } = await db.rpc('push_pendentes');
  if (error) return new Response(error.message, { status: 500 });

  let enviados = 0;
  await Promise.all(
    (data as Pendente[]).map(async (p) => {
      // formato do service worker do Angular; tag sem a data, igual à do aviso local, para não duplicar
      const notification = {
        title: p.titulo,
        body: p.corpo,
        tag: p.chave.slice(11),
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        data: { onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: '/' } } },
      };
      try {
        await webpush.sendNotification({ endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } }, JSON.stringify({ notification }), { TTL: 900 });
        enviados++;
      } catch (e) {
        // inscrição expirada ou removida no aparelho
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from('push_inscricoes').delete().eq('endpoint', p.endpoint);
        else console.error(p.endpoint, e);
      }
    }),
  );
  return Response.json({ enviados, total: data.length });
});
