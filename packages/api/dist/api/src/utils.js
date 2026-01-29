/**
 * Recursively strip keys with null values from an object.
 * JSON Schemas define optional fields as their base type (e.g. "string")
 * without allowing null, so we omit null-valued keys entirely.
 */
export function stripNulls(obj) {
    if (obj === null || obj === undefined)
        return obj;
    if (Array.isArray(obj)) {
        return obj.map(stripNulls);
    }
    if (typeof obj === "object") {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== null) {
                result[key] = typeof value === "object" ? stripNulls(value) : value;
            }
        }
        return result;
    }
    return obj;
}
//# sourceMappingURL=utils.js.map