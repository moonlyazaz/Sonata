import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { ensureSchema, rows, sql } from './db';

/**
 * Autenticação própria em Postgres — sem serviço de terceiros.
 *
 * Hash de senha: **scrypt** nativo do Node. Não usei bcrypt/argon2 porque os
 * dois precisam de módulo nativo compilado, e o bundle da Vercel quebra (ou
 * engorda) com isso. scrypt vem no `node:crypto`, roda em qualquer runtime e é
 * exatamente para isso que ele existe.
 *
 * Sessão: token aleatório de 256 bits no cookie httpOnly. **Só o SHA-256 do
 * token vai para o banco** — se o banco vazar, os cookies continuam inúteis.
 */

/** N=16384 · r=8 · p=1 — ≈50ms por verificação, confortável para um login. */
const SCRYPT: ScryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

export const SESSION_COOKIE = 'sonata_session';
/** 30 dias. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function scryptAsync(pw: Buffer, salt: Buffer, keylen: number, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(pw, salt, keylen, opts, (err, derived) => (err ? reject(err) : resolve(derived)));
  });
}

/** `scrypt$N$r$p$salt$hash` — auto-descritivo para poder reforçar depois. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(Buffer.from(password, 'utf8'), salt, KEYLEN, SCRYPT);
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const opts: ScryptOptions = { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem };
  const expected = Buffer.from(hashB64, 'base64');
  let derived: Buffer;
  try {
    derived = await scryptAsync(Buffer.from(password, 'utf8'), Buffer.from(saltB64, 'base64'), expected.length, opts);
  } catch {
    return false;
  }
  // comprimentos iguais é pré-requisito do timingSafeEqual
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  /** Data URL (`data:image/webp;base64,…`) da foto, ou `null`. */
  avatar: string | null;
}

export interface IssuedSession {
  token: string;
  /** segundos, para o `Max-Age` do cookie */
  maxAge: number;
}

export async function createSession(user: SessionUser, userAgent?: string): Promise<IssuedSession> {
  const token = randomBytes(32).toString('base64url');
  const seconds = Math.floor(SESSION_TTL_MS / 1000);
  await ensureSchema();
  await sql().query(
    `insert into sessions (token_hash, user_id, user_agent, expires_at)
     values ($1, $2, $3, now() + ($4 || ' seconds')::interval)
     on conflict (token_hash) do update set expires_at = excluded.expires_at`,
    [hashToken(token), user.id, userAgent ?? null, String(seconds)],
  );
  return { token, maxAge: seconds };
}

export async function getSessionUser(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  await ensureSchema();
  const found = await rows<SessionUser>(
    `select u.id, u.email, u.name, u.avatar
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  return found.length ? found[0] : null;
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await ensureSchema();
  await sql().query('delete from sessions where token_hash = $1', [hashToken(token)]);
}
