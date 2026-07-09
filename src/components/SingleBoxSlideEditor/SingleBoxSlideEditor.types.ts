import type { SlideImageInfo } from '../SlideViewer/SlideViewer.types'
import type { SlideViewerProps } from '../SlideViewer/SlideViewer.types'

export type SlideImageBox = {
    left: number
    top: number
    width: number
    height: number
}

export type SingleBoxSlideEditorProps = {
    imageInfo: SlideImageInfo
    /** Slide-space box to display and edit. When null, only the slide is shown. */
    box: SlideImageBox | null
    /** Feature label passed to the GeoJSON overlay. */
    boxLabel?: string
    strokeColor?: string
    disabled?: boolean
    className?: string
    height?: string | number
    width?: string | number
    showInfoBar?: boolean
    showToolbar?: boolean
    /** Toggle shape edit vs pan, same default as AnnotationEditor insertBox hotkey. */
    shapeEditToggleKey?: string
    commitLabel?: string
    onBoxChange?: (box: SlideImageBox) => void
    onCommit?: (box: SlideImageBox) => Promise<void>
    apiBaseUrl?: string
    apiHeaders?: Record<string, string>
    authToken?: string
    tokenQueryParam?: boolean
    fetchFn?: SlideViewerProps['fetchFn']
    disableVisibilityCheck?: boolean
    osdOptions?: SlideViewerProps['osdOptions']
    onApiError?: SlideViewerProps['onApiError']
    /**
     * Automatically pan/zoom to fit the box when `box` changes or the viewer opens.
     * Default: false — use the toolbar “Zoom to box” button instead.
     */
    autoZoomToBox?: boolean
}
