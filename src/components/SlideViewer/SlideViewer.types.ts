import type { FeatureCollection } from 'geojson'
import type { Viewer as OpenSeadragonViewer, Options as OpenSeadragonOptions } from 'openseadragon'
import type React from 'react'
import type { ApiErrorHandler } from '../../utils/apiErrorHandling'

/**
 * Configuration for a slide image to display in the SlideViewer.
 * 
 * You can provide either:
 * - A `dziUrl` (recommended): OpenSeadragon will automatically fetch all metadata
 * - Manual configuration: Provide `imageId`, `width`, `height`, `tileWidth`, `levels`, and `baseUrl`
 * 
 * @example Using DZI URL (recommended)
 * ```tsx
 * const imageInfo = {
 *   dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/123/tiles/dzi.dzi'
 * }
 * ```
 * 
 * @example Manual configuration
 * ```tsx
 * const imageInfo = {
 *   imageId: '123',
 *   width: 40000,
 *   height: 30000,
 *   tileWidth: 256,
 *   levels: 8,
 *   baseUrl: 'http://bdsa.pathology.emory.edu:8080'
 * }
 * ```
 */
export interface SlideImageInfo {
    /** Image ID from DSA (required if dziUrl is not provided) */
    imageId?: string | number
    /** Image width in pixels (required if dziUrl is not provided) */
    width?: number
    /** Image height in pixels (required if dziUrl is not provided) */
    height?: number
    /** Tile width in pixels (required if dziUrl is not provided) */
    tileWidth?: number
    /** Number of zoom levels (required if dziUrl is not provided) */
    levels?: number
    /** Base URL for DSA tile server (required if dziUrl is not provided) */
    baseUrl?: string
    /** 
     * DZI descriptor URL. If provided, this will be used instead of manually constructing tile URLs.
     * OpenSeadragon will automatically fetch all metadata (width, height, levels, etc.) from the DZI file.
     * 
     * @example 'http://bdsa.pathology.emory.edu:8080/api/v1/item/{itemId}/tiles/dzi.dzi'
     */
    dziUrl?: string
}

/**
 * Represents an annotation feature to be rendered on a slide image.
 * Supports both rectangle annotations and polyline annotations.
 * 
 * @example Rectangle annotation
 * ```tsx
 * const annotation: AnnotationFeature = {
 *   id: 'ann-1',
 *   left: 1000,
 *   top: 2000,
 *   width: 500,
 *   height: 300,
 *   color: '#ff0000',
 *   label: 'Region of Interest'
 * }
 * ```
 * 
 * @example Polyline annotation
 * ```tsx
 * const polyline: AnnotationFeature = {
 *   id: 'poly-1',
 *   annotationType: 'polyline',
 *   points: [[100, 200], [300, 400], [500, 200]],
 *   closed: true,
 *   color: '#00ff00',
 *   fillColor: 'rgba(0, 255, 0, 0.2)'
 * }
 * ```
 */
