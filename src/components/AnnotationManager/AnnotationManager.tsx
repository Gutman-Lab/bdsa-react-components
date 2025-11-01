import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { IndexedDBAnnotationCache } from '../../cache'
import './AnnotationManager.css'

export interface AnnotationSearchResult {
    _id: string
    _modelType: string
    _elementCount?: number
    _detailsCount?: number
    _version?: number
    _accessLevel?: number
    itemId?: string
    public?: boolean
    created?: string
    updated?: string
    creatorId?: string
    updatedId?: string
    groups?: (string | null)[]
    annotation?: {
        name?: string
        description?: string
        attributes?: Record<string, unknown>
        display?: Record<string, unknown>
    }
    [key: string]: unknown
}

export interface AnnotationManagerProps {
    /** Image/Item ID to search annotations for */
    imageId?: string
    /** Base URL for DSA API (e.g., http://bdsa.pathology.emory.edu:8080/api/v1) */
    apiBaseUrl?: string
    /** Maximum number of annotations to fetch per request (default: 50) */
    limit?: number
    /** Custom fetch function for API requests. Useful for adding authentication headers. */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>
    /** Custom headers to add to all API requests. Merged with fetchFn headers if both are provided. */
    apiHeaders?: HeadersInit
    /** Callback when annotations are loaded */
    onAnnotationsLoaded?: (annotations: AnnotationSearchResult[]) => void
    /** Callback when annotation loading fails */
    onError?: (error: Error) => void
    /** Show debug panel with raw API response (default: false, hidden in production) */
    showDebugPanel?: boolean
    /** Callback when annotation is loaded/unloaded */
    onAnnotationLoadChange?: (annotationId: string, loaded: boolean) => void
    /** Callback when annotation visibility is toggled */
    onAnnotationVisibilityChange?: (annotationId: string, visible: boolean) => void
    /** Callback when annotation opacity changes */
    onAnnotationOpacityChange?: (annotationId: string, opacity: number) => void
    /** Callback when annotation has finished loading and is ready (called by SlideViewer after rendering) */
    onAnnotationReady?: (annotationId: string) => void
    /** Map of annotation IDs to their loaded state */
    loadedAnnotations?: Set<string>
    /** Map of annotation IDs to their visibility state */
    visibleAnnotations?: Map<string, boolean>
    /** Map of annotation IDs to their opacity (0-1) */
    annotationOpacities?: Map<string, number>
    /** Optional cache instance to check if annotations are cached locally. If not provided, automatically creates an IndexedDBAnnotationCache. 
     * Set to `null` to disable caching. If provided, will show a cache indicator icon when annotations are cached. */
    annotationCache?: {
        has(annotationId: string | number, versionHash?: string): Promise<boolean>
        delete?(annotationId: string | number): Promise<void>
    } | null
    /** If true, disables caching entirely (equivalent to annotationCache={null}). Useful for debugging or forcing fresh fetches. */
    disableCache?: boolean
    /** Show default vertical UI (default: true). Set to false to use custom render prop. */
    showDefaultUI?: boolean
    className?: string
    children?: React.ReactNode | ((context: {
        annotations: AnnotationSearchResult[]
        loading: boolean
        error: Error | null
        annotationIds: string[]
        loadedAnnotations: Set<string>
        visibleAnnotations: Map<string, boolean>
        annotationOpacities: Map<string, number>
        toggleLoad: (annotationId: string) => void
        toggleVisibility: (annotationId: string) => void
        setOpacity: (annotationId: string, opacity: number) => void
        onAnnotationReady: (annotationId: string | number) => void
    }) => React.ReactNode)
}

/**
 * AnnotationManager component for managing annotation loading, visibility, and state.
 * This component handles the business logic for annotations while keeping SlideViewer
 * focused on rendering.
 * 
 * Supports fetching annotations by itemId using the DSA API search endpoint.
 * 
 * Note: By default, the API may only return public annotations. To access private
 * annotations, provide authentication via `fetchFn` or `apiHeaders` props.
 */
