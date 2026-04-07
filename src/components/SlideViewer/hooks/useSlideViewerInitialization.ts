import { useEffect } from 'react'
import type React from 'react'
import type { PaperOverlay } from 'osd-paperjs-annotation'
import { AnnotationToolkit } from 'osd-paperjs-annotation'
import type { Viewer as OpenSeadragonViewer, Options as OpenSeadragonOptions } from 'openseadragon'
import OpenSeadragon from 'openseadragon'
import type { DebugLogger } from '../../../utils/debugLog'

/**
 * Hook to handle OpenSeadragon viewer initialization
 */
export function useSlideViewerInitialization(
    containerRef: React.RefObject<HTMLDivElement>,
    isVisible: boolean,
    isMountedRef: React.MutableRefObject<boolean>,
    isInitializedRef: React.MutableRefObject<boolean>,
    lastImageKeyRef: React.MutableRefObject<string>,
    viewerIdRef: React.MutableRefObject<string>,
    imageKey: string,
    processedDziUrl: string | null | undefined,
    imageInfo: {
        imageId?: string | number
        width?: number
        height?: number
        tileWidth?: number
        levels?: number
        baseUrl?: string
        dziUrl?: string
    },
    token: string | null | undefined,
    tokenQueryParam: boolean,
    apiHeaders: HeadersInit | undefined,
    osdOptions: OpenSeadragonOptions | undefined,
    onViewerReadyRef: React.MutableRefObject<((viewer: OpenSeadragonViewer) => void) | undefined>,
    setViewer: (viewer: OpenSeadragonViewer | null) => void,
    setOverlay: (overlay: PaperOverlay | null) => void,
    setToolkit: (toolkit: AnnotationToolkit | null) => void,
    tiledImageRef: React.MutableRefObject<{ addPaperItem: (item: unknown) => void; paperItems?: unknown[] } | null>,
    appendTokenToUrl: (url: string, token: string) => string,
    debugLog: DebugLogger
) {
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
                if (containerRef.current) {
                    containerRef.current.id = viewerIdRef.current
                }

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
                    // Add auth headers for tile requests if provided
                    ...(apiHeaders ? { ajaxHeaders: apiHeaders } : {}),
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

                        // Helper to safely check if _transformBounds is accessible
                        const hasTransformBounds = (obj: any): boolean => {
                            try {
                                return obj !== null &&
                                    obj !== undefined &&
                                    typeof obj._transformBounds !== 'undefined' &&
                                    obj._transformBounds !== null
                            } catch {
                                return false
                            }
                        }

                        const viewProxy = new Proxy(originalView, {
                            get: (target, prop) => {
                                // Intercept methods that might access _transformBounds
                                if (prop === 'getBounds' || prop === '_transformBounds') {
                                    return function (...args: unknown[]) {
                                        try {
                                            // Defensive check: ensure target and _transformBounds exist
                                            if (!target || !hasTransformBounds(target)) {
                                                // Return a safe default instead of throwing
                                                if (prop === 'getBounds') {
                                                    // Return a bounds object that won't break the library
                                                    return { x: 0, y: 0, width: 0, height: 0 }
                                                }
                                                return null
                                            }

                                            if (prop === 'getBounds') {
                                                const bounds = (originalView.getBounds as any)?.apply(target, args)
                                                return bounds || { x: 0, y: 0, width: 0, height: 0 }
                                            }

                                            return (target as any)[prop]
                                        } catch (error) {
                                            // Catch any _transformBounds related errors
                                            if (error instanceof Error) {
                                                const msg = error.message?.toLowerCase() || ''
                                                if (msg.includes('_transformbounds') ||
                                                    msg.includes('transformbounds') ||
                                                    msg.includes('cannot read properties of null')) {
                                                    // Return safe defaults instead of throwing
                                                    if (prop === 'getBounds') {
                                                        return { x: 0, y: 0, width: 0, height: 0 }
                                                    }
                                                    return null
                                                }
                                            }
                                            // Re-throw non-_transformBounds errors
                                            throw error
                                        }
                                    }
                                }

                                // For all other properties, try to access safely
                                try {
                                    const value = (target as any)[prop]
                                    // If accessing _transformBounds property directly
                                    if (prop === '_transformBounds' && (value === null || value === undefined)) {
                                        // Return a dummy function to prevent null access errors
                                        return () => ({ x: 0, y: 0, width: 0, height: 0 })
                                    }
                                    return value
                                } catch (error) {
                                    // If accessing the property throws, return a safe default
                                    if (error instanceof Error) {
                                        const msg = error.message?.toLowerCase() || ''
                                        if (msg.includes('_transformbounds') || msg.includes('null')) {
                                            if (prop === '_transformBounds') {
                                                return () => ({ x: 0, y: 0, width: 0, height: 0 })
                                            }
                                            return null
                                        }
                                    }
                                    throw error
                                }
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
                    debugLog.log('OpenSeadragon: Image opened', e)
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
                    debugLog.log('Tiled image added:', typedEvent.item)
                    tiledImageRef.current = typedEvent.item as { addPaperItem: (item: unknown) => void; paperItems?: unknown[] }
                })

                // Load the image immediately - use viewer.open() for DZI URLs, or addTiledImage for manual tile sources
                if (processedDziUrl) {
                    // Use viewer.open() for DZI descriptor URL with token if needed - call this immediately, don't wait
                    osdViewer.open(processedDziUrl)
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
                            const tileUrl = `${imageInfo.baseUrl}/wsi/files/tile/${imageInfo.imageId}/${level}/${x}/${y}`
                            // Append token if tokenQueryParam is enabled
                            if (tokenQueryParam && token) {
                                return appendTokenToUrl(tileUrl, token)
                            }
                            return tileUrl
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

                // If this is a _transformBounds error, it's likely due to Paper.js not being ready
                // Suppress it silently as it's handled by global error handlers
                if (error instanceof Error && error.message?.toLowerCase().includes('_transformbounds')) {
                    // Already handled by global error handler - just reset flag
                    return
                }

                // For other errors, log and allow retry on next render
                // Could add error state/prop here for consumer to display error UI if needed
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
    }, [
        imageKey,
        processedDziUrl,
        imageInfo.imageId,
        imageInfo.width,
        imageInfo.height,
        imageInfo.tileWidth,
        imageInfo.levels,
        imageInfo.baseUrl,
        token,
        tokenQueryParam,
        apiHeaders,
        osdOptions,
        isVisible,
        isMountedRef,
        isInitializedRef,
        lastImageKeyRef,
        viewerIdRef,
        onViewerReadyRef,
        setViewer,
        setOverlay,
        setToolkit,
        tiledImageRef,
        appendTokenToUrl,
        debugLog,
    ])
}



