/**
 * Recursively strip keys with null values from an object.
 * JSON Schemas define optional fields as their base type (e.g. "string")
 * without allowing null, so we omit null-valued keys entirely.
 */
export function stripNulls<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(stripNulls) as T;
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== null) {
        result[key] = typeof value === "object" ? stripNulls(value) : value;
      }
    }
    return result as T;
  }
  return obj;
}
