import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

if (existsSync('.env')) {
  for (const linha of readFileSync('.env', 'utf8').split('\n')) {
    const m = linha.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// nomes próprios ou os criados pela integração Supabase da Vercel
const env = (...nomes) => nomes.map((n) => process.env[n]).find(Boolean) ?? '';
const url = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const key = env('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (!url || !key) {
  console.warn('⚠ SUPABASE_URL / SUPABASE_ANON_KEY não definidos');
  // na Vercel não publica um app sem banco
  if (process.env.VERCEL) process.exit(1);
}

mkdirSync('src/environments', { recursive: true });
writeFileSync(
  'src/environments/environment.ts',
  `export const environment = ${JSON.stringify({ supabaseUrl: url, supabaseKey: key }, null, 2)};\n`,
);
