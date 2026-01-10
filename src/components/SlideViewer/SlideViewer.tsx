import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PaperOverlay, AnnotationToolkit } from 'osd-paperjs-annotation'
import type { FeatureCollection, Feature } from 'geojson'
import type { Viewer as OpenSeadragonViewer } from 'openseadragon'
import { IndexedDBAnnotationCache } from '../../cache'
import { applyPaperJsPatches } from '../../utils/patchOsdPaperjs'
import { createDebugLogger } from '../../utils/debugLog'
import type { SlideViewerProps, AnnotationFeature } from './SlideViewer.types'
import { extractToken, appendTokenToUrl, DEFAULT_ANNOTATION_INFO_CONFIG } from './SlideViewer.utils'
import { useAnnotationFetching, useAnnotationRendering, useAnnotationOpacity, useSlideViewerInitialization, useViewportChange, useOverlayTileSources } from './hooks'

// Apply patches IMMEDIATELY when this module loads (not in a component lifecycle)
// This must happen before any Paper.js operations
applyPaperJsPatches()
import './SlideViewer.css'

// Re-export types for backward compatibility
export type { SlideImageInfo, AnnotationFeature, AnnotationInfoProperty, AnnotationInfoConfig, SlideViewerProps, ViewportBounds, OverlayTileSource } from './SlideViewer.types'

/**
 * A slide viewer component that integrates OpenSeadragon with Paper.js annotations
 * for viewing Digital Slide Archive images with annotation overlays.
 */
