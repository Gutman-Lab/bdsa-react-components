import { AnnotationCache } from './AnnotationCache';

/**
 * In-memory JavaScript-only cache for annotation documents
 *
 * This cache stores annotation documents in a Map and provides
 * optional TTL (time-to-live) support and basic statistics.
 *
 * Note: This cache is cleared when the page is refreshed or the app restarts.
 * For persistence across refreshes, use IndexedDBAnnotationCache instead.
 */
export declare class MemoryAnnotationCache implements AnnotationCache {
    private cache;
    private hits;
    private misses;
    private maxSize?;
    /**
     * @param options Configuration options
     * @param options.maxSize Maximum number of items to cache (default: unlimited)
     * @param options.defaultTTL Default time-to-live in milliseconds (optional)
     */
    constructor(options?: {
        maxSize?: number;
        defaultTTL?: number;
    });
    /**
     * Normalize annotation ID to string for consistent key matching
     */
    private normalizeId;
    /**
     * Check if a cached item has expired
     */
    private isExpired;
    /**
     * Evict oldest items if cache exceeds maxSize (LRU-like, but simple FIFO)
     */
    private evictIfNeeded;
    get(annotationId: string | number, versionHash?: string): Promise<unknown | null>;
    set(annotationId: string | number, data: unknown, options?: {
        ttl?: number;
        versionHash?: string;
    }): Promise<void>;
    has(annotationId: string | number, versionHash?: string): Promise<boolean>;
    delete(annotationId: string | number): Promise<void>;
    clear(): Promise<void>;
    getStats(): Promise<{
        size: number;
        hits: number;
        misses: number;
        hitRate: number;
    }>;
}
//# sourceMappingURL=MemoryAnnotationCache.d.ts.map