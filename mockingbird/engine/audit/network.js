// A "your site is down" email to a business whose site is fine is the worst
// possible first impression. Before auditing, make sure *we* can reach the
// internet; a dead connection or a blocking proxy would otherwise make every
// site look unreachable.

const PROBES = ['https://www.google.com/generate_204', 'https://www.cloudflare.com/cdn-cgi/trace'];

export async function checkConnectivity({ fetch = globalThis.fetch, timeoutMs = 8000 } = {}) {
  let reason = 'no response';
  for (const url of PROBES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      await res.body?.cancel().catch(() => {});
      if (res.status < 500) return { online: true };
      reason = `HTTP ${res.status} from ${new URL(url).host}`;
    } catch (err) {
      reason = err.cause?.code ?? err.cause?.message ?? err.message;
    }
  }
  return { online: false, reason };
}

const PLAIN = [
  [/ENOTFOUND|EAI_AGAIN/, 'Domain doesn’t resolve', 'the domain doesn’t point to a website anymore'],
  [/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH/, 'Server not responding', 'the server isn’t accepting connections'],
  [/TIMEOUT|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|HEADERS_TIMEOUT/, 'Timed out', 'it never finished loading'],
  [/HTTP 5\d\d/, 'Server error', 'it shows a server error page'],
  [/HTTP 404|HTTP 410/, 'Homepage missing', 'the homepage returns a “page not found” error'],
  [/HTTP 4\d\d/, 'Homepage blocked', 'the homepage returns an error instead of the site'],
];

/** A short label and a customer-facing phrase for why a site didn't load. */
export function describeFailure(error = '') {
  const hit = PLAIN.find(([re]) => re.test(error));
  return hit ? { title: hit[1], phrase: hit[2] } : { title: 'Site not loading', phrase: 'it didn’t load' };
}
