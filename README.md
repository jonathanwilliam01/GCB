<img src="public/icons/icon-192.png" width="96" alt="GCB" />

# GCB - Gestão e Controle do Bebê

Versão atual: **V1.26.11.01** · [Patch notes](PATCH_NOTES.md)

Angular + Supabase (login, dados e compartilhamento), deploy na Vercel.

```bash
cp .env.example .env   # preencher SUPABASE_URL e SUPABASE_ANON_KEY
npm install
npm start              # http://localhost:4200
npm run build          # dist/gcb/browser
```

`npm start`/`npm run build` geram `src/environments/environment.ts` a partir do `.env` ou das variáveis de ambiente.

## Supabase

1. Criar projeto em supabase.com.
2. Rodar as migrations de `supabase/migrations/` em ordem no SQL Editor, ou pela CLI: `npx supabase@2.122.0 login`, `npx supabase@2.122.0 link --project-ref <ref>` e `npm run db:push`.
3. Authentication → Providers → Email: para uso pessoal dá para desligar *Confirm email*.
4. Authentication → URL Configuration: URL da Vercel em *Site URL* e *Redirect URLs* (o link de "Esqueci minha senha" volta para ela e abre a tela de nova senha).
5. Project Settings → API: copiar *Project URL* e *anon public key* para o `.env` e para as Environment Variables da Vercel.

Dados: `bebes.dados` (cadastro e nome do app) e `registros` (um por dia de sono, alimento ou medida, em JSON). Fotos no bucket `fotos` (`<bebe_id>/photo.jpg` e `photoFull.jpg`).

## Lembretes com o app fechado (push)

Quem registra algo monta a agenda de lembretes de todos os aparelhos do bebê (`push_agenda`); o `pg_cron` chama a edge function `push` a cada minuto, que envia os vencidos por Web Push. Configurar uma vez:

1. Gerar as chaves: `npx web-push generate-vapid-keys`.
2. `VAPID_PUBLIC_KEY` no `.env` e nas Environment Variables da Vercel.
3. Secrets da função e deploy:
   ```bash
   npx supabase@2.122.0 secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:voce@email.com CRON_SECRET=<senha aleatória>
   npx supabase@2.122.0 functions deploy push --no-verify-jwt
   ```
4. No SQL Editor, URL da função e o mesmo `CRON_SECRET` no Vault:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/push', 'push_url');
   select vault.create_secret('<CRON_SECRET>', 'push_secret');
   ```

No aparelho: aba Bebê → Lembretes → Ativar (permite notificações). No iPhone o push só funciona com o app instalado na tela inicial.

## Sem internet

O app guarda uma cópia local (`gcb:cache`) e abre com ela. Alterações sem internet ficam no aparelho (📴 no cabeçalho) e sobem ao reconectar ou voltar ao app. Conflito entre aparelhos: vale a última gravação de cada registro.

## Compartilhar

Aba Bebê → Compartilhar: código de convite. A outra pessoa cria conta e, na tela inicial, entra com o código. Tudo sincroniza em tempo real. Uma conta pode acompanhar vários bebês (menu lateral → Adicionar bebê / trocar).

O dono pode gerar novo código (o antigo para de funcionar), remover quem acompanha e excluir o bebê. Qualquer um pode deixar de acompanhar; o último a sair apaga o bebê e, se o dono sair, quem entrou primeiro vira dono. Dez códigos errados em 15 minutos bloqueiam novas tentativas.

Dados do `localStorage` (versões antigas, chave `gcb:data`) aparecem no primeiro acesso com a opção de levar para a conta.
