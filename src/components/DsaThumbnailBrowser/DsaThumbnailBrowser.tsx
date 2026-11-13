import { OSDThumbnailBrowser } from '../OSDThumbnailBrowser/OSDThumbnailBrowser'
import type { OSDThumbnailBrowserProps } from '../OSDThumbnailBrowser/OSDThumbnailBrowser'
import { ThumbnailGrid } from '../ThumbnailGrid/ThumbnailGrid'
import type { ThumbnailGridProps } from '../ThumbnailGrid/ThumbnailGrid'
/** Minimal DSA item shape accepted by both thumbnail browsers. */
export interface DsaThumbnailBrowserItem {
    _id: string | number
    name?: string
    [key: string]: unknown
}

/** Which thumbnail UI to use for a DSA folder or item list. */
export type DsaThumbnailViewerMode = 'static' | 'openseadragon'

/** OpenSeadragon needs one WebGL context per tile; keep a safe default page size. */
const OSD_WEBGL_SAFE_MAX_ITEMS = 10

type SharedBrowseProps = {
    folderId?: string
    imageIds?: string[]
    items?: DsaThumbnailBrowserItem[]
    apiBaseUrl?: string
    backendApiBaseUrl?: string
    apiHeaders?: HeadersInit
    authToken?: string
    tokenQueryParam?: boolean
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>
    itemsPerPage?: number
    modelName?: string
    modelDatasetInfo?: ThumbnailGridProps['modelDatasetInfo']
    onItemsLoaded?: (itemIds: string[]) => void
    getDatasetType?: (itemId: string) => 'train' | 'val' | 'test' | null
    onApiError?: ThumbnailGridProps['onApiError']
    debug?: boolean
    className?: string
}

export type DsaThumbnailBrowserProps = SharedBrowseProps & {
    /**
     * `static` — lightweight image grid without OpenSeadragon (`ThumbnailGrid`).
     * `openseadragon` — live whole-slide pyramids per tile (`OSDThumbnailBrowser`).
     */
    viewerMode: DsaThumbnailViewerMode
    /** Thumbnail size preset (maps to `viewerSize` or `thumbnailSize` on the underlying component). */
    viewerSize?: 's' | 'm' | 'l' | 'xl'
    /** OpenSeadragon mode only — show zoom/home/fullscreen on each tile (default: true). */
    showViewerControls?: boolean
    /** Static mode — how to fetch image bytes (default: 'tiles'). */
    imageSource: 'tiles' | 'download'
    /** Static mode — `/tiles/thumbnail?width=` pixel size. */
    thumbnailImageSize: number
    /** When false, include items without a largeImage flag (default: true). */
    requireLargeImage: boolean
    /** Static mode — click handler for a grid cell. */
    onThumbnailClick?: (item: DsaThumbnailBrowserItem) => void
    /** Static mode — pointer entered a grid cell. */
    onThumbnailHover?: (item: DsaThumbnailBrowserItem) => void
    /** Static mode — double-click handler for a grid cell. */
    onThumbnailDoubleClick?: (item: DsaThumbnailBrowserItem) => void
    /** Annotation name used to filter items (requires `annotationNameToIds`). */
    selectedAnnotationName?: string
    /** Map of item ID to annotation ID; forward to OSD overlays and static filtering. */
    annotationNameToIds?: Map<string, string>
    /** OpenSeadragon mode — annotation overlay opacity (default: 0.7). */
    annotationOpacity?: OSDThumbnailBrowserProps['annotationOpacity']
    /** OpenSeadragon mode — annotation opacity change callback. */
    onAnnotationOpacityChange?: OSDThumbnailBrowserProps['onAnnotationOpacityChange']
}

/**
 * Switch between the lightweight static thumbnail grid and the OpenSeadragon
 * whole-slide thumbnail browser with one common prop surface. Dataset browsers
 * pass the same `items`/`folderId` and let `viewerMode` choose the renderer.
 */
export function DsaThumbnailBrowser({
    viewerMode,
    viewerSize = 'm',
    showViewerControls = true,
    imageSource,
    requireLargeImage,
    thumbnailImageSize,
    folderId,
    imageIds,
    items,
    apiBaseUrl,
    backendApiBaseUrl,
    apiHeaders,
    authToken,
    tokenQueryParam,
    fetchFn,
    itemsPerPage = viewerMode === 'static' ? undefined : OSD_WEBGL_SAFE_MAX_ITEMS,
    modelName,
    modelDatasetInfo,
    onItemsLoaded,
    getDatasetType,
    onApiError,
    debug,
    className,
    onThumbnailClick,
    onThumbnailHover,
    onThumbnailDoubleClick,
    selectedAnnotationName,
    annotationNameToIds,
    annotationOpacity,
    onAnnotationOpacityChange,
}: DsaThumbnailBrowserProps) {
    if (viewerMode === 'static') {
        const gridProps: ThumbnailGridProps = {
            folderId,
            imageIds,
            items: items as unknown as ThumbnailGridProps['items'],
            apiBaseUrl,
            backendApiBaseUrl,
            apiHeaders,
            authToken,
            tokenQueryParam,
            fetchFn,
            itemsPerPage,
            thumbnailSize: viewerSize,
            thumbnailImageSize,
            modelName,
            modelDatasetInfo,
            onItemsLoaded,
            getDatasetType,
            onThumbnailClick,
            onThumbnailHover,
            onThumbnailDoubleClick,
            selectedAnnotationName,
            annotationNameToIds,
            onApiError,
            debug,
            className,
            imageSource,
            requireLargeImage,
        }
        return <ThumbnailGrid {...gridProps} />
    }

    const osdProps: OSDThumbnailBrowserProps = {
        folderId,
        imageIds,
        items: items as unknown as OSDThumbnailBrowserProps['items'],
        requireLargeImage,
        apiBaseUrl,
        backendApiBaseUrl,
        apiHeaders,
        authToken,
        tokenQueryParam,
        fetchFn,
        itemsPerPage,
        viewerSize,
        showViewerControls,
        modelName,
        modelDatasetInfo,
        onItemsLoaded,
        getDatasetType,
        onApiError,
        debug,
        className,
        selectedAnnotationName,
        annotationNameToIds,
        annotationOpacity,
        onAnnotationOpacityChange,
    }
    return <OSDThumbnailBrowser {...osdProps} />
}

DsaThumbnailBrowser.displayName = 'DsaThumbnailBrowser'
