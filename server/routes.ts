import { ensureSchema, isManagedKey, rows as queryRows, sql } from './db';
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  verifyPassword,
  type SessionUser,
} from './auth';

/* ─── contrato HTTP ──────────────────────────────────────────────────────── */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Ctx {
  method: string;
  pathname: string;
  query: URLSearchParams;
  /** JSON já desserializado, ou `undefined` quando não há corpo. */
  body: unknown;
  cookies: Record<string, string>;
  userAgent: string | undefined;
  /** true em produção (Vercel) — decide se o cookie leva `Secure`. */
  secure: boolean;
}

export interface Result {
  status: number;
  json: unknown;
  /** Cookies a emitir (`Set-Cookie`). */
  setCookie?: string[];
}

type Handler = (ctx: Ctx) => Promise<Result>;

const ok = (json: unknown): Result => ({ status: 200, json });

function cookieLine(value: string, maxAge: number, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  // Em http://localhost o navegador descarta cookies `Secure`
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookie(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/* ─── validação ──────────────────────────────────────────────────────────── */

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Corpo da requisição inválido.');
  }
  return body as Record<string, unknown>;
}

function str(obj: Record<string, unknown>, field: string, max = 300): string {
  const v = obj[field];
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `Campo "${field}" obrigatório.`);
  const s = v.trim();
  if (s.length > max) throw new HttpError(400, `Campo "${field}" muito longo.`);
  return s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ─── rotas ──────────────────────────────────────────────────────────────── */

async function signup(ctx: Ctx): Promise<Result> {
  await ensureSchema();
  const body = asObject(ctx.body);
  const email = str(body, 'email', 254).toLowerCase();
  const name = str(body, 'name', 80);
  const password = str(body, 'password', 200);

  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'E-mail inválido.');
  if (password.length < 6) throw new HttpError(400, 'A senha precisa de pelo menos 6 caracteres.');

  const hash = await hashPassword(password);
  let user: SessionUser;
  try {
    const created = await queryRows<{ id: string; email: string; name: string; avatar: string | null }>(
      `insert into users (email, name, password_hash) values ($1, $2, $3)
       returning id, email, name, avatar`,
      [email, name, hash],
    );
    const r = created[0];
    if (!r) throw new HttpError(500, 'Não foi possível criar a conta.');
    user = { id: r.id, email: r.email, name: r.name, avatar: r.avatar };
  } catch (e) {
    // 23505 = unique_violation — é o "e-mail já cadastrado", não um erro de infra
    if (e && typeof e === 'object' && 'code' in e && String((e as { code: string }).code) === '23505') {
      throw new HttpError(409, 'Já existe uma conta com este e-mail.');
    }
    throw e;
  }

  const { token, maxAge } = await createSession(user, ctx.userAgent);
  return { status: 201, json: { user }, setCookie: [cookieLine(token, maxAge, ctx.secure)] };
}

async function login(ctx: Ctx): Promise<Result> {
  await ensureSchema();
  const body = asObject(ctx.body);
  const email = str(body, 'email', 254).toLowerCase();
  const password = str(body, 'password', 200);

  const found = await queryRows<{
    id: string;
    email: string;
    name: string;
    avatar: string | null;
    password_hash: string;
  }>(
    'select id, email, name, avatar, password_hash from users where email = $1',
    [email],
  );
  const r = found[0];

  // Mesha erro de conta e de senha: não se confirma existência de e-mail
  const valid = r ? await verifyPassword(password, r.password_hash) : false;
  if (!r || !valid) throw new HttpError(401, 'E-mail ou senha incorretos.');

  const user: SessionUser = { id: r.id, email: r.email, name: r.name, avatar: r.avatar };
  const { token, maxAge } = await createSession(user, ctx.userAgent);
  return { status: 200, json: { user }, setCookie: [cookieLine(token, maxAge, ctx.secure)] };
}

async function logout(ctx: Ctx): Promise<Result> {
  const token = ctx.cookies[SESSION_COOKIE];
  if (token) await destroySession(token);
  return { status: 200, json: { ok: true }, setCookie: [clearCookie(ctx.secure)] };
}

async function me(ctx: Ctx): Promise<Result> {
  const token = ctx.cookies[SESSION_COOKIE];
  const user = token ? await getSessionUser(token) : null;
  if (!user) throw new HttpError(401, 'Sessão expirada.');
  return ok({ user });
}

