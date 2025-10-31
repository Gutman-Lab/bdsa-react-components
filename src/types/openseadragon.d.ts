declare module 'openseadragon' {
    export interface Options {
        id?: string
        element?: HTMLElement
        prefixUrl?: string
        maxImageCacheCount?: number
        crossOriginPolicy?: string
        autoHideControls?: boolean
        debugMode?: boolean
        // Navigation and UI Controls
        showNavigator?: boolean
        showZoomControl?: boolean
        showHomeControl?: boolean
        showFullPageControl?: boolean
        showRotationControl?: boolean
        showSequenceControl?: boolean
        controlsFadeDelay?: number
        controlsFadeLength?: number
        // Zoom and view options
        minZoomLevel?: number
        maxZoomLevel?: number
        defaultZoomLevel?: number
        zoomPerClick?: number
        zoomPerScroll?: number
        zoomPerSecond?: number
        // Pan options
        panHorizontal?: boolean
        panVertical?: boolean
        // Other common options
        gestureSettingsMouse?: {
            clickToZoom?: boolean
            dblClickToZoom?: boolean
            pinchToZoom?: boolean
            flickEnabled?: boolean
            flickMinSpeed?: number
            flickMomentum?: number
            pinchRotate?: boolean
        }
        [key: string]: unknown
    }

    export interface Viewer {
        viewport: Viewport
        world: World
        destroy(): void
        open(tileSource: string | object, immediately?: boolean): void
        addTiledImage(options: { tileSource: object; success?: () => void }): void
        createPaperOverlay(): PaperOverlay
        addHandler(event: string, handler: (event: unknown) => void): void
    }

    export interface Viewport {
        imageToViewportCoordinates(x: number, y: number): Point
        imageToViewportZoom(zoom: number): number
        zoomTo(zoom: number, immediately?: boolean): void
        panTo(point: Point, immediately?: boolean): void
        goHome(immediately?: boolean): void
    }

    export interface World {
        getItemAt(index: number): TiledImage
        getItemCount(): number
        addHandler(event: string, handler: (event: unknown) => void): void
    }

    export interface TiledImage {
        addPaperItem(item: unknown): void
    }

    export interface Point {
        x: number
        y: number
    }

    export interface PaperOverlay {
        paperScope: {
            Path: {
                Rectangle: new (options: unknown) => unknown
            }
            project: {
                activeLayer: {
                    children: unknown[]
                }
            }
        }
        destroy(): void
    }

    function OpenSeadragon(options?: Options): Viewer

    export default OpenSeadragon
}

