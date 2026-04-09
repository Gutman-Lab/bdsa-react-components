import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PaperOverlay, AnnotationToolkit } from 'osd-paperjs-annotation'
import type { FeatureCollection, Feature } from 'geojson'
import OpenSeadragon from 'openseadragon'
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
            onToolkitReady,
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
            showInfoBar = false,
        },
        ref
    ) => {
        const containerRef = useRef<HTMLDivElement>(null)
        const [viewer, setViewer] = useState<OpenSeadragonViewer | null>(null)
        const [overlay, setOverlay] = useState<InstanceType<typeof PaperOverlay> | null>(null)
        const [toolkit, setToolkit] = useState<InstanceType<typeof AnnotationToolkit> | null>(null)
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
        const isPaperJsReady = useCallback((paperScope: InstanceType<typeof PaperOverlay>['paperScope']): boolean => {
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
        const safeDrawPaperView = useCallback((paperScope: InstanceType<typeof PaperOverlay>['paperScope']): void => {
            if (!isMountedRef.current) return
            if (!isPaperJsReady(paperScope)) {
                debugLog.log('Paper.js not fully initialized, skipping draw operation')
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

        const onToolkitReadyRef = useRef(onToolkitReady)
        useEffect(() => {
            onToolkitReadyRef.current = onToolkitReady
        }, [onToolkitReady])
        useEffect(() => {
            if (toolkit && onToolkitReadyRef.current) {
                onToolkitReadyRef.current(toolkit)
            }
        }, [toolkit])

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
                        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'LineString') {
                            const ring = feature.geometry.type === 'Polygon'
                                ? feature.geometry.coordinates[0]
                                : feature.geometry.coordinates
                            const points = ring as Array<[number, number]>
                            if (points.length < 2) return null

                            const xs = points.map(p => p[0])
                            const ys = points.map(p => p[1])
                            const left = Math.min(...xs)
                            const top = Math.min(...ys)
                            const width = Math.max(...xs) - left
                            const height = Math.max(...ys) - top

                            return {
                                id: feature.id || feature.properties?.id,
                                left,
                                top,
                                width,
                                height,
                                color: (feature.properties?.lineColor as string) || (feature.properties?.color as string) || defaultAnnotationColor,
                                fillColor: (feature.properties?.fillColor as string) || 'rgba(0,0,0,0)',
                                group: feature.properties?.group,
                                label: feature.properties?.label,
                                annotationType: 'polyline' as const,
                                points,
                                closed: feature.geometry.type === 'Polygon',
                            } as AnnotationFeature
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

        // Info bar state: mouse image coordinates and current zoom level
        const [mouseImagePos, setMouseImagePos] = useState<{ x: number; y: number } | null>(null)
        const [currentZoom, setCurrentZoom] = useState<number | null>(null)

        useEffect(() => {
            if (!viewer || !showInfoBar) return

            // Use OSD's own MouseTracker — same approach as the archive app.
            // Native DOM listeners don't work because the Paper.js canvas overlay
            // intercepts pointer events before they reach viewer.canvas.
            const mouseTracker = new (OpenSeadragon as any).MouseTracker({
                element: (viewer as any).canvas,
                moveHandler: (event: any) => {
                    try {
                        const pt = (viewer.viewport as any).viewerElementToImageCoordinates(event.position)
                        setMouseImagePos({ x: Math.round(pt.x), y: Math.round(pt.y) })
                    } catch (_) {}
                },
                leaveHandler: () => setMouseImagePos(null),
            })
            mouseTracker.setTracking(true)

            const handleZoom = (event: any) => setCurrentZoom(Math.round(event.zoom * 10) / 10)
            try { setCurrentZoom(Math.round(viewer.viewport.getZoom() * 10) / 10) } catch (_) {}
            viewer.addHandler('zoom', handleZoom)

            return () => {
                mouseTracker.destroy()
                viewer.removeHandler('zoom', handleZoom)
            }
        }, [viewer, showInfoBar])

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
                <div className="bdsa-slide-viewer__viewer-area">
                    {showInfoBar && (
                        <div className="bdsa-slide-viewer__info-bar">
                            <div className="bdsa-slide-viewer__info-bar-left">
                                <span className="bdsa-slide-viewer__mouse-coords">
                                    X: {mouseImagePos ? mouseImagePos.x : '--'}&nbsp;&nbsp;Y: {mouseImagePos ? mouseImagePos.y : '--'}
                                </span>
                                <span className="bdsa-slide-viewer__zoom-display">
                                    {currentZoom !== null ? `${currentZoom}x` : '--'}
                                </span>
                            </div>
                            <div className="bdsa-slide-viewer__zoom-buttons">
                                {[1, 5, 10, 20].map(level => (
                                    <button
                                        key={level}
                                        className="bdsa-slide-viewer__zoom-btn"
                                        onClick={() => viewer?.viewport.zoomTo(level)}
                                    >
                                        {level}x
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div ref={containerRef} className="bdsa-slide-viewer__container" />
                </div>
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

