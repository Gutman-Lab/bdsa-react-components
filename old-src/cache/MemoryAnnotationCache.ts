import type { AnnotationCache } from './AnnotationCache'

/**
 * In-memory JavaScript-only cache for annotation documents
 * 
 * This cache stores annotation documents in a Map and provides
 * optional TTL (time-to-live) support and basic statistics.
 * 
 * Note: This cache is cleared when the page is refreshed or the app restarts.
 * For persistence across refreshes, use IndexedDBAnnotationCache instead.
 */
export class MemoryAnnotationCache implements AnnotationCache {
    private cache: Map<string, { data: unknown; expiresAt?: number; versionHash?: string }>
    private hits: number = 0
    private misses: number = 0
    private maxSize?: number

    /**
     * @param options Configuration options
     * @param options.maxSize Maximum number of items to cache (default: unlimited)
     * @param options.defaultTTL Default time-to-live in milliseconds (optional)
     */
    constructor(options?: { maxSize?: number; defaultTTL?: number }) {
        this.cache = new Map()
        this.maxSize = options?.maxSize
    }

    /**
     * Normalize annotation ID to string for consistent key matching
     */
    private normalizeId(id: string | number): string {
        return String(id)
    }

    /**
     * Check if a cached item has expired
     */
    private isExpired(key: string): boolean {
        const item = this.cache.get(key)
        if (!item) return true
        if (item.expiresAt && item.expiresAt < Date.now()) {
            // Remove expired item
            this.cache.delete(key)
            return true
        }
        return false
    }

    /**
     * Evict oldest items if cache exceeds maxSize (LRU-like, but simple FIFO)
     */
    private evictIfNeeded(): void {
        if (this.maxSize && this.cache.size >= this.maxSize) {
            // Remove first (oldest) entry
            const firstKey = this.cache.keys().next().value
            if (firstKey) {
                this.cache.delete(firstKey)
            }
        }
    }

    async get(annotationId: string | number, versionHash?: string): Promise<unknown | null> {
        const key = this.normalizeId(annotationId)
        
        if (!this.cache.has(key) || this.isExpired(key)) {
            this.misses++
            return null
        }

        const item = this.cache.get(key)
        if (!item) {
            this.misses++
            return null
        }

        // Check version hash if provided
        if (versionHash !== undefined && item.versionHash !== versionHash) {
            // Version mismatch - cache is stale, remove it
            this.cache.delete(key)
            this.misses++
            return null
        }

        this.hits++
        return item.data
    }

    async set(
        annotationId: string | number,
        data: unknown,
        options?: { ttl?: number; versionHash?: string }
    ): Promise<void> {
        const key = this.normalizeId(annotationId)
        
        // Calculate expiration time if TTL is provided
        const expiresAt = options?.ttl ? Date.now() + options.ttl : undefined

        // Evict if needed before adding
        this.evictIfNeeded()

        this.cache.set(key, { data, expiresAt, versionHash: options?.versionHash })
    }

    async has(annotationId: string | number, versionHash?: string): Promise<boolean> {
        const key = this.normalizeId(annotationId)
        if (!this.cache.has(key) || this.isExpired(key)) {
            return false
        }
        
        const item = this.cache.get(key)
        if (!item) {
            return false
        }
        
        // Check version hash if provided
        if (versionHash !== undefined && item.versionHash !== versionHash) {
            // Version mismatch - cache is stale
            return false
        }
        
        return true
    }

    async delete(annotationId: string | number): Promise<void> {
        const key = this.normalizeId(annotationId)
        this.cache.delete(key)
    }

    async clear(): Promise<void> {
        this.cache.clear()
        this.hits = 0
        this.misses = 0
    }

    async getStats(): Promise<{
        size: number
        hits: number
        misses: number
        hitRate: number
    }> {
        const total = this.hits + this.misses
        const hitRate = total > 0 ? this.hits / total : 0

        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate,
        }
    }
}

