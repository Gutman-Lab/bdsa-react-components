/**
 * Utility functions for computing hashes of annotation metadata
 * Used for cache invalidation when annotation documents change on the server
 */
/**
 * Compute a simple hash of an object/string for version comparison
 * Uses a lightweight hash function (djb2-like) suitable for cache keys
 *
 * @param data The data to hash (object, string, or any JSON-serializable value)
 * @returns A hex string hash of the data
 */
export declare function computeHash(data: unknown): string;
/**
 * Extract version-relevant fields from an annotation header document
 * These fields typically change when the annotation is modified
 *
 * @param header The annotation header/metadata object from /annotation?itemId=...
 * @returns An object with fields that indicate version changes
 */
export declare function extractVersionFields(header: {
    _id?: string | number;
    _modelType?: string;
    _version?: number | string;
    updated?: string | number;
    modified?: string | number;
    annotation?: {
        name?: string;
        description?: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}): Record<string, unknown>;
/**
 * Compute version hash from an annotation header
 * This hash can be used to detect when an annotation document has changed
 *
 * @param header The annotation header/metadata object
 * @returns A hex string hash representing the version
 */
export declare function computeVersionHash(header: {
    _id?: string | number;
    _version?: number | string;
    updated?: string | number;
    modified?: string | number;
    [key: string]: unknown;
}): string;
//# sourceMappingURL=hashUtils.d.ts.map