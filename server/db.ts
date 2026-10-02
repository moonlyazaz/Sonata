import { neon } from '@neondatabase/serverless';

/**
 * Cliente Neon no modo **HTTP** (`neon()`), não TCP.
 *
 * Escolha deliberada para o deploy na Vercel: o runtime serverless não segura
 * conexões abertas e não tem disco, então um pool TCP (`pg`) congelaria ou
 * esgotaria timeout. O driver HTTP manda cada statement num `POST` para o
 * endpoint *pooler* do Neon e devolve a resposta — sem estado entre chamadas.
 *
 * O mesmo driver roda no dev local, então dev e produção falam igual.
 */

type Sql = ReturnType<typeof neon>;

let inst: Sql | null = null;

export function sql(): Sql {
  if (inst) return inst;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL ausente. Copie `.env.example` para `.env` e preencha, ou cadastre a variável na Vercel.',
    );
  }
  inst = neon(url);
  return inst;
}

/**
 * As chaves que o app persiste em `localStorage` (`lib/storage.ts` →
 * `STORAGE_KEYS`). Esta lista define o contrato do sync: o servidor só guarda
 * e devolve estas — nada de outro lixo parar no banco.
 */
export const MANAGED_KEYS = [
  'sc:liked',
  'sc:liked:data',
  'sc:playlists',
  'sc:recent',
  'sc:recent:data',
  'sc:volume',
  'sc:last-track',
  'sc:searches',
] as const;

export type ManagedKey = (typeof MANAGED_KEYS)[number];

export function isManagedKey(k: string): k is ManagedKey {
  return (MANAGED_KEYS as readonly string[]).includes(k);
}

/**
 * DDL idempotente — `IF NOT EXISTS` em tudo, então roda a cada cold start sem
 * custo e a primeira execução cria tudo.
 */
const DDL: readonly string[] = [
  `create table if not exists users (
     id            uuid primary key default gen_random_uuid(),
     email         text not null unique,
     name          text not null,
     password_hash text not null,
     created_at    timestamptz not null default now()
   )`,

  // A foto é dado de CONTA, não cache: fica na própria tabela `users` e num
  // endpoint dedicado, fora de `user_data`. Se ela fosse uma chave do sync
  // (`MANAGED_KEYS`), passaria a ir para o `localStorage` a cada alteração —
  // que tem ~5 MB no total — e seria reenviada no debounce de 1,2s.
  `alter table users add column if not exists avatar text`,

  `create table if not exists sessions (
     token_hash text primary key,
     user_id    uuid not null references users(id) on delete cascade,
     user_agent text,
     created_at timestamptz not null default now(),
     expires_at timestamptz not null
   )`,
  `create index if not exists sessions_user_idx on sessions(user_id)`,

  // Documento do usuário, uma linha por chave. Espelha 1:1 o localStorage:
  // manter o mesmo formato JSON evita uma camada de tradução — e um bug —
  // no caminho mais quente do app.
  `create table if not exists user_data (
     user_id    uuid not null references users(id) on delete cascade,
     key        text not null,
     value      jsonb not null,
     updated_at timestamptz not null default now(),
     primary key (user_id, key)
   )`,
];

let schemaPromise: Promise<void> | null = null;

/**
 * `sql().query()` devolve um union largo (lista de linhas, resultados completos
 * ou arrays), porque o tipo não sabe de antemão se há `RETURNING`. Centralizar
 * o cast aqui — em vez de repetir `as unknown as T[]` em cada chamada — deixa o
 * resto do código legível e o risco num único ponto.
 */
export async function rows<T = Record<string, unknown>>(
  text: string,
  params?: readonly unknown[],
): Promise<T[]> {
  const res = await sql().query(text, params as unknown[] | undefined);
  return res as unknown as T[];
}

/** Garante as tabelas. A segunda chamada devolve a mesma promessa (e não refaz). */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const db = sql();
      for (const stmt of DDL) await db.query(stmt);
      // zera a retenção de sessões expiradas a cada cold start
      await db.query('delete from sessions where expires_at < now()');
    })().catch((e) => {
      schemaPromise = null; // deixa o próximo tentar de novo
      throw e;
    });
  }
  return schemaPromise;
}
