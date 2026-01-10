import { useEffect } from 'react'
import type React from 'react'
import type { AnnotationFeature } from '../SlideViewer.types'
import { applyOpacity } from '../SlideViewer.utils'
import type { PaperOverlay } from 'osd-paperjs-annotation'
import { AnnotationToolkit } from 'osd-paperjs-annotation'
import type { Viewer as OpenSeadragonViewer } from 'openseadragon'
import type { DebugLogger } from '../../../utils/debugLog'

/**
 * Hook to handle annotation rendering in Paper.js
 */
export function useAnnotationRendering(
    viewer: OpenSeadragonViewer | null,
    overlay: PaperOverlay | null,
    toolkit: AnnotationToolkit | null,
    parsedManualAnnotations: AnnotationFeature[],
    fetchedAnnotations: AnnotationFeature[],
    annotationsKey: string,
    fetchedAnnotationsKey: string,
    annotationOpacity: number,
    annotationOpacities: Map<string | number, number> | Record<string, number> | undefined,
    visibleAnnotations: Map<string | number, boolean> | Record<string, boolean> | undefined,
    defaultAnnotationColor: string,
    strokeWidth: number,
    onAnnotationClickRef: React.MutableRefObject<((annotation: AnnotationFeature) => void) | undefined>,
    onAnnotationReady: ((annotationId: string | number) => void) | undefined,
    tiledImageRef: React.MutableRefObject<{ addPaperItem: (item: unknown) => void; paperItems?: unknown[] } | null>,
    lastRenderedAnnotationsRef: React.MutableRefObject<string>,
    safeDrawPaperView: (paperScope: PaperOverlay['paperScope']) => void,
    debugLog: DebugLogger
) {
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
        // They are handled by the separate opacity update effect below
        // This prevents full re-renders when only opacity changes
        visibleAnnotations, // Re-render when visibility changes
        onAnnotationReady, // Include callback in dependencies
        // parsedManualAnnotations and fetchedAnnotations are captured from closure
        // onAnnotationClick removed - using ref instead
        tiledImageRef,
        lastRenderedAnnotationsRef,
        safeDrawPaperView,
        debugLog,
    ])
}



