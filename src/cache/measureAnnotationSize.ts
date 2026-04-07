/**
 * Utility to measure annotation document sizes for cache planning.
 * This helps determine if IndexedDB storage limits will be sufficient.
 */

export interface SizeMeasurement {
    annotationId: string | number
    jsonStringSize: number
    jsonStringSizeMB: number
    estimatedIndexedDBSize: number
    estimatedIndexedDBSizeMB: number
    compressedSize?: number
    compressedSizeMB?: number
    compressionRatio?: number
}

/**
 * Measure the size of annotation documents.
 * @param apiBaseUrl - Base URL for the DSA API
 * @param imageId - Image ID to fetch annotations for
 * @returns Array of size measurements for each annotation document
 */
export async function measureAnnotationSizes(
    apiBaseUrl: string,
    imageId: string | number
): Promise<SizeMeasurement[]> {
    const measurements: SizeMeasurement[] = []

    try {
        // Step 1: Fetch annotation headers (search endpoint)
        const searchUrl = `${apiBaseUrl}/annotation?itemId=${imageId}&limit=100`
        console.log('Fetching annotation headers from:', searchUrl)
        
        const searchResponse = await fetch(searchUrl)
        if (!searchResponse.ok) {
            throw new Error(`Failed to fetch annotations: ${searchResponse.statusText}`)
        }

        const annotations = await searchResponse.json()
        const annotationList = Array.isArray(annotations) ? annotations : annotations.annotations || []

        console.log(`Found ${annotationList.length} annotation(s)`)

        // Step 2: Fetch each full annotation document and measure
        for (const annotationHeader of annotationList) {
            const annotationId = annotationHeader._id
            if (!annotationId) continue

            try {
                const annotationUrl = `${apiBaseUrl}/annotation/${annotationId}`
                console.log(`Fetching full annotation document: ${annotationId}`)
                
                const annotationResponse = await fetch(annotationUrl)
                if (!annotationResponse.ok) {
                    console.warn(`Failed to fetch annotation ${annotationId}: ${annotationResponse.statusText}`)
                    continue
                }

                const annotationDoc = await annotationResponse.json()
                const jsonString = JSON.stringify(annotationDoc)
                const jsonStringSize = new Blob([jsonString]).size
                const jsonStringSizeMB = jsonStringSize / (1024 * 1024)

                // Estimate IndexedDB size (typically ~10-20% overhead)
                const estimatedIndexedDBSize = jsonStringSize * 1.15 // 15% overhead
                const estimatedIndexedDBSizeMB = estimatedIndexedDBSize / (1024 * 1024)

                // Try compression if available
                let compressedSize: number | undefined
                let compressedSizeMB: number | undefined
                let compressionRatio: number | undefined

                if (typeof CompressionStream !== 'undefined') {
                    try {
                        const stream = new Blob([jsonString]).stream().pipeThrough(
                            new CompressionStream('gzip')
                        )
                        const compressedBlob = await new Response(stream).blob()
                        compressedSize = compressedBlob.size
                        compressedSizeMB = compressedSize / (1024 * 1024)
                        compressionRatio = compressedSize / jsonStringSize
                    } catch (compressionError) {
                        console.warn(`Compression failed for ${annotationId}:`, compressionError)
                    }
                }

                measurements.push({
                    annotationId,
                    jsonStringSize,
                    jsonStringSizeMB,
                    estimatedIndexedDBSize,
                    estimatedIndexedDBSizeMB,
                    compressedSize,
                    compressedSizeMB,
                    compressionRatio,
                })

                console.log(`✓ Annotation ${annotationId}:`, {
                    raw: `${jsonStringSizeMB.toFixed(2)} MB`,
                    indexedDB: `${estimatedIndexedDBSizeMB.toFixed(2)} MB`,
                    compressed: compressedSizeMB ? `${compressedSizeMB.toFixed(2)} MB (${(compressionRatio! * 100).toFixed(1)}%)` : 'N/A',
                })
            } catch (error) {
                console.error(`Error measuring annotation ${annotationId}:`, error)
            }
        }
    } catch (error) {
        console.error('Error measuring annotation sizes:', error)
        throw error
    }

    return measurements
}

/**
 * Print a summary of annotation sizes.
 */
export function printSizeSummary(measurements: SizeMeasurement[]): void {
    const totalRaw = measurements.reduce((sum, m) => sum + m.jsonStringSize, 0)
    const totalRawMB = totalRaw / (1024 * 1024)
    
    const totalIndexedDB = measurements.reduce((sum, m) => sum + m.estimatedIndexedDBSize, 0)
    const totalIndexedDBMB = totalIndexedDB / (1024 * 1024)

    const totalCompressed = measurements
        .filter(m => m.compressedSize !== undefined)
        .reduce((sum, m) => sum + (m.compressedSize || 0), 0)
    const totalCompressedMB = totalCompressed / (1024 * 1024)

    console.log('\n=== SIZE SUMMARY ===')
    console.log(`Total annotations: ${measurements.length}`)
    console.log(`Total raw JSON size: ${totalRawMB.toFixed(2)} MB`)
    console.log(`Total estimated IndexedDB size: ${totalIndexedDBMB.toFixed(2)} MB`)
    
    if (totalCompressed > 0) {
        const compressionRatio = totalCompressed / totalRaw
        console.log(`Total compressed size: ${totalCompressedMB.toFixed(2)} MB (${(compressionRatio * 100).toFixed(1)}% of original)`)
    }
    
    console.log(`\nIndexedDB typical limit: 50MB+ (expandable with permission)`)
    console.log(`localStorage typical limit: 5-10MB`)
    
    if (totalIndexedDBMB > 5) {
        console.log(`⚠️  WARNING: Total size (${totalIndexedDBMB.toFixed(2)} MB) exceeds localStorage limit`)
        console.log(`   → Use IndexedDBAnnotationCache for large annotation documents`)
    }
    
    if (totalIndexedDBMB > 50) {
        console.log(`⚠️  WARNING: Total size (${totalIndexedDBMB.toFixed(2)} MB) may require IndexedDB quota expansion`)
    } else {
        console.log(`✓ Total size (${totalIndexedDBMB.toFixed(2)} MB) is well within IndexedDB limits`)
    }
}

