import { OSDThumbnailBrowser, OSD_WEBGL_SAFE_MAX_ITEMS } from '../OSDThumbnailBrowser/OSDThumbnailBrowser'
import type { OSDThumbnailBrowserProps } from '../OSDThumbnailBrowser/OSDThumbnailBrowser'
import { ThumbnailGrid } from '../ThumbnailGrid/ThumbnailGrid'
import type { ThumbnailGridProps } from '../ThumbnailGrid/ThumbnailGrid'

/** Which thumbnail UI to use for a DSA folder or item list. */
export type DsaThumbnailViewerMode = 'openseadragon' | 'static'

type SharedBrowseProps = {
    folderId?: string
    imageIds?: string[]
    items?: ThumbnailGridProps['items']
    apiBaseUrl?: string
    backendApiBaseUrl?: string
    apiHeaders?: HeadersInit
    authToken?: string
    tokenQueryParam?: boolean
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>
    itemsPerPage?: number
    /** OpenSeadragon mode — hard cap on simultaneous viewers (default: 10). */
    maxItemsPerPage?: number
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
     * `openseadragon` — whole-slide pyramids with OpenSeadragon (`OSDThumbnailBrowser`).
     * `static` — lightweight grid without OpenSeadragon (`ThumbnailGrid`).
     */
    viewerMode?: DsaThumbnailViewerMode
    /** Thumbnail size preset (maps to `viewerSize` or `thumbnailSize` on the underlying component). */
    viewerSize?: 's' | 'm' | 'l' | 'xl'
    /** OpenSeadragon mode only — show zoom/home/fullscreen on each tile. */
    showViewerControls?: boolean
    /** Static mode — how to fetch image bytes (see `ThumbnailGrid`). */
    imageSource?: 'tiles' | 'download'
    /** Static mode — `/tiles/thumbnail?width=` pixel size (default: 256). */
    thumbnailImageSize?: number
    /** When false, include items without a largeImage flag (static + download). Default true. */
    requireLargeImage?: boolean
    /** Static mode — click handler for a grid cell. */
    onThumbnailClick?: ThumbnailGridProps['onThumbnailClick']
    /** Static mode — pointer entered a grid cell. */
    onThumbnailHover?: ThumbnailGridProps['onThumbnailHover']
    /** Static mode — double-click handler for a grid cell. */
    onThumbnailDoubleClick?: ThumbnailGridProps['onThumbnailDoubleClick']
    /** OpenSeadragon mode — annotation overlay props. */
    selectedAnnotationName?: OSDThumbnailBrowserProps['selectedAnnotationName']
    annotationNameToIds?: OSDThumbnailBrowserProps['annotationNameToIds']
    annotationOpacity?: OSDThumbnailBrowserProps['annotationOpacity']
    onAnnotationOpacityChange?: OSDThumbnailBrowserProps['onAnnotationOpacityChange']
}

/**
 * Pick the right DSA thumbnail browser for the dataset:
 * - Default `static` — DSA `/tiles/thumbnail` images (no WebGL).
 * - `openseadragon` — live pyramid viewers per tile (heavy; cap page size).
 */
export function DsaThumbnailBrowser({
    viewerMode = 'static',
    viewerSize = 'm',
    showViewerControls = true,
    imageSource = 'tiles',
    requireLargeImage = true,
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
    maxItemsPerPage,
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
            items,
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
        items,
        apiBaseUrl,
        backendApiBaseUrl,
        apiHeaders,
        authToken,
        tokenQueryParam,
        fetchFn,
        itemsPerPage,
        maxItemsPerPage,
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
