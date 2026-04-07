import { useEffect, useState, useMemo } from 'react'
import type React from 'react'
import type { AnnotationFeature } from '../SlideViewer.types'
import { computeVersionHash, parseAnnotationDocument, filterAnnotationsByTotalPoints } from '../SlideViewer.utils'
import { createDebugLogger } from '../../../utils/debugLog'
import { handleApiError, type ApiErrorHandler } from '../../../utils/apiErrorHandling'

export interface UseAnnotationFetchingResult {
    fetchedAnnotations: AnnotationFeature[]
    annotationDocuments: Array<{
        id: string | number
        elementCount: number
        totalPoints: number
        types: string[]
        filteredCount?: number
        filteredPoints?: number
    }>
}

export function useAnnotationFetching(
    annotationIds: (string | number)[] | undefined,
    apiBaseUrl: string | undefined,
    defaultAnnotationColor: string,
    maxPointsPerAnnotation: number,
    maxTotalPoints: number,
    wrappedFetch: (url: string, options?: RequestInit) => Promise<Response>,
    cache: {
        get(annotationId: string | number, versionHash?: string): Promise<unknown | null>
        set(annotationId: string | number, data: unknown, options?: { ttl?: number; versionHash?: string }): Promise<void>
        delete(annotationId: string | number): Promise<void>
    } | null,
    annotationHeaders: Map<string | number, unknown> | Record<string, unknown> | undefined,
    apiHeaders: HeadersInit | undefined,
    isMountedRef: React.MutableRefObject<boolean>,
    debug: boolean,
    onApiError?: ApiErrorHandler
): UseAnnotationFetchingResult {
    const [fetchedAnnotations, setFetchedAnnotations] = useState<AnnotationFeature[]>([])
    const [annotationDocuments, setAnnotationDocuments] = useState<Array<{
        id: string | number
        elementCount: number
        totalPoints: number
        types: string[]
        filteredCount?: number
        filteredPoints?: number
    }>>([])

    const debugLog = useMemo(() => createDebugLogger('SlideViewer', debug), [debug])

    useEffect(() => {
        if (!isMountedRef.current) return
        // Early return if no annotationIds - don't set state unnecessarily
        if (!annotationIds || annotationIds.length === 0 || !apiBaseUrl) {
            // Only clear if we had annotations before (avoid creating new empty array reference)
            setFetchedAnnotations((prev) => {
                if (prev.length === 0) {
                    return prev // Return same reference to prevent re-render
                }
                return []
            })
            setAnnotationDocuments((prev) => {
                if (prev.length === 0) {
                    return prev // Return same reference to prevent re-render
                }
                return []
            })
            return
        }

        const fetchAnnotations = async () => {
            try {
                debugLog.log(`Fetching ${annotationIds.length} annotation(s) from DSA API...`)
                // Use wrapped fetch function (which handles token query param if needed)
                const customFetch = wrappedFetch

                // Fetch annotations from /annotation/{id} endpoint (not geojson)
                const annotationPromises = annotationIds.map(async (id) => {
                    // Get annotation header for version hash computation (if available)
                    const header = annotationHeaders
                        ? (annotationHeaders instanceof Map
                            ? annotationHeaders.get(id)
                            : annotationHeaders[String(id)])
                        : undefined

                    // Compute version hash from header if available
                    const versionHash = header ? computeVersionHash(header as Record<string, unknown>) : undefined

                    // Check cache first if available
                    if (cache) {
                        try {
                            const cached = await cache.get(id, versionHash)
                            if (cached !== null && cached !== undefined) {
                                // Validate cached data structure - must be an object with elements
                                const isValid = cached && typeof cached === 'object' && (
                                    (cached as any).elements ||
                                    (cached as any).annotation?.elements ||
                                    (cached as any).annotation?.elements === null || // Allow empty arrays
                                    Array.isArray((cached as any).annotation?.elements)
                                )

                                if (isValid) {
                                    debugLog.log(`Cache hit for annotation ${id}${versionHash ? ` (version hash: ${versionHash})` : ''}`, {
                                        hasElements: !!(cached as any)?.elements || !!(cached as any)?.annotation?.elements,
                                        elementCount: Array.isArray((cached as any)?.elements)
                                            ? (cached as any).elements.length
                                            : Array.isArray((cached as any)?.annotation?.elements)
                                                ? (cached as any).annotation.elements.length
                                                : 0
                                    })
                                    return cached
                                } else {
                                    // Invalid cached data - clear it and fetch fresh
                                    console.warn(`Invalid cached data format for annotation ${id}, clearing cache and fetching fresh...`, {
                                        type: typeof cached,
                                        keys: cached && typeof cached === 'object' ? Object.keys(cached as any) : 'N/A',
                                        hasElements: !!(cached as any)?.elements || !!(cached as any)?.annotation?.elements
                                    })
                                    await cache.delete(id).catch(err => console.warn('Failed to delete invalid cache entry:', err))
                                    // Fall through to fetch from API
                                }
                            }
                        } catch (cacheError) {
                            console.warn(`Error reading from cache for annotation ${id}, fetching from API:`, cacheError)
                            // Fall through to fetch from API
                        }

                        if (versionHash) {
                            debugLog.log(`Cache miss or version mismatch for annotation ${id} (current version hash: ${versionHash}), fetching from API...`)
                        } else {
                            debugLog.log(`Cache miss for annotation ${id}, fetching from API...`)
                        }
                    }

                    const url = `${apiBaseUrl}/annotation/${id}`
                    debugLog.log(`Fetching annotation ${id} from: ${url}`)

                    // Build request options with custom headers if provided
                    const fetchOptions: RequestInit = {}
                    if (apiHeaders) {
                        fetchOptions.headers = apiHeaders
                    }

                    const response = await customFetch(url, fetchOptions)
                    if (!response.ok) {
                        const error = new Error(`Failed to fetch annotation ${id}: ${response.status} ${response.statusText}`)
                        handleApiError(
                            error,
                            response,
                            onApiError,
                            async () => {
                                // Retry function - re-fetch this annotation
                                const retryResponse = await customFetch(url, fetchOptions)
                                if (!retryResponse.ok) {
                                    throw new Error(`Retry failed: ${retryResponse.status} ${retryResponse.statusText}`)
                                }
                                return retryResponse.json()
                            },
                            {
                                endpoint: url,
                                operation: 'fetch',
                                metadata: { annotationId: id },
                            }
                        )
                        console.warn(`Failed to fetch annotation ${id}:`, response.statusText, response.status)
                        return null
                    }
                    const data = await response.json()
                    debugLog.log(`Successfully fetched annotation ${id}:`, data)

                    // Store in cache if available (with version hash if we have header)
                    if (cache && data) {
                        await cache.set(id, data, { versionHash })
                    }

                    return data
                })

                const annotationData = await Promise.all(annotationPromises)

                // Check if component is still mounted before setting state
                if (!isMountedRef.current) {
                    debugLog.log('Component unmounted during annotation fetch, skipping state update')
                    return
                }

                // Track annotation document info
                const docInfo: Array<{
                    id: string | number
                    elementCount: number
                    totalPoints: number
                    types: string[]
                    filteredCount?: number
                    filteredPoints?: number
                }> = []

                // Parse annotation documents using utility function
                let totalFilteredCount = 0
                let totalFilteredPoints = 0

                const validAnnotations = annotationData
                    .filter((ann: unknown): ann is unknown => ann !== null && ann !== undefined)
                    .map((annotationDoc: unknown, index: number) => {
                        const annotationId = String(annotationIds[index])
                        const result = parseAnnotationDocument(annotationDoc, annotationId, defaultAnnotationColor, maxPointsPerAnnotation)

                        docInfo.push(result.docInfo)
                        totalFilteredCount += result.filteredCount
                        totalFilteredPoints += result.filteredPoints

                        return result.features
                    })
                    .flat()

                // Post-process to enforce maxTotalPoints limit
                const finalAnnotations = filterAnnotationsByTotalPoints(validAnnotations, maxTotalPoints)

                if (totalFilteredCount > 0) {
                    console.warn(
                        `Annotation document(s) ${annotationIds.join(', ')}: ` +
                        `${totalFilteredCount} annotation(s) filtered due to per-annotation point limits ` +
                        `(${totalFilteredPoints} total points skipped)`
                    )
                }

                debugLog.log(`Parsed ${finalAnnotations.length} annotation feature(s) from ${annotationIds.length} annotation document(s)`)
                // Check if component is still mounted before setting state
                if (!isMountedRef.current) {
                    debugLog.log('Component unmounted after annotation parsing, skipping state update')
                    return
                }

                setFetchedAnnotations(finalAnnotations)
                setAnnotationDocuments(docInfo)
            } catch (error) {
                console.error('Error fetching annotations:', error)
                // Only set state if component is still mounted
                if (isMountedRef.current) {
                    setFetchedAnnotations([])
                }
            }
        }

        fetchAnnotations()
    }, [
        // Create stable string key from annotationIds array to avoid re-running when array reference changes
        annotationIds ? JSON.stringify(annotationIds) : '',
        apiBaseUrl || '',
        defaultAnnotationColor,
        maxPointsPerAnnotation,
        maxTotalPoints,
        wrappedFetch, // Include wrapped fetch (handles token query param)
        cache, // Include cache so effect re-runs when cache changes
        annotationHeaders, // Include headers for version hash computation
        isMountedRef,
        debugLog,
        apiHeaders,
    ])

    return { fetchedAnnotations, annotationDocuments }
}



