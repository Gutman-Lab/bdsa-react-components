import type { FeatureCollection } from 'geojson'
import type { Viewer as OpenSeadragonViewer } from 'openseadragon'
import type { SlideImageInfo, ViewportBounds } from '../SlideViewer/SlideViewer.types'
import type { ApiErrorHandler } from '../../utils/apiErrorHandling'
import type { FeatureCollectionToLocalOptions } from './annotationGeoJson'

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
    /** DSA fill color for detection boxes. */
    fillColor?: string
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
    /** When true, the Edit ROIs “Fixed size” checkbox starts checked. Default: false */
    defaultFixedSizeEnabled?: boolean
    /**
     * When set, every ROI uses this exact `label.value` (YOLO `roi_labels` compatibility).
     * Without this, labels are `{label}{n}` e.g. `roi1`, `roi2`.
     */
    fixedLabel?: string
    /** DSA fill color for ROI rectangles. Overrides default black fill. */
    fillColor?: string
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

export interface AutoSaveSettings {
    /** Persist after local document changes. Default: true when this object is passed. */
    enabled?: boolean
    /** Wait after the last edit before saving. Default: 2500 */
    debounceMs?: number
    /** Flush a pending save when the editor unmounts (e.g. slide change). Default: true */
    saveOnUnmount?: boolean
}

export interface HotkeySettings {
    /** Key to navigate to next ROI. Default: 'M' */
    reviewNext?: string
    /** Key to navigate to previous ROI. Default: 'N' */
    reviewPrevious?: string
    /**
     * In Add Labels mode, toggle rectangle drawing vs viewport pan (mouse drag).
     * Default: 't'
     */
    insertBox?: string
    /** Previous label type in Add Labels mode. Default: '[' (Q/W are reserved for pan). */
    typeCyclePrevious?: string
    /** Next label type in Add Labels mode. Default: ']' */
    typeCycleNext?: string
    /** Commit in-progress label/ROI shape edit. Default: 'f' (Enter also works). */
    finishShapeEdit?: string
    /** Start editing hovered or focused label shape. Default: 'e' */
    editLabelShape?: string
}

export type EditorMode = 'add-roi' | 'drawing-roi' | 'edit-roi' | 'delete-roi'

export type WorkflowMode = 'edit-rois' | 'add-labels' | 'review' | 'filter'

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
    /** Optional metadata written to the DSA document `attributes` field on save. */
    documentAttributes?: Record<string, unknown>
    /** Keyboard shortcut configuration */
    hotkeys?: HotkeySettings
    /**
     * Toolbar workflow on load and after clear-all. Default: `edit-rois`.
     * Use `add-labels` when ROIs are usually already placed.
     */
    defaultWorkflowMode?: WorkflowMode
    /** Additional OpenSeadragon options passed through to SlideViewer */
    viewerOptions?: Record<string, unknown>
    /**
     * `label.value` strings that count as ROI (YOLO `roi_labels`).
     * When set, ROI counting matches DSA / project slide lists instead of `group === 'ROI'` only.
     */
    roiCountLabels?: string[]
    /**
     * `label.value` strings that count as detection boxes (YOLO `box_labels`).
     * Defaults to {@link annotationTypes} names when omitted.
     */
    boxCountLabels?: string[]
    /**
     * Pan/zoom to fit the selected ROI when the ROI dropdown or M/N hotkeys change it.
     * Default: false (use explicit zoom actions instead).
     */
    zoomToSelectedRoi?: boolean
}

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
    /**
     * Show the toolbar "Show Info" toggle (hover tooltips on annotation elements).
     * Default: true.
     */
    showInfoControl?: boolean
    /** Start with hover tooltips enabled (no need to click "Show Info"). Default: false */
    defaultShowInfo?: boolean
    /**
     * Show the label hover panel (class picker + Edit/Delete) when mousing over a label box.
     * Right-click context menu is unchanged. Default: true.
     */
    showLabelHoverPanel?: boolean
    /** Show semi-transparent fill inside ROI rectangles. Default: false (outline only). */
    defaultRoiFillVisible?: boolean
    /**
     * Hover tooltip layout. `cleanup` emphasizes class, label, and confidence for YOLO review.
     * Default: `full` (geometry + all user fields).
     */
    hoverInfoMode?: 'full' | 'cleanup'
    /** Custom CSS class name */
    className?: string
    /** Inline styles for the root element */
    style?: React.CSSProperties
    /** Callback when an API error occurs */
    onApiError?: ApiErrorHandler
    /**
     * Debounced persist to DSA (or GeoJSON export) after annotation edits.
     * Pass `true` for defaults, or an object to tune debounce / unmount flush.
     */
    autoSave?: boolean | AutoSaveSettings
    /** Called after a successful manual or automatic save. */
    onAnnotationSaved?: () => void
    /**
     * Called when a save is blocked because the DSA document changed on the server
     * since this editor last synced. Host apps typically reload the editor from DSA.
     */
    onSaveConflict?: (details: AnnotationSaveConflictDetails) => void
    /** Passed to SlideViewer. Use `true` in Storybook iframes so OSD initializes when not intersecting. */
    disableVisibilityCheck?: boolean
    /** Passed through to the underlying SlideViewer. */
    onViewerReady?: (viewer: OpenSeadragonViewer) => void
    /** Passed through to the underlying SlideViewer. */
    onViewportChange?: (bounds: ViewportBounds) => void

    // ── GeoJSON / YOLO-style workflow (optional; DSA path unchanged if omitted) ──
    /**
     * **Opt-in only.** If you do not set `initialGeoJson`, `initialGeoJsonUrl`, or `skipDsaAnnotationLoad`,
     * the editor uses the same DSA list/fetch and save flow as before.
     *
     * When set, the editor does not load an annotation from DSA; it hydrates from this GeoJSON
     * (e.g. YOLO predictions). Coordinates are assumed to be image pixel space matching `imageInfo`.
     */
    initialGeoJson?: FeatureCollection
    /**
     * Fetch GeoJSON from this URL (e.g. `/predictions.geojson` from your YOLO service).
     * Ignored if `initialGeoJson` is provided.
     */
    initialGeoJsonUrl?: string
    /** How each feature maps to editor groups (ROI vs label types). */
    geoJsonImportOptions?: FeatureCollectionToLocalOptions
    /**
     * When true, the main save action calls `onGeoJsonExport` with a FeatureCollection
     * instead of POST/PUT to DSA. `apiBaseUrl` is not required in this mode.
     */
    geoJsonExportMode?: boolean
    /** Called with a FeatureCollection when the user saves in `geoJsonExportMode`. */
    onGeoJsonExport?: (collection: FeatureCollection) => void
    /**
     * When true, never loads annotations from DSA (use with `initialGeoJson` / URL, or a blank canvas
     * with `geoJsonExportMode` only).
     */
    skipDsaAnnotationLoad?: boolean
    /**
     * Read-only model predictions rendered as a separate feature collection (does not replace DSA load).
     */
    overlayGeoJson?: FeatureCollection | null
    /** When false, hides {@link overlayGeoJson} on the canvas. Default: true when overlay is set. */
    overlayGeoJsonVisible?: boolean
    /** Paper.js collection display name for {@link overlayGeoJson}. Default: `Model predictions`. */
    overlayCollectionName?: string
}