async function requireUser(ctx: Ctx): Promise<SessionUser> {
  const token = ctx.cookies[SESSION_COOKIE];
  const user = token ? await getSessionUser(token) : null;
  if (!user) throw new HttpError(401, 'Faça login para continuar.');
  return user;
}

/** Todo o documento do usuário. Só as chaves gerenciadas saem daqui. */
async function getData(ctx: Ctx): Promise<Result> {
  const user = await requireUser(ctx);
  await ensureSchema();
  const found = await queryRows<{ key: string; value: unknown }>(
    'select key, value from user_data where user_id = $1',
    [user.id],
  );
  const items: Record<string, unknown> = {};
  for (const row of found) {
    if (isManagedKey(row.key)) items[row.key] = row.value;
  }
  return ok({ items });
}

/**
 * Upsert parcial: só as chaves presentes no corpo são escritas. O cliente
 * manda o que sujou, não o documento inteiro — e chaves ausentes nunca são
 * apagadas (remoção teria que ser explícita, senão um PATCH incompleto
 * apagaria dados em silêncio).
 */
async function putData(ctx: Ctx): Promise<Result> {
  const user = await requireUser(ctx);
  await ensureSchema();

  const raw = asObject(ctx.body) as { items?: unknown };
  if (!raw.items || typeof raw.items !== 'object' || Array.isArray(raw.items)) {
    throw new HttpError(400, 'Esperado { items: { chave: valor } }.');
  }

  const entries = Object.entries(raw.items as Record<string, unknown>).filter(([k]) =>
    isManagedKey(k),
  );
  if (entries.length === 0) return ok({ saved: 0 });

  const db = sql();
  const writes = entries.map(([key, value]) =>
    db`
      insert into user_data (user_id, key, value, updated_at)
      values (${user.id}, ${key}, ${JSON.stringify(value)}::jsonb, now())
      on conflict (user_id, key)
        do update set value = excluded.value, updated_at = now()
    `,
  );
  await db.transaction(writes);

  return ok({ saved: entries.length });
}

/* ─── avatar ────────────────────────────────────────────────────────────── */

/**
 * Teto de 64 KB de **texto** base64 (≈48 KB de imagem). A foto é reduzida no
 * navegador para 160×160 WebP antes de chegar aqui (~13 KB), então o limite é
 * folgado — mas precisa existir, senão qualquer um poderia mandar megabytes
 * direto para o banco.
 */
const MAX_AVATAR_CHARS = 64 * 1024;

/** Só data URL de imagem, em base64. Nada de HTML/JS colado no meio. */
const AVATAR_RE = /^data:image\/(?:webp|png|jpe?g|gif|avif);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * `PUT /api/avatar` — foto de perfil.
 *
 * Rota própria, fora de `PUT /api/data`, de propósito: a foto é atributo de
 * conta (como `name`), não parte do documento sincronizado com o
 * `localStorage`.
 */
async function putAvatar(ctx: Ctx): Promise<Result> {
  const user = await requireUser(ctx);
  const body = asObject(ctx.body);
  const raw = body.avatar;

  let valor: string | null = null;
  if (raw !== null && raw !== undefined) {
    if (typeof raw !== 'string') throw new HttpError(400, 'Foto inválida.');
    if (!AVATAR_RE.test(raw)) {
      throw new HttpError(400, 'Envie uma imagem em data URL base64 (data:image/…;base64,…).');
    }
    if (raw.length > MAX_AVATAR_CHARS) {
      throw new HttpError(413, 'Imagem muito grande — reduza para menos de 64 KB.');
    }
    valor = raw;
  }

  await ensureSchema();
  await sql().query('update users set avatar = $1 where id = $2', [valor, user.id]);
  return ok({ user: { ...user, avatar: valor } });
}

/* ─── tabela de rotas ────────────────────────────────────────────────────── */

const ROUTES: Record<string, Handler> = {
  'POST /api/auth/signup': signup,
  'POST /api/auth/login': login,
  'POST /api/auth/logout': logout,
  'GET /api/auth/me': me,
  'GET /api/data': getData,
  'PUT /api/data': putData,
  // `navigator.sendBeacon` só sabe mandar POST — é a rota de despedida quando
  // a aba vai fechar com dados sujos (ver `lib/sync.ts` → `flushAntesDeSair`)
  'POST /api/data': putData,
  'PUT /api/avatar': putAvatar,
};

export function match(method: string, pathname: string): Handler | null {
  return ROUTES[`${method.toUpperCase()} ${pathname}`] ?? null;
}
