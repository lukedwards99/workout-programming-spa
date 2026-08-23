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
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json() as { data?: T; error?: ApiFailure };
  if (!response.ok || payload.error) {
    throw new ApiClientError(response.status, payload.error ?? { code: 'request_failed', message: 'The request failed.' });
  }
  return payload.data as T;
}

export const jsonBody = (value: unknown): Pick<RequestInit, 'body'> => ({ body: JSON.stringify(value) });