export const SlideViewer = React.forwardRef<HTMLDivElement, SlideViewerProps>(
    (
        {
            imageInfo,
            annotations = [],
            annotationIds = [],
            apiBaseUrl,
            onViewerReady,
            onAnnotationClick,
            onViewportChange,
            defaultAnnotationColor = '#ff0000',
            strokeWidth = 2,
            osdOptions = {},
            className = '',
            height = '600px',
            width = '100%',
            showAnnotationInfo = false,
            annotationInfoConfig,
            maxPointsPerAnnotation = 10000,
            maxTotalPoints = 100000,
            fetchFn,
            apiHeaders,
            authToken,
            tokenQueryParam = false,
            showAnnotationControls = false,
            defaultAnnotationOpacity = 1,
            annotationOpacities,
            visibleAnnotations,
            onAnnotationReady,
            annotationCache: externalAnnotationCache,
            disableCache = false,
            disableVisibilityCheck = false,
            annotationHeaders,
            onApiError,
            overlayTileSources = [],
            debug = false,
        },
        ref
    ) => {
        const containerRef = useRef<HTMLDivElement>(null)
        const [viewer, setViewer] = useState<OpenSeadragonViewer | null>(null)
        const [overlay, setOverlay] = useState<PaperOverlay | null>(null)
        const [toolkit, setToolkit] = useState<AnnotationToolkit | null>(null)
        const tiledImageRef = useRef<{ addPaperItem: (item: unknown) => void; paperItems?: unknown[] } | null>(null)
        const lastRenderedAnnotationsRef = useRef<string>('')
        const [annotationOpacity, setAnnotationOpacity] = useState<number>(defaultAnnotationOpacity)

        // Create debug logger
        const debugLog = useMemo(() => createDebugLogger('SlideViewer', debug), [debug])

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

        // Track if component is mounted to prevent operations after unmount
        const isMountedRef = useRef(true)
        useEffect(() => {
            isMountedRef.current = true
            return () => {
                isMountedRef.current = false
            }
        }, [])

        // Track component visibility to prevent initialization when hidden
        // This prevents _transformBounds errors by ensuring Paper.js only initializes when visible
        const [isVisible, setIsVisible] = useState(!disableVisibilityCheck) // Initialize as visible if check disabled
        useEffect(() => {
            if (disableVisibilityCheck) {
                // Visibility check disabled - always consider visible
                setIsVisible(true)
                return
            }
            
            if (!containerRef.current) return

            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
                            setIsVisible(true)
                        } else {
                            setIsVisible(false)
                        }
                    })
                },
                { threshold: 0.1, rootMargin: '50px' }
            )

            observer.observe(containerRef.current)

            return () => {
                if (containerRef.current) {
                    observer.unobserve(containerRef.current)
                }
            }
        }, [disableVisibilityCheck])

        // Global error handler to catch _transformBounds errors from library's mouse handlers
        useEffect(() => {
            // Comprehensive check for _transformBounds related errors
            const isTransformBoundsError = (error: unknown): boolean => {
                if (!error) return false
                
                // Check error message
                const message = error instanceof Error ? error.message : String(error)
                if (message && typeof message === 'string') {
                    const lowerMessage = message.toLowerCase()
                    if (lowerMessage.includes('_transformbounds') || 
                        lowerMessage.includes('transformbounds') ||
                        lowerMessage.includes('cannot read properties of null') ||
                        lowerMessage.includes('reading \'_transformbounds\'') ||
                        lowerMessage.includes('reading "_transformbounds"')) {
                        return true
                    }
                }
                
                // Check stack trace
                if (error instanceof Error && error.stack) {
                    const lowerStack = error.stack.toLowerCase()
                    if (lowerStack.includes('_transformbounds') || 
                        lowerStack.includes('transformbounds') ||
                        lowerStack.includes('getbounds')) {
                        return true
                    }
                }
                
                // Check if source file is from osd-paperjs-annotation
                if (error instanceof ErrorEvent) {
                    const filename = error.filename || ''
                    if (filename.includes('osd-paperjs-annotation') || 
                        filename.includes('annotation.js')) {
                        const message = error.message || String(error)
                        if (message.includes('null') || message.includes('_transformBounds')) {
                            return true
                        }
                    }
                }
                
                return false
            }

            // Global error handler for _transformBounds errors
            const errorHandler = (event: ErrorEvent | Event) => {
                const error = event instanceof ErrorEvent ? event.error || event : event
                
                if (isTransformBoundsError(error)) {
                    // Suppress the error silently (or log at debug level only)
                    if (event instanceof ErrorEvent) {
                        event.preventDefault()
                        event.stopPropagation()
                    }
                    return true
                }
                return false
            }

            // Unhandled rejection handler
            const rejectionHandler = (event: PromiseRejectionEvent) => {
                const reason = event.reason
                
                if (isTransformBoundsError(reason)) {
                    // Suppress the rejection
                    event.preventDefault()
                    event.stopPropagation()
                    return true
                }
                return false
            }

            // Add event listeners with capture phase for maximum coverage
            window.addEventListener('error', errorHandler as EventListener, true)
            window.addEventListener('unhandledrejection', rejectionHandler, true)

            // Also set window.onerror as fallback (though addEventListener is preferred)
            const originalOnError = window.onerror
            window.onerror = (message, source, lineno, colno, error) => {
                if (isTransformBoundsError(error) || isTransformBoundsError(message)) {
                    return true // Suppress error
                }
                // Call original handler if it exists
                if (originalOnError) {
                    return originalOnError(message, source, lineno, colno, error)
                }
                return false
            }

            // Cleanup
            return () => {
                window.removeEventListener('error', errorHandler as EventListener, true)
                window.removeEventListener('unhandledrejection', rejectionHandler, true)
                window.onerror = originalOnError
            }
        }, [])

        // Helper function to check if Paper.js is fully initialized and ready
        const isPaperJsReady = useCallback((paperScope: PaperOverlay['paperScope']): boolean => {
            if (!paperScope) return false
            if (!paperScope.view) return false
            // Check if _transformBounds exists (Paper.js internal property indicating initialization)
            const view = paperScope.view as any
            if (view._transformBounds === null || view._transformBounds === undefined) {
                return false
            }
            if (typeof paperScope.view.draw !== 'function') return false
            return true
        }, [])

        // Safe wrapper for Paper.js view.draw() that checks initialization
        const safeDrawPaperView = useCallback((paperScope: PaperOverlay['paperScope']): void => {
            if (!isMountedRef.current) return
            if (!isPaperJsReady(paperScope)) {
                console.warn('Paper.js not fully initialized, skipping draw operation')
                return
            }
            try {
                if (paperScope.view && typeof paperScope.view.draw === 'function') {
                    paperScope.view.draw()
                }
            } catch (error) {
                // Silently catch _transformBounds errors - component might be unmounting or hidden
                if (error instanceof Error && error.message.includes('_transformBounds')) {
                    console.warn('Paper.js draw operation skipped (component likely unmounting or hidden)')
                } else {
                    console.error('Error drawing Paper.js view:', error)
                }
            }
        }, [isPaperJsReady])

        // Generate a unique viewer ID for this component instance
        const viewerIdRef = useRef(`osd-viewer-${Math.random().toString(36).substr(2, 9)}`)

        // Track if viewer is already initialized to prevent multiple creations
        const isInitializedRef = useRef(false)
        
        // Track last imageKey to detect when it actually changes
        const lastImageKeyRef = useRef<string>('')

        // Store callbacks in refs to avoid dependency issues
        const onViewerReadyRef = useRef(onViewerReady)
        useEffect(() => {
            onViewerReadyRef.current = onViewerReady
        }, [onViewerReady])

        const onAnnotationClickRef = useRef(onAnnotationClick)
        useEffect(() => {
            onAnnotationClickRef.current = onAnnotationClick
        }, [onAnnotationClick])

        // Extract token from authToken or apiHeaders (memoized)
        const token = useMemo(() => {
            return extractToken(authToken, apiHeaders)
        }, [authToken, apiHeaders])

        // Create wrapped fetch function that appends token to URLs when tokenQueryParam is true
        const wrappedFetch = useMemo(() => {
            const baseFetch = fetchFn || fetch
            if (!tokenQueryParam || !token) {
                return baseFetch
            }
            
            return (url: string, options?: RequestInit) => {
                const urlWithToken = appendTokenToUrl(url, token)
                return baseFetch(urlWithToken, options)
            }
        }, [fetchFn, token, tokenQueryParam])

        // Get the DZI URL with token if needed (memoized to prevent unnecessary re-renders)
        const processedDziUrl = useMemo((): string | null => {
            if (!imageInfo.dziUrl) {
                return null
            }
            if (tokenQueryParam && token) {
                return appendTokenToUrl(imageInfo.dziUrl, token)
            }
            return imageInfo.dziUrl ?? null
        }, [imageInfo.dziUrl, token, tokenQueryParam])

        // Get the DZI URL or construct a key for manual mode to track changes (memoized to prevent unnecessary re-renders)
        const imageKey = useMemo(() => {
            return processedDziUrl || imageInfo.dziUrl || `${imageInfo.imageId}-${imageInfo.baseUrl}`
        }, [processedDziUrl, imageInfo.dziUrl, imageInfo.imageId, imageInfo.baseUrl])

        // Create stable key for annotations to prevent unnecessary re-renders
        const annotationsKey = useMemo(() => {
            if (Array.isArray(annotations)) {
                return JSON.stringify(annotations.map(a => ({ id: a.id, left: a.left, top: a.top, width: a.width, height: a.height })))
            } else if (annotations && typeof annotations === 'object' && 'type' in annotations && annotations.type === 'FeatureCollection') {
                return JSON.stringify((annotations as FeatureCollection).features?.map(f => ({ id: f.id })) || [])
            }
            return '[]'
        }, [annotations])

        // Fetch annotations from DSA API if annotationIds are provided
        const { fetchedAnnotations, annotationDocuments } = useAnnotationFetching(
            annotationIds,
            apiBaseUrl,
            defaultAnnotationColor,
            maxPointsPerAnnotation,
            maxTotalPoints,
            wrappedFetch,
            cache,
            annotationHeaders,
            apiHeaders,
            isMountedRef,
            debug,
            onApiError
        )

        // Create stable key for fetched annotations
        const fetchedAnnotationsKey = useMemo(() => {
            return fetchedAnnotations.map(a => `${a.id}:${a.left}:${a.top}:${a.width}:${a.height}`).join('|')
        }, [fetchedAnnotations])

        // Parse annotations once to avoid recreating in effect
        const parsedManualAnnotations = useMemo(() => {
            if (!Array.isArray(annotations) && annotations && typeof annotations === 'object' && 'type' in annotations && annotations.type === 'FeatureCollection') {
                // GeoJSON FeatureCollection
                return annotations.features
                    .map((feature: Feature) => {
                        if (feature.geometry.type === 'Polygon') {
                            const coords = feature.geometry.coordinates[0]
                            if (coords.length >= 4) {
                                const [left, top] = coords[0]
                                const [rightX, , , bottomY] = coords[2]
                                const width = rightX - left
                                const height = bottomY - top

                                return {
                                    id: feature.id || feature.properties?.id,
                                    left,
                                    top,
                                    width,
                                    height,
                                    color: feature.properties?.color || defaultAnnotationColor,
                                    group: feature.properties?.group,
                                    label: feature.properties?.label,
                                    ...feature.properties,
                                } as AnnotationFeature
                            }
                        }
                        return null
                    })
                    .filter((item): item is AnnotationFeature => item !== null)
            } else if (Array.isArray(annotations)) {
                return [...annotations]
            }
            return []
        }, [annotationsKey, defaultAnnotationColor])

        // Initialize OpenSeadragon viewer
        useSlideViewerInitialization(
            containerRef,
            isVisible,
            isMountedRef,
            isInitializedRef,
            lastImageKeyRef,
            viewerIdRef,
            imageKey,
            processedDziUrl,
            imageInfo,
            token,
            tokenQueryParam,
            apiHeaders,
            osdOptions,
            onViewerReadyRef,
            setViewer,
            setOverlay,
            setToolkit,
            tiledImageRef,
            appendTokenToUrl,
            debugLog
        )

        // Render annotations when they change
        useAnnotationRendering(
            viewer,
            overlay,
            toolkit,
            parsedManualAnnotations,
            fetchedAnnotations,
            annotationsKey,
            fetchedAnnotationsKey,
            annotationOpacity,
            annotationOpacities,
            visibleAnnotations,
            defaultAnnotationColor,
            strokeWidth,
            onAnnotationClickRef,
            onAnnotationReady,
            tiledImageRef,
            lastRenderedAnnotationsRef,
            safeDrawPaperView,
            debugLog
        )

        // OLD CODE - REPLACED BY useAnnotationRendering hook above
        /* useEffect(() => {
            if (!viewer || !overlay || !toolkit) return

            const paperScope = overlay.paperScope
            if (!paperScope || !paperScope.project) return

            // Wait for tiled image to be ready first - early return if not ready
            const tiledImage = tiledImageRef.current
            if (!tiledImage || typeof tiledImage.addPaperItem !== 'function') {
                // Tiled image not ready yet, skip this render cycle
                return
            }

            // Combine parsed manual annotations with fetched annotations
            const annotationFeatures: AnnotationFeature[] = [...parsedManualAnnotations, ...fetchedAnnotations]

            // Create a stable key for this set of annotations to prevent duplicate renders
            const combinedKey = `${annotationsKey}:${fetchedAnnotationsKey}`

            // Skip if we've already rendered these exact annotations
            if (lastRenderedAnnotationsRef.current === combinedKey) {
                return // Already rendered, skip
            }

            // Update ref BEFORE rendering to prevent re-entering
            lastRenderedAnnotationsRef.current = combinedKey

            debugLog.log(`Rendering ${annotationFeatures.length} total annotation(s)`)

            // If no annotations to render, clear existing ones and return
            if (annotationFeatures.length === 0) {
                // Clear existing annotations
                try {
                    const existingFeatures = toolkit.getFeatures()
                    if (existingFeatures && Array.isArray(existingFeatures)) {
                        for (const feature of existingFeatures) {
                            try {
                                (feature as { remove: () => void }).remove()
                            } catch (e) {
                                console.warn('Error removing feature:', e)
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Could not clear existing features:', e)
                }
                return
            }

            // TiledImage already checked above

            debugLog.log(`About to render ${annotationFeatures.length} annotations, tiledImage:`, tiledImage)

            // Clear existing annotations in proper order to avoid transform bounds errors
            // The osd-paperjs-annotation library can throw errors if items are removed
            // while mouse events are processing, so we need to be careful
            try {
                // Clear paper items from tiledImage first (synchronous, reverse order)
                if (tiledImage.paperItems && Array.isArray(tiledImage.paperItems) && tiledImage.paperItems.length > 0) {
                    // Make a copy and reverse to avoid index shifting issues
                    const itemsToRemove = [...tiledImage.paperItems].reverse()
                    for (const item of itemsToRemove) {
                        try {
                            if (item && typeof (item as { remove?: () => void }).remove === 'function') {
                                (item as { remove: () => void }).remove()
                            }
                        } catch (e) {
                            // Item may have already been removed or is invalid - that's okay
                            // Don't log to avoid console spam
                        }
                    }
                }

                // Clear toolkit features separately - they should be cleaned up when paper items are removed
                // But we'll clear them explicitly if they exist, with error handling
                try {
                    const existingFeatures = toolkit.getFeatures()
                    if (existingFeatures && Array.isArray(existingFeatures) && existingFeatures.length > 0) {
                        // Filter out null/undefined and only process valid features
                        const validFeatures = existingFeatures.filter(
                            (feature): feature is { remove: () => void } =>
                                feature !== null &&
                                feature !== undefined &&
                                typeof (feature as { remove?: () => void }).remove === 'function'
                        )

                        // Remove features one by one with error handling
                        for (const feature of validFeatures) {
                            try {
                                feature.remove()
                            } catch (e) {
                                // Feature may be already removed or invalid - that's okay
                                // This can happen if paper items were removed first
                            }
                        }
                    }
                } catch (e) {
                    // getFeatures() might fail if toolkit isn't ready - that's okay
                }
            } catch (e) {
                console.warn('Error clearing existing annotations:', e)
            }

            // Convert annotationOpacities to Map if needed (do this once before the loop)
            // Convert all keys to strings for consistent Map matching
            const opacityMap = annotationOpacities instanceof Map
                ? new Map(Array.from(annotationOpacities.entries()).map(([k, v]) => [String(k), v]))
                : annotationOpacities
                    ? new Map(Object.entries(annotationOpacities).map(([k, v]) => [String(k), v]))
                    : null

            // Track which document IDs have been rendered (to call onAnnotationReady)
            // Use string Set for consistency with AnnotationManager
            const renderedDocumentIds = new Set<string>()

            // Render each annotation
            for (const annotation of annotationFeatures) {
                try {
                    // Use documentId (annotation document ID) for lookup - convert to string for consistent matching
                    const documentId = (annotation as { documentId?: string | number }).documentId
                    const lookupId = documentId !== undefined ? String(documentId) : undefined
                    
                    debugLog.log(`SlideViewer: Processing annotation feature id=${annotation.id}, documentId=${documentId}, lookupId=${lookupId}`)
                    
                    // Get per-annotation opacity if available, otherwise use global opacity
                    // Use documentId (annotation document ID) for opacity lookup, not the individual feature ID
                    let annotationSpecificOpacity = annotationOpacity
                    if (opacityMap && lookupId !== undefined) {
                        const specificOpacity = opacityMap.get(lookupId)
                        if (specificOpacity !== undefined) {
                            annotationSpecificOpacity = specificOpacity
                        }
                    }
                    
                    debugLog.log(`SlideViewer: Annotation opacity=${annotationSpecificOpacity}, will ${annotationSpecificOpacity <= 0 ? 'skip' : 'render'}`)
                    
                    // Check visibility based on opacity (opacity-based visibility)
                    // Skip rendering if opacity is 0 (hidden)
                    if (annotationSpecificOpacity <= 0) {
                        debugLog.log(`SlideViewer: Skipping annotation with opacity 0 (hidden)`)
                        continue
                    }
                    
                    let paperItem: {
                        data?: { annotation?: AnnotationFeature }
                        onClick?: (event?: unknown) => void
                        annotationId?: string | number
                        style?: { rescale?: { strokeWidth: number } }
                        remove?: () => void
                    }

                    // Check if this is a polyline (like the working example)
                    if (annotation.annotationType === 'polyline' && annotation.points && Array.isArray(annotation.points)) {
                        // Create path from points (like the working example)
                        const path = new paperScope.Path() as any
                        const strokeColor = annotation.color || defaultAnnotationColor
                        path.strokeColor = applyOpacity(strokeColor, annotationSpecificOpacity)
                        path.strokeWidth = strokeWidth
                        const fillColor = (annotation.fillColor as string) || 'rgba(0, 0, 0, 0)'
                        path.fillColor = applyOpacity(fillColor, annotationSpecificOpacity)

                        // Add points to path (like the working example)
                        annotation.points.forEach((point: [number, number], pointIndex: number) => {
                            if (pointIndex === 0) {
                                path.moveTo(point[0], point[1])
                            } else {
                                path.lineTo(point[0], point[1])
                            }
                        })

                        // Close path if needed
                        if (annotation.closed) {
                            path.closePath()
                        }

                        paperItem = path
                    } else {
                        // Create rectangle path (like the working example pattern)
                        const rect = new paperScope.Rectangle(
                            annotation.left,
                            annotation.top,
                            annotation.width,
                            annotation.height
                        )
                        const rectPath = new paperScope.Path.Rectangle(rect) as any

                        // Set style properties
                        const strokeColor = annotation.color || defaultAnnotationColor
                        rectPath.strokeColor = applyOpacity(strokeColor, annotationSpecificOpacity)
                        rectPath.strokeWidth = strokeWidth
                        rectPath.fillColor = applyOpacity('rgba(0, 0, 0, 0)', annotationSpecificOpacity) // Transparent fill by default

                        paperItem = rectPath as any
                    }

                    // Store annotation data on the paper item (like the working example)
                    paperItem.data = {
                        annotation,
                    }
                    paperItem.annotationId = annotation.id

                    // Handle click events
                    if (onAnnotationClickRef.current) {
                        paperItem.onClick = (_event?: unknown) => {
                            onAnnotationClickRef.current?.(annotation)
                        }
                    }

                    // Make it resizable/selectable with the toolkit
                    paperItem.style = {
                        rescale: { strokeWidth },
                    }

                    // Add to the tiled image (like the working example)
                    tiledImage.addPaperItem(paperItem)

                    // Register with annotation toolkit (important!)
                    // Only register if item is valid and has the required properties
                    if (paperItem && typeof paperItem === 'object') {
                        try {
                            AnnotationToolkit.registerFeature(paperItem)
                        } catch (e) {
                            console.warn('Failed to register feature with toolkit:', e)
                        }
                    }

                    // Track this document ID as rendered
                    // Always use the normalized string version for consistency with AnnotationManager
                    if (lookupId !== undefined) {
                        renderedDocumentIds.add(lookupId)
                        debugLog.log(`SlideViewer: Added documentId '${lookupId}' to renderedDocumentIds. Set now has:`, Array.from(renderedDocumentIds))
                    } else {
                        console.warn(`SlideViewer: Cannot track document ID - lookupId is undefined for annotation id=${annotation.id}`)
                    }
                } catch (e) {
                    console.error(`Error rendering annotation ${annotation.id}:`, e, annotation)
                }
            }

            // Draw the view safely (like the working example)
            safeDrawPaperView(paperScope)

            debugLog.log(`Finished rendering ${annotationFeatures.length} annotations`)
            debugLog.log(`SlideViewer: onAnnotationReady is ${onAnnotationReady ? 'defined' : 'undefined'}, renderedDocumentIds has ${renderedDocumentIds.size} items:`, Array.from(renderedDocumentIds))
            
            // Call onAnnotationReady for each unique document ID that was rendered
            if (onAnnotationReady && renderedDocumentIds.size > 0) {
                // Use setTimeout to ensure rendering is complete before notifying
                setTimeout(() => {
                    debugLog.log(`SlideViewer: setTimeout fired, calling onAnnotationReady for ${renderedDocumentIds.size} document(s)`)
                    renderedDocumentIds.forEach((documentId) => {
                        try {
                            // documentId is already a normalized string from the Set
                            debugLog.log(`SlideViewer: Calling onAnnotationReady('${documentId}')`)
                            onAnnotationReady(documentId)
                        } catch (e) {
                            console.error(`Error calling onAnnotationReady for ${documentId}:`, e)
                        }
                    })
                }, 100)
            } else {
                console.warn(`SlideViewer: Not calling onAnnotationReady - callback is ${onAnnotationReady ? '' : 'not '}defined, renderedDocumentIds has ${renderedDocumentIds.size} items`)
            }
        }, [
            viewer,
            overlay,
            toolkit,
            annotationsKey, // Stable key for manual annotations
            fetchedAnnotationsKey, // Stable key for fetched annotations
            strokeWidth,
            // REMOVED annotationOpacity and annotationOpacities from dependencies
            // They are handled by the separate opacity update effect below (lines 1614-1734)
            // This prevents full re-renders when only opacity changes
            visibleAnnotations, // Re-render when visibility changes
            onAnnotationReady, // Include callback in dependencies
            // parsedManualAnnotations and fetchedAnnotations are captured from closure
            // onAnnotationClick removed - using ref instead
        ]) */

        // Update opacity on existing annotations when opacity changes
        useAnnotationOpacity(
            viewer,
            overlay,
            toolkit,
            annotationOpacity,
            annotationOpacities,
            visibleAnnotations,
            defaultAnnotationOpacity,
            defaultAnnotationColor,
            safeDrawPaperView
        )

        // Handle viewport change callbacks
        useViewportChange(viewer, onViewportChange, imageInfo, debugLog)

        // Get base image dimensions for overlay positioning
        const [baseImageWidth, setBaseImageWidth] = useState<number | null>(null)
        const [baseImageHeight, setBaseImageHeight] = useState<number | null>(null)

        // Update base image dimensions when viewer or image changes
        // Prioritize imageInfo dimensions as they represent the actual pixel dimensions
        useEffect(() => {
            if (!viewer) {
                setBaseImageWidth(null)
                setBaseImageHeight(null)
                return
            }

            // Prioritize imageInfo dimensions if available (these are the actual pixel dimensions)
            if (imageInfo.width && imageInfo.height) {
                setBaseImageWidth(imageInfo.width)
                setBaseImageHeight(imageInfo.height)
                debugLog.log('Base image dimensions (from imageInfo):', imageInfo.width, imageInfo.height)
                return
            }

            const world = viewer.world
            if (!world || world.getItemCount() === 0) {
                setBaseImageWidth(null)
                setBaseImageHeight(null)
                return
            }

            // Get dimensions from the base (first) tiled image as fallback
            const baseTiledImage = world.getItemAt(0)
            if (baseTiledImage) {
                try {
                    const contentSize = (baseTiledImage as any).getContentSize?.()
                    if (contentSize && contentSize.x > 0 && contentSize.y > 0) {
                        setBaseImageWidth(contentSize.x)
                        setBaseImageHeight(contentSize.y)
                        debugLog.log('Base image dimensions (from contentSize):', contentSize.x, contentSize.y)
                        return
                    }

                    const sourceBounds = (baseTiledImage as any).getSourceBounds?.()
                    if (sourceBounds && sourceBounds.width > 0 && sourceBounds.height > 0) {
                        setBaseImageWidth(sourceBounds.width)
                        setBaseImageHeight(sourceBounds.height)
                        debugLog.log('Base image dimensions (from sourceBounds):', sourceBounds.width, sourceBounds.height)
                        return
                    }
                } catch (error) {
                    debugLog.warn('Error getting base image dimensions:', error)
                }
            }
        }, [viewer, imageInfo, debugLog])

        // Handle overlay tile sources
        useOverlayTileSources(viewer, overlayTileSources, baseImageWidth, baseImageHeight, debugLog)

        // Merge user config with defaults
        const infoConfig = useMemo(() => {
            return {
                documentProperties: annotationInfoConfig?.documentProperties ?? DEFAULT_ANNOTATION_INFO_CONFIG.documentProperties ?? [],
                showFetchedSection: annotationInfoConfig?.showFetchedSection ?? DEFAULT_ANNOTATION_INFO_CONFIG.showFetchedSection ?? true,
                showProvidedSection: annotationInfoConfig?.showProvidedSection ?? DEFAULT_ANNOTATION_INFO_CONFIG.showProvidedSection ?? true,
                showTotalSection: annotationInfoConfig?.showTotalSection ?? DEFAULT_ANNOTATION_INFO_CONFIG.showTotalSection ?? true,
                headerText: annotationInfoConfig?.headerText ?? DEFAULT_ANNOTATION_INFO_CONFIG.headerText ?? 'Annotation Information',
            }
        }, [annotationInfoConfig])

        const containerStyle: React.CSSProperties = {
            width: typeof width === 'number' ? `${width}px` : width,
            height: typeof height === 'number' ? `${height}px` : height,
        }

        return (
            <div
                ref={ref}
                className={`bdsa-slide-viewer ${className}`}
                style={containerStyle}
            >
                <div ref={containerRef} className="bdsa-slide-viewer__container" />
                {(showAnnotationInfo || showAnnotationControls) && (
                    <div className="bdsa-slide-viewer__sidebar">
                        {showAnnotationControls && (
                            <div className="bdsa-slide-viewer__controls">
                                <div className="bdsa-slide-viewer__controls-header">
                                    <strong>Annotation Controls</strong>
                                </div>
                                <div className="bdsa-slide-viewer__controls-section">
                                    <div className="bdsa-slide-viewer__controls-label">
                                        Opacity: {Math.round(annotationOpacity * 100)}%
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={annotationOpacity}
                                        onChange={(e) => setAnnotationOpacity(parseFloat(e.target.value))}
                                        className="bdsa-slide-viewer__opacity-slider"
                                    />
                                </div>
                            </div>
                        )}
                        {showAnnotationInfo && ((Array.isArray(annotations) && annotations.length > 0) || (!Array.isArray(annotations) && annotations && 'type' in annotations && annotations.type === 'FeatureCollection' && annotations.features?.length > 0) || annotationDocuments.length > 0 || fetchedAnnotations.length > 0) && (
                            <div className="bdsa-slide-viewer__annotation-info">
                                <div className="bdsa-slide-viewer__annotation-info-header">
                                    <strong>{infoConfig.headerText}</strong>
                                </div>
                                {infoConfig.showFetchedSection && annotationDocuments.length > 0 && (
                                    <div className="bdsa-slide-viewer__annotation-info-section">
                                        <div className="bdsa-slide-viewer__annotation-info-title">Fetched from DSA API:</div>
                                        {annotationDocuments.map((doc) => (
                                            <div key={doc.id} className="bdsa-slide-viewer__annotation-info-item">
                                                {infoConfig.documentProperties
                                                    .filter((prop) => prop.show !== false)
                                                    .map((prop) => {
                                                        const value = doc[prop.key as keyof typeof doc]
                                                        const displayValue = prop.formatter
                                                            ? prop.formatter(value, { ...doc, totalPoints: (doc as any).totalPoints ?? 0 })
                                                            : String(value ?? 'N/A')
                                                        return (
                                                            <div key={prop.key}>
                                                                {prop.label}: {displayValue}
                                                            </div>
                                                        )
                                                    })}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {infoConfig.showProvidedSection &&
                                    ((Array.isArray(annotations) && annotations.length > 0) ||
                                        (!Array.isArray(annotations) && annotations && annotations.type === 'FeatureCollection')) && (
                                        <div className="bdsa-slide-viewer__annotation-info-section">
                                            <div className="bdsa-slide-viewer__annotation-info-title">Provided Annotations:</div>
                                            <div className="bdsa-slide-viewer__annotation-info-item">
                                                {Array.isArray(annotations) ? (
                                                    <div>Count: {annotations.length}</div>
                                                ) : (
                                                    <div>GeoJSON FeatureCollection with {annotations.features?.length || 0} features</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                {infoConfig.showTotalSection && (
                                    <div className="bdsa-slide-viewer__annotation-info-section">
                                        <div className="bdsa-slide-viewer__annotation-info-title">Total Rendered:</div>
                                        <div className="bdsa-slide-viewer__annotation-info-item">
                                            {fetchedAnnotations.length + (Array.isArray(annotations) ? annotations.length : 0)} annotation(s)
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }
)

SlideViewer.displayName = 'SlideViewer'