export const AnnotationManager = React.forwardRef<HTMLDivElement, AnnotationManagerProps>(
    (
        {
            imageId,
            apiBaseUrl,
            limit = 50,
            fetchFn,
            apiHeaders,
            onAnnotationsLoaded,
            onError,
            showDebugPanel = false,
            onAnnotationLoadChange,
            onAnnotationVisibilityChange,
            onAnnotationOpacityChange,
            onAnnotationReady: externalOnAnnotationReady,
            loadedAnnotations: externalLoadedAnnotations,
            visibleAnnotations: externalVisibleAnnotations,
            annotationOpacities: externalAnnotationOpacities,
            annotationCache: externalAnnotationCache,
            disableCache = false,
            showDefaultUI = true,
            className = '',
            children,
        },
        ref
    ) => {
        const [annotations, setAnnotations] = useState<AnnotationSearchResult[]>([])
        const [loading, setLoading] = useState<boolean>(false)
        const [error, setError] = useState<Error | null>(null)
        const [rawApiResponse, setRawApiResponse] = useState<string | null>(null)

        // Internal state management if not controlled externally
        const [internalLoadedAnnotations, setInternalLoadedAnnotations] = useState<Set<string>>(new Set())
        const [internalVisibleAnnotations, setInternalVisibleAnnotations] = useState<Map<string, boolean>>(new Map())
        const [internalAnnotationOpacities, setInternalAnnotationOpacities] = useState<Map<string, number>>(new Map())

        // Store previous opacity values before hiding (so we can restore them)
        const previousOpacitiesRef = useRef<Map<string, number>>(new Map())

        // Track selected annotation for top bar controls
        const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)

        // Track which annotations are currently loading (fetching/rendering)
        const [loadingAnnotations, setLoadingAnnotations] = useState<Set<string>>(new Set())
        
        // Track which annotations are cached locally
        const [cachedAnnotationIds, setCachedAnnotationIds] = useState<Set<string>>(new Set())

        // Auto-create IndexedDB cache if not provided and not explicitly disabled
        const cache = useMemo(() => {
            if (disableCache || externalAnnotationCache === null) {
                // Explicitly disabled via prop
                return null
            }
            if (externalAnnotationCache) {
                // Provided by user
                return externalAnnotationCache
            }
            // Auto-create IndexedDB cache
            return new IndexedDBAnnotationCache()
        }, [externalAnnotationCache, disableCache])

        // Use external state if provided, otherwise use internal state
        const loadedAnnotations = externalLoadedAnnotations ?? internalLoadedAnnotations
        const visibleAnnotations = externalVisibleAnnotations ?? internalVisibleAnnotations
        const annotationOpacities = externalAnnotationOpacities ?? internalAnnotationOpacities

        // Handle annotation ready callback (called when SlideViewer finishes loading)
        // This clears the loading state when an annotation is ready
        // This is used internally and exposed via context for render props
        const handleAnnotationReady = useCallback((annotationId: string) => {
            setLoadingAnnotations(prev => {
                const next = new Set(prev)
                next.delete(annotationId)
                return next
            })
            // Call the external callback if provided
            externalOnAnnotationReady?.(annotationId)
        }, [externalOnAnnotationReady])

        // Create a wrapper for the onAnnotationReady prop that automatically clears loading
        // This will be passed to SlideViewer - when SlideViewer calls it, loading is cleared
        const onAnnotationReady = useCallback((annotationId: string | number) => {
            const id = String(annotationId) // Normalize to string
            console.log(`AnnotationManager: Clearing loading state for annotation ${id}`)
            // Automatically clear loading state when called
            setLoadingAnnotations(prev => {
                const next = new Set(prev)
                const wasPresent = next.has(id)
                next.delete(id)
                console.log(`AnnotationManager: Loading state for ${id} was ${wasPresent ? 'present' : 'missing'}, now cleared. Remaining:`, Array.from(next))
                return next
            })
            
            // Update cache indicator when annotation is loaded (it's now cached)
            if (cache) {
                cache.has(id).then((isCached) => {
                    if (isCached) {
                        setCachedAnnotationIds(prev => new Set(prev).add(id))
                    }
                }).catch(() => {
                    // Ignore errors
                })
            }
            
            // Call the external callback if provided
            externalOnAnnotationReady?.(id)
        }, [externalOnAnnotationReady, cache])


        // Toggle annotation load state
        const toggleLoad = useCallback((annotationId: string) => {
            const idStr = String(annotationId) // Normalize to string
            const isLoaded = loadedAnnotations.has(idStr)
            if (!isLoaded) {
                // Start loading annotation - mark as loading immediately
                console.log(`AnnotationManager: Starting to load annotation ${idStr}`)
                setLoadingAnnotations(prev => {
                    const next = new Set(prev).add(idStr)
                    console.log(`AnnotationManager: Added ${idStr} to loading set. Now loading:`, Array.from(next))
                    return next
                })

                // Load annotation (this will trigger SlideViewer to fetch and render)
                if (!externalLoadedAnnotations) {
                    setInternalLoadedAnnotations(prev => new Set(prev).add(idStr))
                }
                if (!externalVisibleAnnotations) {
                    setInternalVisibleAnnotations(prev => new Map(prev).set(idStr, true))
                }
                if (!externalAnnotationOpacities) {
                    setInternalAnnotationOpacities(prev => new Map(prev).set(idStr, 1))
                }
                onAnnotationLoadChange?.(idStr, true)
            } else {
                // Unload annotation
                if (!externalLoadedAnnotations) {
                    setInternalLoadedAnnotations(prev => {
                        const next = new Set(prev)
                        next.delete(idStr)
                        return next
                    })
                }
                if (!externalVisibleAnnotations) {
                    setInternalVisibleAnnotations(prev => {
                        const next = new Map(prev)
                        next.delete(idStr)
                        return next
                    })
                }
                if (!externalAnnotationOpacities) {
                    setInternalAnnotationOpacities(prev => {
                        const next = new Map(prev)
                        next.delete(idStr)
                        return next
                    })
                }
                onAnnotationLoadChange?.(idStr, false)

                // Clear loading state if it exists
                setLoadingAnnotations(prev => {
                    const next = new Set(prev)
                    next.delete(idStr)
                    return next
                })
            }
        }, [externalLoadedAnnotations, externalVisibleAnnotations, externalAnnotationOpacities, loadedAnnotations, onAnnotationLoadChange])

        // Toggle annotation visibility using opacity (hide = opacity 0, show = restore previous opacity)
        const toggleVisibility = useCallback((annotationId: string) => {
            const currentOpacity = annotationOpacities.get(annotationId) ?? 1
            const isVisible = currentOpacity > 0

            if (isVisible) {
                // Hiding: store current opacity and set to 0
                previousOpacitiesRef.current.set(annotationId, currentOpacity)
                const newOpacity = 0
                if (!externalAnnotationOpacities) {
                    setInternalAnnotationOpacities(prev => new Map(prev).set(annotationId, newOpacity))
                }
                onAnnotationOpacityChange?.(annotationId, newOpacity)
                if (!externalVisibleAnnotations) {
                    setInternalVisibleAnnotations(prev => new Map(prev).set(annotationId, false))
                }
                onAnnotationVisibilityChange?.(annotationId, false)
            } else {
                // Showing: restore previous opacity (or default to 1 if none stored)
                const previousOpacity = previousOpacitiesRef.current.get(annotationId) ?? 1
                previousOpacitiesRef.current.delete(annotationId)
                if (!externalAnnotationOpacities) {
                    setInternalAnnotationOpacities(prev => new Map(prev).set(annotationId, previousOpacity))
                }
                onAnnotationOpacityChange?.(annotationId, previousOpacity)
                if (!externalVisibleAnnotations) {
                    setInternalVisibleAnnotations(prev => new Map(prev).set(annotationId, true))
                }
                onAnnotationVisibilityChange?.(annotationId, true)
            }
        }, [externalAnnotationOpacities, externalVisibleAnnotations, annotationOpacities, onAnnotationOpacityChange, onAnnotationVisibilityChange])

        // Set annotation opacity
        const setOpacity = useCallback((annotationId: string, opacity: number) => {
            if (!externalAnnotationOpacities) {
                setInternalAnnotationOpacities(prev => new Map(prev).set(annotationId, opacity))
            }
            onAnnotationOpacityChange?.(annotationId, opacity)
        }, [externalAnnotationOpacities, onAnnotationOpacityChange])

        // Fetch annotations when imageId or apiBaseUrl changes
        useEffect(() => {
            if (!imageId || !apiBaseUrl) {
                setAnnotations([])
                setLoading(false)
                setError(null)
                setRawApiResponse(null)
                return
            }

            const fetchAnnotations = async () => {
                setLoading(true)
                setError(null)
                setRawApiResponse(null)

                try {
                    // Build URL with pagination parameters
                    const params = new URLSearchParams({
                        itemId: imageId,
                        limit: String(limit),
                        offset: '0',
                        sort: 'lowerName',
                        sortdir: '1',
                    })
                    const url = `${apiBaseUrl}/annotation?${params.toString()}`
                    const customFetch = fetchFn || fetch
                    const fetchOptions: RequestInit = {}

                    if (apiHeaders) {
                        fetchOptions.headers = apiHeaders
                    }

                    console.log(`AnnotationManager: Fetching annotations from: ${url}`)
                    const response = await customFetch(url, fetchOptions)

                    if (!response.ok) {
                        throw new Error(`Failed to fetch annotations: ${response.status} ${response.statusText}`)
                    }

                    const data = await response.json()
                    console.log(`AnnotationManager: API response:`, data)

                    // Store raw response as JSON string for debug panel
                    if (showDebugPanel) {
                        setRawApiResponse(JSON.stringify(data, null, 2))
                    }

                    // Handle both array response and paginated response
                    let annotationList: AnnotationSearchResult[] = []
                    if (Array.isArray(data)) {
                        // DSA API returns array directly
                        annotationList = data
                        console.log(`AnnotationManager: Parsed ${annotationList.length} annotation(s) from array response`)
                    } else if (data && Array.isArray(data.data)) {
                        // Some APIs might return paginated response
                        annotationList = data.data
                        console.log(`AnnotationManager: Parsed ${annotationList.length} annotation(s) from paginated response`)
                    } else if (data && typeof data === 'object') {
                        // If it's a single annotation object, wrap it in an array
                        annotationList = [data]
                        console.log(`AnnotationManager: Parsed 1 annotation from single object response`)
                    } else {
                        console.warn(`AnnotationManager: Unexpected response format:`, typeof data, data)
                    }

                    setAnnotations(annotationList)
                    console.log(`AnnotationManager: Fetched ${annotationList.length} annotation(s) from API`)
                    if (annotationList.length > 0) {
                        console.log(`AnnotationManager: Annotation IDs:`, annotationList.map(a => a._id))
                    }

                    // Check which annotations are cached (if cache is provided)
                    if (cache && annotationList.length > 0) {
                        const checkCacheForAnnotations = async () => {
                            const cachedIds = new Set<string>()
                            for (const ann of annotationList) {
                                const annId = String(ann._id)
                                try {
                                    // Check cache without version hash (just check if exists)
                                    const isCached = await cache.has(annId)
                                    if (isCached) {
                                        cachedIds.add(annId)
                                    }
                                } catch (error) {
                                    // Ignore cache check errors
                                }
                            }
                            setCachedAnnotationIds(cachedIds)
                        }
                        checkCacheForAnnotations()
                    } else {
                        // Clear cache state if no cache provided
                        setCachedAnnotationIds(new Set())
                    }

                    if (onAnnotationsLoaded) {
                        onAnnotationsLoaded(annotationList)
                    }
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err))
                    setError(error)
                    setRawApiResponse(null)

                    if (onError) {
                        onError(error)
                    }
                } finally {
                    setLoading(false)
                }
            }

            fetchAnnotations()
        }, [imageId, apiBaseUrl, limit, fetchFn, apiHeaders, onAnnotationsLoaded, onError, showDebugPanel])

        // Memoize the annotations list for rendering
        const annotationContext = useMemo(() => ({
            annotations,
            loading,
            error,
            annotationIds: annotations.map(a => a._id),
            loadedAnnotations,
            visibleAnnotations,
            annotationOpacities,
            toggleLoad,
            toggleVisibility,
            setOpacity,
            handleAnnotationReady: handleAnnotationReady,
            onAnnotationReady: onAnnotationReady,
            loadingAnnotations,
        }), [annotations, loading, error, loadedAnnotations, visibleAnnotations, annotationOpacities, toggleLoad, toggleVisibility, setOpacity, handleAnnotationReady, onAnnotationReady, loadingAnnotations])

        // Default vertical UI
        const renderDefaultUI = () => {
            if (loading) {
                return (
                    <div className="bdsa-annotation-manager__list">
                        <div className="bdsa-annotation-manager__empty-state">
                            <p>Loading annotations...</p>
                        </div>
                    </div>
                )
            }

            if (error) {
                return (
                    <div className="bdsa-annotation-manager__list">
                        <div className="bdsa-annotation-manager__empty-state" style={{ color: '#dc3545' }}>
                            <p>Error: {error.message}</p>
                        </div>
                    </div>
                )
            }

            if (annotations.length === 0) {
                return (
                    <div className="bdsa-annotation-manager__list">
                        <div className="bdsa-annotation-manager__empty-state">
                            <p>No annotations found</p>
                        </div>
                    </div>
                )
            }

            const loadedCount = Array.from(loadedAnnotations).length

            return (
                <div className="bdsa-annotation-manager__list">
                    <div className="bdsa-annotation-manager__list-header">
                        <h3>Annotations ({annotations.length} total)</h3>
                        <p>{loadedCount} loaded in viewer</p>
                    </div>
                    {annotations.map((ann) => {
                        const annIdStr = String(ann._id) // Normalize to string for consistency
                        const isLoaded = loadedAnnotations.has(annIdStr)
                        const isLoading = loadingAnnotations.has(annIdStr)
                        const opacity = annotationOpacities.get(annIdStr) ?? 1
                        const isCached = cachedAnnotationIds.has(annIdStr)

                        const isSelected = selectedAnnotationId === annIdStr

                        return (
                            <div
                                key={ann._id}
                                className={`bdsa-annotation-manager__annotation-card ${isLoaded ? 'bdsa-annotation-manager__annotation-card--loaded' : ''} ${isSelected ? 'bdsa-annotation-manager__annotation-card--selected' : ''}`}
                                onClick={() => setSelectedAnnotationId(ann._id)}
                            >
                                <div className="bdsa-annotation-manager__annotation-card-header">
                                    <h4 className="bdsa-annotation-manager__annotation-card-title">
                                        {ann.annotation?.name || ann._id}
                                    </h4>
                                    <div className="bdsa-annotation-manager__annotation-card-meta">
                                        {ann.public === false && (
                                            <span className="bdsa-annotation-manager__annotation-card-badge bdsa-annotation-manager__annotation-card-badge--private">
                                                Private
                                            </span>
                                        )}
                                        {ann.public === true && (
                                            <span className="bdsa-annotation-manager__annotation-card-badge bdsa-annotation-manager__annotation-card-badge--public">
                                                Public
                                            </span>
                                        )}
                                        {isCached && (
                                            <div className="bdsa-annotation-manager__annotation-card-cache-indicator-group">
                                                <span 
                                                    className="bdsa-annotation-manager__annotation-card-cache-indicator"
                                                    title="Cached locally - will load quickly"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        {/* Hard drive/database icon for cache indicator */}
                                                        <rect x="2" y="3" width="20" height="18" rx="2" />
                                                        <path d="M7 3h10M7 21h10M9 9h6M9 15h6" />
                                                    </svg>
                                                </span>
                                                {cache && typeof cache.delete === 'function' && (
                                                    <button
                                                        className="bdsa-annotation-manager__annotation-card-cache-bypass"
                                                        onClick={async (e) => {
                                                            e.stopPropagation()
                                                            const annId = String(ann._id)
                                                            try {
                                                                await cache.delete!(annId)
                                                                // Remove from cached set
                                                                setCachedAnnotationIds(prev => {
                                                                    const next = new Set(prev)
                                                                    next.delete(annId)
                                                                    return next
                                                                })
                                                                // If annotation is loaded, trigger reload by toggling off then on
                                                                if (loadedAnnotations.has(annId)) {
                                                                    toggleLoad(annId) // Unload
                                                                    setTimeout(() => toggleLoad(annId), 100) // Reload
                                                                }
                                                            } catch (error) {
                                                                console.warn('Failed to clear cache for annotation:', error)
                                                            }
                                                        }}
                                                        title="Clear cache and refresh this annotation"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            {/* Refresh/reload icon */}
                                                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                                            <path d="M21 3v5h-5" />
                                                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                                            <path d="M3 21v-5h5" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <button
                                            className={`bdsa-annotation-manager__annotation-card-button bdsa-annotation-manager__annotation-card-button--load bdsa-annotation-manager__annotation-card-button--load-header`}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                toggleLoad(String(ann._id))
                                            }}
                                            title={isLoaded ? 'Unload annotation' : 'Load annotation'}
                                        >
                                            {isLoaded ? (
                                                // Unload icon (minus)
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                            ) : (
                                                // Load icon (plus)
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="bdsa-annotation-manager__annotation-card-details">
                                    {ann._elementCount !== undefined && (
                                        <div className="bdsa-annotation-manager__annotation-card-detail">
                                            <strong>Elements:</strong> {ann._elementCount}
                                        </div>
                                    )}
                                    {ann._detailsCount !== undefined && (
                                        <div className="bdsa-annotation-manager__annotation-card-detail">
                                            <strong>Points:</strong> {ann._detailsCount.toLocaleString()}
                                        </div>
                                    )}
                                </div>

                                <div className="bdsa-annotation-manager__annotation-card-controls">
                                    {isLoading ? (
                                        // Show loading indicator while annotation is being fetched/rendered
                                        <div className="bdsa-annotation-manager__loading-indicator">
                                            <div className="bdsa-annotation-manager__spinner"></div>
                                            <span>Loading...</span>
                                        </div>
                                    ) : isLoaded ? (
                                        // Show controls only when annotation is fully loaded and ready
                                        <>
                                            <button
                                                className={`bdsa-annotation-manager__annotation-card-button bdsa-annotation-manager__annotation-card-button--visibility`}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleVisibility(ann._id)
                                                }}
                                                title={opacity > 0 ? 'Hide annotation' : 'Show annotation'}
                                            >
                                                {/* Eye icon - open when visible, closed when hidden */}
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    {opacity > 0 ? (
                                                        // Open eye (visible)
                                                        <>
                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                            <circle cx="12" cy="12" r="3" />
                                                        </>
                                                    ) : (
                                                        // Closed eye (hidden)
                                                        <>
                                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                            <line x1="1" y1="1" x2="23" y2="23" />
                                                        </>
                                                    )}
                                                </svg>
                                            </button>
                                            <div className="bdsa-annotation-manager__annotation-card-opacity" onClick={(e) => e.stopPropagation()}>
                                                <label className="bdsa-annotation-manager__annotation-card-opacity-label">
                                                    Opacity: {Math.round(opacity * 100)}%
                                                </label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.01"
                                                    value={opacity}
                                                    onChange={(e) => setOpacity(ann._id, parseFloat(e.target.value))}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    className="bdsa-annotation-manager__annotation-card-opacity-slider"
                                                />
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )
        }

        return (
            <div
                ref={ref}
                className={`bdsa-annotation-manager ${className}`}
            >
                {showDefaultUI ? (
                    <>
                        {renderDefaultUI()}
                        {children && typeof children === 'function'
                            ? (children as (context: typeof annotationContext) => React.ReactNode)(annotationContext)
                            : children}
                    </>
                ) : (
                    children && typeof children === 'function'
                        ? (children as (context: typeof annotationContext) => React.ReactNode)(annotationContext)
                        : children
                )}
                {showDebugPanel && rawApiResponse && (
                    <div className="bdsa-annotation-manager__debug-panel">
                        <div className="bdsa-annotation-manager__debug-panel-header">
                            <strong>Raw API Response (Debug)</strong>
                        </div>
                        <pre className="bdsa-annotation-manager__debug-panel-content">
                            {rawApiResponse}
                        </pre>
                    </div>
                )}
            </div>
        )
    }
)

AnnotationManager.displayName = 'AnnotationManager'

