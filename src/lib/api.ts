import { clearTokens, getLeadToken, getModToken } from './auth';

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ApiFetchOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  lead?: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

function baseUrl(): string {
  const u = import.meta.env.VITE_WORKER_URL;
  if (!u) throw new ApiError('VITE_WORKER_URL not configured', 0);
  return u.replace(/\/$/, '');
}

export async function apiFetch<T>(path: string, opts: ApiFetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = opts.lead ? getLeadToken() : getModToken();
  if (!token) throw new ApiError('no_token', 401);
  headers[opts.lead ? 'x-lead-token' : 'x-mod-token'] = token;

  const res = await fetch(baseUrl() + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    clearTokens();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiError('unauthorized', 401);
  }

  let json: ApiEnvelope<T>;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(`bad_response (${res.status})`, res.status);
  }

  if (!json.ok) throw new ApiError(json.error ?? 'api_error', res.status);
  return json.data as T;
}
