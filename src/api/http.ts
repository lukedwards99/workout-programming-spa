export interface ApiFailure {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export class ApiClientError extends Error {
  constructor(public status: number, public failure: ApiFailure) {
    super(failure.message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  }); } catch (error) {
    if (__HOSTED__) window.dispatchEvent(new Event('liftlog-session-lost'));
    throw error;
  }
  if (__HOSTED__ && (response.status === 401 || response.status === 403 || response.redirected || !response.headers.get('Content-Type')?.includes('application/json'))) {
    // Authorization failures with JSON still belong to the current screen.
    if (response.status !== 403 || !response.headers.get('Content-Type')?.includes('application/json')) {
      window.dispatchEvent(new Event('liftlog-session-lost'));
      throw new ApiClientError(401, { code: 'session_expired', message: 'Sign in again to continue.' });
    }
  }
  const payload = await response.json() as { data?: T; error?: ApiFailure };
  if (!response.ok || payload.error) {
    throw new ApiClientError(response.status, payload.error ?? { code: 'request_failed', message: 'The request failed.' });
  }
  return payload.data as T;
}

export const jsonBody = (value: unknown): Pick<RequestInit, 'body'> => ({ body: JSON.stringify(value) });
