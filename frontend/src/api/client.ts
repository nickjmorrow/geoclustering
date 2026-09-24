/**
 * The HTTP boundary. Every request goes through `apiFetch`, which knows the
 * two things no caller should have to: a non-2xx status is an error rather
 * than a value, and the API describes errors as RFC 9457 problem details —
 * `{ title, detail, status }` — whose `detail` is written to be shown.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The request never produced an answer: no connection, no response in time,
 * or a body that was not what the server sends. Distinct from `ApiError` so
 * the query client can retry these and not a 4xx.
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Clustering 500 places takes well under a second; this only has to catch a
// server that has stopped answering.
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * What to say for an error with no message of its own — a proxy's 502 while
 * the API restarts, say. Not `response.statusText`, which HTTP/2 leaves empty.
 */
function statusMessage(status: number): string {
  if (status === 413) return 'That file is too large. The limit is 5 MB.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if ([502, 503, 504].includes(status)) {
    return 'The server is unavailable right now. Try again in a moment.';
  }
  if (status >= 500) return 'The server ran into a problem. Try again in a moment.';
  if (status === 404) return 'Not found.';
  return `The request failed (HTTP ${String(status)}).`;
}

export async function errorDetail(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const detail = (body as null | { detail?: unknown })?.detail;
  return typeof detail === 'string' && detail !== '' ? detail : statusMessage(response.status);
}

function asNetworkError(caught: unknown, callerSignal: AbortSignal | undefined): unknown {
  // An abort the caller asked for is a component unmounting, not a failure.
  if (callerSignal?.aborted === true) return caught;
  if (caught instanceof DOMException && caught.name === 'TimeoutError') {
    return new NetworkError('The server took too long to respond. Try again in a moment.');
  }
  if (caught instanceof SyntaxError) {
    return new NetworkError("The server sent a response this app couldn't read.");
  }
  return new NetworkError("Couldn't reach the server. Check your connection and try again.");
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const callerSignal = init.signal ?? undefined;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(path, { ...init, signal });
  } catch (caught) {
    throw asNetworkError(caught, callerSignal);
  }

  if (!response.ok) throw new ApiError(await errorDetail(response), response.status);

  try {
    return (await response.json()) as T;
  } catch (caught) {
    throw asNetworkError(caught, callerSignal);
  }
}

/** The message to show for a caught error, whatever threw it. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message;
  return 'Something went wrong. Try again.';
}
