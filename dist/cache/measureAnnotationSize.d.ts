/**
 * Utility to measure annotation document sizes for cache planning.
 * This helps determine if IndexedDB storage limits will be sufficient.
 */
export interface SizeMeasurement {
    annotationId: string | number;
    jsonStringSize: number;
    jsonStringSizeMB: number;
    estimatedIndexedDBSize: number;
    estimatedIndexedDBSizeMB: number;
    compressedSize?: number;
    compressedSizeMB?: number;
    compressionRatio?: number;
}
/**
 * Measure the size of annotation documents.
 * @param apiBaseUrl - Base URL for the DSA API
 * @param imageId - Image ID to fetch annotations for
 * @returns Array of size measurements for each annotation document
 */
export declare function measureAnnotationSizes(apiBaseUrl: string, imageId: string | number): Promise<SizeMeasurement[]>;
/**
 * Print a summary of annotation sizes.
 */
export declare function printSizeSummary(measurements: SizeMeasurement[]): void;
//# sourceMappingURL=measureAnnotationSize.d.ts.map