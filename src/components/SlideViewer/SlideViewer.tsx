import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import OpenSeadragon from 'openseadragon'
import { PaperOverlay, AnnotationToolkit } from 'osd-paperjs-annotation'
import type { FeatureCollection, Feature } from 'geojson'
import type { Viewer as OpenSeadragonViewer, Options as OpenSeadragonOptions } from 'openseadragon'
import { IndexedDBAnnotationCache } from '../../cache'
/**
 * Compute version hash from annotation header for cache invalidation
 * Extracts version-relevant fields and computes a hash
 */
function computeVersionHash(header: Record<string, unknown>): string {
    // Extract fields that indicate changes
    const versionFields: Record<string, unknown> = {}
    if (header._id !== undefined) versionFields._id = header._id
    if (header._version !== undefined) versionFields._version = header._version
    if (header._modelType !== undefined) versionFields._modelType = header._modelType
    if (header.updated !== undefined) versionFields.updated = header.updated
    if (header.modified !== undefined) versionFields.modified = header.modified
    if (header._accessLevel !== undefined) versionFields._accessLevel = header._accessLevel
    
    // Include annotation metadata if present
    if (header.annotation && typeof header.annotation === 'object') {
        const ann = header.annotation as Record<string, unknown>
        if (ann.name !== undefined) versionFields.name = ann.name
    }
    
    // Simple hash function (djb2 variant)
    const jsonString = JSON.stringify(versionFields, Object.keys(versionFields).sort())
    let hash = 5381
    for (let i = 0; i < jsonString.length; i++) {
        hash = ((hash << 5) + hash) + jsonString.charCodeAt(i)
        hash = hash & hash // Convert to 32-bit integer
    }
    return (hash >>> 0).toString(16)
}
import './SlideViewer.css'

export interface SlideImageInfo {
    /** Image ID from DSA (used if dziUrl is not provided) */
    imageId?: string | number
    /** Image width in pixels (used if dziUrl is not provided) */
    width?: number
    /** Image height in pixels (used if dziUrl is not provided) */
    height?: number
    /** Tile width (used if dziUrl is not provided) */
    tileWidth?: number
    /** Number of zoom levels (used if dziUrl is not provided) */
    levels?: number
    /** Base URL for DSA tile server (used if dziUrl is not provided) */
    baseUrl?: string
    /** DZI descriptor URL (e.g., 'http://bdsa.pathology.emory.edu:8080/api/v1/item/{itemId}/tiles/dzi.dzi')
     *  If provided, this will be used instead of manually constructing tile URLs */
    dziUrl?: string
}

export interface AnnotationFeature {
    /** Unique identifier for the annotation */
    id?: string | number
    /** Left coordinate in pixels */
    left: number
    /** Top coordinate in pixels */
    top: number
    /** Width in pixels */
    width: number
    /** Height in pixels */
    height: number
    /** Optional color for the annotation stroke */
    color?: string
    /** Optional group identifier */
    group?: string | number
    /** Optional label */
    label?: string
    /** Type of annotation (rectangle, polyline, etc.) */
    annotationType?: 'rectangle' | 'polyline'
    /** Points array for polyline annotations */
    points?: Array<[number, number]>
    /** Whether polyline is closed */
    closed?: boolean
    /** Fill color for polyline */
    fillColor?: string
    /** Store full element for rendering */
    element?: unknown
    /** Optional additional properties */
    [key: string]: unknown
}

export interface AnnotationInfoProperty {
    /** Key to access the property value from the annotation document */
    key: string
    /** Display label for this property */
    label: string
    /** Optional formatter function to transform the value before display */
    formatter?: (value: unknown, doc: { id: string | number; elementCount: number; totalPoints: number; types: string[]; filteredCount?: number; filteredPoints?: number }) => string | React.ReactNode
    /** Whether to display this property (default: true) */
    show?: boolean
}

export interface AnnotationInfoConfig {
    /** Properties to display for each fetched annotation document */
    documentProperties?: AnnotationInfoProperty[]
    /** Whether to show the "Fetched from DSA API" section */
    showFetchedSection?: boolean
    /** Whether to show the "Provided Annotations" section */
    showProvidedSection?: boolean
    /** Whether to show the "Total Rendered" section */
    showTotalSection?: boolean
    /** Custom header text */
    headerText?: string
}

