import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SlideViewer } from '../SlideViewer/SlideViewer'
import type { Item } from '../../utils/itemUtils'
import { createDebugLogger } from '../../utils/debugLog'
import './ThumbnailViewer.css'

/**
 * Module-level opacity management for all thumbnails
 * This prevents re-renders when opacity changes
 */
const sharedOpacityMap = new Map<string, number>()
let opacityVersion = 0

/**
 * Update opacity for a specific annotation across all thumbnails
 */
export function updateThumbnailOpacity(annotationId: string, opacity: number): void {
    sharedOpacityMap.set(annotationId, opacity)
    opacityVersion++
}

/**
 * Get current opacity for an annotation
 */
export function getThumbnailOpacity(annotationId: string): number {
    return sharedOpacityMap.get(annotationId) ?? 1
}

/**
 * Clear all opacity settings
 */
export function clearThumbnailOpacities(): void {
    sharedOpacityMap.clear()
    opacityVersion++
}

export interface ThumbnailViewerProps {
    /** DSA item object with _id, name, meta, etc. */
    item: Item
    /** Width of thumbnail in pixels */
    viewerWidth: number
    /** DSA API base URL */
    apiBaseUrl: string
    /** Backend API base URL for annotation caching (optional) */
    backendApiBaseUrl?: string
    /** Headers for API requests */
    apiHeaders?: HeadersInit
    /** Name of currently selected annotation */
    selectedAnnotationName?: string
    /** Map of itemId -> annotationId */
    annotationNameToIds?: Map<string, string> | Record<string, string>
    /** Function to determine dataset type (train/val/test) */
    getDatasetType?: (itemId: string) => 'train' | 'val' | 'test' | null
    /** Show OpenSeadragon navigation controls (zoom, home, fullscreen) (default: false) */
    showViewerControls?: boolean
    /** Custom fetch function for API requests */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>
    /** Debug mode for logging */
    debug?: boolean
}

/**
 * Individual thumbnail component that wraps SlideViewer for displaying a single DSA item
 * with optional annotation overlay.
 */
