import type { AnnotationCache } from './AnnotationCache'

/**
 * IndexedDB-based annotation cache implementation.
 * Persists across page refreshes and handles large documents (50MB+ storage).
 * Best for production use with large annotation documents.
 */

const DB_NAME = 'bdsa-annotation-cache'
const STORE_NAME = 'annotations'
const DB_VERSION = 1

interface CacheEntry {
    data: unknown
    timestamp: number
    expiresAt?: number
    versionHash?: string
}

export class IndexedDBAnnotationCache implements AnnotationCache {
    private db: IDBDatabase | null = null
    private initPromise: Promise<void> | null = null

    private async init(): Promise<void> {
        if (this.db) {
            return
        }

        if (this.initPromise) {
            return this.initPromise
        }

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)

            request.onerror = () => {
                reject(new Error(`Failed to open IndexedDB: ${request.error}`))
            }

            request.onsuccess = () => {
                this.db = request.result
                resolve()
            }

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
                    // Create index for expiration cleanup
                    store.createIndex('expiresAt', 'expiresAt', { unique: false })
                }
            }
        })

        return this.initPromise
    }

    private async getStore(mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
        await this.init()
        if (!this.db) {
            throw new Error('IndexedDB not initialized')
        }
        const transaction = this.db.transaction([STORE_NAME], mode)
        return transaction.objectStore(STORE_NAME)
    }

    async get(
        annotationId: string | number,
        versionHash?: string
    ): Promise<unknown | undefined> {
        await this.init()
        const key = String(annotationId)
        const store = await this.getStore()

        return new Promise((resolve, reject) => {
            const request = store.get(key)

            request.onerror = () => {
                reject(new Error(`Failed to get from cache: ${request.error}`))
            }

            request.onsuccess = () => {
                const result = request.result as (CacheEntry & { id: string }) | undefined

                if (!result) {
                    resolve(undefined)
                    return
                }

                // Check expiration
                if (result.expiresAt && result.expiresAt < Date.now()) {
                    // Delete expired entry and return undefined
                    this.delete(annotationId).catch(console.error)
                    resolve(undefined)
                    return
                }

                // Check version hash if provided
                if (versionHash !== undefined && result.versionHash !== versionHash) {
                    // Cache entry is stale, remove it and return undefined
                    this.delete(annotationId).catch(console.error)
                    resolve(undefined)
                    return
                }

                resolve(result.data)
            }
        })
    }

    async set(
        annotationId: string | number,
        data: unknown,
        options?: { ttl?: number; versionHash?: string }
    ): Promise<void> {
        await this.init()
        const key = String(annotationId)
        const store = await this.getStore('readwrite')

        const entry: CacheEntry & { id: string } = {
            id: key,
            data,
            timestamp: Date.now(),
            expiresAt: options?.ttl ? Date.now() + options.ttl : undefined,
            versionHash: options?.versionHash,
        }

        return new Promise((resolve, reject) => {
            const request = store.put(entry)

            request.onerror = () => {
                reject(new Error(`Failed to set cache entry: ${request.error}`))
            }

            request.onsuccess = () => {
                resolve()
            }
        })
    }

    async has(annotationId: string | number, versionHash?: string): Promise<boolean> {
        await this.init()
        const key = String(annotationId)
        const store = await this.getStore()

        return new Promise((resolve, reject) => {
            const request = store.get(key)

            request.onerror = () => {
                reject(new Error(`Failed to check cache: ${request.error}`))
            }

            request.onsuccess = () => {
                const result = request.result as (CacheEntry & { id: string }) | undefined

                if (!result) {
                    resolve(false)
                    return
                }

                // Check expiration
                if (result.expiresAt && result.expiresAt < Date.now()) {
                    this.delete(annotationId).catch(console.error)
                    resolve(false)
                    return
                }

                // Check version hash if provided
                if (versionHash !== undefined && result.versionHash !== versionHash) {
                    resolve(false)
                    return
                }

                resolve(true)
            }
        })
    }

    async delete(annotationId: string | number): Promise<void> {
        await this.init()
        const key = String(annotationId)
        const store = await this.getStore('readwrite')

        return new Promise((resolve, reject) => {
            const request = store.delete(key)

            request.onerror = () => {
                reject(new Error(`Failed to delete cache entry: ${request.error}`))
            }

            request.onsuccess = () => {
                resolve()
            }
        })
    }

    async clear(): Promise<void> {
        await this.init()
        const store = await this.getStore('readwrite')

        return new Promise((resolve, reject) => {
            const request = store.clear()

            request.onerror = () => {
                reject(new Error(`Failed to clear cache: ${request.error}`))
            }

            request.onsuccess = () => {
                resolve()
            }
        })
    }

    async getStats(): Promise<{ size: number; count: number }> {
        await this.init()
        const store = await this.getStore()

        return new Promise((resolve, reject) => {
            const request = store.count()

            request.onerror = () => {
                reject(new Error(`Failed to get cache stats: ${request.error}`))
            }

            request.onsuccess = () => {
                resolve({
                    size: request.result,
                    count: request.result,
                })
            }
        })
    }
}

