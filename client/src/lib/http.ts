export const UNAUTHORIZED_EVENT = 'betguess:unauthorized';
export const UPGRADE_NEEDED_EVENT = 'betguess:upgrade-needed';
export const RATE_LIMITED_EVENT = 'betguess:rate-limited';

type ErrorPayload = Record<string, unknown> & { error?: string };

export class HttpApiError extends Error {
  status: number;
  payload: ErrorPayload;

  constructor(message: string, status: number, payload: ErrorPayload = {}) {
    super(message);
    this.name = 'HttpApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function isHttpApiError(error: unknown): error is HttpApiError {
  return error instanceof HttpApiError;
}

function toErrorPayload(value: unknown, fallbackMessage: string): ErrorPayload {
  if (value && typeof value === 'object') {
    return value as ErrorPayload;
  }

  return { error: fallbackMessage };
}

let redirectScheduled = false;

export function notifyUnauthorized(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));

  if (window.location.pathname === '/login' || redirectScheduled) {
    return;
  }

  redirectScheduled = true;
  window.setTimeout(() => {
    window.location.assign('/login');
  }, 0);
}

export interface ApiFetchOptions {
  defaultError?: string;
  redirectOn401?: boolean;
}

export async function apiFetchJson<T>(
  url: string,
  options: RequestInit = {},
  fetchOptions: ApiFetchOptions = {},
): Promise<T> {
  const { defaultError = 'Baglanti hatasi', redirectOn401 = true } = fetchOptions;
  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? 'include',
    headers: {
      ...(!options.body || isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });

  const payload = toErrorPayload(
    await response.json().catch(() => ({ error: defaultError })),
    defaultError,
  );

  if (!response.ok) {
    if (response.status === 401 && redirectOn401) {
      notifyUnauthorized();
    }
    if (response.status === 403 && (payload as any).requiredTier) {
      window.dispatchEvent(new CustomEvent(UPGRADE_NEEDED_EVENT, { detail: payload }));
    }
    if (response.status === 429) {
      window.dispatchEvent(new CustomEvent(RATE_LIMITED_EVENT, { detail: payload }));
    }

    throw new HttpApiError(payload.error || `HTTP ${response.status}`, response.status, payload);
  }

  return payload as T;
}
