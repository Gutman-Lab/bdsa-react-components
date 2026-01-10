import { useEffect, useRef, useCallback } from 'react'
import type { Viewer as OpenSeadragonViewer } from 'openseadragon'
import type { ViewportBounds } from '../SlideViewer.types'
import type { DebugLogger } from '../../../utils/debugLog'

/**
 * Hook to handle viewport change callbacks from OpenSeadragon viewer.
 * Fires callback whenever viewport changes (pan, zoom, resize) with normalized coordinates.
 */
export function useViewportChange(
    viewer: OpenSeadragonViewer | null,
    onViewportChange: ((bounds: ViewportBounds) => void) | undefined,
    imageInfo: {
        width?: number
        height?: number
        dziUrl?: string
    },
    debugLog: DebugLogger
) {
    const callbackRef = useRef(onViewportChange)
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    const lastBoundsRef = useRef<ViewportBounds | null>(null)

    // Update callback ref when it changes
    useEffect(() => {
        callbackRef.current = onViewportChange
    }, [onViewportChange])

    // Update callback ref when it changes
    useEffect(() => {
        callbackRef.current = onViewportChange
    }, [onViewportChange])

    // Helper to get image dimensions from viewer
    const getImageDimensions = useCallback((): { width: number; height: number } | null => {
        if (!viewer) return null

        try {
            // Try to get dimensions from the tiled image
            const world = viewer.world
            if (world && world.getItemCount() > 0) {
                const tiledImage = world.getItemAt(0)
                if (tiledImage) {
                    // Try getContentSize first
                    const contentSize = (tiledImage as any).getContentSize?.()
                    if (contentSize && contentSize.x > 0 && contentSize.y > 0) {
                        debugLog.log('Got image dimensions from tiledImage.getContentSize():', contentSize)
                        return { width: contentSize.x, height: contentSize.y }
                    }

                    // Try getSourceBounds as fallback
                    const sourceBounds = (tiledImage as any).getSourceBounds?.()
                    if (sourceBounds && sourceBounds.width > 0 && sourceBounds.height > 0) {
                        debugLog.log('Got image dimensions from tiledImage.getSourceBounds():', sourceBounds)
                        return { width: sourceBounds.width, height: sourceBounds.height }
                    }
                }
            }

            // Try to get from viewport home bounds (full image bounds)
            try {
                const viewport = viewer.viewport
                const homeBounds = (viewport as any).getHomeBounds?.()
                if (homeBounds && homeBounds.width > 0 && homeBounds.height > 0) {
                    debugLog.log('Got image dimensions from viewport.getHomeBounds():', homeBounds)
                    return { width: homeBounds.width, height: homeBounds.height }
                }
            } catch (e) {
                // getHomeBounds might not be available
            }

            // Fallback to imageInfo if available
            if (imageInfo.width && imageInfo.height) {
                debugLog.log('Got image dimensions from imageInfo:', imageInfo.width, imageInfo.height)
                return { width: imageInfo.width, height: imageInfo.height }
            }

            debugLog.warn('Could not determine image dimensions from any source')
            return null
        } catch (error) {
            debugLog.warn('Error getting image dimensions:', error)
            return null
        }
    }, [viewer, imageInfo, debugLog])

    // Helper to calculate normalized viewport bounds
    const calculateViewportBounds = useCallback((): ViewportBounds | null => {
        if (!viewer) return null

        try {
            const viewport = viewer.viewport
            const zoom = viewport.getZoom()

            // Check if world has items (image is loaded)
            const world = viewer.world
            if (!world || world.getItemCount() === 0) {
                debugLog.log('Viewport bounds: Image not loaded yet (no items in world)')
                return null
            }

            // Get the tiled image (like the old implementation)
            const tiledImage = world.getItemAt(0)
            if (!tiledImage) {
                debugLog.warn('Viewport bounds: No tiled image found')
                return null
            }

            // Use the same method as the old implementation: convert viewport bounds to image coordinates
            // This is the key - viewportToImageRectangle converts viewport coordinates to image coordinates
            const viewportBounds = viewport.getBounds()
            if (!viewportBounds) {
                debugLog.warn('Viewport bounds: getBounds() returned null')
                return null
            }

            // Convert viewport bounds to image coordinates using tiledImage method
            // viewportToImageRectangle returns coordinates in image pixel space (NOT normalized)
            const imageRect = (tiledImage as any).viewportToImageRectangle?.(viewportBounds)
            if (!imageRect) {
                debugLog.warn('Viewport bounds: viewportToImageRectangle returned null')
                return null
            }

            debugLog.log('Viewport bounds (image coords from viewportToImageRectangle):', imageRect)

            if (imageRect.width === 0 || imageRect.height === 0) {
                debugLog.warn('Viewport bounds have zero width or height:', imageRect)
                return null
            }

            // Check if imageRect values are already normalized (0-1 range) or in pixels
            // If values are < 1, they might be normalized, but typically they'll be in pixels
            // Get image dimensions to determine if we need to normalize
            const imageDims = getImageDimensions()
            if (!imageDims || imageDims.width === 0 || imageDims.height === 0) {
                debugLog.warn('Cannot normalize viewport bounds: image dimensions unknown or zero', imageDims)
                // If values look normalized (all < 1), return as-is, otherwise return pixel coords
                const looksNormalized = imageRect.x < 1 && imageRect.y < 1 && imageRect.width < 1 && imageRect.height < 1
                if (looksNormalized) {
                    return {
                        x: imageRect.x,
                        y: imageRect.y,
                        width: imageRect.width,
                        height: imageRect.height,
                        zoom,
                    }
                }
                return null
            }

            // Determine if imageRect is in pixels or normalized
            // If imageRect values are larger than image dimensions, something's wrong
            // Typically, if x/width are > 1, they're likely in pixels
            const likelyInPixels = imageRect.x > 1 || imageRect.y > 1 || imageRect.width > 1 || imageRect.height > 1

            let normalizedBounds: ViewportBounds
            if (likelyInPixels) {
                // Normalize from pixel coordinates to 0-1 range
                normalizedBounds = {
                    x: imageRect.x / imageDims.width,
                    y: imageRect.y / imageDims.height,
                    width: imageRect.width / imageDims.width,
                    height: imageRect.height / imageDims.height,
                    zoom,
                }
            } else {
                // Already normalized, use as-is
                normalizedBounds = {
                    x: imageRect.x,
                    y: imageRect.y,
                    width: imageRect.width,
                    height: imageRect.height,
                    zoom,
                }
            }

            debugLog.log('Normalized viewport bounds:', normalizedBounds, 'from imageRect:', imageRect, 'imageDims:', imageDims, 'likelyInPixels:', likelyInPixels)

            // Validate normalized bounds are reasonable
            if (
                isNaN(normalizedBounds.x) || isNaN(normalizedBounds.y) ||
                isNaN(normalizedBounds.width) || isNaN(normalizedBounds.height)
            ) {
                debugLog.warn('Normalized bounds contain NaN:', normalizedBounds)
                return null
            }

            return normalizedBounds
        } catch (error) {
            debugLog.warn('Error calculating viewport bounds:', error)
            return null
        }
    }, [viewer, getImageDimensions, debugLog])

    // Fire callback with debouncing
    const fireViewportChange = useCallback(() => {
        if (!callbackRef.current) return

        const bounds = calculateViewportBounds()
        if (!bounds) return

        // Check if bounds actually changed (avoid duplicate callbacks)
        const lastBounds = lastBoundsRef.current
        if (
            lastBounds &&
            Math.abs(lastBounds.x - bounds.x) < 0.0001 &&
            Math.abs(lastBounds.y - bounds.y) < 0.0001 &&
            Math.abs(lastBounds.width - bounds.width) < 0.0001 &&
            Math.abs(lastBounds.height - bounds.height) < 0.0001 &&
            Math.abs(lastBounds.zoom - bounds.zoom) < 0.0001
        ) {
            return // No significant change
        }

        lastBoundsRef.current = bounds

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        // Debounce rapid updates (e.g., during animations)
        debounceTimerRef.current = setTimeout(() => {
            if (callbackRef.current) {
                try {
                    callbackRef.current(bounds)
                } catch (error) {
                    debugLog.error('Error in onViewportChange callback:', error)
                }
            }
        }, 50) // 50ms debounce
    }, [calculateViewportBounds, debugLog])

    // Set up event listeners
    useEffect(() => {
        if (!viewer || !onViewportChange) return

        // Listen to viewport change events (like the old implementation)
        // Use 'viewport-change' event which fires on any viewport change (pan, zoom, resize)
        const handlers: Array<() => void> = []

        const viewportChangeHandler = () => {
            fireViewportChange()
        }
        viewer.addHandler('viewport-change', viewportChangeHandler)
        handlers.push(viewportChangeHandler)

        // Also listen to 'open' event to fire callback after image is loaded (like the old implementation)
        const openHandler = () => {
            // Wait a bit for the image to be fully ready
            setTimeout(() => {
                fireViewportChange()
            }, 200)
        }
        viewer.addHandler('open', openHandler)
        handlers.push(openHandler)

        // Fire initial callback with current viewport state
        // Use a delay to ensure viewer and image are fully initialized
        const initTimer = setTimeout(() => {
            fireViewportChange()
        }, 500)

        debugLog.log('Viewport change listeners attached')

        return () => {
            clearTimeout(initTimer)
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
            // Remove event handlers
            if (viewer && handlers[0]) {
                try {
                    viewer.removeHandler('viewport-change', handlers[0])
                } catch (error) {
                    debugLog.warn('Error removing viewport-change handler:', error)
                }
            }
            if (viewer && handlers[1]) {
                try {
                    viewer.removeHandler('open', handlers[1])
                } catch (error) {
                    debugLog.warn('Error removing open handler:', error)
                }
            }
            debugLog.log('Viewport change listeners removed')
        }
    }, [viewer, onViewportChange, fireViewportChange, debugLog])
}
