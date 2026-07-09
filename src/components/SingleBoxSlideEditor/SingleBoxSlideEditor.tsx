import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SlideViewer } from '../SlideViewer/SlideViewer'
import type { SlideViewerProps } from '../SlideViewer/SlideViewer.types'
import {
    activatePanTool,
    activateShapeEditTool,
    loadSingleBoxOntoToolkit,
    paperItemToSlideBox,
    removeSingleBoxFromToolkit,
    restorePaperItemSegments,
    roundSlideImageBox,
    type BoxEditSession,
    type EditablePaperItem,
} from './slideBoxToolkit'
import type { SingleBoxSlideEditorProps, SlideImageBox } from './SingleBoxSlideEditor.types'
import {
    boxesNearlyEqual,
    fitViewerToSlideBox,
    formatSlideBoxCoords,
    isFormFieldKeyboardTarget,
    zoomViewerBy,
    type OsdViewerLike,
} from './singleBoxSlideEditor.utils'
import './SingleBoxSlideEditor.css'

type AnnotationToolkitFromSlide = NonNullable<
    Parameters<NonNullable<SlideViewerProps['onToolkitReady']>>[0]
>

/**
 * SlideViewer + osd-paperjs rectangle editor for a single slide-space box.
 * Uses the same GeoJSON overlay and default/rectangle tool switching as AnnotationEditor.
 */