export interface SlideViewerProps {
    /** Image information for the slide to display */
    imageInfo: SlideImageInfo
    /** Annotations to render on the slide (array of rectangles or GeoJSON) */
    annotations?: AnnotationFeature[] | FeatureCollection
    /** Annotation IDs to fetch from DSA API (baseUrl/annotation/{id}) */
    annotationIds?: (string | number)[]
    /** Base URL for DSA API (e.g., 'http://bdsa.pathology.emory.edu:8080/api/v1') */
    apiBaseUrl?: string
    /** Callback when viewer is ready */
    onViewerReady?: (viewer: OpenSeadragonViewer) => void
    /** Callback when annotation is clicked */
    onAnnotationClick?: (annotation: AnnotationFeature) => void
    /** Default stroke color for annotations */
    defaultAnnotationColor?: string
    /** Stroke width for annotations */
    strokeWidth?: number
    /** Additional OpenSeadragon configuration options */
    osdOptions?: OpenSeadragonOptions
    /** Custom CSS class name */
    className?: string
    /** Height for the viewer container (e.g., '600px', '100vh', '100%').
     *  Required: OpenSeadragon needs an explicit height to initialize properly. */
    height?: string | number
    /** Width for the viewer container (defaults to '100%') */
    width?: string | number
    /** Display information about loaded annotation documents */
    showAnnotationInfo?: boolean
    /** Configuration for customizing the annotation info panel display */
    annotationInfoConfig?: AnnotationInfoConfig
    /** Maximum number of points allowed per annotation element (default: 10000).
     *  Annotations exceeding this limit will be skipped with a warning. */
    maxPointsPerAnnotation?: number
    /** Maximum total number of points allowed across all annotations (default: 100000).
     *  If exceeded, annotations will be filtered starting from the largest ones. */
    maxTotalPoints?: number
    /** Custom fetch function for API requests. Useful for adding authentication headers.
     *  If not provided, uses the default `fetch`. The function should match the Fetch API signature. */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>
    /** Custom headers to add to all API requests. Merged with fetchFn headers if both are provided. */
    apiHeaders?: HeadersInit
    /** Show annotation controls panel in the sidebar (default: false) */
    showAnnotationControls?: boolean
    /** Default opacity for all annotations (0-1, default: 1) */
    defaultAnnotationOpacity?: number
    /** Map of annotation IDs to their individual opacity values (0-1). Overrides defaultAnnotationOpacity for specific annotations. */
    annotationOpacities?: Map<string | number, number> | Record<string, number>
    /** Map of annotation IDs to their visibility state. If provided, only visible annotations will be rendered/updated. */
    visibleAnnotations?: Map<string | number, boolean> | Record<string, boolean>
    /** Callback when annotation has finished loading and rendering. Called with the annotation ID. */
    onAnnotationReady?: (annotationId: string | number) => void
    /** Optional pull-through cache for annotation documents. Acts as a cache-aside proxy:
     *  1. Checks cache first on fetch requests
     *  2. On cache miss, fetches from API and stores in cache
     *  3. On cache hit, returns cached data immediately (no API call)
     *  If not provided, automatically creates an IndexedDBAnnotationCache. Set to `null` to disable caching. */
    annotationCache?: {
        get(annotationId: string | number, versionHash?: string): Promise<unknown | null>
        set(annotationId: string | number, data: unknown, options?: { ttl?: number; versionHash?: string }): Promise<void>
        has(annotationId: string | number, versionHash?: string): Promise<boolean>
        delete(annotationId: string | number): Promise<void>
        clear(): Promise<void>
        getStats?(): Promise<{ size: number; hits?: number; misses?: number; hitRate?: number }>
    } | null
    /** If true, disables caching entirely (equivalent to annotationCache={null}). Useful for debugging or forcing fresh fetches. */
    disableCache?: boolean
    /** Optional map of annotation headers (from /annotation?itemId=... endpoint) keyed by annotation ID.
     *  If provided, used to compute version hashes for cache invalidation when annotations change on the server.
     *  Should contain the metadata objects returned from AnnotationManager's annotation search endpoint.
     *  Typically obtained from AnnotationManager: `annotations.map(ann => [ann._id, ann])` or similar.
     *  If not provided, cache will work but version-based invalidation will be disabled. */
    annotationHeaders?: Map<string | number, unknown> | Record<string, unknown>
}

/**
 * Helper function to apply opacity to a color string
 * Always returns rgba format for consistency, even at 100% opacity
 */