export const ThumbnailViewer = React.memo<ThumbnailViewerProps>(
    ({
        item,
        viewerWidth,
        apiBaseUrl,
        backendApiBaseUrl,
        apiHeaders,
        selectedAnnotationName,
        annotationNameToIds,
        getDatasetType,
        showViewerControls = false,
        fetchFn,
        debug = false,
    }) => {
        const containerRef = useRef<HTMLDivElement>(null)
        const slideViewerRef = useRef<HTMLDivElement>(null)
        const [isVisible, setIsVisible] = useState(false)
        const [opacityMapVersion, setOpacityMapVersion] = useState(0)
        const opacityMapRef = useRef<Map<string, number>>(new Map())
        const [annotationLoading, setAnnotationLoading] = useState(false)
        const [annotationLoaded, setAnnotationLoaded] = useState(false)
        const [annotationError, setAnnotationError] = useState(false)
        const annotationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
        const debugLog = useMemo(() => createDebugLogger('ThumbnailViewer', debug), [debug])

        // Get annotation ID for this item
        const annotationId = useMemo(() => {
            if (!selectedAnnotationName || !annotationNameToIds) {
                return undefined
            }

            const itemId = String(item._id)
            if (annotationNameToIds instanceof Map) {
                return annotationNameToIds.get(itemId)
            } else {
                return annotationNameToIds[itemId]
            }
        }, [item._id, selectedAnnotationName, annotationNameToIds])

        // Track annotation loading state - start loading when annotationId is set
        useEffect(() => {
            // Only reset state if annotationId actually changed (not just on every render)
            const currentAnnotationId = annotationId

            // Clear any existing timeout
            if (annotationTimeoutRef.current) {
                clearTimeout(annotationTimeoutRef.current)
                annotationTimeoutRef.current = null
            }

            if (currentAnnotationId && isVisible) {
                // Only set loading if we're not already loaded for this annotation
                // This prevents resetting the state if the component re-renders
                if (!annotationLoaded) {
                    debugLog.log(`[ThumbnailViewer] Starting loading state for annotation ${currentAnnotationId}`)
                    setAnnotationLoading(true)
                    setAnnotationError(false)

                    // Set a timeout to detect if annotation fails to load (e.g., doesn't exist)
                    // Use a longer timeout for large annotations (30 seconds)
                    annotationTimeoutRef.current = setTimeout(() => {
                        // Only set error if we're still loading (not if we've already loaded)
                        setAnnotationLoading((prevLoading) => {
                            if (prevLoading) {
                                debugLog.warn(`[ThumbnailViewer] Annotation ${currentAnnotationId} loading timeout after 30s`)
                                setAnnotationError(true)
                                return false
                            }
                            return prevLoading
                        })
                    }, 30000) // 30 second timeout
                }
            } else if (!currentAnnotationId && isVisible && selectedAnnotationName) {
                // No annotation ID means no annotation found (only show error if we're looking for annotations)
                debugLog.log(`[ThumbnailViewer] No annotation ID found for item, showing error`)
                setAnnotationError(true)
                setAnnotationLoading(false)
            } else if (!currentAnnotationId) {
                // No annotation ID and not looking for annotations - clear all states
                setAnnotationLoading(false)
                setAnnotationLoaded(false)
                setAnnotationError(false)
            }

            return () => {
                if (annotationTimeoutRef.current) {
                    clearTimeout(annotationTimeoutRef.current)
                    annotationTimeoutRef.current = null
                }
            }
        }, [annotationId, isVisible, selectedAnnotationName, annotationLoaded, debugLog])

        // Build image info for SlideViewer - use DZI URL for simplicity
        const imageInfo = useMemo(() => {
            return {
                dziUrl: `${apiBaseUrl}/item/${item._id}/tiles/dzi.dzi`,
            }
        }, [item._id, apiBaseUrl])

        // Get dataset type for this item
        const datasetType = useMemo(() => {
            if (!getDatasetType) return null
            return getDatasetType(item._id)
        }, [item._id, getDatasetType])

        // Custom fetch function that routes through backend cache
        const proxyFetchFn = useCallback(
            async (url: string, options?: RequestInit): Promise<Response> => {
                // Check if this is an annotation fetch request - match /annotation/{id} pattern
                // This matches URLs like: http://.../api/v1/annotation/123 or /annotation/123
                const annotationIdMatch = url.match(/\/annotation\/([^/?&#]+)/)
                const isAnnotationFetch = annotationIdMatch !== null
                const fetchedAnnotationId = annotationIdMatch ? annotationIdMatch[1] : null

                if (debug && isAnnotationFetch) {
                    debugLog.log(`[ThumbnailViewer] Detected annotation fetch: ${url}, ID: ${fetchedAnnotationId}, expected: ${annotationId}`)
                }

                if (!backendApiBaseUrl) {
                    // No backend URL, use provided fetchFn or default fetch
                    const response = fetchFn ? await fetchFn(url, options) : await fetch(url, options)

                    // If this was an annotation fetch and it succeeded, mark as loaded
                    if (isAnnotationFetch && fetchedAnnotationId && response.ok) {
                        if (String(fetchedAnnotationId) === String(annotationId)) {
                            if (debug) {
                                debugLog.log(`[ThumbnailViewer] Annotation ${fetchedAnnotationId} fetched successfully, hiding spinner`)
                            }
                            // Annotation document fetched successfully
                            setAnnotationLoading(false)
                            setAnnotationError(false) // Clear any error state
                            // Don't set annotationLoaded here - wait for onAnnotationReady for full render
                        }
                    } else if (isAnnotationFetch && fetchedAnnotationId && !response.ok) {
                        if (String(fetchedAnnotationId) === String(annotationId)) {
                            if (debug) {
                                debugLog.error(`[ThumbnailViewer] Annotation ${fetchedAnnotationId} fetch failed: ${response.status}`)
                            }
                            // Annotation fetch failed
                            setAnnotationLoading(false)
                            setAnnotationError(true)
                        }
                    }

                    return response
                }

                // Route annotation requests through backend cache
                const annotationSearchMatch = url.match(/\/annotation\?itemId=([^&]+)/)

                if (annotationSearchMatch || annotationIdMatch) {
                    // This is an annotation request - route through backend
                    const backendUrl = `${backendApiBaseUrl}/api/v1${url.replace(apiBaseUrl, '').replace(/^\/api\/v1/, '')}`
                    const backendOptions: RequestInit = {
                        ...options,
                        headers: {
                            ...apiHeaders,
                            ...(options?.headers || {}),
                        },
                    }

                    const response = await fetch(backendUrl, backendOptions)

                    // If annotation fetch succeeded, mark loading as complete
                    if (response.ok && fetchedAnnotationId && String(fetchedAnnotationId) === String(annotationId)) {
                        if (debug) {
                            debugLog.log(`[ThumbnailViewer] Annotation ${fetchedAnnotationId} fetched successfully via backend, hiding spinner`)
                        }
                        // Annotation document fetched successfully
                        setAnnotationLoading(false)
                        setAnnotationError(false) // Clear any error state
                        // Don't set annotationLoaded here - wait for onAnnotationReady for full render
                    } else if (!response.ok && fetchedAnnotationId && String(fetchedAnnotationId) === String(annotationId)) {
                        if (debug) {
                            debugLog.error(`[ThumbnailViewer] Annotation ${fetchedAnnotationId} fetch failed via backend: ${response.status}`)
                        }
                        // Annotation fetch failed
                        setAnnotationLoading(false)
                        setAnnotationError(true)
                    }

                    return response
                }

                // Not an annotation request, use original fetch
                return fetchFn ? fetchFn(url, options) : fetch(url, options)
            },
            [apiBaseUrl, backendApiBaseUrl, apiHeaders, fetchFn, annotationId, debug, debugLog]
        )

        // Poll for opacity changes (avoids re-renders)
        useEffect(() => {
            let animationFrameId: number

            const checkOpacity = () => {
                if (opacityVersion !== opacityMapVersion) {
                    // Create new Map reference from shared map
                    const newMap = new Map(sharedOpacityMap)
                    opacityMapRef.current = newMap
                    setOpacityMapVersion(opacityVersion)
                }
                animationFrameId = requestAnimationFrame(checkOpacity)
            }

            animationFrameId = requestAnimationFrame(checkOpacity)
            return () => {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId)
                }
            }
        }, [opacityMapVersion])

        // Visibility detection with IntersectionObserver
        useEffect(() => {
            if (!containerRef.current) return

            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            setIsVisible(true)
                            // Trigger OpenSeadragon resize when visible
                            // This is handled by SlideViewer internally
                        }
                    })
                },
                {
                    threshold: 0.1,
                }
            )

            observer.observe(containerRef.current)

            return () => {
                observer.disconnect()
            }
        }, [])

        // Sync canvas sizes when visible
        useEffect(() => {
            if (!isVisible || !slideViewerRef.current) return

            const syncCanvas = () => {
                const osdContainer = slideViewerRef.current?.querySelector('.openseadragon-container')
                const paperCanvas = slideViewerRef.current?.querySelector('canvas[data-paper-id]')

                if (osdContainer && paperCanvas) {
                    // Remove explicit width/height attributes, use CSS sizing
                    if ((paperCanvas as HTMLElement).style.width) {
                        ; (paperCanvas as HTMLElement).style.width = ''
                    }
                    if ((paperCanvas as HTMLElement).style.height) {
                        ; (paperCanvas as HTMLElement).style.height = ''
                    }
                }
            }

            // Initial sync
            syncCanvas()

            // Watch for dynamically added elements
            const mutationObserver = new MutationObserver(syncCanvas)
            if (slideViewerRef.current) {
                mutationObserver.observe(slideViewerRef.current, {
                    childList: true,
                    subtree: true,
                })
            }

            // Also sync after a delay to catch delayed image opening
            const timeoutId = setTimeout(syncCanvas, 500)

            return () => {
                mutationObserver.disconnect()
                clearTimeout(timeoutId)
            }
        }, [isVisible])

        // Build annotation opacities map
        const annotationOpacities = useMemo(() => {
            if (!annotationId) {
                return new Map<string, number>()
            }
            return opacityMapRef.current
        }, [annotationId, opacityMapVersion])

        // Build annotation IDs array
        const annotationIds = useMemo(() => {
            if (!annotationId) {
                return []
            }
            return [annotationId]
        }, [annotationId])

        // Handle annotation ready callback
        const handleAnnotationReady = useCallback((id: string | number) => {
            debugLog.log(`[ThumbnailViewer] onAnnotationReady called with ID: ${id} (type: ${typeof id}), expected: ${annotationId} (type: ${typeof annotationId})`)
            const idStr = String(id)
            const expectedIdStr = String(annotationId)

            if (idStr === expectedIdStr) {
                debugLog.log(`[ThumbnailViewer] IDs match! Annotation ${id} is ready, hiding spinner and showing checkmark`)
                setAnnotationLoading(false)
                setAnnotationLoaded(true)
                setAnnotationError(false) // Clear error state when annotation is ready
                if (annotationTimeoutRef.current) {
                    clearTimeout(annotationTimeoutRef.current)
                    annotationTimeoutRef.current = null
                }
            } else {
                debugLog.warn(`[ThumbnailViewer] ID mismatch! Received: '${idStr}', Expected: '${expectedIdStr}'`)
            }
        }, [annotationId, debugLog])

        // Also watch for Paper.js rendering to detect when annotations start appearing
        // This provides earlier feedback than waiting for onAnnotationReady
        useEffect(() => {
            if (!isVisible || !annotationId || !annotationLoading || annotationLoaded) {
                // Don't set up observer if already loaded or not loading
                return
            }

            debugLog.log(`[ThumbnailViewer] Setting up Paper.js observer for annotation ${annotationId}`)

            const checkForPaperItems = () => {
                if (!slideViewerRef.current) return false

                const canvas = slideViewerRef.current.querySelector('canvas[data-paper-id]')
                if (canvas) {
                    try {
                        const paperScope = (window as any).paper?.scopes?.find((scope: any) =>
                            scope.project?.canvas === canvas
                        )
                        if (paperScope?.project?.activeLayer?.children?.length > 0) {
                            debugLog.log(`[ThumbnailViewer] Detected ${paperScope.project.activeLayer.children.length} Paper.js items, annotation is rendering`)
                            return true
                        }
                    } catch (e) {
                        debugLog.warn(`[ThumbnailViewer] Error checking Paper.js scope:`, e)
                    }
                }
                return false
            }

            // Check immediately
            if (checkForPaperItems()) {
                debugLog.log(`[ThumbnailViewer] Paper.js items already present, clearing loading state`)
                setAnnotationLoading(false)
                setAnnotationError(false)
                return
            }

            // Watch for canvas creation and Paper.js items
            const observer = new MutationObserver(() => {
                // Only update if we're still in loading state (prevent race conditions)
                setAnnotationLoading((prevLoading) => {
                    if (prevLoading && checkForPaperItems()) {
                        debugLog.log(`[ThumbnailViewer] Paper.js items detected via MutationObserver, clearing loading state`)
                        setAnnotationError(false)
                        return false
                    }
                    return prevLoading
                })
            })

            if (slideViewerRef.current) {
                observer.observe(slideViewerRef.current, {
                    childList: true,
                    subtree: true,
                })
            }

            // Also poll periodically as a fallback (Paper.js might render before DOM mutations)
            const pollInterval = setInterval(() => {
                // Only update if we're still in loading state (prevent race conditions)
                setAnnotationLoading((prevLoading) => {
                    if (prevLoading && checkForPaperItems()) {
                        debugLog.log(`[ThumbnailViewer] Paper.js items detected via polling, clearing loading state`)
                        setAnnotationError(false)
                        clearInterval(pollInterval)
                        observer.disconnect()
                        return false
                    }
                    return prevLoading
                })
            }, 200)

            return () => {
                observer.disconnect()
                clearInterval(pollInterval)
            }
        }, [isVisible, annotationId, annotationLoading, annotationLoaded, debugLog])

        return (
            <div
                ref={containerRef}
                className={`bdsa-thumbnail-viewer ${datasetType ? `bdsa-thumbnail-viewer--${datasetType}` : ''}`}
                style={{ width: viewerWidth, height: viewerWidth }}
            >
                {datasetType && (
                    <div className={`bdsa-thumbnail-viewer__dataset-badge bdsa-thumbnail-viewer__dataset-badge--${datasetType}`}>
                        {datasetType.toUpperCase()}
                    </div>
                )}
                {/* Annotation loading indicator */}
                {selectedAnnotationName && isVisible && (
                    <div className="bdsa-thumbnail-viewer__annotation-status">
                        {annotationLoading && (
                            <div className="bdsa-thumbnail-viewer__annotation-spinner" title="Loading annotation...">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                                    <path
                                        d="M12 2 A10 10 0 0 1 22 12"
                                        strokeDasharray="15.7"
                                        strokeDashoffset="7.85"
                                        fill="none"
                                    >
                                        <animateTransform
                                            attributeName="transform"
                                            type="rotate"
                                            from="0 12 12"
                                            to="360 12 12"
                                            dur="1s"
                                            repeatCount="indefinite"
                                        />
                                    </path>
                                </svg>
                            </div>
                        )}
                        {annotationLoaded && !annotationLoading && (
                            <div className="bdsa-thumbnail-viewer__annotation-success" title="Annotation loaded">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="9 12 11 14 15 10" />
                                </svg>
                            </div>
                        )}
                        {annotationError && !annotationLoading && !annotationLoaded && (
                            <div className="bdsa-thumbnail-viewer__annotation-error" title="No annotation found">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            </div>
                        )}
                    </div>
                )}
                <div ref={slideViewerRef} className="bdsa-thumbnail-viewer__slide-container">
                    {isVisible && (
                        <SlideViewer
                            imageInfo={imageInfo}
                            apiBaseUrl={apiBaseUrl}
                            fetchFn={proxyFetchFn}
                            apiHeaders={apiHeaders}
                            annotationIds={annotationIds}
                            annotationOpacities={annotationOpacities}
                            onAnnotationReady={handleAnnotationReady}
                            width={`${viewerWidth}px`}
                            height={`${viewerWidth}px`}
                            showAnnotationControls={false}
                            showAnnotationInfo={false}
                            defaultAnnotationOpacity={1}
                            osdOptions={{
                                showNavigator: showViewerControls,
                                showZoomControl: showViewerControls,
                                showHomeControl: showViewerControls,
                                showFullPageControl: showViewerControls,
                                showRotationControl: false,
                                autoHideControls: false,
                            }}
                            debug={debug}
                        />
                    )}
                </div>
                {item.name && (
                    <div className="bdsa-thumbnail-viewer__label" title={item.name}>
                        {item.name}
                    </div>
                )}
            </div>
        )
    },
    (prevProps, nextProps) => {
        // Custom comparison for React.memo
        return (
            prevProps.item._id === nextProps.item._id &&
            prevProps.viewerWidth === nextProps.viewerWidth &&
            prevProps.selectedAnnotationName === nextProps.selectedAnnotationName &&
            prevProps.apiBaseUrl === nextProps.apiBaseUrl &&
            prevProps.backendApiBaseUrl === nextProps.backendApiBaseUrl
        )
    }
)

ThumbnailViewer.displayName = 'ThumbnailViewer'
