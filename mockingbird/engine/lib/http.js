import { sleep } from './util.js';

export class HttpError extends Error {
  constructor(message, { status, url, body, retryAfterMs } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.body = body;
    this.retryAfterMs = retryAfterMs;
  }
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

function retryAfterMs(res) {
  const header = res.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

/**
 * fetch() with a timeout, retries on 429/5xx/network errors (exponential
 * backoff with jitter, honoring Retry-After), and JSON helpers.
 *
 * Returns the Response for 2xx. Throws HttpError otherwise.
 */
export async function request(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    json,
    body,
    timeoutMs = 30_000,
    retries = 3,
    fetch: fetchImpl = globalThis.fetch,
  } = options;

  const init = { method, headers: { ...headers } };
  if (json !== undefined) {
    init.body = JSON.stringify(json);
    init.headers['content-type'] ??= 'application/json';
  } else if (body !== undefined) {
    init.body = body;
  }

  let attempt = 0;
  for (;;) {
    let res;
    try {
      res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      if (attempt >= retries) {
        throw new HttpError(`Request to ${new URL(url).host} failed: ${err.cause?.code ?? err.message}`, { url });
      }
      await sleep(backoff(attempt++));
      continue;
    }
    if (res.ok) return res;

    const text = await res.text().catch(() => '');
    const wait = retryAfterMs(res);
    if (RETRYABLE.has(res.status) && attempt < retries) {
      await sleep(Math.min(wait ?? backoff(attempt), 60_000));
      attempt++;
      continue;
    }
    throw new HttpError(`${method} ${new URL(url).host}${new URL(url).pathname} -> ${res.status}: ${text.slice(0, 300)}`, {
      status: res.status,
      url,
      body: text,
      retryAfterMs: wait,
    });
  }
}

export async function requestJson(url, options) {
  const res = await request(url, options);
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(`Expected JSON from ${new URL(url).host}, got: ${text.slice(0, 200)}`, { url, status: res.status });
  }
}

function backoff(attempt) {
  return Math.min(30_000, 1000 * 2 ** attempt) * (0.75 + Math.random() * 0.5);
}