function applyOpacity(color: string, opacity: number): string {
    // Clamp opacity to valid range
    const clampedOpacity = Math.max(0, Math.min(1, opacity))
    
    // Always convert to rgba for consistent rendering, even at 100%
    if (color.startsWith('rgba(')) {
        // Extract RGB values, ignore existing alpha
        const match = color.match(/(\d+(?:\.\d+)?)/g)
        if (match && match.length >= 3) {
            const r = match[0]
            const g = match[1]
            const b = match[2]
            return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`
        }
    } else if (color.startsWith('rgb(')) {
        // Extract RGB values from rgb() format
        const match = color.match(/(\d+(?:\.\d+)?)/g)
        if (match && match.length >= 3) {
            const r = match[0]
            const g = match[1]
            const b = match[2]
            return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`
        }
    } else if (color.startsWith('#')) {
        // Convert hex to rgba
        const hex = color.replace('#', '')
        // Handle both 3-digit and 6-digit hex
        let r: number, g: number, b: number
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16)
            g = parseInt(hex[1] + hex[1], 16)
            b = parseInt(hex[2] + hex[2], 16)
        } else {
            r = parseInt(hex.substring(0, 2), 16)
            g = parseInt(hex.substring(2, 4), 16)
            b = parseInt(hex.substring(4, 6), 16)
        }
        return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`
    }

    // Fallback: return as-is if we can't parse it
    // This should rarely happen, but preserves original behavior for edge cases
    return color
}

/**
 * Default configuration for annotation info panel
 */
const DEFAULT_ANNOTATION_INFO_CONFIG: AnnotationInfoConfig = {
    documentProperties: [
        { key: 'id', label: 'ID', formatter: (value) => String(value) },
        { key: 'elementCount', label: 'Elements', formatter: (value) => String(value) },
        { key: 'totalPoints', label: 'Points/Vertices', formatter: (value) => String(value) },
        {
            key: 'types',
            label: 'Types',
            formatter: (value) => Array.isArray(value) && value.length > 0 ? value.join(', ') : 'N/A',
            show: true
        },
        {
            key: 'filteredCount',
            label: 'Filtered',
            formatter: (_value, doc) => {
                if (doc.filteredCount !== undefined && doc.filteredCount > 0) {
                    return `${doc.filteredCount} element(s) (${doc.filteredPoints || 0} points) skipped`
                }
                return 'None'
            },
            show: true,
        },
    ],
    showFetchedSection: true,
    showProvidedSection: true,
    showTotalSection: true,
    headerText: 'Annotation Information',
}

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
            showAnnotationControls = false,
            defaultAnnotationOpacity = 1,
            annotationOpacities,
            visibleAnnotations,
            onAnnotationReady,
            annotationCache: externalAnnotationCache,
            disableCache = false,
            annotationHeaders,
        },
        ref
    ) => {
        const containerRef = useRef<HTMLDivElement>(null)
        const [viewer, setViewer] = useState<OpenSeadragonViewer | null>(null)
        const [overlay, setOverlay] = useState<PaperOverlay | null>(null)
        const [toolkit, setToolkit] = useState<AnnotationToolkit | null>(null)
        const [fetchedAnnotations, setFetchedAnnotations] = useState<AnnotationFeature[]>([])
        const [annotationDocuments, setAnnotationDocuments] = useState<Array<{ id: string | number; elementCount: number; types: string[] }>>([])
        const tiledImageRef = useRef<{ addPaperItem: (item: unknown) => void; paperItems?: unknown[] } | null>(null)
        const lastRenderedAnnotationsRef = useRef<string>('')
        const [annotationOpacity, setAnnotationOpacity] = useState<number>(defaultAnnotationOpacity)

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
        const [isVisible, setIsVisible] = useState(true)
        useEffect(() => {
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
        }, [])

        // Global error handler to catch _transformBounds errors from library's mouse handlers
        useEffect(() => {
            // Global error handler for _transformBounds errors
            const errorHandler = (event: ErrorEvent | Event) => {
                const message = event instanceof ErrorEvent ? event.message : String(event)
                if (message && typeof message === 'string' && message.includes('_transformBounds')) {
                    console.warn('Suppressed _transformBounds error from library')
                    if (event instanceof ErrorEvent) {
                        event.preventDefault() // Suppress the error
                    }
                    return true
                }
                return false
            }

            // Unhandled rejection handler
            const rejectionHandler = (event: PromiseRejectionEvent) => {
                const reason = event.reason
                const reasonStr = reason?.message || String(reason || '')
                if (reasonStr.includes('_transformBounds')) {
                    console.warn('Suppressed _transformBounds promise rejection')
                    event.preventDefault() // Suppress the error
                }
            }

            // Add event listeners
            window.addEventListener('error', errorHandler as EventListener, true)
            window.addEventListener('unhandledrejection', rejectionHandler)

            // Cleanup
            return () => {
                window.removeEventListener('error', errorHandler as EventListener, true)
                window.removeEventListener('unhandledrejection', rejectionHandler)
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

        // Create stable key for fetched annotations
        const fetchedAnnotationsKey = useMemo(() => {
            return fetchedAnnotations.map(a => `${a.id}:${a.left}:${a.top}:${a.width}:${a.height}`).join('|')
        }, [fetchedAnnotations])

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

        // Get the DZI URL or construct a key for manual mode to track changes (memoized to prevent unnecessary re-renders)
        const imageKey = useMemo(() => {
            return imageInfo.dziUrl || `${imageInfo.imageId}-${imageInfo.baseUrl}`
        }, [imageInfo.dziUrl, imageInfo.imageId, imageInfo.baseUrl])

        // Create stable key for annotations to prevent unnecessary re-renders
        const annotationsKey = useMemo(() => {
            if (Array.isArray(annotations)) {
                return JSON.stringify(annotations.map(a => ({ id: a.id, left: a.left, top: a.top, width: a.width, height: a.height })))
            } else if (annotations && typeof annotations === 'object' && 'type' in annotations && annotations.type === 'FeatureCollection') {
                return JSON.stringify((annotations as FeatureCollection).features?.map(f => ({ id: f.id })) || [])
            }
            return '[]'
        }, [annotations])

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
        useEffect(() => {
            if (!containerRef.current) return
            // Only check visibility for initial mount, don't re-initialize if visibility changes
            if (!isVisible && !isInitializedRef.current) {
                // Component not visible and not yet initialized, don't initialize yet
                return
            }
            if (isInitializedRef.current) {
                // Already initialized, don't re-initialize unless imageKey changed
                return
            }

            // Store references for cleanup
            let osdViewer: OpenSeadragonViewer | null = null
            let paperOverlay: PaperOverlay | null = null
            let annotationToolkit: AnnotationToolkit | null = null

            // Add small delay to ensure DOM is ready
            const initTimer = setTimeout(() => {
                if (!isMountedRef.current || !containerRef.current) return
                // Double-check visibility before initializing (user might have scrolled away)
                if (!isVisible) {
                    return
                }

                try {
                    isInitializedRef.current = true
                    lastImageKeyRef.current = imageKey


                    // Set the ID on the container element (OpenSeadragon needs an element with an ID)
                    containerRef.current.id = viewerIdRef.current

                    const defaultOsdOptions: OpenSeadragonOptions = {
                        id: viewerIdRef.current, // Use ID like the working example
                        prefixUrl: 'https://openseadragon.github.io/openseadragon/images/',
                        maxImageCacheCount: 1000,
                        crossOriginPolicy: 'Anonymous',
                        autoHideControls: false,
                        debugMode: false,
                        // Enable navigation controls by default
                        showNavigator: true,
                        showZoomControl: true,
                        showHomeControl: true,
                        showFullPageControl: true,
                        // User-provided options override defaults
                        ...osdOptions,
                    }

                    // Create viewer first (empty, like the working example)
                    osdViewer = OpenSeadragon(defaultOsdOptions)

                    // Create Paper overlay from the viewer (before adding images, like working example)
                    paperOverlay = osdViewer.createPaperOverlay() as PaperOverlay
                    if (isMountedRef.current) {
                        setOverlay(paperOverlay)
                    }

                    // Create annotation toolkit immediately (like working example - before loading image)
                    annotationToolkit = new AnnotationToolkit(osdViewer, {
                        overlay: paperOverlay,
                    })
                    
                    // Add error handling for library's mouse event handlers
                    // The library's internal mouse handlers can throw _transformBounds errors
                    // if Paper.js isn't fully initialized when mouse events fire
                    if (annotationToolkit && typeof (annotationToolkit as any).overlay?.paperScope?.view !== 'undefined') {
                        const paperScope = (annotationToolkit as any).overlay.paperScope
                        if (paperScope && paperScope.view) {
                            // Wrap view methods that might access _transformBounds
                            const originalView = paperScope.view
                            const viewProxy = new Proxy(originalView, {
                                get: (target, prop) => {
                                    if (prop === 'getBounds' || prop === '_transformBounds') {
                                        return function(...args: unknown[]) {
                                            try {
                                                // Check if _transformBounds exists before accessing
                                                if ((target as any)._transformBounds === null || (target as any)._transformBounds === undefined) {
                                                    console.warn('Paper.js view not fully initialized, skipping bounds operation')
                                                    return null
                                                }
                                                if (prop === 'getBounds') {
                                                    return (originalView.getBounds as any)?.apply(target, args)
                                                }
                                                return (target as any)[prop]
                                            } catch (error) {
                                                if (error instanceof Error && error.message.includes('_transformBounds')) {
                                                    // Silently suppress _transformBounds errors from library
                                                    return null
                                                }
                                                throw error
                                            }
                                        }
                                    }
                                    return (target as any)[prop]
                                }
                            })
                            // Try to replace the view (may not work if library has locked reference)
                            try {
                                (paperScope as any).view = viewProxy
                            } catch (e) {
                                // If we can't replace, that's okay - we'll handle errors globally
                            }
                        }
                    }
                    
                    if (isMountedRef.current) {
                        setToolkit(annotationToolkit)
                    }

                    // Add event handlers (like the working example)
                    if (!osdViewer) return
                    
                    osdViewer.addHandler('open-failed', (e: unknown) => {
                        console.warn('OpenSeadragon: Open failed', e)
                    })

                    osdViewer.addHandler('open', (e: unknown) => {
                        if (!isMountedRef.current || !osdViewer) return
                        console.log('OpenSeadragon: Image opened', e)
                        setViewer(osdViewer)
                        // Use ref to avoid dependency issues
                        if (onViewerReadyRef.current) {
                            onViewerReadyRef.current(osdViewer)
                        }
                    })

                    // Wait for tiled image to be added (like the working example)
                    osdViewer.world.addHandler('add-item', (event: unknown) => {
                        if (!isMountedRef.current) return
                        const typedEvent = event as { item: { addPaperItem: (item: unknown) => void } }
                        console.log('Tiled image added:', typedEvent.item)
                        tiledImageRef.current = typedEvent.item as { addPaperItem: (item: unknown) => void; paperItems?: unknown[] }
                    })

                    // Load the image immediately - use viewer.open() for DZI URLs, or addTiledImage for manual tile sources
                    if (imageInfo.dziUrl) {
                        // Use viewer.open() for DZI descriptor URL - call this immediately, don't wait
                        osdViewer.open(imageInfo.dziUrl)
                    } else {
                        // Manual tile source construction (requires all fields)
                        if (
                            !imageInfo.imageId ||
                            !imageInfo.width ||
                            !imageInfo.height ||
                            !imageInfo.tileWidth ||
                            !imageInfo.levels ||
                            !imageInfo.baseUrl
                        ) {
                            console.error(
                                'SlideViewer: If dziUrl is not provided, all manual fields (imageId, width, height, tileWidth, levels, baseUrl) are required'
                            )
                            return
                        }

                        const tileSource = {
                            width: imageInfo.width,
                            height: imageInfo.height,
                            tileSize: imageInfo.tileWidth,
                            minLevel: 0,
                            maxLevel: imageInfo.levels - 1,
                            getTileUrl: (level: number, x: number, y: number) => {
                                return `${imageInfo.baseUrl}/wsi/files/tile/${imageInfo.imageId}/${level}/${x}/${y}`
                            },
                        }

                        // Add the tile source to the viewer
                        if (osdViewer) {
                            osdViewer.addTiledImage({
                                tileSource,
                                success: () => {
                                    if (!isMountedRef.current || !osdViewer) return
                                    setViewer(osdViewer)
                                    // Use ref to avoid dependency issues
                                    if (onViewerReadyRef.current) {
                                        onViewerReadyRef.current(osdViewer)
                                    }
                                },
                            })
                        }
                    }
                } catch (error) {
                    console.error('Error initializing SlideViewer:', error)
                    // Reset initialization flag on error so it can retry
                    isInitializedRef.current = false
                }
            }, 100)

            return () => {
                clearTimeout(initTimer)
                
                // Only cleanup if imageKey actually changed (which means we're re-initializing) or component is unmounting
                // Don't cleanup on every dependency update
                const imageKeyChanged = imageKey !== lastImageKeyRef.current
                const shouldCleanup = !isMountedRef.current || imageKeyChanged
                
                if (shouldCleanup) {
                    // Update the tracked imageKey
                    if (imageKeyChanged) {
                        lastImageKeyRef.current = imageKey
                    }
                    // Cleanup in reverse order with error handling
                    // Use local variables captured from the effect closure
                    if (annotationToolkit) {
                        try {
                            annotationToolkit.destroy()
                        } catch (e) {
                            console.warn('Error destroying annotation toolkit:', e)
                        }
                    }
                    if (paperOverlay) {
                        try {
                            paperOverlay.destroy()
                        } catch (e) {
                            console.warn('Error destroying paper overlay:', e)
                        }
                    }
                    if (osdViewer) {
                        try {
                            // Check if viewer has isDestroyed property before destroying
                            if (typeof (osdViewer as any).isDestroyed === 'boolean' && (osdViewer as any).isDestroyed) {
                                return
                            }
                            osdViewer.destroy()
                        } catch (e) {
                            console.warn('Error destroying OpenSeadragon viewer:', e)
                        }
                    }

                    // Only reset initialization flag if actually unmounting or image changed
                    if (!isMountedRef.current) {
                        isInitializedRef.current = false
                    }
                }

                // Don't clear state here - let React handle it on unmount
                // Clearing state here can cause infinite loops if the effect runs again
            }
        }, [imageKey, osdOptions]) // Only depend on imageKey and osdOptions - not visibility

        // Fetch annotations from DSA API if annotationIds are provided
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
                    console.log(`Fetching ${annotationIds.length} annotation(s) from DSA API...`)
                    // Use custom fetch function if provided, otherwise use default fetch
                    const customFetch = fetchFn || fetch

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
                                        console.log(`Cache hit for annotation ${id}${versionHash ? ` (version hash: ${versionHash})` : ''}`, {
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
                                console.log(`Cache miss or version mismatch for annotation ${id} (current version hash: ${versionHash}), fetching from API...`)
                            } else {
                                console.log(`Cache miss for annotation ${id}, fetching from API...`)
                            }
                        }

                        const url = `${apiBaseUrl}/annotation/${id}`
                        console.log(`Fetching annotation ${id} from: ${url}`)

                        // Build request options with custom headers if provided
                        const fetchOptions: RequestInit = {}
                        if (apiHeaders) {
                            fetchOptions.headers = apiHeaders
                        }

                        const response = await customFetch(url, fetchOptions)
                        if (!response.ok) {
                            console.warn(`Failed to fetch annotation ${id}:`, response.statusText, response.status)
                            return null
                        }
                        const data = await response.json()
                        console.log(`Successfully fetched annotation ${id}:`, data)
                        
                        // Store in cache if available (with version hash if we have header)
                        if (cache && data) {
                            await cache.set(id, data, { versionHash })
                        }
                        
                        return data
                    })

                    const annotationData = await Promise.all(annotationPromises)

                    // Check if component is still mounted before setting state
                    if (!isMountedRef.current) {
                        console.log('Component unmounted during annotation fetch, skipping state update')
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

                    let totalFilteredCount = 0
                    let totalFilteredPoints = 0

                    // Parse annotation documents (like the working example)
                    const validAnnotations = annotationData
                        .filter((ann: unknown): ann is unknown => ann !== null && ann !== undefined)
                        .map((annotationDoc: unknown, index: number) => {
                            // Normalize annotationId to string for consistency
                            const annotationId = String(annotationIds[index])
                            const types = new Set<string>()
                            const parsed: AnnotationFeature[] = []
                            let totalPoints = 0
                            let filteredCount = 0
                            let filteredPoints = 0

                            // Get elements from annotation (like working example)
                            let elements: unknown[] = []
                            if (annotationDoc && typeof annotationDoc === 'object') {
                                const ann = annotationDoc as {
                                    elements?: Array<{
                                        type?: string
                                        points?: Array<[number, number]>
                                        x?: number
                                        y?: number
                                        width?: number
                                        height?: number
                                        lineColor?: string
                                        fillColor?: string
                                        lineWidth?: number
                                        group?: string
                                        label?: string
                                        [key: string]: unknown
                                    }>
                                    [key: string]: unknown
                                }

                                if (ann.elements && Array.isArray(ann.elements)) {
                                    elements = ann.elements
                                } else if ((ann as { annotation?: { elements?: unknown[] } }).annotation?.elements) {
                                    elements = (ann as { annotation: { elements: unknown[] } }).annotation.elements
                                }
                            }

                            // Parse each element (like working example)
                            for (const element of elements) {
                                if (element && typeof element === 'object') {
                                    const el = element as {
                                        type?: string
                                        points?: Array<[number, number]>
                                        x?: number
                                        y?: number
                                        width?: number
                                        height?: number
                                        lineColor?: string
                                        fillColor?: string
                                        lineWidth?: number
                                        group?: string
                                        label?: string
                                        closed?: boolean
                                        [key: string]: unknown
                                    }

                                    // Track element type
                                    if (el.type) {
                                        types.add(el.type)
                                    }

                                    if (el.type === 'rectangle' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
                                        // Rectangles have 4 vertices (corners)
                                        const pointsInElement = 4
                                        if (pointsInElement > maxPointsPerAnnotation) {
                                            filteredCount++
                                            filteredPoints += pointsInElement
                                            console.warn(
                                                `Skipping rectangle annotation ${el.group || parsed.length} in document ${annotationId}: ` +
                                                `has ${pointsInElement} points (exceeds limit of ${maxPointsPerAnnotation})`
                                            )
                                        } else {
                                            totalPoints += pointsInElement
                                            parsed.push({
                                                id: el.group || parsed.length,
                                                left: el.x,
                                                top: el.y,
                                                width: el.width,
                                                height: el.height,
                                                color: el.lineColor || defaultAnnotationColor,
                                                group: el.group,
                                                label: el.label,
                                                annotationType: 'rectangle',
                                                element: el, // Store full element for rendering
                                                documentId: annotationId, // Store document ID for opacity lookup
                                            })
                                        }
                                    } else if (el.type === 'polyline' && el.points && el.points.length >= 2) {
                                        // For polylines, check point count before processing
                                        const pointsInElement = el.points.length
                                        if (pointsInElement > maxPointsPerAnnotation) {
                                            filteredCount++
                                            filteredPoints += pointsInElement
                                            console.warn(
                                                `Skipping polyline annotation ${el.group || parsed.length} in document ${annotationId}: ` +
                                                `has ${pointsInElement} points (exceeds limit of ${maxPointsPerAnnotation})`
                                            )
                                        } else {
                                            // For polylines, count the actual points
                                            totalPoints += pointsInElement
                                            // For polylines, store the actual points and type
                                            // Calculate bounding box for compatibility
                                            const xs = el.points.map((p) => p[0])
                                            const ys = el.points.map((p) => p[1])
                                            const left = Math.min(...xs)
                                            const top = Math.min(...ys)
                                            const right = Math.max(...xs)
                                            const bottom = Math.max(...ys)
                                            const width = right - left
                                            const height = bottom - top

                                            parsed.push({
                                                id: el.group || parsed.length,
                                                left,
                                                top,
                                                width,
                                                height,
                                                color: el.lineColor || defaultAnnotationColor,
                                                group: el.group,
                                                label: el.label,
                                                annotationType: 'polyline',
                                                points: el.points,
                                                closed: el.closed,
                                                fillColor: el.fillColor,
                                                element: el, // Store full element for rendering
                                                documentId: annotationId, // Store document ID for opacity lookup
                                            })
                                        }
                                    }
                                }
                            }

                            // Store document info
                            docInfo.push({
                                id: annotationId,
                                elementCount: parsed.length,
                                totalPoints,
                                types: Array.from(types),
                                filteredCount: filteredCount > 0 ? filteredCount : undefined,
                                filteredPoints: filteredPoints > 0 ? filteredPoints : undefined,
                            })

                            // Accumulate filtered counts
                            totalFilteredCount += filteredCount
                            totalFilteredPoints += filteredPoints

                            return parsed
                        })
                        .flat()

                    // Post-process to enforce maxTotalPoints limit
                    let finalAnnotations = validAnnotations
                    const totalPointsAcrossAll = validAnnotations.reduce((sum: number, ann: AnnotationFeature) => {
                        if (ann.annotationType === 'polyline' && ann.points) {
                            return sum + ann.points.length
                        } else {
                            return sum + 4 // rectangles have 4 points
                        }
                    }, 0)

                    if (totalPointsAcrossAll > maxTotalPoints) {
                        console.warn(
                            `Total points (${totalPointsAcrossAll}) exceeds limit (${maxTotalPoints}). ` +
                            `Filtering annotations starting from largest ones...`
                        )

                        // Sort annotations by point count (largest first) and filter
                        const annotationsWithPointCounts = validAnnotations.map((ann: AnnotationFeature) => ({
                            annotation: ann,
                            pointCount: ann.annotationType === 'polyline' && ann.points
                                ? ann.points.length
                                : 4,
                        }))

                        annotationsWithPointCounts.sort((a: { annotation: AnnotationFeature; pointCount: number }, b: { annotation: AnnotationFeature; pointCount: number }) => b.pointCount - a.pointCount)

                        let cumulativePoints = 0
                        finalAnnotations = []
                        for (const { annotation, pointCount } of annotationsWithPointCounts) {
                            if (cumulativePoints + pointCount <= maxTotalPoints) {
                                finalAnnotations.push(annotation)
                                cumulativePoints += pointCount
                            } else {
                                console.warn(
                                    `Skipping annotation ${annotation.id}: adding ${pointCount} points would exceed total limit ` +
                                    `(${cumulativePoints + pointCount} > ${maxTotalPoints})`
                                )
                            }
                        }

                        console.warn(
                            `Filtered annotations: ${validAnnotations.length} → ${finalAnnotations.length} ` +
                            `(${validAnnotations.length - finalAnnotations.length} skipped)`
                        )
                    }

                    if (totalFilteredCount > 0) {
                        console.warn(
                            `Annotation document(s) ${annotationIds.join(', ')}: ` +
                            `${totalFilteredCount} annotation(s) filtered due to per-annotation point limits ` +
                            `(${totalFilteredPoints} total points skipped)`
                        )
                    }

                    console.log(`Parsed ${finalAnnotations.length} annotation feature(s) from ${annotationIds.length} annotation document(s)`)
                    // Check if component is still mounted before setting state
                    if (!isMountedRef.current) {
                        console.log('Component unmounted after annotation parsing, skipping state update')
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
            // Note: fetchFn and apiHeaders are intentionally not in deps - they're used in the closure
            // If they change, the effect should re-run, but we'll handle that via refs or user responsibility
        ])

        // Render annotations when they change
        useEffect(() => {
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

            console.log(`Rendering ${annotationFeatures.length} total annotation(s)`)

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

            console.log(`About to render ${annotationFeatures.length} annotations, tiledImage:`, tiledImage)

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
                    
                    console.log(`SlideViewer: Processing annotation feature id=${annotation.id}, documentId=${documentId}, lookupId=${lookupId}`)
                    
                    // Get per-annotation opacity if available, otherwise use global opacity
                    // Use documentId (annotation document ID) for opacity lookup, not the individual feature ID
                    let annotationSpecificOpacity = annotationOpacity
                    if (opacityMap && lookupId !== undefined) {
                        const specificOpacity = opacityMap.get(lookupId)
                        if (specificOpacity !== undefined) {
                            annotationSpecificOpacity = specificOpacity
                        }
                    }
                    
                    console.log(`SlideViewer: Annotation opacity=${annotationSpecificOpacity}, will ${annotationSpecificOpacity <= 0 ? 'skip' : 'render'}`)
                    
                    // Check visibility based on opacity (opacity-based visibility)
                    // Skip rendering if opacity is 0 (hidden)
                    if (annotationSpecificOpacity <= 0) {
                        console.log(`SlideViewer: Skipping annotation with opacity 0 (hidden)`)
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
                        console.log(`SlideViewer: Added documentId '${lookupId}' to renderedDocumentIds. Set now has:`, Array.from(renderedDocumentIds))
                    } else {
                        console.warn(`SlideViewer: Cannot track document ID - lookupId is undefined for annotation id=${annotation.id}`)
                    }
                } catch (e) {
                    console.error(`Error rendering annotation ${annotation.id}:`, e, annotation)
                }
            }

            // Draw the view safely (like the working example)
            safeDrawPaperView(paperScope)

            console.log(`Finished rendering ${annotationFeatures.length} annotations`)
            console.log(`SlideViewer: onAnnotationReady is ${onAnnotationReady ? 'defined' : 'undefined'}, renderedDocumentIds has ${renderedDocumentIds.size} items:`, Array.from(renderedDocumentIds))
            
            // Call onAnnotationReady for each unique document ID that was rendered
            if (onAnnotationReady && renderedDocumentIds.size > 0) {
                // Use setTimeout to ensure rendering is complete before notifying
                setTimeout(() => {
                    console.log(`SlideViewer: setTimeout fired, calling onAnnotationReady for ${renderedDocumentIds.size} document(s)`)
                    renderedDocumentIds.forEach((documentId) => {
                        try {
                            // documentId is already a normalized string from the Set
                            console.log(`SlideViewer: Calling onAnnotationReady('${documentId}')`)
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
            annotationOpacity, // Re-render when opacity changes
            annotationOpacities, // Re-render when per-annotation opacities change
            visibleAnnotations, // Re-render when visibility changes
            onAnnotationReady, // Include callback in dependencies
            // parsedManualAnnotations and fetchedAnnotations are captured from closure
            // onAnnotationClick removed - using ref instead
        ])

        // Update opacity on existing annotations when opacity changes
        useEffect(() => {
            if (!viewer || !overlay || !toolkit) return

            const paperScope = overlay.paperScope
            if (!paperScope || !paperScope.project) return

            try {
                const existingFeatures = toolkit.getFeatures()
                if (existingFeatures && Array.isArray(existingFeatures)) {
                    // Convert maps if needed
                    const opacityMap = annotationOpacities instanceof Map 
                        ? annotationOpacities 
                        : annotationOpacities 
                            ? new Map(Object.entries(annotationOpacities).map(([k, v]) => [String(k), v]))
                            : null
                    
                    let hasUpdates = false
                    
                    for (const feature of existingFeatures) {
                        try {
                            if (feature && typeof feature === 'object') {
                                const paperItem = feature as {
                                    annotationId?: string | number
                                    strokeColor?: string | { r: number; g: number; b: number; alpha: number }
                                    fillColor?: string | { r: number; g: number; b: number; alpha: number }
                                    data?: { annotation?: AnnotationFeature }
                                    remove?: () => void
                                }

                                // Get original color from annotation data
                                const annotation = paperItem.data?.annotation
                                if (!annotation) continue

                                // Use documentId (annotation document ID) for lookup - this is the key in the maps
                                const documentId = (annotation as { documentId?: string | number }).documentId
                                // Convert to string for consistent Map key matching
                                const lookupId = documentId !== undefined ? String(documentId) : undefined
                                
                                if (lookupId === undefined) {
                                    // No documentId - skip this feature (shouldn't happen, but be safe)
                                    continue
                                }
                                
                                // Check visibility based on opacity (opacity-based visibility)
                                // If opacity is 0, the annotation should be hidden
                                let featureOpacity = annotationOpacity
                                if (opacityMap && lookupId !== undefined) {
                                    const specificOpacity = opacityMap.get(lookupId)
                                    if (specificOpacity !== undefined) {
                                        featureOpacity = specificOpacity
                                    }
                                }
                                
                                if (featureOpacity <= 0) {
                                    // Annotation should be hidden (opacity 0) - set opacity to 0 or remove
                                    try {
                                        // Try to set opacity to 0 first (less destructive than removing)
                                        const strokeColor = annotation.color || defaultAnnotationColor
                                        const fillColor = annotation.fillColor || 'rgba(0, 0, 0, 0)'
                                        if (paperItem.strokeColor) {
                                            paperItem.strokeColor = applyOpacity(strokeColor, 0) as any
                                            hasUpdates = true
                                        }
                                        if (paperItem.fillColor) {
                                            paperItem.fillColor = applyOpacity(fillColor, 0) as any
                                            hasUpdates = true
                                        }
                                    } catch (e) {
                                        // If opacity update fails, try removal as fallback
                                        try {
                                            if (paperItem.remove) {
                                                paperItem.remove()
                                                hasUpdates = true
                                            }
                                        } catch (removeError) {
                                            console.warn('Could not hide annotation:', removeError)
                                        }
                                    }
                                    continue // Skip further opacity update for hidden annotations
                                }

                                // Get the target opacity for this feature
                                let targetOpacity = annotationOpacity
                                if (opacityMap && lookupId !== undefined && opacityMap.has(lookupId)) {
                                    // Use per-annotation opacity if available
                                    const specificOpacity = opacityMap.get(lookupId)
                                    if (specificOpacity !== undefined) {
                                        targetOpacity = specificOpacity
                                    }
                                }

                                const strokeColor = annotation.color || defaultAnnotationColor
                                const fillColor = annotation.fillColor || 'rgba(0, 0, 0, 0)'

                                // Update stroke color opacity
                                if (paperItem.strokeColor) {
                                    paperItem.strokeColor = applyOpacity(strokeColor, targetOpacity) as any
                                    hasUpdates = true
                                }

                                // Update fill color opacity
                                if (paperItem.fillColor) {
                                    paperItem.fillColor = applyOpacity(fillColor, targetOpacity) as any
                                    hasUpdates = true
                                }
                            }
                        } catch (e) {
                            console.warn('Error updating annotation opacity:', e)
                        }
                    }

                    // Only redraw if we actually made updates
                    if (hasUpdates) {
                        safeDrawPaperView(paperScope)
                    }
                }
            } catch (e) {
                console.warn('Could not update annotation opacity:', e)
            }
        }, [annotationOpacity, annotationOpacities, visibleAnnotations, viewer, overlay, toolkit, defaultAnnotationOpacity, defaultAnnotationColor, safeDrawPaperView])

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

