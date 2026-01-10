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
    quota: number;
    /** Estimated storage usage in bytes */
    usage: number;
    /** Estimated available storage in bytes */
    available: number;
    /** Storage usage as percentage (0-100) */
    usagePercent: number;
    /** Whether persistent storage is granted */
    persistent: boolean;
}
/**
 * Check IndexedDB quota and usage for the current origin.
 * @returns Promise resolving to quota information, or null if quota API is not available
 */
export declare function checkIndexedDBQuota(): Promise<QuotaInfo | null>;
/**
 * Request persistent storage permission from the user.
 * This prevents the browser from automatically clearing stored data during cleanup.
 *
 * Note: The browser may show a permission prompt to the user.
 *
 * @returns Promise resolving to true if persistent storage is granted, false otherwise
 */
export declare function requestPersistentStorage(): Promise<boolean>;
/**
 * Format bytes to human-readable string.
 */
export declare function formatBytes(bytes: number): string;
/**
 * Log quota information to the console in a readable format.
 */
export declare function logQuotaInfo(): Promise<void>;
//# sourceMappingURL=indexedDBQuota.d.ts.map