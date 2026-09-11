/**
 * The HTTP layer between this app and the Worksuite API.
 *
 * Three things live here and nowhere else: where the API is, how a request is
 * authenticated, and what happens when the access token expires. Everything
 * above this file calls `request()` and gets parsed JSON or a thrown
 * `ApiError` — it never sees a header, a token or a retry.
 */

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:3001/api/v1";

const ACCESS_KEY = "ws.access";
const REFRESH_KEY = "ws.refresh";

/* ---------------------------------------------------------------- tokens */

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private window or storage disabled — the session just won't survive a reload.
    return null;
  }
};

const write = (key: string, value: string | null) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};

export const tokens = {
  get access() {
    return read(ACCESS_KEY);
  },
  get refresh() {
    return read(REFRESH_KEY);
  },
  set(access: string | null, refresh?: string | null) {
    write(ACCESS_KEY, access);
    if (refresh !== undefined) write(REFRESH_KEY, refresh);
  },
  clear() {
    write(ACCESS_KEY, null);
    write(REFRESH_KEY, null);
  },
};

/* ---------------------------------------------------------------- errors */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: string[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiFailure = { status: number; message: string; details?: string[] };

const errorListeners = new Set<(e: ApiFailure) => void>();

/** The shell subscribes to this to show a toast. */
export const apiErrors = {
  subscribe(fn: (e: ApiFailure) => void) {
    errorListeners.add(fn);
    return () => {
      errorListeners.delete(fn);
    };
  },
};

export const announce = (failure: ApiFailure) => errorListeners.forEach((fn) => fn(failure));

/** Fired when the refresh token is gone or rejected and the user must sign in again. */
const signedOutListeners = new Set<() => void>();
export const onSignedOut = (fn: () => void) => {
  signedOutListeners.add(fn);
  return () => {
    signedOutListeners.delete(fn);
  };
};

/* --------------------------------------------------------------- refresh */

/**
 * One refresh at a time.
 *
 * A page load fires a dozen requests at once. If the access token has expired,
 * every one of them gets a 401 together — and because the server rotates
 * refresh tokens and treats a reused one as a stolen one, a dozen parallel
 * refreshes would revoke the whole session family. So the first 401 starts the
 * refresh and the rest await the same promise.
 */
let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const refreshToken = tokens.refresh;
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;

      const body = (await res.json()) as { accessToken: string; refreshToken: string };
      tokens.set(body.accessToken, body.refreshToken);
      return true;
    } catch {
      return false;
    }
  })();

  const ok = await refreshing;
  refreshing = null;
  if (!ok) {
    tokens.clear();
    signedOutListeners.forEach((fn) => fn());
  }
  return ok;
}

/* --------------------------------------------------------------- request */

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, unknown>;
  /** Skip the Authorization header — login and register. */
  anonymous?: boolean;
  signal?: AbortSignal;
  /** Suppress the error toast; the caller is handling the failure itself. */
  quiet?: boolean;
};

const buildUrl = (path: string, query?: Record<string, unknown>) => {
  const url = new URL(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
};

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, anonymous, signal, quiet } = options;

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (!anonymous && tokens.access) headers.authorization = `Bearer ${tokens.access}`;

    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };

  let res: Response;
  try {
    res = await send();
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    const failure = { status: 0, message: "Can't reach the server. Check your connection." };
    if (!quiet) announce(failure);
    throw new ApiError(0, failure.message, "NETWORK");
  }

  // Expired access token: refresh once, then replay the original request.
  if (res.status === 401 && !anonymous && tokens.refresh) {
    if (await refreshAccessToken()) {
      try {
        res = await send();
      } catch {
        throw new ApiError(0, "Can't reach the server.", "NETWORK");
      }
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const message =
      (payload as { message?: string })?.message ?? `Request failed (${res.status})`;
    const code = (payload as { code?: string })?.code;
    const details = (payload as { details?: string[] })?.details;

    // A 401 that survived the refresh means the session is genuinely over.
    if (res.status === 401 && !anonymous) {
      tokens.clear();
      signedOutListeners.forEach((fn) => fn());
    }
    if (!quiet) announce({ status: res.status, message, details });
    throw new ApiError(res.status, message, code, details);
  }

  return payload as T;
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 200) };
  }
};

/** The envelope every list endpoint returns. */
export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
};
