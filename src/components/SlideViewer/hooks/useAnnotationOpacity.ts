import { useEffect } from 'react'
import type { AnnotationFeature } from '../SlideViewer.types'
import { applyOpacity } from '../SlideViewer.utils'
import type { PaperOverlay } from 'osd-paperjs-annotation'
import { AnnotationToolkit } from 'osd-paperjs-annotation'
import type { Viewer as OpenSeadragonViewer } from 'openseadragon'

/**
 * Hook to handle annotation opacity updates without full re-renders
 */
export function useAnnotationOpacity(
    viewer: OpenSeadragonViewer | null,
    overlay: PaperOverlay | null,
    toolkit: AnnotationToolkit | null,
    annotationOpacity: number,
    annotationOpacities: Map<string | number, number> | Record<string, number> | undefined,
    visibleAnnotations: Map<string | number, boolean> | Record<string, boolean> | undefined,
    defaultAnnotationOpacity: number,
    defaultAnnotationColor: string,
    safeDrawPaperView: (paperScope: PaperOverlay['paperScope']) => void
) {
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
}