export interface AnnotationFeature {
    /** Unique identifier for the annotation */
    id?: string | number
    /** Left coordinate in pixels (for rectangle annotations) */
    left: number
    /** Top coordinate in pixels (for rectangle annotations) */
    top: number
    /** Width in pixels (for rectangle annotations) */
    width: number
    /** Height in pixels (for rectangle annotations) */
    height: number
    /** Optional color for the annotation stroke (CSS color string) */
    color?: string
    /** Optional group identifier for organizing related annotations */
    group?: string | number
    /** Optional label to display with the annotation */
    label?: string
    /** Type of annotation - 'rectangle' for bounding boxes, 'polyline' for paths */
    annotationType?: 'rectangle' | 'polyline'
    /** Array of [x, y] coordinate pairs for polyline annotations */
    points?: Array<[number, number]>
    /** Whether the polyline should be closed (connect last point to first) */
    closed?: boolean
    /** Fill color for polyline annotations (CSS color string) */
    fillColor?: string
    /** Internal: Store full element for rendering (used internally) */
    element?: unknown
    /** Optional additional properties (e.g., documentId, properties from DSA API) */
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

/**
 * Interface for annotation caching implementations.
 * 
 * Provides a cache-aside pattern for annotation documents to reduce API calls
 * and improve performance. Implementations can use IndexedDB, memory, or other storage.
 * 
 * @example Using IndexedDBAnnotationCache
 * ```tsx
 * import { IndexedDBAnnotationCache } from 'bdsa-react-components'
 * 
 * const cache = new IndexedDBAnnotationCache()
 * 
 * <SlideViewer
 *   imageInfo={imageInfo}
 *   annotationIds={['123', '456']}
 *   annotationCache={cache}
 * />
 * ```
 */
export interface AnnotationCache {
    /** Get an annotation from cache by ID and optional version hash */
    get(annotationId: string | number, versionHash?: string): Promise<unknown | null>
    /** Store an annotation in cache with optional TTL and version hash */
    set(annotationId: string | number, data: unknown, options?: { ttl?: number; versionHash?: string }): Promise<void>
    /** Check if an annotation exists in cache */
    has(annotationId: string | number, versionHash?: string): Promise<boolean>
    /** Delete an annotation from cache */
    delete(annotationId: string | number): Promise<void>
    /** Clear all annotations from cache */
    clear(): Promise<void>
    /** Get cache statistics (optional - may not be implemented by all caches) */
    getStats?(): Promise<{ size: number; hits?: number; misses?: number; hitRate?: number }>
}

/**
 * Viewport bounds in normalized coordinates (0-1) relative to the full image.
 * These coordinates are consistent across different image sizes.
 */
export interface ViewportBounds {
    /** Left edge of viewport (0-1, normalized) */
    x: number
    /** Top edge of viewport (0-1, normalized) */
    y: number
    /** Width of viewport (0-1, normalized) */
    width: number
    /** Height of viewport (0-1, normalized) */
    height: number
    /** Current zoom level (e.g., 1.0 = 100%, 2.0 = 200%) */
    zoom: number
}

/**
 * Configuration for an overlay tile source that can be dynamically added to the viewer.
 * Overlay tile sources are rendered on top of the base image and can be positioned, scaled, and have their opacity controlled.
 * 
 * @example Base64 image overlay
 * ```tsx
 * const overlay: OverlayTileSource = {
 *   id: 'overlay-1',
 *   tileSource: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
 *   x: 0.2,  // Position at 20% from left
 *   y: 0.3,  // Position at 30% from top
 *   width: 0.5,  // 50% of base image width
 *   height: 0.5,  // 50% of base image height
 *   opacity: 0.7,
 * }
 * ```
 * 
 * @example DZI URL overlay
 * ```tsx
 * const overlay: OverlayTileSource = {
 *   id: 'overlay-2',
 *   tileSource: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/123/tiles/dzi.dzi',
 *   x: 0,
 *   y: 0,
 *   opacity: 0.5,
 * }
 * ```
 */
export interface OverlayTileSource {
    /** Unique identifier for this overlay tile source */
    id: string | number
    /** 
     * Tile source for the overlay. Can be:
     * - Base64 data URL: `'data:image/png;base64,...'`
     * - DZI URL: `'http://.../dzi.dzi'`
     * - Simple image URL: `'http://.../image.jpg'`
     * - OpenSeadragon tile source object
     */
    tileSource: string | unknown
    /** X position in image coordinates (0 = left edge, 1 = right edge). Default: 0 */
    x?: number
    /** Y position in image coordinates (0 = top edge, 1 = bottom edge). Default: 0 */
    y?: number
    /** Width in image coordinates (0-1, normalized). If not provided, uses tile source's natural width. */
    width?: number
    /** Height in image coordinates (0-1, normalized). If not provided, uses tile source's natural height. */
    height?: number
    /** Opacity (0-1). Default: 1 */
    opacity?: number
    /** Rotation in degrees. Default: 0 */
    rotation?: number
    /** Composite operation (e.g., 'multiply', 'screen', 'overlay'). Default: 'source-over' */
    compositeOperation?: string
    /** Whether the overlay is visible. Default: true */
    visible?: boolean
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
    /** Authentication token to use for requests. Can be extracted from apiHeaders automatically if not provided. */
    authToken?: string
    /** If true, appends the authentication token as a query parameter (?token=...) to all requests (DZI, tiles, annotations).
     *  This is required for some DSA servers that validate tokens via query parameters instead of (or in addition to) headers.
     *  Default: false */
    tokenQueryParam?: boolean
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
    annotationCache?: AnnotationCache | null
    /** If true, disables caching entirely (equivalent to annotationCache={null}). Useful for debugging or forcing fresh fetches. */
    disableCache?: boolean
    /** If true, disables the IntersectionObserver visibility check and initializes immediately.
     *  Useful for cases where you want immediate initialization regardless of viewport visibility.
     *  Default: false (visibility check enabled for better performance and error prevention) */
    disableVisibilityCheck?: boolean
    /** Optional map of annotation headers (from /annotation?itemId=... endpoint) keyed by annotation ID.
     *  If provided, used to compute version hashes for cache invalidation when annotations change on the server.
     *  Should contain the metadata objects returned from AnnotationManager's annotation search endpoint.
     *  Typically obtained from AnnotationManager: `annotations.map(ann => [ann._id, ann])` or similar.
     *  If not provided, cache will work but version-based invalidation will be disabled. */
    annotationHeaders?: Map<string | number, unknown> | Record<string, unknown>
    /** Callback that fires whenever the viewport changes (pan, zoom, resize).
     *  Provides normalized coordinates (0-1) relative to the full image for consistency across image sizes.
     * 
     *  @example
     *  ```tsx
     *  <SlideViewer
     *    imageInfo={{ dziUrl: '...' }}
     *    onViewportChange={(bounds) => {
     *      console.log('Viewport:', bounds)
     *      // bounds: { x: 0.25, y: 0.3, width: 0.5, height: 0.4, zoom: 2.0 }
     *      setViewportState(bounds)
     *    }}
     *  />
     *  ```
     * 
     *  Use cases:
     *  - Display current viewport coordinates in UI
     *  - Capture a region of the image based on current viewport
     *  - Save/restore viewport state
     *  - Sync viewport across multiple viewers
     *  - Generate viewport-based annotations
     */
    onViewportChange?: (bounds: ViewportBounds) => void
    /** 
     * Callback when an API error occurs.
     * Provides error details and a retry function for transient failures.
     * 
     * @param error - The error that occurred
     * @param retry - Function to retry the failed operation
     * @param context - Additional context about the error (endpoint, operation type, etc.)
     * 
     * @example
     * ```tsx
     * <SlideViewer
     *   imageInfo={imageInfo}
     *   annotationIds={['ann-1', 'ann-2']}
     *   apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
     *   onApiError={(error, retry, context) => {
     *     if (error.status === 401) {
     *       // Token expired, refresh and retry
     *       refreshToken().then(() => retry())
     *     } else if (error.isRetryable) {
     *       // Retry with delay
     *       setTimeout(() => retry(), 2000)
     *     } else {
     *       // Show error to user
     *       showErrorNotification(error.message)
     *     }
     *   }}
     * />
     * ```
     */
    onApiError?: ApiErrorHandler
    /** 
     * Array of overlay tile sources to display on top of the base image.
     * Overlays can be dynamically added, removed, or updated by changing this array.
     * 
     * @example
     * ```tsx
     * <SlideViewer
     *   imageInfo={imageInfo}
     *   overlayTileSources={[
     *     {
     *       id: 'overlay-1',
     *       tileSource: 'data:image/png;base64,iVBORw0KGgo...',
     *       x: 0.2,
     *       y: 0.3,
     *       width: 0.5,
     *       height: 0.5,
     *       opacity: 0.7,
     *     }
     *   ]}
     * />
     * ```
     */
    overlayTileSources?: OverlayTileSource[]
    /** If true, enables debug logging to console. Default: false */
    debug?: boolean
    /** Show a toolbar above the viewer with mouse coordinates, current zoom, and preset zoom buttons (1x/5x/10x/20x). Default: false */
    showInfoBar?: boolean
}



