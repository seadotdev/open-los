import type { Context } from "hono";
import type { ErrorResponse } from "../types/common.js";

export function parsePagination(c: Context): { offset: number; limit: number } {
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;
  const rawLimit = parseInt(c.req.query("limit") ?? "50", 10);
  const limit = Math.min(Math.max(rawLimit, 1), 1000);
  return { offset, limit };
}

export function mambuError(
  code: number,
  source: string,
  reason: string
): ErrorResponse {
  return {
    errors: [{ errorCode: code, errorSource: source, errorReason: reason }],
  };
}
