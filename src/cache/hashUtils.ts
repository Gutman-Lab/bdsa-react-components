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
export function computeHash(data: unknown): string {
    // Convert to stable JSON string (sorted keys for consistency)
    const jsonString = JSON.stringify(data, Object.keys(data as Record<string, unknown>).sort())
    
    // Simple hash function (djb2 variant)
    let hash = 5381
    for (let i = 0; i < jsonString.length; i++) {
        hash = ((hash << 5) + hash) + jsonString.charCodeAt(i)
        hash = hash & hash // Convert to 32-bit integer
    }
    
    // Convert to positive hex string
    return (hash >>> 0).toString(16)
}

/**
 * Extract version-relevant fields from an annotation header document
 * These fields typically change when the annotation is modified
 * 
 * @param header The annotation header/metadata object from /annotation?itemId=...
 * @returns An object with fields that indicate version changes
 */
export function extractVersionFields(header: {
    _id?: string | number
    _modelType?: string
    _version?: number | string
    updated?: string | number
    modified?: string | number
    annotation?: {
        name?: string
        description?: string
        [key: string]: unknown
    }
    [key: string]: unknown
}): Record<string, unknown> {
    // Extract fields that indicate changes
    const versionFields: Record<string, unknown> = {}
    
    if (header._id !== undefined) versionFields._id = header._id
    if (header._version !== undefined) versionFields._version = header._version
    if (header._modelType !== undefined) versionFields._modelType = header._modelType
    
    // Timestamps that indicate modification
    if (header.updated !== undefined) versionFields.updated = header.updated
    if (header.modified !== undefined) versionFields.modified = header.modified
    
    // Common DSA fields that might indicate changes
    if (header._accessLevel !== undefined) versionFields._accessLevel = header._accessLevel
    
    // Include annotation metadata if present
    if (header.annotation && typeof header.annotation === 'object') {
        const ann = header.annotation as Record<string, unknown>
        if (ann.name !== undefined) versionFields.name = ann.name
        // Add other fields that might be version-relevant
    }
    
    return versionFields
}

/**
 * Compute version hash from an annotation header
 * This hash can be used to detect when an annotation document has changed
 * 
 * @param header The annotation header/metadata object
 * @returns A hex string hash representing the version
 */
export function computeVersionHash(header: {
    _id?: string | number
    _version?: number | string
    updated?: string | number
    modified?: string | number
    [key: string]: unknown
}): string {
    const versionFields = extractVersionFields(header)
    return computeHash(versionFields)
}

