// src/utils/api.ts

const SESSION_TOKEN_KEY = 'orbit_session_token';
const USER_ID_KEY = 'orbit_user_id';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string) {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {}
}

export function clearSessionToken() {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}

/**
 * Robust API fetch function that attaches Authorization and session headers,
 * supports credentials, and automatically saves session tokens upon login/init.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input && typeof input === 'object' && 'url' in input) {
    url = (input as Request).url;
  }

  const options: RequestInit = { ...init };
  options.credentials = options.credentials || 'include';

  const token = getSessionToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (token && !headers.has('x-orbit-session-token')) {
    headers.set('x-orbit-session-token', token);
  }
  options.headers = headers;

  // Use the native fetch directly
  const response = await window.fetch(input, options);

  // Handle session token auto-save on init / lookup
  if (
    response.ok &&
    (url.includes('/api/user/session/init') || url.includes('/api/user/session/lookup'))
  ) {
    try {
      const clone = response.clone();
      clone.json().then(data => {
        if (data?.sessionToken) {
          setSessionToken(data.sessionToken);
        }
        if (data?.userId) {
          try {
            localStorage.setItem(USER_ID_KEY, data.userId);
          } catch {}
        }
      }).catch(() => {});
    } catch {}
  }

  // If unauthorized, clear invalid session token
  if (response.status === 401) {
    clearSessionToken();
  }

  return response;
}

/**
 * Safe optional setup that will never throw if window.fetch has only a getter
 * or is configured non-writable by the browser environment.
 */
export function setupApiFetchInterceptor() {
  if (typeof window === 'undefined') return;

  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (descriptor && descriptor.writable === false && !descriptor.set) {
      // In this environment, window.fetch cannot be re-assigned.
      return;
    }

    try {
      Object.defineProperty(window, 'fetch', {
        value: function (input: RequestInfo | URL, init?: RequestInit) {
          return apiFetch(input, init);
        },
        writable: true,
        configurable: true,
      });
    } catch {
      // Fallback or ignore if environment restricts defining property
    }
  } catch {
    // Silently ignore any environment restrictions
  }
}

