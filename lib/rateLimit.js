// Simple in-memory sliding-window rate limiter.
//
// LIMITATION: this is an in-process Map. It works correctly ONLY as long as
// the app runs on a single Node.js instance (which is the case today: one
// supervisor-managed Next.js process). If we later scale horizontally (multi-
// pod, serverless functions with cold starts, etc.) each instance will have
// its own counters and the effective limit becomes N * max. In that scenario,
// replace this module with a distributed store (Redis / Upstash / Cloudflare
// Rate-Limit) — the API surface below (isAllowed) can stay identical so call
// sites won't need changes.

const buckets = new Map(); // key -> { count, resetAt }

// Best-effort cleanup so the map doesn't grow forever on a long-lived process.
let lastSweep = 0;
function sweep(now) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

/**
 * Check whether a call identified by `key` is allowed under the given quota.
 * Returns { allowed, remaining, retryAfterSec }.
 */
export function isAllowed(key, { max = 5, windowMs = 60_000 } = {}) {
  const now = Date.now();
  sweep(now);
  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(key, entry);
  }
  entry.count += 1;
  const remaining = Math.max(0, max - entry.count);
  const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    allowed: entry.count <= max,
    remaining,
    retryAfterSec,
  };
}

/**
 * Extract a stable client IP hint from Next.js Request headers. Falls back to
 * the string "unknown" if no forwarded header is available.
 */
export function getClientIp(request) {
  const xff = request.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0]?.trim();
  if (first) return first;
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