export function SingleBoxSlideEditor({
    imageInfo,
    box,
    boxLabel = 'box',
    strokeColor = '#22c55e',
    disabled = false,
    className = '',
    height = '100%',
    width = '100%',
    showInfoBar = true,
    showToolbar = true,
    shapeEditToggleKey = 't',
    commitLabel = 'Save shape',
    onBoxChange,
    onCommit,
    apiBaseUrl,
    apiHeaders,
    authToken,
    tokenQueryParam,
    fetchFn,
    disableVisibilityCheck,
    osdOptions,
    onApiError,
}: SingleBoxSlideEditorProps) {
    const hostRef = useRef<HTMLDivElement>(null)
    const viewerRef = useRef<OsdViewerLike | null>(null)
    const toolkitRef = useRef<AnnotationToolkitFromSlide | null>(null)
    const boxItemRef = useRef<EditablePaperItem | null>(null)
    const editSessionRef = useRef<BoxEditSession | null>(null)
    const overlayMouseUpRef = useRef<((event: MouseEvent) => void) | null>(null)
    const shapeEditEnabledRef = useRef(false)
    const committedBoxRef = useRef<SlideImageBox | null>(box)
    const boxRef = useRef<SlideImageBox | null>(box)
    const zoomGenerationRef = useRef(0)
    const zoomCleanupRef = useRef<(() => void) | null>(null)
    const zoomDebounceRef = useRef<number | null>(null)
    const slideViewerKeyRef = useRef<string>('slide')
    const activeSlideKeyRef = useRef<string | null>(null)
    const viewerSessionRef = useRef(0)
    const boxKeyRef = useRef<string | null>(null)
    const [hostHeightPx, setHostHeightPx] = useState(280)
    const [draftBox, setDraftBox] = useState<SlideImageBox | null>(null)
    const [shapeEditEnabled, setShapeEditEnabled] = useState(false)
    const [editDirty, setEditDirty] = useState(false)
    const [saving, setSaving] = useState(false)

    const boxKey = useMemo(
        () =>
            box != null
                ? [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)].join(':')
                : null,
        [box],
    )

    const slideViewerKey = useMemo(
        () => String(imageInfo.imageId ?? imageInfo.dziUrl ?? 'slide'),
        [imageInfo.imageId, imageInfo.dziUrl],
    )

    boxRef.current = box
    committedBoxRef.current = box
    shapeEditEnabledRef.current = shapeEditEnabled
    slideViewerKeyRef.current = slideViewerKey
    boxKeyRef.current = boxKey

    const displayBox = draftBox ?? box

    const cancelScheduledZoom = useCallback(() => {
        if (zoomDebounceRef.current != null) {
            window.clearTimeout(zoomDebounceRef.current)
            zoomDebounceRef.current = null
        }
        zoomCleanupRef.current?.()
        zoomCleanupRef.current = null
    }, [])

    const runZoomToSelection = useCallback(
        (
            viewer?: OsdViewerLike | null,
            options?: { tight?: boolean; waitForOpen?: boolean; expectedBoxKey?: string | null },
        ) => {
            const v = viewer ?? viewerRef.current
            const targetBox = boxRef.current
            const expectedSlideKey = slideViewerKeyRef.current
            const expectedBoxKey = options?.expectedBoxKey ?? boxKeyRef.current
            if (!v || !targetBox) return
            if (activeSlideKeyRef.current !== expectedSlideKey) return
            if (expectedBoxKey != null && boxKeyRef.current !== expectedBoxKey) return

            cancelScheduledZoom()
            const generation = ++zoomGenerationRef.current
            const session = viewerSessionRef.current
            const timeouts: number[] = []
            let finished = false
            const tight = options?.tight ?? false
            const waitForOpen = options?.waitForOpen ?? false

            const isStale = (): boolean =>
                generation !== zoomGenerationRef.current ||
                session !== viewerSessionRef.current ||
                activeSlideKeyRef.current !== expectedSlideKey ||
                (expectedBoxKey != null && boxKeyRef.current !== expectedBoxKey)

            const detachListeners = () => {
                try {
                    v.removeHandler?.('open', onOpen)
                } catch {
                    /* viewer may be destroyed */
                }
                const tiled = v.world.getItemAt(0) as
                    | { removeHandler?: (event: string, handler: () => void) => void }
                    | undefined
                try {
                    tiled?.removeHandler?.('fully-loaded-change', onTileLoaded)
                } catch {
                    /* ignore */
                }
            }

            const cleanup = () => {
                for (const id of timeouts) window.clearTimeout(id)
                timeouts.length = 0
                detachListeners()
            }

            const complete = () => {
                if (finished || isStale()) return
                finished = true
                cleanup()
            }

            const tryFit = (): boolean => {
                if (finished || isStale()) {
                    complete()
                    return true
                }
                const ok = fitViewerToSlideBox(v, targetBox, tight)
                if (ok) complete()
                return ok
            }

            const retry = (attempt: number) => {
                if (finished || isStale()) {
                    complete()
                    return
                }
                if (tryFit()) return
                if (attempt >= 30) {
                    complete()
                    return
                }
                const delay = attempt < 6 ? 40 : attempt < 14 ? 100 : 160
                timeouts.push(window.setTimeout(() => retry(attempt + 1), delay))
            }

            const onOpen = () => retry(0)
            const onTileLoaded = () => retry(0)

            v.addHandler?.('open', onOpen)
            const tiled = v.world.getItemAt(0) as
                | { addHandler?: (event: string, handler: () => void) => void }
                | undefined
            tiled?.addHandler?.('fully-loaded-change', onTileLoaded)

            if (!waitForOpen) {
                retry(0)
                timeouts.push(
                    window.setTimeout(() => {
                        if (!finished && !isStale()) retry(0)
                    }, 120),
                )
                requestAnimationFrame(() => {
                    if (!finished && !isStale()) retry(0)
                })
            }

            zoomCleanupRef.current = cleanup
        },
        [cancelScheduledZoom],
    )

    const detachOverlayMouseUp = useCallback(() => {
        const toolkit = toolkitRef.current as { overlay?: { canvas?: () => HTMLElement } } | null
        const canvas = toolkit?.overlay?.canvas?.()
        const handler = overlayMouseUpRef.current
        if (canvas && handler) {
            canvas.removeEventListener('mouseup', handler)
        }
        overlayMouseUpRef.current = null
    }, [])

    const syncDraftFromPaper = useCallback(() => {
        const item = boxItemRef.current
        if (!item) return
        const nextBox = paperItemToSlideBox(item)
        if (!nextBox) return
        setDraftBox(nextBox)
        onBoxChange?.(nextBox)
        const committed = committedBoxRef.current
        setEditDirty(Boolean(committed && !boxesNearlyEqual(nextBox, committed)))
    }, [onBoxChange])

    const syncActiveTool = useCallback(() => {
        const toolkit = toolkitRef.current
        if (!toolkit) return

        detachOverlayMouseUp()
        editSessionRef.current = null

        const item = boxItemRef.current
        if (shapeEditEnabledRef.current && item && !disabled) {
            editSessionRef.current = activateShapeEditTool(toolkit, item)
            const canvas = (toolkit as { overlay?: { canvas?: () => HTMLElement } }).overlay?.canvas?.()
            if (canvas) {
                const onMouseUp = () => syncDraftFromPaper()
                overlayMouseUpRef.current = onMouseUp
                canvas.addEventListener('mouseup', onMouseUp)
            }
            return
        }

        item?.deselect?.(true)
        activatePanTool(toolkit)
    }, [disabled, detachOverlayMouseUp, syncDraftFromPaper])

    const loadBoxOverlay = useCallback((): boolean => {
        const toolkit = toolkitRef.current
        const targetBox = boxRef.current
        if (!toolkit || !targetBox) return false

        const item = loadSingleBoxOntoToolkit(toolkit, targetBox, {
            strokeColor,
            label: boxLabel,
        })
        if (!item) return false

        boxItemRef.current = item
        syncActiveTool()
        return true
    }, [strokeColor, boxLabel, syncActiveTool])

    const syncViewerToCurrentBox = useCallback(
        (viewer?: OsdViewerLike | null, options?: { tight?: boolean }) => {
            if (activeSlideKeyRef.current !== slideViewerKeyRef.current) return
            runZoomToSelection(viewer, {
                tight: options?.tight,
                waitForOpen: false,
                expectedBoxKey: boxKeyRef.current,
            })
        },
        [runZoomToSelection],
    )

    const loadBoxOverlayAndSync = useCallback(
        (viewer?: OsdViewerLike | null, options?: { tight?: boolean }) => {
            if (activeSlideKeyRef.current !== slideViewerKeyRef.current) return false
            if (!loadBoxOverlay()) return false
            syncViewerToCurrentBox(viewer, options)
            return true
        },
        [loadBoxOverlay, syncViewerToCurrentBox],
    )

    const syncSelectionToViewer = useCallback(
        (viewer?: OsdViewerLike | null, options?: { tight?: boolean }) => {
            if (!boxRef.current) return
            if (activeSlideKeyRef.current !== slideViewerKeyRef.current) return
            if (!viewerRef.current && !viewer) return

            let attempts = 0
            const trySync = () => {
                if (activeSlideKeyRef.current !== slideViewerKeyRef.current) return
                if (loadBoxOverlayAndSync(viewer, options)) return
                attempts += 1
                if (attempts >= 40) return
                window.setTimeout(trySync, attempts < 8 ? 60 : 120)
            }

            trySync()
        },
        [loadBoxOverlayAndSync],
    )

    const resetShapeDraft = useCallback(() => {
        const session = editSessionRef.current
        const toolkit = toolkitRef.current
        const committed = committedBoxRef.current
        if (session) {
            restorePaperItemSegments(session.item, session.originalSegments)
        } else if (committed && toolkit) {
            boxItemRef.current = loadSingleBoxOntoToolkit(toolkit, committed, {
                strokeColor,
                label: boxLabel,
            })
        }
        setDraftBox(null)
        setEditDirty(false)
        syncActiveTool()
    }, [strokeColor, boxLabel, syncActiveTool])

    const commitBoxEdit = useCallback(async () => {
        const item = boxItemRef.current
        if (!item || !onCommit || disabled || saving) return

        const nextBox = paperItemToSlideBox(item)
        if (!nextBox || nextBox.width < 5 || nextBox.height < 5) {
            resetShapeDraft()
            return
        }

        const rounded = roundSlideImageBox(nextBox)
        const committed = committedBoxRef.current
        if (committed && boxesNearlyEqual(rounded, committed)) {
            setEditDirty(false)
            setDraftBox(null)
            return
        }

        setSaving(true)
        try {
            await onCommit(rounded)
            editSessionRef.current = null
            setDraftBox(null)
            setEditDirty(false)
            committedBoxRef.current = rounded
            boxRef.current = rounded
        } catch {
            resetShapeDraft()
        } finally {
            setSaving(false)
        }
    }, [onCommit, disabled, saving, resetShapeDraft])

    useEffect(() => {
        return () => {
            cancelScheduledZoom()
            zoomGenerationRef.current += 1
            detachOverlayMouseUp()
            const toolkit = toolkitRef.current
            if (toolkit) {
                removeSingleBoxFromToolkit(toolkit)
                activatePanTool(toolkit)
            }
            boxItemRef.current = null
            editSessionRef.current = null
        }
    }, [cancelScheduledZoom, detachOverlayMouseUp])

    useEffect(() => {
        viewerSessionRef.current += 1
        activeSlideKeyRef.current = null
        viewerRef.current = null
        toolkitRef.current = null
        boxItemRef.current = null
        editSessionRef.current = null
        cancelScheduledZoom()
        zoomGenerationRef.current += 1
    }, [slideViewerKey, cancelScheduledZoom])

    useEffect(() => {
        cancelScheduledZoom()
        zoomGenerationRef.current += 1
        setDraftBox(null)
        setEditDirty(false)
        setShapeEditEnabled(false)
        boxItemRef.current = null
        editSessionRef.current = null
        detachOverlayMouseUp()
        if (box && !disabled && activeSlideKeyRef.current === slideViewerKey) {
            syncSelectionToViewer(undefined, { tight: false })
        }
    }, [boxKey, boxLabel, slideViewerKey, cancelScheduledZoom, syncSelectionToViewer, detachOverlayMouseUp, box, disabled])

    useEffect(() => {
        syncActiveTool()
    }, [shapeEditEnabled, syncActiveTool, disabled])

    useEffect(() => {
        const toggleKey = shapeEditToggleKey.toLowerCase()
        const onKeyDown = (event: KeyboardEvent) => {
            if (disabled || saving) return
            if (isFormFieldKeyboardTarget(event.target)) return

            const key = event.key.toLowerCase()
            if (key === toggleKey) {
                event.preventDefault()
                setShapeEditEnabled((prev) => !prev)
                return
            }

            if (!shapeEditEnabledRef.current) return

            if (event.key === 'Enter') {
                event.preventDefault()
                void commitBoxEdit()
                return
            }

            if (event.key === 'Escape') {
                event.preventDefault()
                resetShapeDraft()
            }
        }

        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [commitBoxEdit, resetShapeDraft, disabled, saving, shapeEditToggleKey])

    useEffect(() => {
        const el = hostRef.current
        if (!el) return

        const measure = () => {
            const next = Math.floor(el.getBoundingClientRect().height)
            if (next < 120) return
            setHostHeightPx((prev) => (Math.abs(prev - next) > 3 ? next : prev))
        }

        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [boxKey])

    const onToolkitReady = useCallback(
        (toolkit: AnnotationToolkitFromSlide) => {
            toolkitRef.current = toolkit
            if (
                activeSlideKeyRef.current === slideViewerKeyRef.current &&
                viewerRef.current
            ) {
                syncSelectionToViewer(undefined, { tight: false })
            }
        },
        [syncSelectionToViewer],
    )

    const onViewerReady = useCallback(
        (viewer: NonNullable<Parameters<NonNullable<SlideViewerProps['onViewerReady']>>[0]>) => {
            const session = viewerSessionRef.current
            const openedSlideKey = slideViewerKeyRef.current

            activeSlideKeyRef.current = openedSlideKey
            viewerRef.current = viewer as unknown as OsdViewerLike
            boxItemRef.current = null

            window.setTimeout(() => {
                if (session !== viewerSessionRef.current) return
                if (openedSlideKey !== slideViewerKeyRef.current) return
                syncSelectionToViewer(viewer as unknown as OsdViewerLike, { tight: false })
            }, 0)
        },
        [syncSelectionToViewer],
    )

    const modeClass = shapeEditEnabled
        ? 'single-box-slide-editor--shape-edit'
        : 'single-box-slide-editor--pan'

    const viewerHeight =
        typeof height === 'number'
            ? `${height}px`
            : height === '100%' && hostHeightPx > 0
              ? `${hostHeightPx}px`
              : height

    return (
        <div className={`single-box-slide-editor ${modeClass} ${className}`.trim()}>
            {showToolbar && displayBox ? (
                <div className="single-box-slide-editor__toolbar">
                    <button
                        type="button"
                        className={`single-box-slide-editor__mode-btn${shapeEditEnabled ? ' single-box-slide-editor__mode-btn--active' : ''}`}
                        disabled={disabled || !box}
                        onClick={() => setShapeEditEnabled(true)}
                        title={`Edit box corners (${shapeEditToggleKey.toUpperCase()} toggles edit/pan)`}
                    >
                        Edit shape ({shapeEditToggleKey.toUpperCase()})
                    </button>
                    <button
                        type="button"
                        className={`single-box-slide-editor__mode-btn${!shapeEditEnabled ? ' single-box-slide-editor__mode-btn--active' : ''}`}
                        onClick={() => setShapeEditEnabled(false)}
                        title={`Pan and zoom (${shapeEditToggleKey.toUpperCase()} toggles edit/pan)`}
                    >
                        Pan / zoom ({shapeEditToggleKey.toUpperCase()})
                    </button>
                    <button
                        type="button"
                        className="single-box-slide-editor__mode-btn"
                        onClick={() => syncViewerToCurrentBox(undefined, { tight: true })}
                    >
                        Zoom to box
                    </button>
                    <button
                        type="button"
                        className="single-box-slide-editor__mode-btn"
                        onClick={() => {
                            const viewer = viewerRef.current
                            if (viewer) zoomViewerBy(viewer, 1.35)
                        }}
                    >
                        Zoom in
                    </button>
                    <button
                        type="button"
                        className="single-box-slide-editor__mode-btn"
                        onClick={() => {
                            const viewer = viewerRef.current
                            if (viewer) zoomViewerBy(viewer, 1 / 1.35)
                        }}
                    >
                        Zoom out
                    </button>
                    <button
                        type="button"
                        className="single-box-slide-editor__mode-btn"
                        onClick={() => viewerRef.current?.viewport.goHome?.(true)}
                    >
                        Fit slide
                    </button>
                    {onCommit ? (
                        <button
                            type="button"
                            className="single-box-slide-editor__mode-btn single-box-slide-editor__mode-btn--active"
                            disabled={!editDirty || disabled || saving || !shapeEditEnabled}
                            onClick={() => void commitBoxEdit()}
                        >
                            {saving ? 'Saving…' : commitLabel}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="single-box-slide-editor__mode-btn"
                        disabled={!editDirty || disabled || saving || !shapeEditEnabled}
                        onClick={resetShapeDraft}
                    >
                        Reset
                    </button>
                    <span className="single-box-slide-editor__coords" title="Slide-space box">
                        {formatSlideBoxCoords(displayBox)}
                    </span>
                    <span className="single-box-slide-editor__hint">
                        {shapeEditToggleKey.toUpperCase()} edit/pan · Enter save · Esc reset · Scroll zooms
                    </span>
                </div>
            ) : null}
            <div ref={hostRef} className="single-box-slide-editor__viewer-host">
                {box && hostHeightPx > 0 ? (
                    <SlideViewer
                        key={slideViewerKey}
                        imageInfo={imageInfo}
                        apiBaseUrl={apiBaseUrl}
                        apiHeaders={apiHeaders}
                        authToken={authToken}
                        tokenQueryParam={tokenQueryParam}
                        fetchFn={fetchFn}
                        disableVisibilityCheck={disableVisibilityCheck}
                        showInfoBar={showInfoBar}
                        manageAnnotationsExternally
                        height={viewerHeight}
                        width={width}
                        osdOptions={osdOptions}
                        onApiError={onApiError}
                        onViewerReady={onViewerReady}
                        onToolkitReady={onToolkitReady}
                    />
                ) : null}
            </div>
        </div>
    )
}

export type { SingleBoxSlideEditorProps, SlideImageBox } from './SingleBoxSlideEditor.types'
