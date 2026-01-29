/**
 * Recursively strip keys with null values from an object.
 * JSON Schemas define optional fields as their base type (e.g. "string")
 * without allowing null, so we omit null-valued keys entirely.
 */
export declare function stripNulls<T>(obj: T): T;
//# sourceMappingURL=utils.d.ts.map