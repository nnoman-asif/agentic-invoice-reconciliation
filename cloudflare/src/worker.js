/**
 * Reverse-proxy Worker: Firebase SPA -> Oracle VM :8000.
 *
 * Forwards CF-Connecting-IP so the API can key demo limits on the real
 * client when TRUST_PROXY_HEADER=true. Passes the request body through
 * (including multipart uploads) and lets FastAPI answer OPTIONS.
 */

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cf-connecting-ip",
  "cf-ray",
  "cdn-loop",
]);

export default {
  async fetch(request, env) {
    const origin = String(env.ORIGIN || "http://127.0.0.1:8000").replace(
      /\/$/,
      ""
    );
    const incoming = new URL(request.url);
    const target = origin + incoming.pathname + incoming.search;

    const headers = new Headers();
    for (const [key, value] of request.headers) {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    const clientIp = request.headers.get("CF-Connecting-IP");
    if (clientIp) {
      headers.set("CF-Connecting-IP", clientIp);
    }

    const init = { method: request.method, headers };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      // Required so multipart/POST bodies stream through instead of being
      // buffered and dropped.
      init.duplex = "half";
    }

    return fetch(target, init);
  },
};
