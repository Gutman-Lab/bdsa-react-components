import { useEffect } from 'react'
import type React from 'react'
import type { PaperOverlay } from 'osd-paperjs-annotation'
import { AnnotationToolkit } from 'osd-paperjs-annotation'
import type { Viewer as OpenSeadragonViewer, Options as OpenSeadragonOptions } from 'openseadragon'
import OpenSeadragon from 'openseadragon'
import type { DebugLogger } from '../../../utils/debugLog'
import { hardenPaperOverlayInstance } from '../../../utils/patchOsdPaperjs'

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
        if (isInitializedRef.current && lastImageKeyRef.current === imageKey) {
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
                    // Allow zooming out very far (matches archive app behavior)
                    minZoomImageRatio: 0.01,
                    maxZoomPixelRatio: 16,
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
                hardenPaperOverlayInstance(paperOverlay)
                if (isMountedRef.current) {
                    setOverlay(paperOverlay)
                }

                // Create annotation toolkit immediately (like working example - before loading image)
                annotationToolkit = new AnnotationToolkit(osdViewer, {
                    overlay: paperOverlay,
                })

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

            // Always tear down resources created in this effect instance. A previous guard
            // skipped cleanup when imageKey matched lastImageKeyRef (set during init) and
            // isMountedRef was still true — React runs this cleanup before the isMounted
            // effect, so OpenSeadragon viewers leaked on slide change / remount.
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
                    const viewerState = osdViewer as unknown as { isDestroyed?: boolean }
                    if (viewerState.isDestroyed !== true) {
                        osdViewer.destroy()
                    }
                } catch (e) {
                    console.warn('Error destroying OpenSeadragon viewer:', e)
                }
            }

            isInitializedRef.current = false

            // Don't clear React state here — can cause re-init loops if the effect runs again
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



