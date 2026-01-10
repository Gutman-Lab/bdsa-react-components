/**
 * Cache interface for annotation documents
 * 
 * Different implementations can be provided:
 * - MemoryAnnotationCache: JavaScript-only in-memory cache
 * - RedisAnnotationCache: Redis-backed cache (future)
 * - PostgresAnnotationCache: PostgreSQL-backed cache (future)
 */
export interface AnnotationCache {
    /**
     * Get an annotation document from cache
     * @param annotationId The annotation document ID
     * @param versionHash Optional version hash to verify cache validity. If provided and doesn't match cached version, returns null.
     * @returns The cached annotation document, or null if not found or version mismatch
     */
    get(annotationId: string | number, versionHash?: string): Promise<unknown | null>

    /**
     * Store an annotation document in cache
     * @param annotationId The annotation document ID
     * @param data The annotation document data to cache
     * @param options Optional options including TTL and version hash
     */
    set(
        annotationId: string | number,
        data: unknown,
        options?: {
            ttl?: number
            versionHash?: string
        }
    ): Promise<void>

    /**
     * Check if an annotation document exists in cache
     * @param annotationId The annotation document ID
     * @param versionHash Optional version hash to verify cache validity
     * @returns true if the annotation is cached with matching version, false otherwise
     */
    has(annotationId: string | number, versionHash?: string): Promise<boolean>

    /**
     * Remove an annotation document from cache
     * @param annotationId The annotation document ID
     */
    delete(annotationId: string | number): Promise<void>

    /**
     * Clear all cached annotation documents
     */
    clear(): Promise<void>

    /**
     * Get cache statistics (optional, for monitoring)
     */
    getStats?(): Promise<{
        size: number
        hits?: number
        misses?: number
        hitRate?: number
    }>
}