/** Imperative API for host apps (e.g. testing utilities in the slide workspace). */
export type ClearAllAnnotationsResult = 'cleared' | 'cancelled' | 'empty' | 'error'

export type RemoveOverlappingLabelsOptions = {
    /** Limit cleanup to boxes stamped to the active ROI. Default: whole slide. */
    scope?: 'active-roi' | 'slide'
    /** IoU threshold for greedy NMS (0 disables). Default 0.5. */
    iouThreshold?: number
    /** Drop smaller same-class boxes mostly inside a larger one (0 disables). Default 0.7. */
    containedThreshold?: number
    saveToDsa?: boolean
    skipConfirm?: boolean
}

export type RemoveOverlappingLabelsResult = {
    status: 'removed' | 'none' | 'cancelled' | 'error'
    removed: number
    kept: number
}

export type RoiImageBounds = {
    left: number
    top: number
    width: number
    height: number
}

/** Ground-truth detection box in the active ROI (slide pixel coordinates). */
export type GroundTruthBox = {
    className: string
    left: number
    top: number
    width: number
    height: number
}

export type AnnotationSaveConflictDetails = {
    serverElementCount: number
    baselineElementCount: number
    localElementCount: number
}

export type AnnotationEditorSyncSnapshot = {
    roiCount: number
    boxCount: number
    dirty: boolean
    saveStatus: 'idle' | 'saving' | 'saved' | 'error'
    /** False while the editor ref or DSA load has not settled. */
    ready: boolean
    loading: boolean
}

export interface AnnotationEditorHandle {
    /** Remove every ROI and detection label; optionally persist empty doc to DSA. */
    clearAllAnnotations: (options?: {
        saveToDsa?: boolean
    }) => Promise<ClearAllAnnotationsResult>
    /** Top-left of the selected ROI, or the first ROI when none is selected. */
    getActiveRoiBounds: () => RoiImageBounds | null
    /** Label boxes stamped to the active ROI (`user.roiLabel`). */
    getActiveRoiGroundTruthBoxes: () => GroundTruthBox[]
    /** Move the selected ROI (no-op when none selected). Returns false if nothing moved. */
    nudgeSelectedRoi: (dx: number, dy: number) => boolean
    /** Move the selected ROI top-left (no-op when none selected). */
    setSelectedRoiTopLeft: (left: number, top: number) => boolean
    /** In-memory editor counts and save state (compare to DSA for sync checks). */
    getSyncSnapshot: () => AnnotationEditorSyncSnapshot
    /** Flush the current annotation document to DSA immediately. */
    saveToDsa: () => Promise<boolean>
    /** Remove overlapping detection boxes (keeps the larger box per overlap cluster). */
    removeOverlappingLabels: (
        options?: RemoveOverlappingLabelsOptions,
    ) => Promise<RemoveOverlappingLabelsResult>
    /** Pan/zoom to fit one or more document elements by index (slide-pixel bounds). */
    fitViewerToElementDocIndices: (docIndices: number[]) => boolean
}
