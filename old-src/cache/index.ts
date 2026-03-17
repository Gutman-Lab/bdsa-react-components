/**
 * Cache implementations for annotation documents
 * 
 * Provides different caching strategies:
 * - MemoryAnnotationCache: Fast in-memory cache (cleared on refresh)
 * - IndexedDBAnnotationCache: Persistent cache using IndexedDB (handles large documents, 50MB+)
 *   Best for production use. Browser automatically handles quota expansion when needed.
 * 
 * Future implementations:
 * - RedisAnnotationCache: Server-side Redis cache
 * - PostgresAnnotationCache: Server-side PostgreSQL cache with pgvector
 */

export type { AnnotationCache } from './AnnotationCache'
export { MemoryAnnotationCache } from './MemoryAnnotationCache'
export { IndexedDBAnnotationCache } from './IndexedDBAnnotationCache'
export { computeHash, computeVersionHash, extractVersionFields } from './hashUtils'
export { measureAnnotationSizes, printSizeSummary } from './measureAnnotationSize'
export { CacheSizeTester } from './CacheSizeTester'
export { checkIndexedDBQuota, requestPersistentStorage, logQuotaInfo, formatBytes } from './indexedDBQuota'

