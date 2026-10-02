/**
 * Cliente da API da Sonata (auth + dados).
 *
 * `credentials: 'same-origin'` porque a sessão vive num cookie httpOnly —
 * o token nunca toca JavaScript de propósito: XSS não pode roubá-lo.
 */

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  /** Data URL da foto de perfil, ou `null` quando não há. */
  avatar?: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'GET',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor.');
  }

  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'erro' in body
        ? String((body as { erro: unknown }).erro)
        : 'Falha na requisição.';
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

export interface Credentials {
  email: string;
  password: string;
}

export const api = {
  me: () => request<{ user: ApiUser }>('/api/auth/me'),

  login: (c: Credentials) =>
    request<{ user: ApiUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(c) }),

  signup: (d: Credentials & { name: string }) =>
    request<{ user: ApiUser }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(d) }),

  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' }),

  getData: () => request<{ items: Record<string, unknown> }>('/api/data'),

  putData: (items: Record<string, unknown>) =>
    request<{ saved: number }>('/api/data', { method: 'PUT', body: JSON.stringify({ items }) }),

  /** `null` remove a foto. */
  putAvatar: (avatar: string | null) =>
    request<{ user: ApiUser }>('/api/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar }),
    }),
};
