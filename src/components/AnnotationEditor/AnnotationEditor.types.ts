import type { SlideImageInfo } from '../SlideViewer/SlideViewer.types'
import type { ApiErrorHandler } from '../../utils/apiErrorHandling'

export interface AnnotationType {
    /** Display name for this annotation type */
    name: string
    /** Stroke color (CSS color string) */
    color: string
    /** Stroke width in pixels. Default: 1 */
    strokeWidth?: number
    /** Keyboard shortcut key (single character) */
    key?: string
    /** Default width in image pixels when drop-placing */
    defaultWidth: number
    /** Default height in image pixels when drop-placing */
    defaultHeight: number
}

export interface RoiSettings {
    /** Stroke color for ROI rectangles. Default: 'orange' */
    color?: string
    /** Stroke width for ROI rectangles. Default: 2 */
    strokeWidth?: number
    /** Fill opacity for ROI rectangles (0-1). Default: 0.05 */
    fillOpacity?: number
}

export interface HotkeySettings {
    /** Key to navigate to next ROI. Default: 'M' */
    reviewNext?: string
    /** Key to navigate to previous ROI. Default: 'N' */
    reviewPrevious?: string
    /** Key to insert a new annotation box. Default: 'b' */
    insertBox?: string
}

export interface AnnotationEditorConfig {
    /**
     * Name of the DSA annotation document to load/save.
     * If multiple documents share this name, the first is used and a warning is shown.
     */
    annotationDocumentName: string
    /** Optional description written when creating a new annotation document */
    annotationDescription?: string
    /** Object annotation types (the small boxes inside ROIs) */
    annotationTypes: AnnotationType[]
    /** Visual settings for ROI rectangles */
    roiSettings?: RoiSettings
    /** Keyboard shortcut configuration */
    hotkeys?: HotkeySettings
    /** Additional OpenSeadragon options passed through to SlideViewer */
    viewerOptions?: Record<string, unknown>
}

export type EditorMode = 'add-roi' | 'edit-roi' | 'delete-roi'

export interface AnnotationEditorProps {
    /** Image to display in the viewer */
    imageInfo: SlideImageInfo
    /** Protocol/task configuration */
    config: AnnotationEditorConfig
    /** Base URL for the DSA API (e.g. 'http://bdsa.pathology.emory.edu:8080/api/v1') */
    apiBaseUrl?: string
    /** Authentication token for DSA requests */
    authToken?: string
    /** If true, appends token as a query parameter to tile/DZI URLs */
    tokenQueryParam?: boolean
    /** Custom fetch function (for adding auth headers, etc.) */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>
    /** Additional HTTP headers for API requests */
    apiHeaders?: HeadersInit
    /** Show the SlideViewer info bar (mouse coords, zoom, preset zoom buttons). Default: true */
    showInfoBar?: boolean
    /** Custom CSS class name */
    className?: string
    /** Inline styles for the root element */
    style?: React.CSSProperties
    /** Callback when an API error occurs */
    onApiError?: ApiErrorHandler
}
