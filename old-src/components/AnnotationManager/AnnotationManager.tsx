import React, { useState, useEffect, useMemo, useCallback, useRef, useImperativeHandle } from 'react'
import { IndexedDBAnnotationCache } from '../../cache'
import { createDebugLogger } from '../../utils/debugLog'
import './AnnotationManager.css'
import type { AnnotationSearchResult, AnnotationManagerProps, AnnotationManagerHandle, AnnotationManagerContext } from './AnnotationManager.types'

export type { AnnotationSearchResult, AnnotationManagerProps, AnnotationManagerHandle, AnnotationManagerContext }

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
export const AnnotationManager = React.forwardRef<AnnotationManagerHandle, AnnotationManagerProps>(
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
            slideViewerOnAnnotationReady,
            onLoadedAnnotationIdsChange,
            onAnnotationLoad,
            onAnnotationHide,
            onAnnotationStateChange,
            onAnnotationOpacitiesChange,
            onAnnotationHeadersChange,
            loadedAnnotations: externalLoadedAnnotations,
            visibleAnnotations: externalVisibleAnnotations,
            annotationOpacities: externalAnnotationOpacities,
            annotationCache: externalAnnotationCache,
            disableCache = false,
            showDefaultUI = true,
            className = '',
            children,
            debug = false,
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
        
        // Track which annotation's metadata is being viewed
        const [viewingMetadataFor, setViewingMetadataFor] = useState<string | null>(null)
        
        // Create debug logger
        const debugLog = useMemo(() => createDebugLogger('AnnotationManager', debug), [debug])

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

        // Fire onLoadedAnnotationIdsChange whenever the loaded annotations set changes
        // Use a sorted array string for comparison to detect changes even if Set reference doesn't change
        const loadedAnnotationsArray = useMemo(() => {
            return Array.from(loadedAnnotations).sort()
        }, [loadedAnnotations])
        
        useEffect(() => {
            if (onLoadedAnnotationIdsChange) {
                onLoadedAnnotationIdsChange(loadedAnnotationsArray)
            }
        }, [loadedAnnotationsArray, onLoadedAnnotationIdsChange])

        // Ref to store the annotation ready callback for use in fireStateChangeCallbacks
        // This allows us to reference it before it's defined
        const annotationReadyCallbackRef = useRef<((id: string | number) => void) | null>(null)

        // Helper function to fire state change callbacks immediately (synchronously)
        // This ensures callbacks fire immediately when actions occur, not in next render cycle
        // NOTE: We'll pass the callback ref directly so it's always up-to-date
        const fireStateChangeCallbacks = useCallback(() => {
            const loadedIdsArray = Array.from(loadedAnnotations).sort()
            const opacitiesMap = new Map(annotationOpacities)
            const visibilityMap = new Map(visibleAnnotations)
            
            // Fire unified state change callback immediately
            if (onAnnotationStateChange) {
                // Get the current callback from ref (may be null initially, but will be set on next render)
                const readyCallback = annotationReadyCallbackRef.current
                onAnnotationStateChange({
                    loadedAnnotationIds: loadedIdsArray,
                    opacities: opacitiesMap,
                    visibility: visibilityMap,
                    // Include the internal callback that SlideViewer should use
                    // This eliminates the need for render props
                    // Pass undefined if not set yet - it will be provided in next state change
                    onAnnotationReady: readyCallback || undefined,
                })
            }
            
            // Fire opacity-specific callback
            if (onAnnotationOpacitiesChange) {
                onAnnotationOpacitiesChange(opacitiesMap)
            }
            
            // Fire loaded IDs change callback
            if (onLoadedAnnotationIdsChange) {
                onLoadedAnnotationIdsChange(loadedIdsArray)
            }
        }, [loadedAnnotations, annotationOpacities, visibleAnnotations, onAnnotationStateChange, onAnnotationOpacitiesChange, onLoadedAnnotationIdsChange])

        // Create stable serialized references for Map change detection
        // Used for useEffect-based callbacks (backup/legacy pattern)
        const opacitiesArray = useMemo(() => {
            return Array.from(annotationOpacities.entries()).sort(([a], [b]) => a.localeCompare(b))
        }, [annotationOpacities])
        
        const visibilityArray = useMemo(() => {
            return Array.from(visibleAnnotations.entries()).sort(([a], [b]) => a.localeCompare(b))
        }, [visibleAnnotations])
        
        // Also fire callbacks in useEffect as backup (for state updates that happen outside our handlers)
        // But primary firing should be synchronous in action handlers
        useEffect(() => {
            fireStateChangeCallbacks()
        }, [fireStateChangeCallbacks, loadedAnnotationsArray, opacitiesArray, visibilityArray])

        // Unified annotation ready handler
        // This handles both internal use and external callbacks from SlideViewer
        // Note: SlideViewer already deduplicates by document ID, so we don't need to do it here
        const handleAnnotationReadyInternal = useCallback((annotationId: string | number) => {
            const id = String(annotationId) // Normalize to string
            debugLog.log(`handleAnnotationReadyInternal called for ${id}`)
            
            // Automatically clear loading state when called
            setLoadingAnnotations(prev => {
                const wasLoading = prev.has(id)
                const next = new Set(prev)
                next.delete(id)
                debugLog.log(`Cleared loading for ${id}. Was loading: ${wasLoading}. Still loading:`, Array.from(next))
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
            
            // Call external callbacks
            externalOnAnnotationReady?.(id)
            slideViewerOnAnnotationReady?.(id)
        }, [externalOnAnnotationReady, slideViewerOnAnnotationReady, cache])
        
        // Store the callback in ref immediately (refs are mutable and don't cause re-renders)
        // This ensures it's available to fireStateChangeCallbacks even on first call
        annotationReadyCallbackRef.current = handleAnnotationReadyInternal
        
        // Also update in useEffect to ensure it stays current across renders
        // and trigger a state change callback so consumers get the callback
        useEffect(() => {
            annotationReadyCallbackRef.current = handleAnnotationReadyInternal
            // Fire callbacks to ensure consumers get the callback reference
            fireStateChangeCallbacks()
        }, [handleAnnotationReadyInternal, fireStateChangeCallbacks])

        // Create a wrapper for the onAnnotationReady prop that automatically clears loading
        // This will be passed to SlideViewer - when SlideViewer calls it, loading is cleared
        // Uses the unified handler with deduplication
        const onAnnotationReady = handleAnnotationReadyInternal


        // Toggle annotation load state
        const toggleLoad = useCallback((annotationId: string) => {
            const idStr = String(annotationId) // Normalize to string
            const isLoaded = loadedAnnotations.has(idStr)
            debugLog.log(`toggleLoad for ${idStr}. Currently loaded: ${isLoaded}`)
            if (!isLoaded) {
                // Start loading annotation - mark as loading immediately
                debugLog.log(`Adding ${idStr} to loading state`)
                setLoadingAnnotations(prev => new Set(prev).add(idStr))

                // Load annotation (this will trigger SlideViewer to fetch and render)
                if (!externalLoadedAnnotations) {
                    debugLog.log(`toggleLoad: Adding ${idStr} to internalLoadedAnnotations`)
                    setInternalLoadedAnnotations(prev => {
                        const next = new Set(prev).add(idStr)
                        debugLog.log(`internalLoadedAnnotations now:`, Array.from(next))
                        return next
                    })
                }
                if (!externalVisibleAnnotations) {
                    setInternalVisibleAnnotations(prev => new Map(prev).set(idStr, true))
                }
                if (!externalAnnotationOpacities) {
                    setInternalAnnotationOpacities(prev => new Map(prev).set(idStr, 1))
                }
                onAnnotationLoadChange?.(idStr, true)
                onAnnotationLoad?.(idStr) // Fire individual load callback (annotationData can be added later if needed)
                
                // Don't manually call fireStateChangeCallbacks here - let the useEffect handle it
                // after React has applied the state updates. Manual calls cause race conditions.
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
                onAnnotationHide?.(idStr) // Fire individual hide callback

                // Clear loading state if it exists
                setLoadingAnnotations(prev => {
                    const next = new Set(prev)
                    next.delete(idStr)
                    return next
                })
                
                // Don't manually call fireStateChangeCallbacks here - let the useEffect handle it
                // after React has applied the state updates. Manual calls cause race conditions.
            }
        }, [externalLoadedAnnotations, externalVisibleAnnotations, externalAnnotationOpacities, loadedAnnotations, onAnnotationLoadChange, onAnnotationLoad, onAnnotationHide, fireStateChangeCallbacks])

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
            
            // Don't manually call fireStateChangeCallbacks here - let the useEffect handle it
            // after React has applied the state updates. Manual calls cause race conditions.
        }, [externalAnnotationOpacities, externalVisibleAnnotations, annotationOpacities, onAnnotationOpacityChange, onAnnotationVisibilityChange, fireStateChangeCallbacks])

        // Set annotation opacity
        const setOpacity = useCallback((annotationId: string, opacity: number) => {
            if (!externalAnnotationOpacities) {
                setInternalAnnotationOpacities(prev => new Map(prev).set(annotationId, opacity))
            }
            onAnnotationOpacityChange?.(annotationId, opacity)
            
            // Don't manually call fireStateChangeCallbacks here - let the useEffect handle it
            // after React has applied the state updates. Manual calls cause race conditions.
        }, [externalAnnotationOpacities, onAnnotationOpacityChange, fireStateChangeCallbacks])

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

                    debugLog.log(`Fetching annotations from: ${url}`)
                    const response = await customFetch(url, fetchOptions)

                    if (!response.ok) {
                        throw new Error(`Failed to fetch annotations: ${response.status} ${response.statusText}`)
                    }

                    const data = await response.json()
                    debugLog.log(`API response:`, data)

                    // Store raw response as JSON string for debug panel
                    if (showDebugPanel) {
                        setRawApiResponse(JSON.stringify(data, null, 2))
                    }

                    // Handle both array response and paginated response
                    let annotationList: AnnotationSearchResult[] = []
                    if (Array.isArray(data)) {
                        // DSA API returns array directly
                        annotationList = data
                        debugLog.log(`Parsed ${annotationList.length} annotation(s) from array response`)
                    } else if (data && Array.isArray(data.data)) {
                        // Some APIs might return paginated response
                        annotationList = data.data
                        debugLog.log(`Parsed ${annotationList.length} annotation(s) from paginated response`)
                    } else if (data && typeof data === 'object') {
                        // If it's a single annotation object, wrap it in an array
                        annotationList = [data]
                        debugLog.log(`Parsed 1 annotation from single object response`)
                    } else {
                        debugLog.warn(`Unexpected response format:`, typeof data, data)
                    }

                    setAnnotations(annotationList)
                    debugLog.log(`Fetched ${annotationList.length} annotation(s) from API`)
                    if (annotationList.length > 0) {
                        debugLog.log(`Annotation IDs:`, annotationList.map(a => a._id))
                    }
                    
                    // Fire annotation headers change callback automatically
                    if (onAnnotationHeadersChange && annotationList.length > 0) {
                        const headersMap = new Map<string | number, AnnotationSearchResult>()
                        annotationList.forEach((ann) => {
                            headersMap.set(String(ann._id), ann)
                        })
                        onAnnotationHeadersChange(headersMap)
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
        }, [imageId, apiBaseUrl, limit, fetchFn, apiHeaders, onAnnotationsLoaded, onError, showDebugPanel, onAnnotationHeadersChange])

        // Fire annotation headers change callback when annotations change (for non-controlled usage)
        useEffect(() => {
            if (onAnnotationHeadersChange && annotations.length > 0) {
                const headersMap = new Map<string | number, AnnotationSearchResult>()
                annotations.forEach((ann) => {
                    headersMap.set(String(ann._id), ann)
                })
                onAnnotationHeadersChange(headersMap)
            }
        }, [annotations, onAnnotationHeadersChange])

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
            handleAnnotationReady: handleAnnotationReadyInternal,
            onAnnotationReady: onAnnotationReady,
            loadingAnnotations,
        }), [annotations, loading, error, loadedAnnotations, visibleAnnotations, annotationOpacities, toggleLoad, toggleVisibility, setOpacity, handleAnnotationReadyInternal, onAnnotationReady, loadingAnnotations])

        // Expose imperative handle for parent components to query annotation state
        const containerRef = useRef<HTMLDivElement>(null)
        useImperativeHandle(ref, () => ({
            getAnnotations: () => annotations,
            getAnnotation: (id: string) => annotations.find(a => String(a._id) === id),
            getLoadedAnnotationIds: () => Array.from(loadedAnnotations),
            isAnnotationLoaded: (id: string) => loadedAnnotations.has(id),
            isAnnotationVisible: (id: string) => {
                const opacity = annotationOpacities.get(id) ?? 1
                return opacity > 0
            },
            getAnnotationOpacity: (id: string) => annotationOpacities.get(id) ?? 1,
            isAnnotationLoading: (id: string) => loadingAnnotations.has(id),
            getVisibleAnnotationIds: () => {
                return Array.from(loadedAnnotations).filter(id => {
                    const opacity = annotationOpacities.get(id) ?? 1
                    return opacity > 0
                })
            },
            getAnnotationState: () => ({
                loadedAnnotationIds: Array.from(loadedAnnotations),
                opacities: new Map(annotationOpacities),
                visibility: new Map(visibleAnnotations),
                loadingAnnotationIds: Array.from(loadingAnnotations),
            }),
        }), [annotations, loadedAnnotations, visibleAnnotations, annotationOpacities, loadingAnnotations])

        // Helper function to filter out element-level info from metadata
        const filterMetadata = useCallback((ann: AnnotationSearchResult): Record<string, unknown> => {
            const filtered: Record<string, unknown> = {}
            
            // Include top-level metadata fields
            const fieldsToInclude = [
                '_id',
                '_modelType',
                '_elementCount',
                '_detailsCount',
                '_version',
                '_accessLevel',
                'itemId',
                'public',
                'created',
                'updated',
                'creatorId',
                'updatedId',
                'groups',
            ]
            
            // Add top-level fields
            fieldsToInclude.forEach(key => {
                if (key in ann && ann[key] !== undefined) {
                    filtered[key] = ann[key]
                }
            })
            
            // Include annotation.name and annotation.description, but not nested element data
            if (ann.annotation) {
                filtered.annotation = {
                    name: ann.annotation.name,
                    description: ann.annotation.description,
                    attributes: ann.annotation.attributes,
                    display: ann.annotation.display,
                }
            }
            
            // Include any other top-level fields that aren't element-level data
            Object.keys(ann).forEach(key => {
                if (!fieldsToInclude.includes(key) && key !== 'annotation') {
                    const value = ann[key]
                    // Skip if it's an array of complex objects (likely element data)
                    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                        // Skip arrays of objects (likely elements)
                        return
                    }
                    // Skip if it's a deeply nested object (likely element data)
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        const keys = Object.keys(value)
                        if (keys.length > 10) {
                            // Likely element data, skip
                            return
                        }
                    }
                    filtered[key] = value
                }
            })
            
            return filtered
        }, [])

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
                                            className={`bdsa-annotation-manager__annotation-card-button bdsa-annotation-manager__annotation-card-button--metadata`}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setViewingMetadataFor(ann._id)
                                            }}
                                            title="View metadata"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="16" x2="12" y2="12" />
                                                <line x1="12" y1="8" x2="12.01" y2="8" />
                                            </svg>
                                        </button>
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
                                            {ann.updated && (
                                                <span className="bdsa-annotation-manager__annotation-card-detail-separator">•</span>
                                            )}
                                            {ann.updated && (
                                                <span className="bdsa-annotation-manager__annotation-card-detail-date">
                                                    Modified: {new Date(ann.updated).toLocaleDateString(undefined, { 
                                                        year: 'numeric', 
                                                        month: 'short', 
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            )}
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
                ref={containerRef}
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
                {viewingMetadataFor && (() => {
                    const ann = annotations.find(a => String(a._id) === viewingMetadataFor)
                    if (!ann) return null
                    const filteredMetadata = filterMetadata(ann)
                    return (
                        <div 
                            className="bdsa-annotation-manager__metadata-modal-overlay"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    setViewingMetadataFor(null)
                                }
                            }}
                        >
                            <div className="bdsa-annotation-manager__metadata-modal">
                                <div className="bdsa-annotation-manager__metadata-modal-header">
                                    <h3>Metadata: {ann.annotation?.name || ann._id}</h3>
                                    <button
                                        className="bdsa-annotation-manager__metadata-modal-close"
                                        onClick={() => setViewingMetadataFor(null)}
                                        title="Close"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="bdsa-annotation-manager__metadata-modal-content">
                                    <pre className="bdsa-annotation-manager__metadata-modal-json">
                                        {JSON.stringify(filteredMetadata, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )
                })()}
            </div>
        )
    }
)

AnnotationManager.displayName = 'AnnotationManager'

