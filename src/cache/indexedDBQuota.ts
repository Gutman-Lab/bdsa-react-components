/**
 * IndexedDB quota management utilities.
 * 
 * IndexedDB storage limits are automatically managed by the browser:
 * - Initial quota: Typically 50MB+ (varies by browser and available disk space)
 * - Automatic expansion: Browser prompts user when quota is exceeded
 * - Persistent storage: Can request persistent storage (survives browser cleanup)
 * 
 * These utilities help check quota status and request persistent storage when needed.
 */

export interface QuotaInfo {
    /** Estimated storage quota in bytes */
    quota: number
    /** Estimated storage usage in bytes */
    usage: number
    /** Estimated available storage in bytes */
    available: number
    /** Storage usage as percentage (0-100) */
    usagePercent: number
    /** Whether persistent storage is granted */
    persistent: boolean
}

/**
 * Check IndexedDB quota and usage for the current origin.
 * @returns Promise resolving to quota information, or null if quota API is not available
 */
export async function checkIndexedDBQuota(): Promise<QuotaInfo | null> {
    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
        console.warn('Storage quota API not available in this browser')
        return null
    }

    try {
        const estimate = await navigator.storage.estimate()
        const quota = estimate.quota || 0
        const usage = estimate.usage || 0
        const available = quota - usage
        const usagePercent = quota > 0 ? (usage / quota) * 100 : 0

        // Check if persistent storage is granted
        let persistent = false
        if ('persisted' in navigator.storage && 'persist' in navigator.storage) {
            persistent = await navigator.storage.persisted()
        }

        return {
            quota,
            usage,
            available,
            usagePercent,
            persistent,
        }
    } catch (error) {
        console.error('Failed to check IndexedDB quota:', error)
        return null
    }
}

/**
 * Request persistent storage permission from the user.
 * This prevents the browser from automatically clearing stored data during cleanup.
 * 
 * Note: The browser may show a permission prompt to the user.
 * 
 * @returns Promise resolving to true if persistent storage is granted, false otherwise
 */
export async function requestPersistentStorage(): Promise<boolean> {
    if (!('storage' in navigator) || !('persist' in navigator.storage)) {
        console.warn('Persistent storage API not available in this browser')
        return false
    }

    try {
        const granted = await navigator.storage.persist()
        if (granted) {
            console.log('Persistent storage granted - data will not be cleared automatically')
        } else {
            console.warn('Persistent storage not granted - data may be cleared during browser cleanup')
        }
        return granted
    } catch (error) {
        console.error('Failed to request persistent storage:', error)
        return false
    }
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Log quota information to the console in a readable format.
 */
export async function logQuotaInfo(): Promise<void> {
    const info = await checkIndexedDBQuota()
    if (!info) {
        console.log('Quota information not available')
        return
    }

    console.log('=== IndexedDB Quota Information ===')
    console.log(`Quota: ${formatBytes(info.quota)}`)
    console.log(`Usage: ${formatBytes(info.usage)} (${info.usagePercent.toFixed(1)}%)`)
    console.log(`Available: ${formatBytes(info.available)}`)
    console.log(`Persistent storage: ${info.persistent ? 'Granted' : 'Not granted'}`)
    
    if (info.usagePercent > 80) {
        console.warn('⚠️  Storage usage is above 80% - consider requesting persistent storage')
    }
}

