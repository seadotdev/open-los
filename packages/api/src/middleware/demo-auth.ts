import { createMiddleware } from "hono/factory";
import { createHmac } from "node:crypto";

export interface DemoToken {
  tenant_id: string;
  actor: string;
  created_at: number;
}

/** Per-tenant rate-limit tracking */
const rateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Returns true when the server is running in demo mode.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/**
 * Produce an HMAC-signed demo token string.
 *
 * Format: `demo_<base64url_payload>.<hex_signature>`
 */
function signToken(payload: DemoToken, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(encoded).digest("hex");
  return `demo_${encoded}.${sig}`;
}

/**
 * Verify an HMAC-signed demo token string and return the decoded payload,
 * or `null` when the token is malformed / signature is invalid.
 *
 * Note: expiry is checked separately by the middleware so callers can
 * distinguish "invalid" from "expired".
 */
function verifyToken(token: string, secret: string): DemoToken | null {
  // token arrives *without* the "Bearer " prefix but still has the "demo_" prefix
  if (!token.startsWith("demo_")) return null;

  const rest = token.slice(5); // strip "demo_"
  const dotIdx = rest.indexOf(".");
  if (dotIdx === -1) return null;

  const encoded = rest.slice(0, dotIdx);
  const sig = rest.slice(dotIdx + 1);

  // Recompute HMAC and compare in constant-ish time
  const expected = createHmac("sha256", secret).update(encoded).digest("hex");
  if (sig.length !== expected.length) return null;

  // Constant-time comparison (timingSafeEqual requires equal-length Buffers)
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return null;

  let mismatch = 0;
  for (let i = 0; i < sigBuf.length; i++) {
    mismatch |= sigBuf[i]! ^ expBuf[i]!;
  }
  if (mismatch !== 0) return null;

  try {
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    const payload: DemoToken = JSON.parse(json);
    if (!payload.tenant_id || !payload.actor || !payload.created_at) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Create a signed demo token for the given tenant and actor.
 */
export function createDemoToken(tenantId: string, actor: string): string {
  const secret = process.env.DEMO_SECRET || "demo-secret-change-me";
  const payload: DemoToken = {
    tenant_id: tenantId,
    actor,
    created_at: Date.now(),
  };
  return signToken(payload, secret);
}

/**
 * Hono middleware that authenticates demo-mode requests.
 *
 * - When `DEMO_MODE` is not `"true"`, the middleware is a pass-through.
 * - When no `Authorization` header (or one not prefixed with `Bearer demo_`)
 *   is present the request continues unauthenticated (so the provision
 *   endpoint remains reachable).
 * - Otherwise the token is verified, checked for expiry, and rate-limited.
 *   On success the decoded `X-Actor` and `X-Tenant-Id` headers are set for
 *   downstream handlers.
 */
export const demoAuth = createMiddleware(async (c, next) => {
  // If not in demo mode, skip entirely
  if (!isDemoMode()) {
    await next();
    return;
  }

  // Check for Authorization header
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer demo_")) {
    // No demo token — allow through (e.g. for /v1/demo/provision)
    await next();
    return;
  }

  const token = auth.slice(7); // Remove "Bearer "
  const secret = process.env.DEMO_SECRET || "demo-secret-change-me";
  const payload = verifyToken(token, secret);

  if (!payload) {
    return c.json(
      { error: { code: "INVALID_TOKEN", message: "Invalid or expired demo token" } },
      401,
    );
  }

  // Check token expiry
  const ttl = parseInt(process.env.DEMO_TENANT_TTL || "86400", 10) * 1000;
  if (Date.now() - payload.created_at > ttl) {
    return c.json(
      { error: { code: "TOKEN_EXPIRED", message: "Demo token expired" } },
      401,
    );
  }

  // Rate limiting: 100 requests per minute per tenant
  const now = Date.now();
  const limit = rateLimits.get(payload.tenant_id);
  if (limit && now < limit.resetAt) {
    if (limit.count >= 100) {
      return c.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Limit: 100/min" } },
        429,
      );
    }
    limit.count++;
  } else {
    rateLimits.set(payload.tenant_id, { count: 1, resetAt: now + 60_000 });
  }

  // Inject identity headers for downstream route handlers
  c.req.raw.headers.set("X-Actor", payload.actor);
  c.req.raw.headers.set("X-Tenant-Id", payload.tenant_id);

  await next();
});
