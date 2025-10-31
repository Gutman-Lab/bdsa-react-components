import React, { useEffect, useMemo, useRef, useState } from 'react'
import OpenSeadragon from 'openseadragon'
import { PaperOverlay, AnnotationToolkit } from 'osd-paperjs-annotation'
import type { FeatureCollection, Feature } from 'geojson'
import type { Viewer as OpenSeadragonViewer, Options as OpenSeadragonOptions } from 'openseadragon'
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
            formatter: (value, doc) => {
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

        // Create stable key for fetched annotations
        const fetchedAnnotationsKey = useMemo(() => {
            return fetchedAnnotations.map(a => `${a.id}:${a.left}:${a.top}:${a.width}:${a.height}`).join('|')
        }, [fetchedAnnotations])

        // Generate a unique viewer ID for this component instance
        const viewerIdRef = useRef(`osd-viewer-${Math.random().toString(36).substr(2, 9)}`)

        // Track if viewer is already initialized to prevent multiple creations
        const isInitializedRef = useRef(false)

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
            if (isInitializedRef.current) {
                // Already initialized, don't re-initialize unless imageKey changed
                return
            }

            isInitializedRef.current = true

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
            const osdViewer = OpenSeadragon(defaultOsdOptions)

            // Create Paper overlay from the viewer (before adding images, like working example)
            const paperOverlay = osdViewer.createPaperOverlay()
            setOverlay(paperOverlay)

            // Create annotation toolkit immediately (like working example - before loading image)
            const annotationToolkit = new AnnotationToolkit(osdViewer, {
                overlay: paperOverlay,
            })
            setToolkit(annotationToolkit)

            // Add event handlers (like the working example)
            osdViewer.addHandler('open-failed', (e: unknown) => {
                console.warn('OpenSeadragon: Open failed', e)
            })

            osdViewer.addHandler('open', (e: unknown) => {
                console.log('OpenSeadragon: Image opened', e)
                setViewer(osdViewer)
                // Use ref to avoid dependency issues
                if (onViewerReadyRef.current) {
                    onViewerReadyRef.current(osdViewer)
                }
            })

            // Wait for tiled image to be added (like the working example)
            osdViewer.world.addHandler('add-item', (event: { item: { addPaperItem: (item: unknown) => void } }) => {
                console.log('Tiled image added:', event.item)
                tiledImageRef.current = event.item as { addPaperItem: (item: unknown) => void; paperItems?: unknown[] }
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
                osdViewer.addTiledImage({
                    tileSource,
                    success: () => {
                        setViewer(osdViewer)
                        // Use ref to avoid dependency issues
                        if (onViewerReadyRef.current) {
                            onViewerReadyRef.current(osdViewer)
                        }
                    },
                })
            }

            // Cleanup function
            return () => {
                isInitializedRef.current = false

                // Cleanup in reverse order
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
                        osdViewer.destroy()
                    } catch (e) {
                        console.warn('Error destroying OpenSeadragon viewer:', e)
                    }
                }

                // Don't clear state here - let React handle it on unmount
                // Clearing state here can cause infinite loops if the effect runs again
            }
        }, [imageKey]) // Only depend on imageKey - osdOptions is spread inline so doesn't need to be in deps

        // Fetch annotations from DSA API if annotationIds are provided
        useEffect(() => {
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
                    // Fetch annotations from /annotation/{id} endpoint (not geojson)
                    const annotationPromises = annotationIds.map(async (id) => {
                        const url = `${apiBaseUrl}/annotation/${id}`
                        console.log(`Fetching annotation ${id} from: ${url}`)
                        const response = await fetch(url)
                        if (!response.ok) {
                            console.warn(`Failed to fetch annotation ${id}:`, response.statusText, response.status)
                            return null
                        }
                        const data = await response.json()
                        console.log(`Successfully fetched annotation ${id}:`, data)
                        return data
                    })

                    const annotationData = await Promise.all(annotationPromises)

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
                        .filter((ann): ann is unknown => ann !== null && ann !== undefined)
                        .map((annotationDoc, index) => {
                            const annotationId = annotationIds[index]
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
                    const totalPointsAcrossAll = validAnnotations.reduce((sum, ann) => {
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
                        const annotationsWithPointCounts = validAnnotations.map((ann) => ({
                            annotation: ann,
                            pointCount: ann.annotationType === 'polyline' && ann.points
                                ? ann.points.length
                                : 4,
                        }))

                        annotationsWithPointCounts.sort((a, b) => b.pointCount - a.pointCount)

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
                    setFetchedAnnotations(finalAnnotations)
                    setAnnotationDocuments(docInfo)
                } catch (error) {
                    console.error('Error fetching annotations:', error)
                    setFetchedAnnotations([])
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

            // Render each annotation
            for (const annotation of annotationFeatures) {
                try {
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
                        const path = new paperScope.Path()
                        path.strokeColor = annotation.color || defaultAnnotationColor
                        path.strokeWidth = strokeWidth
                        path.fillColor = (annotation.fillColor as string) || 'rgba(0, 0, 0, 0)'

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
                        const rectPath = new paperScope.Path.Rectangle(rect)

                        // Set style properties
                        rectPath.strokeColor = annotation.color || defaultAnnotationColor
                        rectPath.strokeWidth = strokeWidth
                        rectPath.fillColor = 'rgba(0, 0, 0, 0)' // Transparent fill by default

                        paperItem = rectPath
                    }

                    // Store annotation data on the paper item (like the working example)
                    paperItem.data = {
                        annotation,
                    }
                    paperItem.annotationId = annotation.id

                    // Handle click events
                    if (onAnnotationClickRef.current) {
                        paperItem.onClick = (event?: unknown) => {
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
                } catch (e) {
                    console.error(`Error rendering annotation ${annotation.id}:`, e, annotation)
                }
            }

            // Draw the view (like the working example)
            if (paperScope.view && paperScope.view.draw) {
                paperScope.view.draw()
            }

            console.log(`Finished rendering ${annotationFeatures.length} annotations`)
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [
            viewer,
            overlay,
            toolkit,
            annotationsKey, // Stable key for manual annotations
            fetchedAnnotationsKey, // Stable key for fetched annotations
            strokeWidth,
            // parsedManualAnnotations and fetchedAnnotations are captured from closure
            // onAnnotationClick removed - using ref instead
        ])

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
                {showAnnotationInfo && (annotations.length > 0 || annotationDocuments.length > 0 || fetchedAnnotations.length > 0) && (
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
                                                    ? prop.formatter(value, doc)
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
        )
    }
)

SlideViewer.displayName = 'SlideViewer'

