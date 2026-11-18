// Central HTTP client for the Lamma API (API-DESIGN §2–§6).
// - Same-origin requests with cookies (Identity cookie auth, D-077).
// - Every unsafe request carries the antiforgery token as X-XSRF-TOKEN; the token is fetched lazily,
//   cached, and re-fetched once automatically if the server reports `security.csrf`.
// - Errors are RFC 9457 ProblemDetails, surfaced as a typed ApiError with field errors.

export const API_BASE = "/api/v1";

export interface ProblemBody {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly traceId?: string;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string[]> = {}, traceId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.traceId = traceId;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** First message for a camelCase field key, if any. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }
}

export const GENERIC_ERROR = "صار خطأ غير متوقع. جرّب كمان مرة بعد شوي.";
export const NETWORK_ERROR = "النت مقطوع أو السيرفر مش متاح. تأكد من الاتصال وجرّب كمان مرة.";

export interface RequestOptions {
  signal?: AbortSignal;
  /** Sent as Idempotency-Key for operations that must not be applied twice (Phase 5+). */
  idempotencyKey?: string;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

let csrfToken: string | null = null;
let csrfInFlight: Promise<string> | null = null;
let unauthorizedHandler: (() => void) | null = null;

/** Antiforgery tokens are bound to the signed-in identity: reset after sign-up, login and logout. */
export function resetCsrfToken(): void {
  csrfToken = null;
  csrfInFlight = null;
}

/** Called when the session is gone (401 auth.unauthenticated), so the app can return to login. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function fetchCsrfToken(): Promise<string> {
  const response = await safeFetch(apiUrl("/auth/antiforgery"), { method: "GET", headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw await toApiError(response);
  }

  const body = (await response.json()) as { token: string };
  return body.token;
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  csrfInFlight ??= fetchCsrfToken()
    .then((token) => {
      csrfToken = token;
      return token;
    })
    .finally(() => {
      csrfInFlight = null;
    });
  return csrfInFlight;
}

/** Absolute same-origin URL (identical to a relative URL in the browser; required by fetch outside it). */
function apiUrl(path: string): string {
  return new URL(`${API_BASE}${path}`, window.location.origin).toString();
}

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { credentials: "same-origin", ...init });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(0, "network.offline", NETWORK_ERROR);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemBody;
  try {
    const text = await response.text();
    problem = text ? (JSON.parse(text) as ProblemBody) : {};
  } catch {
    problem = {};
  }

  return new ApiError(
    response.status,
    problem.code ?? `http.${response.status}`,
    problem.detail ?? GENERIC_ERROR,
    problem.errors ?? {},
    problem.traceId,
  );
}

export async function apiRequest<T>(method: HttpMethod, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const unsafe = method !== "GET";

  const send = async (allowCsrfRetry: boolean): Promise<T> => {
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined && !isForm) {
      headers["Content-Type"] = "application/json"; // multipart sets its own boundary header
    }

    if (unsafe) {
      headers["X-XSRF-TOKEN"] = await getCsrfToken();
    }

    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    const response = await safeFetch(apiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal: options.signal,
    });

    if (response.ok) {
      if (response.status === 204 || response.status === 202) {
        return undefined as T;
      }

      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }

    const error = await toApiError(response);
    if (unsafe && allowCsrfRetry && error.code === "security.csrf") {
      resetCsrfToken();
      return send(false);
    }

    if (error.status === 401 && error.code === "auth.unauthenticated") {
      unauthorizedHandler?.();
    }

    throw error;
  };

  return send(true);
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => apiRequest<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => apiRequest<T>("PUT", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) => apiRequest<T>("DELETE", path, undefined, options),
  /** Multipart PUT (e.g. a product image). */
  upload: <T>(path: string, form: FormData, options?: RequestOptions) => apiRequest<T>("PUT", path, form, options),
};

/** Turns any thrown value into a user-safe Arabic message. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return GENERIC_ERROR;
}
