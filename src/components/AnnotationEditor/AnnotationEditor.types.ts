import type { SlideImageInfo } from '../SlideViewer/SlideViewer.types'
import type { ApiErrorHandler } from '../../utils/apiErrorHandling'

export interface AnnotationType {
    /** Display name for this annotation type */
    name: string
    /** Stroke color — must be hex (#rrggbb / #rrggbbaa) or rgb()/rgba() format. Named colors (e.g. "red") are not accepted by DSA. */
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
    /** Base label for ROIs — sequential numbers are appended (e.g. "region" → "region1", "region2"). Default: 'roi' */
    label?: string
    /** Stroke color for ROI rectangles — must be hex (#rrggbb) or rgb()/rgba() format. Default: '#ffa500' */
    color?: string
    /** Stroke width for ROI rectangles. Default: 2 */
    strokeWidth?: number
    /** Fill opacity for ROI rectangles (0-1). Default: 0.05 */
    fillOpacity?: number
    /** Default width in image pixels for fixed-size ROI placement. Default: 1000 */
    width?: number
    /** Default height in image pixels for fixed-size ROI placement. Default: 1000 */
    height?: number
}

// ── Local annotation document (DSA-compatible structure, stored in memory) ──

export interface LocalAnnotationElement {
    type: 'rectangle'
    group: string
    label: { value: string }
    /** [cx, cy, 0] — center of the rectangle in image pixel coordinates */
    center: [number, number, number]
    width: number
    height: number
    rotation: number
    lineColor: string
    lineWidth: number
    fillColor: string
    /** Arbitrary custom data passed through to DSA's element `user` field */
    user?: Record<string, unknown>
}

export interface LocalAnnotationDocument {
    name: string
    description: string
    elements: LocalAnnotationElement[]
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

export type EditorMode = 'add-roi' | 'drawing-roi' | 'edit-roi' | 'delete-roi'

export type WorkflowMode = 'edit-rois' | 'add-labels' | 'review' | 'filter'

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
