import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import type { FeatureCollection } from 'geojson'
import OpenSeadragon from 'openseadragon'
import type { AnnotationToolkit } from 'osd-paperjs-annotation'
import { SlideViewer } from '../SlideViewer/SlideViewer'
import type {
    AnnotationEditorProps,
    AnnotationEditorHandle,
    EditorMode,
    WorkflowMode,
    LocalAnnotationDocument,
    LocalAnnotationElement,
    RoiImageBounds,
    GroundTruthBox,
    RemoveOverlappingLabelsOptions,
} from './AnnotationEditor.types'
import {
    featureCollectionToLocalDocument,
    localDocumentToFeatureCollection,
    applyLocalDocumentToToolkitWhenReady,
    loadLocalElementsOntoAnnotationToolkit,
    wrapOrphanLabelsInRoi,
    refreshAnnotationToolkitDisplay,
    loadOverlayFeatureCollectionOntoToolkit,
    removeOverlayFeatureCollection,
    setOverlayFeatureCollectionVisibility,
    getToolkitTiledImage,
    MODEL_PREDICTION_OVERLAY_NAME,
} from './annotationGeoJson'
import { normalizeCssColor, resolveItemId, resolveRoiLabelValue, fitViewerToElements, centerViewerOnElement, isFormFieldKeyboardTarget, findAnnotationTypeIndexForKey, shouldBlockOpenSeadragonKey, isFinishShapeEditKey, isEditLabelShapeKey, documentElementsSnapshot, normalizeKnownDsaElements, countKnownAnnotationElements, isRoiElementForConfig, wouldRegressServerAnnotation, AnnotationSaveConflictError, AnnotationSaveRegressionError, resolveAutoSaveSettings, elementToRoiBounds, clampRoiTopLeft, translatePaperRoiItem, effectiveRoiFillOpacity, applyRoiFillVisibilityToPaperItem, findTopmostLabelItemIdxAtImagePoint, annotationFindByNameUrl } from './AnnotationEditor.utils'
import { findOverlappingBoxDocIndices, type OverlapBox } from './overlapUtils'
import { AnnotationEditorToolbar } from './AnnotationEditor.Toolbar'
import { AnnotationEditorOverlays } from './AnnotationEditor.Overlays'
import { createApiError } from '../../utils/apiErrorHandling'
import './AnnotationEditor.css'

/**
 * AnnotationEditor — wraps SlideViewer and adds a protocol-driven toolbar for
 * human-in-the-loop annotation editing (ROI selection, mode switching, save).
 *
 * Drawing is delegated entirely to osd-paperjs-annotation's RectangleTool,
 * which provides the crosshair, rubber-band, and mouse-capture behaviour.
 */
export const AnnotationEditor = forwardRef<AnnotationEditorHandle, AnnotationEditorProps>(
function AnnotationEditor({
    imageInfo,
    config,
    apiBaseUrl,
    authToken,
    tokenQueryParam,
    fetchFn,
    apiHeaders,
    showInfoBar = true,
    showInfoControl = true,
    defaultShowInfo = false,
    showLabelHoverPanel = true,
    defaultRoiFillVisible = false,
    hoverInfoMode = 'full',
    className = '',
    style,
    onApiError,
    autoSave,
    onAnnotationSaved,
    onSaveConflict,
    disableVisibilityCheck,
    onViewerReady,
    onViewportChange,
    initialGeoJson,
    initialGeoJsonUrl,
    geoJsonImportOptions,
    geoJsonExportMode = false,
    onGeoJsonExport,
    skipDsaAnnotationLoad = false,
    overlayGeoJson = null,
    overlayGeoJsonVisible = true,
    overlayCollectionName = MODEL_PREDICTION_OVERLAY_NAME,
}: AnnotationEditorProps, ref) {
    const autoSaveSettings = useMemo(() => resolveAutoSaveSettings(autoSave), [autoSave])
    const initialWorkflowMode = config.defaultWorkflowMode ?? 'edit-rois'
    const [selectedRoiIndex, setSelectedRoiIndex] = useState<number>(-1)
    const [markComplete, setMarkComplete] = useState(false)
    const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(initialWorkflowMode)
    const [activeMode, setActiveMode] = useState<EditorMode | null>(null)
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
    // DSA document ID — null until saved/loaded for the first time
    const [annotationDocumentId, setAnnotationDocumentId] = useState<string | null>(null)
    const annotationDocumentIdRef = useRef<string | null>(null)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [saveDirty, setSaveDirty] = useState(false)
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [isLoadingAnnotation, setIsLoadingAnnotation] = useState(false)
    // Confidence filter mode
    const [confidenceThreshold, setConfidenceThreshold] = useState(0)

    // Fixed-size ROI placement
    const [fixedSizeEnabled, setFixedSizeEnabled] = useState(
        () => config.roiSettings?.defaultFixedSizeEnabled ?? false,
    )
    const [fixedWidth, setFixedWidth] = useState(() => config.roiSettings?.width ?? 1000)
    const [fixedHeight, setFixedHeight] = useState(() => config.roiSettings?.height ?? 1000)
    const [roiFillVisible, setRoiFillVisible] = useState(defaultRoiFillVisible)
    const roiFillVisibleRef = useRef(defaultRoiFillVisible)

    // The AnnotationToolkit instance provided by SlideViewer
    const [toolkit, setToolkit] = useState<AnnotationToolkit | null>(null)

    // The annotation document held in memory (not yet pushed to DSA)
    const [localDocument, setLocalDocument] = useState<LocalAnnotationDocument | null>(null)

    // Annotation type selector
    const annotationTypes = config.annotationTypes ?? []
    const [selectedTypeIndex, setSelectedTypeIndex] = useState(0)
    const selectedTypeIndexRef = useRef(0)
    // Stable ref to the label of the currently selected ROI — stamped onto new label elements
    const selectedRoiLabelRef = useRef<string | null>(null)
    // Fixed-size label placement
    const [labelFixedSizeEnabled, setLabelFixedSizeEnabled] = useState(false)
    const labelFixedSizeEnabledRef = useRef(false)
    /** Add Labels: when false, default tool is active so the slide can be panned with the mouse. */
    const [addLabelsDrawingEnabled, setAddLabelsDrawingEnabled] = useState(false)
    const addLabelsDrawingEnabledRef = useRef(false)
    // Tracks whether the add-labels drawing loop is still active
    const addLabelsActiveRef = useRef(false)
    // Paper.js item refs for label elements — parallel to the ordered label elements in localDocument
    const labelItemsRef = useRef<any[]>([])
    /** Index into labelItemsRef for the last placed, hovered, or context-selected label (-1 = none). */
    const [activeLabelItemIdx, setActiveLabelItemIdx] = useState(-1)
    const activeLabelItemIdxRef = useRef(-1)
    const [hoveredLabelItemIdx, setHoveredLabelItemIdx] = useState(-1)
    const hoveredLabelItemIdxRef = useRef(-1)
    const [hoveredLabelPointer, setHoveredLabelPointer] = useState<{ x: number; y: number } | null>(null)
    const deleteActiveLabelRef = useRef<() => void>(() => {})
    const finishEditingLabelRef = useRef<() => void>(() => {})
    const cancelEditingLabelRef = useRef<() => void>(() => {})
    const finishEditingRoiRef = useRef<() => void>(() => {})
    const cancelPendingRoiRef = useRef<() => void>(() => {})
    const startEditLabelByItemIdxRef = useRef<(itemIdx: number) => void>(() => {})
    const startReviewEditShapeRef = useRef<() => void>(() => {})
    const annotationLoadSettledRef = useRef(false)
    const savedSnapshotRef = useRef<string | null>(null)
    const documentDirtyRef = useRef(false)
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saveInFlightRef = useRef(false)
    const pendingSaveRef = useRef(false)
    const performSaveRef = useRef<(options?: { silent?: boolean }) => Promise<boolean>>(async () => false)
    const markLoadSettledRef = useRef<(doc: LocalAnnotationDocument | null) => void>(() => {})
    const scheduleAutoSaveRef = useRef<() => void>(() => {})
    // Right-click context menu for label items in add-labels mode
    const [contextMenu, setContextMenu] = useState<{
        x: number; y: number; itemIdx: number; item: any
    } | null>(null)
    // State for editing an existing label's shape via the context menu
    const [isEditingLabel, setIsEditingLabel] = useState(false)
    const [showInfo, setShowInfo] = useState(defaultShowInfo)
    const showInfoRef = useRef(false)
    const [hoverInfo, setHoverInfo] = useState<{
        x: number; y: number
        element: LocalAnnotationElement
        roiElement?: LocalAnnotationElement
    } | null>(null)
    const editingLabelRef = useRef<{
        item: any; docElementIndex: number
        originalSegments: { x: number; y: number }[]
    } | null>(null)
    // Exposed so finishEditingLabel / cancelEditingLabel can resume the drawing loop
    const reactivateLabelDrawingRef = useRef<() => void>(() => {})
    // Raw DSA element objects that don't belong to ROI or any known annotation type.
    // Stored as-is from the server and appended to save payloads to prevent data loss.
    const foreignElementsRef = useRef<any[]>([])

    const [fetchedGeoJson, setFetchedGeoJson] = useState<FeatureCollection | null>(null)
    /** De-dupe GeoJSON → canvas hydration (e.g. React Strict Mode). */
    const lastGeoApplyKeyRef = useRef<string | null>(null)

    // Review mode — index into reviewItems[] for the focused label box (-1 = none)
    const [reviewItemIndex, setReviewItemIndex] = useState(-1)
    const reviewItemIndexRef = useRef(-1)
    const changeReviewItemTypeRef = useRef<(typeIndex: number) => void>(() => {})
    const reviewNextItemRef = useRef<() => void>(() => {})
    const reviewPreviousItemRef = useRef<() => void>(() => {})
    // Stable ref so workflowMode is readable inside finishEditingLabel / cancelEditingLabel
    // without adding toolkit to their dependency arrays.
    const workflowModeRef = useRef<WorkflowMode>(initialWorkflowMode)
    const toolkitRef = useRef<AnnotationToolkit | null>(null)

    // Paper.js item for the ROI currently being placed or edited (not yet committed)
    const pendingRoiItemRef = useRef<any>(null)
    // Committed paper.js items, one per ROI in localDocument order
    const roiItemsRef = useRef<any[]>([])
    // Index into rois[] being edited (-1 means a brand-new ROI)
    const editingRoiIndexRef = useRef<number>(-1)
    // Segment points saved before editing an existing ROI, for cancel restore
    const originalSegmentsRef = useRef<{ x: number; y: number }[] | null>(null)
    // Label of a newly finished ROI so we can auto-select it in the dropdown
    /** Document-order ROI index to select after the next localDocument update (add ROI). */
    const pendingSelectRoiIndexRef = useRef<number | null>(null)
    // Refs to always-current values for use inside event-handler closures
    const localDocumentRef = useRef<LocalAnnotationDocument | null>(localDocument)
    const addRoiRef = useRef<(left: number, top: number, width: number, height: number) => void>(null as any)

    const notify = useCallback(
        (type: 'success' | 'error', message: string, durationMs: number) => {
            setNotification({ type, message })
            setTimeout(() => setNotification(null), durationMs)
        },
        []
    )

    const markLoadSettled = useCallback((doc: LocalAnnotationDocument | null) => {
        annotationLoadSettledRef.current = true
        savedSnapshotRef.current = documentElementsSnapshot(doc)
        documentDirtyRef.current = false
        setSaveDirty(false)
    }, [])

    const scheduleAutoSave = useCallback(() => {
        if (!autoSaveSettings.enabled) return
        if (geoJsonExportMode && !onGeoJsonExport) return
        if (!geoJsonExportMode && !apiBaseUrl) return

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = setTimeout(() => {
            autoSaveTimerRef.current = null
            void performSaveRef.current({ silent: true })
        }, autoSaveSettings.debounceMs)
    }, [
        autoSaveSettings.enabled,
        autoSaveSettings.debounceMs,
        geoJsonExportMode,
        onGeoJsonExport,
        apiBaseUrl,
    ])

    useEffect(() => { markLoadSettledRef.current = markLoadSettled }, [markLoadSettled])
    useEffect(() => { scheduleAutoSaveRef.current = scheduleAutoSave }, [scheduleAutoSave])

    const resetSaveTracking = useCallback(() => {
        annotationLoadSettledRef.current = false
        savedSnapshotRef.current = null
        documentDirtyRef.current = false
        setSaveDirty(false)
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current)
            autoSaveTimerRef.current = null
        }
    }, [])

    useEffect(() => {
        resetSaveTracking()
    }, [resolveItemId(imageInfo), resetSaveTracking])

    // ── Register tools once when toolkit is ready ─────────────────────────
    useEffect(() => {
        if (!toolkit) return
        ;(toolkit as any).addTools(['default', 'rectangle'])
    }, [toolkit])

    // ── Optional GeoURL fetch (only when `initialGeoJsonUrl` is set; otherwise no-op) ─
    useEffect(() => {
        if (initialGeoJson != null) {
            setFetchedGeoJson(null)
            return
        }
        if (!initialGeoJsonUrl) {
            setFetchedGeoJson(null)
            return
        }

        let cancelled = false
        setIsLoadingAnnotation(true)
        setFetchedGeoJson(null)

        const headers: Record<string, string> = {}
        if (apiHeaders) {
            const entries =
                apiHeaders instanceof Headers
                    ? Array.from(apiHeaders.entries())
                    : Object.entries(apiHeaders as Record<string, string>)
            entries.forEach(([k, v]) => { headers[k] = v })
        }
        if (authToken) headers['Girder-Token'] = authToken

        const doFetch = fetchFn ?? fetch

        ;(async () => {
            try {
                const res = await doFetch(initialGeoJsonUrl, { headers })
                if (cancelled) return
                if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
                const j: unknown = await res.json()
                if (cancelled) return
                const asFc = j as { type?: string }
                if (asFc.type !== 'FeatureCollection') {
                    throw new Error('Response must be a GeoJSON FeatureCollection')
                }
                setFetchedGeoJson(j as FeatureCollection)
            } catch (err) {
                if (cancelled) return
                console.error('[AnnotationEditor] Failed to load GeoJSON URL:', err)
                setFetchedGeoJson(null)
                setIsLoadingAnnotation(false)
                notify('error', 'Failed to load GeoJSON from the given URL.', 5000)
            }
        })()

        return () => { cancelled = true }
    }, [initialGeoJson, initialGeoJsonUrl, apiHeaders, authToken, fetchFn, notify])

    // ── Load existing annotation document when toolkit first becomes ready ─
    useEffect(() => {
        if (!toolkit) return

        if (initialGeoJson != null) return
        if (initialGeoJsonUrl) return
        if (skipDsaAnnotationLoad) return

        const itemId = resolveItemId(imageInfo)
        if (!itemId || !apiBaseUrl) return

        let cancelled = false
        let disposeApply: (() => void) | undefined
        annotationLoadSettledRef.current = false
        setIsLoadingAnnotation(true)

        const headers: Record<string, string> = {}
        if (apiHeaders) {
            const entries =
                apiHeaders instanceof Headers
                    ? Array.from(apiHeaders.entries())
                    : Object.entries(apiHeaders as Record<string, string>)
            entries.forEach(([k, v]) => { headers[k] = v })
        }
        if (authToken) headers['Girder-Token'] = authToken

        const doFetch = fetchFn ?? fetch

        ;(async () => {
            try {
                // 1. Look up annotation list rows by exact project document name (not every slide doc).
                const listRes = await doFetch(
                    annotationFindByNameUrl(apiBaseUrl, itemId, config.annotationDocumentName),
                    { headers, cache: 'no-store' },
                )
                if (cancelled) return
                if (!listRes.ok) throw new Error(`${listRes.status} ${listRes.statusText}`)
                const matching: any[] = await listRes.json()
                if (cancelled) return
                if (!Array.isArray(matching) || matching.length === 0) return // No existing document — start fresh

                if (matching.length > 1) {
                    setShowDuplicateWarning(true)
                }

                const row = matching[0]!
                const candidateRes = await doFetch(`${apiBaseUrl}/annotation/${row._id}`, { headers, cache: 'no-store' })
                if (cancelled) return
                if (!candidateRes.ok) return
                const docFull: any = await candidateRes.json()
                if (cancelled) return
                const docId: string = row._id

                // 4. Partition DSA elements into known (ROI / annotation types) and foreign.
                // Foreign elements are preserved verbatim so save never strips them.
                const rawElements: any[] = docFull.annotation?.elements ?? []
                const knownGroups = new Set([
                    'ROI',
                    ...config.annotationTypes.map(t => t.name),
                ])
                foreignElementsRef.current = rawElements.filter(el => !knownGroups.has(el.group ?? ''))

                const elements = normalizeKnownDsaElements(rawElements, config)

                setLocalDocument({
                    name: docFull.annotation.name,
                    description: docFull.annotation.description ?? '',
                    elements,
                })
                markLoadSettledRef.current({
                    name: docFull.annotation.name,
                    description: docFull.annotation.description ?? '',
                    elements,
                })
                setAnnotationDocumentId(docId)
                setActiveLabelItemIdx(-1)

                // 5–7. Render ROIs and label elements on the canvas (same path as GeoJSON import)
                disposeApply = applyLocalDocumentToToolkitWhenReady(
                    toolkit as any,
                    config,
                    { name: docFull.annotation.name, description: docFull.annotation.description ?? '', elements },
                    roiItemsRef,
                    labelItemsRef,
                    () => {
                        const roiElements = elements.filter(e => e.group === 'ROI')
                        if (roiElements.length > 0) {
                            setSelectedRoiIndex(0)
                        }
                    },
                    roiFillLoadOptions(),
                ) ?? undefined
            } catch (err) {
                if (cancelled) return
                console.error('[AnnotationEditor] Failed to load annotations:', err)
                notify('error', 'Failed to load existing annotations from server.', 4000)
            } finally {
                if (!cancelled) {
                    setIsLoadingAnnotation(false)
                    if (!annotationLoadSettledRef.current) {
                        markLoadSettledRef.current(null)
                    }
                }
            }
        })()

        return () => {
            cancelled = true
            disposeApply?.()
        }
    }, [
        toolkit,
        resolveItemId(imageInfo),
        config.annotationDocumentName,
        apiBaseUrl,
        skipDsaAnnotationLoad,
        initialGeoJson,
        initialGeoJsonUrl,
        authToken,
    ])

    // Blank canvas when DSA load is skipped and no inline GeoJSON is provided.
    useEffect(() => {
        if (!toolkit) return
        if (initialGeoJson != null || initialGeoJsonUrl) return
        if (!skipDsaAnnotationLoad) return
        if (annotationLoadSettledRef.current) return
        markLoadSettledRef.current(null)
    }, [toolkit, skipDsaAnnotationLoad, initialGeoJson, initialGeoJsonUrl])

    // ── Inline / fetched GeoJSON → local document + canvas (YOLO, etc.) ─
    const effectiveGeoJson: FeatureCollection | null =
        initialGeoJson != null ? initialGeoJson : fetchedGeoJson

    useEffect(() => {
        if (!toolkit) return

        if (initialGeoJson == null) {
            if (!initialGeoJsonUrl) return
            if (fetchedGeoJson == null) return
        }

        const fc = effectiveGeoJson
        if (!fc) return
        if (fc.type !== 'FeatureCollection') {
            notify('error', 'GeoJSON must be a FeatureCollection.', 4000)
            setIsLoadingAnnotation(false)
            return
        }

        const applyKey = initialGeoJson != null
            ? `inline:${JSON.stringify(fc)}`
            : `url:${initialGeoJsonUrl!}:${JSON.stringify(fc)}`
        if (lastGeoApplyKeyRef.current === applyKey) {
            setIsLoadingAnnotation(false)
            return
        }
        lastGeoApplyKeyRef.current = applyKey

        let disposeApply: (() => void) | undefined

        try {
            foreignElementsRef.current = []
            setShowDuplicateWarning(false)
            const doc = wrapOrphanLabelsInRoi(
                featureCollectionToLocalDocument(
                    fc,
                    config,
                    config.annotationDocumentName,
                    geoJsonImportOptions,
                ),
                config,
            )
            setLocalDocument(doc)
            markLoadSettledRef.current(doc)
            setAnnotationDocumentId(null)
            setActiveLabelItemIdx(-1)
            const knownTypeNames = new Set(config.annotationTypes.map(t => t.name))
            const fitTargets = doc.elements.filter(e => knownTypeNames.has(e.group))
            disposeApply = applyLocalDocumentToToolkitWhenReady(
                toolkit as any,
                config,
                doc,
                roiItemsRef,
                labelItemsRef,
                () => {
                    const roiElements = doc.elements.filter(e => e.group === 'ROI')
                    if (roiElements.length > 0) {
                        setSelectedRoiIndex(0)
                    } else {
                        setSelectedRoiIndex(-1)
                    }
                    const viewer = (toolkit as any).viewer
                    const toFit = fitTargets.length > 0 ? fitTargets : doc.elements
                    if (viewer && toFit.length > 0) {
                        requestAnimationFrame(() => {
                            fitViewerToElements(viewer, toFit, OpenSeadragon as any)
                            refreshDisplayAndSyncRoiFill(toolkit as any)
                        })
                    }
                },
                roiFillLoadOptions(),
            ) ?? undefined
        } catch (err) {
            console.error('[AnnotationEditor] GeoJSON hydrate failed:', err)
            notify('error', 'Failed to load GeoJSON into the editor.', 5000)
        } finally {
            setIsLoadingAnnotation(false)
        }

        return () => {
            disposeApply?.()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toolkit, initialGeoJson, initialGeoJsonUrl, fetchedGeoJson, config, geoJsonImportOptions, notify])

    // ── Derive ROI list for the select dropdown ───────────────────────────
    // Declared early so callbacks below can reference it.
    const rois = useMemo(() => {
        if (!localDocument) return []
        // Carry roiIndex (position in the ROI-filtered array) so callbacks can
        // correctly map back to roiItemsRef and localDocument regardless of sort order.
        const trailingNum = (s: string) => {
            const m = s.match(/(\d+)$/)
            return m ? parseInt(m[1], 10) : Infinity
        }
        return localDocument.elements
            .filter(e => isRoiElementForConfig(e, config))
            .map((e, roiIndex) => ({ label: e.label.value, roiIndex }))
            .sort((a, b) => {
                const na = trailingNum(a.label)
                const nb = trailingNum(b.label)
                return na !== nb ? na - nb : a.label.localeCompare(b.label)
            })
    }, [localDocument, config])

    const roiCompletedCount = useMemo(() => {
        if (!localDocument) return 0
        return localDocument.elements.filter(e => isRoiElementForConfig(e, config) && e.user?.complete === true).length
    }, [localDocument, config])

    // ── Review mode: list of label items in the selected ROI ─────────────
    // Each entry has the Paper.js item and the index into localDocument.elements.
    // labelItemsRef is read here; it stays in sync because localDocument is a dep.
    const reviewItems = useMemo(() => {
        if (workflowMode !== 'review' || selectedRoiIndex < 0 || !localDocument) return []
        const roiLabel = rois[selectedRoiIndex]?.label
        if (!roiLabel) return []
        const knownTypeNames = new Set(config.annotationTypes.map(t => t.name))
        const result: { item: any; docIdx: number }[] = []
        let labelCount = 0
        for (let i = 0; i < localDocument.elements.length; i++) {
            const el = localDocument.elements[i]
            if (knownTypeNames.has(el.group)) {
                if (el.user?.roiLabel === roiLabel) {
                    result.push({ item: labelItemsRef.current[labelCount], docIdx: i })
                }
                labelCount++
            }
        }
        return result
    }, [workflowMode, selectedRoiIndex, rois, localDocument, config.annotationTypes])


    // ── Add an ROI element to the local document ──────────────────────────
    const addRoi = useCallback(
        (left: number, top: number, width: number, height: number) => {
            const roi = config.roiSettings ?? {}
            const fillOpacity = roi.fillOpacity ?? 0.05

            setLocalDocument(prev => {
                const elements = prev?.elements ?? []
                const labelValue = resolveRoiLabelValue(elements, roi)

                const newElement: LocalAnnotationElement = {
                    type: 'rectangle',
                    group: 'ROI',
                    label: { value: labelValue },
                    center: [
                        Math.round(left + width / 2),
                        Math.round(top + height / 2),
                        0,
                    ],
                    width: Math.round(width),
                    height: Math.round(height),
                    rotation: 0,
                    lineColor: normalizeCssColor(roi.color ?? '#ffa500'),
                    lineWidth: roi.strokeWidth ?? 2,
                    fillColor: normalizeCssColor(
                        roi.fillColor ?? `rgba(0,0,0,${fillOpacity})`,
                    ),
                }

                const doc: LocalAnnotationDocument = prev
                    ? { ...prev, elements: [...elements, newElement] }
                    : {
                          name: config.annotationDocumentName,
                          description: config.annotationDescription ?? '',
                          elements: [newElement],
                      }

                return doc
            })
        },
        [config]
    )

    // Keep refs current so event-handler closures always see the latest values
    useEffect(() => { localDocumentRef.current = localDocument }, [localDocument])

    // Track unsaved edits and schedule debounced autosave.
    useEffect(() => {
        if (!annotationLoadSettledRef.current || isLoadingAnnotation) return
        if (!localDocument || savedSnapshotRef.current == null) return

        const snap = documentElementsSnapshot(localDocument)
        if (snap === savedSnapshotRef.current) {
            documentDirtyRef.current = false
            setSaveDirty(false)
            return
        }

        documentDirtyRef.current = true
        setSaveDirty(true)
        scheduleAutoSaveRef.current()
    }, [localDocument, isLoadingAnnotation])

    useEffect(() => { annotationDocumentIdRef.current = annotationDocumentId }, [annotationDocumentId])
    useEffect(() => { addRoiRef.current = addRoi }, [addRoi])
    useEffect(() => { selectedTypeIndexRef.current = selectedTypeIndex }, [selectedTypeIndex])
    useEffect(() => { selectedRoiLabelRef.current = rois[selectedRoiIndex]?.label ?? null }, [selectedRoiIndex, rois])
    useEffect(() => { labelFixedSizeEnabledRef.current = labelFixedSizeEnabled }, [labelFixedSizeEnabled])
    useEffect(() => { workflowModeRef.current = workflowMode }, [workflowMode])
    useEffect(() => { addLabelsDrawingEnabledRef.current = addLabelsDrawingEnabled }, [addLabelsDrawingEnabled])
    useEffect(() => { toolkitRef.current = toolkit }, [toolkit])
    useEffect(() => { reviewItemIndexRef.current = reviewItemIndex }, [reviewItemIndex])
    useEffect(() => { showInfoRef.current = showInfo }, [showInfo])
    useEffect(() => { roiFillVisibleRef.current = roiFillVisible }, [roiFillVisible])

    const syncAllRoiFillVisibility = useCallback(() => {
        const showRoiFill =
            roiFillVisibleRef.current && workflowModeRef.current === 'edit-rois'
        roiItemsRef.current.forEach(item =>
            applyRoiFillVisibilityToPaperItem(item, showRoiFill, config.roiSettings),
        )
        if (pendingRoiItemRef.current) {
            applyRoiFillVisibilityToPaperItem(
                pendingRoiItemRef.current,
                showRoiFill,
                config.roiSettings,
            )
        }
    }, [config.roiSettings])

    const refreshDisplayAndSyncRoiFill = useCallback(
        (tk: Parameters<typeof refreshAnnotationToolkitDisplay>[0]) => {
            refreshAnnotationToolkitDisplay(tk)
            syncAllRoiFillVisibility()
        },
        [syncAllRoiFillVisibility],
    )

    const roiFillLoadOptions = useCallback(
        () => ({
            roiFillOpacity: effectiveRoiFillOpacity(
                roiFillVisibleRef.current && workflowModeRef.current === 'edit-rois',
                config.roiSettings,
            ),
            onLoaded: () => {
                syncAllRoiFillVisibility()
                requestAnimationFrame(() => syncAllRoiFillVisibility())
            },
        }),
        [config.roiSettings, syncAllRoiFillVisibility],
    )

    // ── ROI fill visibility (canvas only; saved DSA fill colors unchanged) ──
    useEffect(() => {
        syncAllRoiFillVisibility()
    }, [roiFillVisible, workflowMode, config.roiSettings, localDocument, syncAllRoiFillVisibility])

    // ── Read-only model prediction overlay (separate from editable annotations) ──
    useEffect(() => {
        if (!toolkit) return
        const tk = toolkit as any
        const collectionName = overlayCollectionName || MODEL_PREDICTION_OVERLAY_NAME
        let cancelled = false
        let rafId = 0

        const applyOverlay = (): boolean => {
            if (cancelled) return true
            if (!overlayGeoJson?.features?.length) {
                removeOverlayFeatureCollection(tk, collectionName)
                return true
            }
            if (!getToolkitTiledImage(tk)) return false

            if (!overlayGeoJsonVisible) {
                if (setOverlayFeatureCollectionVisibility(tk, false, collectionName)) {
                    return true
                }
                loadOverlayFeatureCollectionOntoToolkit(tk, overlayGeoJson, collectionName)
                setOverlayFeatureCollectionVisibility(tk, false, collectionName)
                return true
            }

            loadOverlayFeatureCollectionOntoToolkit(tk, overlayGeoJson, collectionName)
            setOverlayFeatureCollectionVisibility(tk, true, collectionName)
            return true
        }

        const scheduleApply = () => {
            cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    applyOverlay()
                })
            })
        }

        if (getToolkitTiledImage(tk)) {
            scheduleApply()
        }

        const viewer = tk.viewer
        const onReady = () => {
            scheduleApply()
        }
        viewer?.addHandler?.('open', onReady)
        viewer?.world?.addHandler?.('add-item', onReady)
        return () => {
            cancelled = true
            cancelAnimationFrame(rafId)
            viewer?.removeHandler?.('open', onReady)
            viewer?.world?.removeHandler?.('add-item', onReady)
        }
    }, [toolkit, overlayGeoJson, overlayGeoJsonVisible, overlayCollectionName])

    // ── Map a hit Paper.js item back to a LocalAnnotationElement ─────────
    const findElementForHitItem = useCallback((hitItem: any): LocalAnnotationElement | null => {
        if (!hitItem || !localDocumentRef.current) return null
        let current: any = hitItem
        while (current) {
            const roiIdx = roiItemsRef.current.indexOf(current)
            if (roiIdx >= 0) {
                const roiEls = localDocumentRef.current.elements.filter(e => e.group === 'ROI')
                return roiEls[roiIdx] ?? null
            }
            const labelIdx = labelItemsRef.current.indexOf(current)
            if (labelIdx >= 0) {
                const knownTypeNames = new Set(config.annotationTypes.map(t => t.name))
                const labelEls = localDocumentRef.current.elements.filter(e => knownTypeNames.has(e.group))
                return labelEls[labelIdx] ?? null
            }
            current = current.parent
        }
        return null
    }, [config.annotationTypes])

    // ── Show-info hover: hit-test canvas on mousemove ─────────────────────
    useEffect(() => {
        if (!toolkit || !showInfo) {
            setHoverInfo(null)
            return
        }
        // toolkit.paperScope is the correct path (not toolkit.project?.paperScope)
        const paperScope = (toolkit as any).paperScope
        if (!paperScope) return
        const canvas = paperScope.view?.element as HTMLCanvasElement | null
        if (!canvas) return

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect()
            let projectPoint: any
            try {
                projectPoint = paperScope.view.viewToProject(
                    new (paperScope.Point)(e.clientX - rect.left, e.clientY - rect.top)
                )
            } catch { return }

            // Scale tolerance by zoom (same as SelectTool in osd-paperjs-annotation)
            const tolerance = 5 / (paperScope.view.zoom ?? 1)

            // Stroke/edge hits via hitTestAll
            const strokeHits: any[] = paperScope.project.hitTestAll(projectPoint, {
                fill: true, stroke: true, tolerance,
                match: (i: any) => i.item.isGeoJSONFeature || i.item.parent?.isGeoJSONFeature,
            })

            // Interior containment check on all feature items — handles zero/no-fill
            // (Paper.js fill hit-test skips items with null or zero-alpha fillColor)
            const allFeatures: any[] = paperScope.project.getItems({
                match: (item: any) => item.isGeoJSONFeature,
            })
            const containedFeatures = allFeatures.filter((item: any) => {
                try { return item.contains(projectPoint) } catch { return false }
            })

            const allHitItems = new Set<any>([
                ...strokeHits.map((h: any) => h.item),
                ...containedFeatures,
            ])
            if (!allHitItems.size) { setHoverInfo(null); return }

            const elements = [...allHitItems]
                .map(item => findElementForHitItem(item))
                .filter(Boolean) as LocalAnnotationElement[]

            // Prefer label box as primary; ROI as secondary context
            const labelEl = elements.find(e => e.group !== 'ROI')
            const roiEl = elements.find(e => e.group === 'ROI')
            const primary = labelEl ?? roiEl
            if (!primary) { setHoverInfo(null); return }

            setHoverInfo({
                x: e.clientX, y: e.clientY,
                element: primary,
                roiElement: labelEl ? roiEl : undefined,
            })
        }

        const handleMouseLeave = () => setHoverInfo(null)

        canvas.addEventListener('mousemove', handleMouseMove)
        canvas.addEventListener('mouseleave', handleMouseLeave)
        return () => {
            canvas.removeEventListener('mousemove', handleMouseMove)
            canvas.removeEventListener('mouseleave', handleMouseLeave)
            setHoverInfo(null)
        }
    }, [toolkit, showInfo, findElementForHitItem])

    // ── Confidence filter counts ──────────────────────────────────────────
    const filterCounts = useMemo(() => {
        if (!localDocument) return { showing: 0, total: 0 }
        const knownTypeNames = new Set(config.annotationTypes.map(t => t.name))
        const labelElements = localDocument.elements.filter(e => knownTypeNames.has(e.group))
        const total = labelElements.length
        const showing = labelElements.filter(el => {
            const raw = el.user?.confidence
            const conf = (typeof raw === 'number' && isFinite(raw)) ? raw : -1
            return conf >= confidenceThreshold
        }).length
        return { showing, total }
    }, [localDocument, config.annotationTypes, confidenceThreshold])

    // ── Confidence filter: show/hide label items by threshold ────────────
    // Runs whenever we enter/leave filter mode or the slider moves.
    // On exit, restores full opacity for all label items.
    useEffect(() => {
        if (!localDocument) return
        const knownTypeNames = new Set(config.annotationTypes.map(t => t.name))
        const labelElements = localDocument.elements.filter(e => knownTypeNames.has(e.group))

        labelItemsRef.current.forEach((item, idx) => {
            if (!item) return
            if (workflowMode === 'filter') {
                const raw = labelElements[idx]?.user?.confidence
                const conf = (typeof raw === 'number' && isFinite(raw)) ? raw : -1
                item.opacity = conf >= confidenceThreshold ? 1 : 0.08
            } else {
                item.opacity = 1
            }
        })
    }, [workflowMode, confidenceThreshold, localDocument, config.annotationTypes])

    // ── Editor hotkeys (cycle / assign types, review nav) ─────────────────
    // Window listener handles actions; canvas-key handler blocks OpenSeadragon
    // defaults (W/S/A/D/F pan, F flip, arrows pan) when the canvas has focus.
    useEffect(() => {
        if (annotationTypes.length === 0) return

        const applyTypeIndex = (typeIndex: number) => {
            setSelectedTypeIndex(typeIndex)
            if (workflowModeRef.current === 'review') changeReviewItemTypeRef.current(typeIndex)
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isFormFieldKeyboardTarget(e)) return

            const key = e.key.toLowerCase()
            let consumed = false

            if (!consumed && (e.metaKey || e.ctrlKey) && key === 's') {
                consumed = true
                if (autoSaveTimerRef.current) {
                    clearTimeout(autoSaveTimerRef.current)
                    autoSaveTimerRef.current = null
                }
                void performSaveRef.current({ silent: false })
            }

            if (!consumed && editingLabelRef.current) {
                if (isFinishShapeEditKey(e.key, config.hotkeys)) {
                    consumed = true
                    finishEditingLabelRef.current()
                } else if (e.key === 'Escape') {
                    consumed = true
                    cancelEditingLabelRef.current()
                }
            }

            if (!consumed && pendingRoiItemRef.current) {
                if (isFinishShapeEditKey(e.key, config.hotkeys)) {
                    consumed = true
                    finishEditingRoiRef.current()
                } else if (e.key === 'Escape') {
                    consumed = true
                    cancelPendingRoiRef.current()
                }
            }

            if (
                !consumed
                && !editingLabelRef.current
                && !pendingRoiItemRef.current
                && (workflowModeRef.current === 'add-labels' || workflowModeRef.current === 'review')
            ) {
                if (isEditLabelShapeKey(e.key, config.hotkeys)) {
                    if (workflowModeRef.current === 'review') {
                        consumed = true
                        startReviewEditShapeRef.current()
                    } else {
                        const targetIdx = hoveredLabelItemIdxRef.current >= 0
                            ? hoveredLabelItemIdxRef.current
                            : activeLabelItemIdxRef.current
                        if (targetIdx >= 0) {
                            consumed = true
                            startEditLabelByItemIdxRef.current(targetIdx)
                        }
                    }
                }
            }

            if (
                !consumed
                && workflowModeRef.current === 'add-labels'
            ) {
                const { prev, next } = {
                    prev: (config.hotkeys?.typeCyclePrevious ?? '[').toLowerCase(),
                    next: (config.hotkeys?.typeCycleNext ?? ']').toLowerCase(),
                }
                if (addLabelsDrawingEnabledRef.current && key === prev) {
                    consumed = true
                    const n = (selectedTypeIndexRef.current - 1 + annotationTypes.length) % annotationTypes.length
                    applyTypeIndex(n)
                } else if (addLabelsDrawingEnabledRef.current && key === next) {
                    consumed = true
                    const n = (selectedTypeIndexRef.current + 1) % annotationTypes.length
                    applyTypeIndex(n)
                } else {
                    const typeIdx = findAnnotationTypeIndexForKey(annotationTypes, e.key)
                    if (typeIdx != null) {
                        consumed = true
                        applyTypeIndex(typeIdx)
                    }
                }
            } else if (!consumed) {
                if (key === 'q') {
                    consumed = true
                    const next = (selectedTypeIndexRef.current - 1 + annotationTypes.length) % annotationTypes.length
                    applyTypeIndex(next)
                } else if (key === 'w') {
                    consumed = true
                    const next = (selectedTypeIndexRef.current + 1) % annotationTypes.length
                    applyTypeIndex(next)
                } else {
                    const typeIdx = findAnnotationTypeIndexForKey(annotationTypes, e.key)
                    if (typeIdx != null) {
                        consumed = true
                        applyTypeIndex(typeIdx)
                    }
                }
            }

            if (
                !consumed
                && workflowModeRef.current === 'add-labels'
                && !editingLabelRef.current
            ) {
                const drawToggleKey = (config.hotkeys?.insertBox ?? 't').toLowerCase()
                if (key === drawToggleKey) {
                    consumed = true
                    setAddLabelsDrawingEnabled(prev => !prev)
                }
            }

            if (
                !consumed
                && workflowModeRef.current === 'add-labels'
                && (e.key === 'Delete' || e.key === 'Backspace')
            ) {
                consumed = true
                deleteActiveLabelRef.current()
            }

            if (!consumed && workflowModeRef.current === 'review') {
                const hotkeys = config.hotkeys ?? {}
                const nextKey = (hotkeys.reviewNext ?? 'm').toLowerCase()
                const prevKey = (hotkeys.reviewPrevious ?? 'n').toLowerCase()
                if (key === nextKey || e.key === 'ArrowRight') {
                    consumed = true
                    reviewNextItemRef.current()
                } else if (key === prevKey || e.key === 'ArrowLeft') {
                    consumed = true
                    reviewPreviousItemRef.current()
                }
            }

            if (consumed) {
                e.preventDefault()
                e.stopPropagation()
            }
        }

        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [annotationTypes, config.hotkeys])

    // Block OpenSeadragon canvas shortcuts when editor owns the same keys.
    useEffect(() => {
        if (!toolkit) return
        const viewer = (toolkit as { viewer?: { addHandler?: (n: string, h: (e: { preventDefaultAction?: boolean; originalEvent?: KeyboardEvent }) => void) => void; removeHandler?: (n: string, h: (e: { preventDefaultAction?: boolean; originalEvent?: KeyboardEvent }) => void) => void } }).viewer
        if (!viewer?.addHandler) return

        const onCanvasKey = (event: { preventDefaultAction?: boolean; originalEvent?: KeyboardEvent }) => {
            const e = event.originalEvent
            if (!e || isFormFieldKeyboardTarget(e)) return
            if (shouldBlockOpenSeadragonKey(
                e.key,
                workflowModeRef.current,
                annotationTypes,
                config.hotkeys,
                addLabelsDrawingEnabledRef.current,
                Boolean(editingLabelRef.current || pendingRoiItemRef.current),
            )) {
                event.preventDefaultAction = true
            }
        }

        viewer.addHandler('canvas-key', onCanvasKey)
        return () => viewer.removeHandler?.('canvas-key', onCanvasKey)
    }, [toolkit, annotationTypes, config.hotkeys])

    // ── Update placeholder color when selected type changes (no restart) ──
    // This is intentionally separate from the drawing effect so that Q/W
    // never deactivates the tool mid-draw.
    useEffect(() => {
        if (!toolkit || workflowMode !== 'add-labels' || !addLabelsDrawingEnabled) return
        const types = config.annotationTypes ?? []
        const annotationType = types[selectedTypeIndex]
        if (!annotationType) return
        const paperScope = (toolkit as any).project?.paperScope
        if (!paperScope) return
        // findSelectedNewItem returns the placeholder (uninitialized item).
        // During a drag it will be null (already initialized), which is fine —
        // we apply the correct color in onItemCreated instead.
        const placeholder = paperScope.findSelectedNewItem?.()
        if (placeholder) {
            try { placeholder.strokeColor = normalizeCssColor(annotationType.color) } catch { /* ignore */ }
        }
    }, [toolkit, workflowMode, selectedTypeIndex, config, addLabelsDrawingEnabled])

    // ── Continuous annotation drawing in add-labels mode ─────────────────
    // selectedTypeIndex is intentionally NOT a dependency — type changes must
    // not restart the tool (which would interrupt an in-progress drag).
    // The current type is always read from selectedTypeIndexRef inside callbacks.
    useEffect(() => {
        if (!toolkit || workflowMode !== 'add-labels') {
            addLabelsActiveRef.current = false
            return
        }
        const types = config.annotationTypes ?? []
        if (types.length === 0) return

        const rectTool = (toolkit as any).getTool('rectangle')
        const defaultTool = (toolkit as any).getTool('default')
        if (!rectTool || !defaultTool) return

        const getPaperScope = () => (toolkit as any).project?.paperScope

        const clearDrawPlaceholder = () => {
            const stale = getPaperScope()?.findSelectedNewItem?.()
            if (stale) stale.remove()
        }

        const activatePanTool = () => {
            addLabelsActiveRef.current = false
            clearDrawPlaceholder()
            rectTool.deactivate(true)
            defaultTool.activate()
        }

        const getStyle = (idx: number) => {
            const t = types[idx]
            if (!t) return null
            return {
                strokeColor: normalizeCssColor(t.color),
                rescale: { strokeWidth: t.strokeWidth ?? 2 },
            }
        }

        const reactivate = () => {
            if (!addLabelsDrawingEnabledRef.current) {
                activatePanTool()
                return
            }
            const style = getStyle(selectedTypeIndexRef.current)
            if (!style) return
            clearDrawPlaceholder()
            rectTool.deactivate(true)
            rectTool.activate({ createNewItem: true, style })
            addLabelsActiveRef.current = true
        }

        reactivateLabelDrawingRef.current = reactivate

        if (!addLabelsDrawingEnabled) {
            activatePanTool()
            return () => {
                addLabelsActiveRef.current = false
                clearDrawPlaceholder()
            }
        }

        addLabelsActiveRef.current = true

        const onItemCreated = (payload: any) => {
            const item = payload?.item
            if (!item) return
            // Don't create new items while editing an existing label's shape
            if (editingLabelRef.current) return

            const typeIdx = selectedTypeIndexRef.current
            const annotationType = types[typeIdx]

            if (!annotationType) { item.remove(); return }

            // Apply fixed-size if enabled: click point → top-left, reshape to type defaults
            if (labelFixedSizeEnabledRef.current) {
                const fw = annotationType.defaultWidth
                const fh = annotationType.defaultHeight
                const left = item.position.x
                const top = item.position.y
                const innerPath = item.children?.[0] || item
                if (innerPath?.segments?.length >= 4) {
                    innerPath.segments[0].point.set(left, top)
                    innerPath.segments[1].point.set(left + fw, top)
                    innerPath.segments[2].point.set(left + fw, top + fh)
                    innerPath.segments[3].point.set(left, top + fh)
                }
                try { item.strokeColor = normalizeCssColor(annotationType.color) } catch { /* ignore */ }
                setLocalDocument(prev => {
                    const elements = prev?.elements ?? []
                    const newElement: LocalAnnotationElement = {
                        type: 'rectangle',
                        group: annotationType.name,
                        label: { value: annotationType.name },
                        center: [Math.round(left + fw / 2), Math.round(top + fh / 2), 0],
                        width: fw,
                        height: fh,
                        rotation: 0,
                        lineColor: normalizeCssColor(annotationType.color),
                        lineWidth: annotationType.strokeWidth ?? 2,
                        fillColor: normalizeCssColor(annotationType.fillColor ?? 'rgba(0,0,0,0.05)'),
                        ...(selectedRoiLabelRef.current != null ? { user: { roiLabel: selectedRoiLabelRef.current } } : {}),
                    }
                    return prev
                        ? { ...prev, elements: [...elements, newElement] }
                        : { name: config.annotationDocumentName, description: config.annotationDescription ?? '', elements: [newElement] }
                })
                labelItemsRef.current.push(item)
                setActiveLabelItemIdx(labelItemsRef.current.length - 1)
            } else {
                const b = item.bounds
                if (b && b.width >= 5 && b.height >= 5) {
                    // Correct the visual color — placeholder may have been a stale type.
                    try { item.strokeColor = normalizeCssColor(annotationType.color) } catch { /* ignore */ }
                    setLocalDocument(prev => {
                        const elements = prev?.elements ?? []
                        const newElement: LocalAnnotationElement = {
                            type: 'rectangle',
                            group: annotationType.name,
                            label: { value: annotationType.name },
                            center: [
                                Math.round(b.x + b.width / 2),
                                Math.round(b.y + b.height / 2),
                                0,
                            ],
                            width: Math.round(b.width),
                            height: Math.round(b.height),
                            rotation: 0,
                            lineColor: normalizeCssColor(annotationType.color),
                            lineWidth: annotationType.strokeWidth ?? 2,
                            fillColor: normalizeCssColor(annotationType.fillColor ?? 'rgba(0,0,0,0.05)'),
                            ...(selectedRoiLabelRef.current != null ? { user: { roiLabel: selectedRoiLabelRef.current } } : {}),
                        }
                        return prev
                            ? { ...prev, elements: [...elements, newElement] }
                            : {
                                  name: config.annotationDocumentName,
                                  description: config.annotationDescription ?? '',
                                  elements: [newElement],
                              }
                    })
                    labelItemsRef.current.push(item)
                    setActiveLabelItemIdx(labelItemsRef.current.length - 1)
                } else {
                    item.remove()
                }
            }

            // activate() is a no-op when _active=true — must deactivate first.
            // Defer past onMouseUp so the tool finishes its own cleanup.
            setTimeout(() => {
                if (!addLabelsActiveRef.current) return
                if (item?.selected) item.deselect(true)
                reactivate()
            }, 0)
        }

        rectTool.addEventListener('item-created', onItemCreated)
        const initialStyle = getStyle(selectedTypeIndexRef.current)
        if (initialStyle) rectTool.activate({ createNewItem: true, style: initialStyle })

        return () => {
            addLabelsActiveRef.current = false
            rectTool.removeEventListener('item-created', onItemCreated)
            clearDrawPlaceholder()
            defaultTool.activate()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toolkit, workflowMode, config, addLabelsDrawingEnabled])

    // ── Review mode: activate default tool and configure the reactivate hook ─
    useEffect(() => {
        if (!toolkit || workflowMode !== 'review') return
        const defaultTool = (toolkit as any).getTool('default')
        defaultTool?.activate()
        // After finishing/canceling a label shape edit in review mode, return to
        // the default tool (not the rect-draw loop that add-labels mode uses).
        reactivateLabelDrawingRef.current = () => { defaultTool?.activate() }
        return () => { reactivateLabelDrawingRef.current = () => {} }
    }, [toolkit, workflowMode])

    // ── Finish / cancel an in-progress ROI placement or edit ─────────────
    const finishEditingRoi = useCallback(() => {
        const item = pendingRoiItemRef.current
        const editIdx = editingRoiIndexRef.current

        if (item) {
            const b = item.bounds
            if (editIdx >= 0) {
                // Editing an existing committed ROI — update bounds in state
                if (b && b.width >= 5 && b.height >= 5) {
                    setLocalDocument(prev => {
                        if (!prev) return prev
                        let roiCount = 0
                        const elements = prev.elements.map(el => {
                            if (el.group !== 'ROI') return el
                            if (roiCount++ !== editIdx) return el
                            return {
                                ...el,
                                center: [
                                    Math.round(b.x + b.width / 2),
                                    Math.round(b.y + b.height / 2),
                                    0,
                                ] as [number, number, number],
                                width: Math.round(b.width),
                                height: Math.round(b.height),
                            }
                        })
                        return { ...prev, elements }
                    })
                } else {
                    // Edited to be too small — restore original geometry
                    const segs = originalSegmentsRef.current
                    const rect = item.children?.[0] || item
                    if (segs) segs.forEach((pt, i) => rect.segments[i].point.set(pt))
                }
                item.deselect(true)
            } else {
                // Brand-new ROI — commit to state and store item ref
                if (b && b.width >= 5 && b.height >= 5) {
                    // Index of the ROI about to be appended — used to auto-select
                    // after localDocument updates (label alone is ambiguous with fixedLabel).
                    pendingSelectRoiIndexRef.current =
                        localDocumentRef.current?.elements.filter(e => e.group === 'ROI').length ?? 0
                    addRoi(b.x, b.y, b.width, b.height)
                    roiItemsRef.current.push(item)
                } else {
                    item.remove()
                }
            }
            pendingRoiItemRef.current = null
        }

        editingRoiIndexRef.current = -1
        originalSegmentsRef.current = null
        setActiveMode(null)
    }, [addRoi, config, localDocument])

    const cancelPendingRoi = useCallback(() => {
        const item = pendingRoiItemRef.current
        const editIdx = editingRoiIndexRef.current

        if (item) {
            if (editIdx >= 0) {
                // Restore original geometry for existing ROI
                const segs = originalSegmentsRef.current
                const rect = item.children?.[0] || item
                if (segs) segs.forEach((pt, i) => rect.segments[i].point.set(pt))
                item.deselect(true)
            } else {
                // Remove brand-new ROI from canvas
                item.remove()
            }
            pendingRoiItemRef.current = null
        }

        editingRoiIndexRef.current = -1
        originalSegmentsRef.current = null
        setActiveMode(null)
    }, [])

    useEffect(() => { finishEditingRoiRef.current = finishEditingRoi }, [finishEditingRoi])
    useEffect(() => { cancelPendingRoiRef.current = cancelPendingRoi }, [cancelPendingRoi])

    // ── Start editing an existing committed ROI ───────────────────────────
    const startEditActiveRoi = useCallback(() => {
        if (!toolkit || selectedRoiIndex < 0) return
        const roi = rois[selectedRoiIndex]
        if (!roi) return
        const item = roiItemsRef.current[roi.roiIndex]
        if (!item) return

        // Save segment positions so cancel can restore them
        const rect = item.children?.[0] || item
        originalSegmentsRef.current = rect.segments.map((s: any) => ({
            x: s.point.x,
            y: s.point.y,
        }))

        // Select the item so the rect tool's getSelectedItems() finds it
        item.select()

        // Store original roiIndex (not the sorted selectedRoiIndex) for localDocument lookups
        editingRoiIndexRef.current = roi.roiIndex
        pendingRoiItemRef.current = item

        // Activate rect tool without createNewItem — it will enter modifying mode
        const rectTool = (toolkit as any).getTool('rectangle')
        if (rectTool) rectTool.activate()

        setActiveMode('drawing-roi')
    }, [toolkit, selectedRoiIndex, rois])

    // ── Delete the currently selected committed ROI ───────────────────────
    const deleteActiveRoi = useCallback(() => {
        if (selectedRoiIndex < 0) return
        const roi = rois[selectedRoiIndex]
        if (!roi) return
        if (!window.confirm('Delete this ROI? This action cannot be undone.')) return

        // Remove canvas item using original roiIndex
        const item = roiItemsRef.current[roi.roiIndex]
        if (item) item.remove()
        roiItemsRef.current.splice(roi.roiIndex, 1)

        // Remove element from localDocument using original roiIndex
        setLocalDocument(prev => {
            if (!prev) return prev
            let roiCount = 0
            const elements = prev.elements.filter(el => {
                if (el.group !== 'ROI') return true
                return roiCount++ !== roi.roiIndex
            })
            return { ...prev, elements }
        })

        setSelectedRoiIndex(-1)
    }, [selectedRoiIndex, rois])

    // Dismiss context menu on click-outside or Escape
    useEffect(() => {
        if (!contextMenu) return
        const handleMouseDown = (e: MouseEvent) => {
            const menu = document.querySelector('.annotation-editor__context-menu')
            if (menu && menu.contains(e.target as Node)) return
            setContextMenu(null)
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null)
        }
        document.addEventListener('mousedown', handleMouseDown)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousedown', handleMouseDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [contextMenu])

    useEffect(() => { activeLabelItemIdxRef.current = activeLabelItemIdx }, [activeLabelItemIdx])
    useEffect(() => { hoveredLabelItemIdxRef.current = hoveredLabelItemIdx }, [hoveredLabelItemIdx])

    // Helper: given an item's index in labelItemsRef, find its index in localDocument.elements
    const findLabelDocIndex = useCallback((itemIdx: number): number => {
        if (!localDocument) return -1
        const knownTypeNames = new Set(config.annotationTypes.map(t => t.name))
        let count = 0
        for (let i = 0; i < localDocument.elements.length; i++) {
            if (knownTypeNames.has(localDocument.elements[i].group)) {
                if (count === itemIdx) return i
                count++
            }
        }
        return -1
    }, [localDocument, config.annotationTypes])

    const resolveLabelItemIdxAtClientPoint = useCallback((clientX: number, clientY: number): number => {
        if (!toolkit) return -1
        const viewer = (toolkit as any).viewer
        const paperScope = (toolkit as any).paperScope
        const overlayCanvas: HTMLElement | undefined = (toolkit as any).overlay?.canvas()
        if (!viewer || !paperScope || !overlayCanvas) return -1

        const rect = overlayCanvas.getBoundingClientRect()
        const x = clientX - rect.left
        const y = clientY - rect.top
        const imageCoords = viewer.viewport.viewerElementToImageCoordinates(
            new (OpenSeadragon as any).Point(x, y),
        )
        const point = new paperScope.Point(imageCoords.x, imageCoords.y)
        return findTopmostLabelItemIdxAtImagePoint(labelItemsRef.current, point)
    }, [toolkit])

    const changeLabelTypeByItemIdx = useCallback((itemIdx: number, typeIndex: number) => {
        const item = labelItemsRef.current[itemIdx]
        const annotationType = config.annotationTypes[typeIndex]
        if (!item || !annotationType) return

        const docIdx = findLabelDocIndex(itemIdx)
        if (docIdx < 0) return

        try { item.strokeColor = normalizeCssColor(annotationType.color) } catch { /* ignore */ }
        setSelectedTypeIndex(typeIndex)

        setLocalDocument(prev => {
            if (!prev) return prev
            const elements = [...prev.elements]
            elements[docIdx] = {
                ...elements[docIdx],
                group: annotationType.name,
                label: { value: annotationType.name },
                lineColor: normalizeCssColor(annotationType.color),
                lineWidth: annotationType.strokeWidth ?? 2,
            }
            return { ...prev, elements }
        })
    }, [config.annotationTypes, findLabelDocIndex])

    const startEditLabelByItemIdx = useCallback((itemIdx: number) => {
        if (!toolkit) return
        const item = labelItemsRef.current[itemIdx]
        if (!item) return

        const docIdx = findLabelDocIndex(itemIdx)
        if (docIdx < 0) return

        const rect = item.children?.[0] || item
        const originalSegments = rect.segments?.map((s: any) => ({ x: s.point.x, y: s.point.y })) ?? []
        editingLabelRef.current = { item, docElementIndex: docIdx, originalSegments }
        setIsEditingLabel(true)
        setHoveredLabelItemIdx(-1)
        setHoveredLabelPointer(null)
        setActiveLabelItemIdx(itemIdx)

        item.select()
        const rectTool = (toolkit as any).getTool('rectangle')
        if (rectTool) rectTool.activate()
    }, [toolkit, findLabelDocIndex])

    useEffect(() => { startEditLabelByItemIdxRef.current = startEditLabelByItemIdx }, [startEditLabelByItemIdx])

    const handleSelectedTypeIndexChange = useCallback((typeIndex: number) => {
        setSelectedTypeIndex(typeIndex)
        if (
            workflowModeRef.current === 'add-labels'
            && !editingLabelRef.current
            && hoveredLabelItemIdxRef.current >= 0
        ) {
            changeLabelTypeByItemIdx(hoveredLabelItemIdxRef.current, typeIndex)
        }
    }, [changeLabelTypeByItemIdx])

    // ── Right-click context menu for label items (add-labels + review mode) ─
    useEffect(() => {
        if (!toolkit || (workflowMode !== 'add-labels' && workflowMode !== 'review')) return
        const overlayCanvas: HTMLElement | undefined = (toolkit as any).overlay?.canvas()
        if (!overlayCanvas) return

        const handleContextMenu = (event: MouseEvent) => {
            event.preventDefault()

            const itemIdx = resolveLabelItemIdxAtClientPoint(event.clientX, event.clientY)
            if (itemIdx < 0) { setContextMenu(null); return }

            const hitItem = labelItemsRef.current[itemIdx]
            if (!hitItem) { setContextMenu(null); return }

            setActiveLabelItemIdx(itemIdx)
            setContextMenu({ x: event.clientX, y: event.clientY, itemIdx, item: hitItem })
        }

        overlayCanvas.addEventListener('contextmenu', handleContextMenu)
        return () => overlayCanvas.removeEventListener('contextmenu', handleContextMenu)
    }, [toolkit, workflowMode, resolveLabelItemIdxAtClientPoint])

    // ── Add-labels hover: select existing boxes for edit / delete / reclassify ─
    useEffect(() => {
        if (!toolkit || workflowMode !== 'add-labels' || isEditingLabel) {
            setHoveredLabelItemIdx(-1)
            setHoveredLabelPointer(null)
            return
        }
        const overlayCanvas: HTMLElement | undefined = (toolkit as any).overlay?.canvas()
        if (!overlayCanvas) return

        const syncHoverAt = (clientX: number, clientY: number) => {
            const itemIdx = resolveLabelItemIdxAtClientPoint(clientX, clientY)
            if (itemIdx < 0) {
                setHoveredLabelItemIdx(-1)
                setHoveredLabelPointer(null)
                return
            }
            setHoveredLabelItemIdx(itemIdx)
            setActiveLabelItemIdx(itemIdx)
            setHoveredLabelPointer({ x: clientX, y: clientY })
            const docIdx = findLabelDocIndex(itemIdx)
            const group = docIdx >= 0 ? localDocumentRef.current?.elements[docIdx]?.group : undefined
            if (group) {
                const typeIdx = config.annotationTypes.findIndex(t => t.name === group)
                if (typeIdx >= 0 && typeIdx !== selectedTypeIndexRef.current) {
                    setSelectedTypeIndex(typeIdx)
                }
            }
        }

        const handleMouseMove = (event: MouseEvent) => {
            syncHoverAt(event.clientX, event.clientY)
        }

        const handleMouseLeave = () => {
            setHoveredLabelItemIdx(-1)
            setHoveredLabelPointer(null)
        }

        const handleMouseDownCapture = (event: MouseEvent) => {
            if (event.button !== 0 || !addLabelsDrawingEnabledRef.current) return
            const itemIdx = resolveLabelItemIdxAtClientPoint(event.clientX, event.clientY)
            if (itemIdx < 0) return
            setActiveLabelItemIdx(itemIdx)
            setHoveredLabelItemIdx(itemIdx)
            setHoveredLabelPointer({ x: event.clientX, y: event.clientY })
            event.stopPropagation()
            event.preventDefault()
        }

        overlayCanvas.addEventListener('mousemove', handleMouseMove)
        overlayCanvas.addEventListener('mouseleave', handleMouseLeave)
        overlayCanvas.addEventListener('mousedown', handleMouseDownCapture, true)
        return () => {
            overlayCanvas.removeEventListener('mousemove', handleMouseMove)
            overlayCanvas.removeEventListener('mouseleave', handleMouseLeave)
            overlayCanvas.removeEventListener('mousedown', handleMouseDownCapture, true)
            setHoveredLabelItemIdx(-1)
            setHoveredLabelPointer(null)
        }
    }, [
        toolkit,
        workflowMode,
        isEditingLabel,
        resolveLabelItemIdxAtClientPoint,
        findLabelDocIndex,
        config.annotationTypes,
    ])

    const deleteLabelByItemIdx = useCallback((itemIdx: number): boolean => {
        if (itemIdx < 0 || itemIdx >= labelItemsRef.current.length) return false
        const item = labelItemsRef.current[itemIdx]
        const docIdx = findLabelDocIndex(itemIdx)
        if (docIdx < 0) return false

        if (editingLabelRef.current?.item === item) {
            editingLabelRef.current = null
            setIsEditingLabel(false)
        }

        item.remove()
        labelItemsRef.current.splice(itemIdx, 1)
        setLocalDocument(prev => {
            if (!prev) return prev
            return { ...prev, elements: prev.elements.filter((_, i) => i !== docIdx) }
        })
        setActiveLabelItemIdx(prev => {
            if (prev === itemIdx) return -1
            if (prev > itemIdx) return prev - 1
            return prev
        })
        setHoveredLabelItemIdx(prev => {
            if (prev === itemIdx) {
                setHoveredLabelPointer(null)
                return -1
            }
            if (prev > itemIdx) return prev - 1
            return prev
        })
        setContextMenu(null)
        if (workflowModeRef.current === 'add-labels') {
            reactivateLabelDrawingRef.current()
        }
        return true
    }, [findLabelDocIndex])

    const deleteActiveLabel = useCallback(() => {
        if (workflowModeRef.current !== 'add-labels') return

        const editInfo = editingLabelRef.current
        if (editInfo) {
            const itemIdx = labelItemsRef.current.indexOf(editInfo.item)
            if (itemIdx >= 0) deleteLabelByItemIdx(itemIdx)
            return
        }

        const targetIdx = hoveredLabelItemIdxRef.current >= 0
            ? hoveredLabelItemIdxRef.current
            : activeLabelItemIdxRef.current
        if (targetIdx < 0) return
        deleteLabelByItemIdx(targetIdx)
    }, [deleteLabelByItemIdx])

    useEffect(() => { deleteActiveLabelRef.current = deleteActiveLabel }, [deleteActiveLabel])

    const handleContextMenuChangeType = useCallback((typeIndex: number) => {
        if (!contextMenu) return
        changeLabelTypeByItemIdx(contextMenu.itemIdx, typeIndex)
        setContextMenu(null)
    }, [contextMenu, changeLabelTypeByItemIdx])

    const handleContextMenuEditShape = useCallback(() => {
        if (!contextMenu) return
        startEditLabelByItemIdx(contextMenu.itemIdx)
        setContextMenu(null)
    }, [contextMenu, startEditLabelByItemIdx])

    const handleContextMenuDelete = useCallback(() => {
        if (!contextMenu) return
        deleteLabelByItemIdx(contextMenu.itemIdx)
    }, [contextMenu, deleteLabelByItemIdx])

    const finishEditingLabel = useCallback(() => {
        const editInfo = editingLabelRef.current
        if (!editInfo) return
        const { item, docElementIndex, originalSegments } = editInfo
        const b = item.bounds

        if (b && b.width >= 5 && b.height >= 5) {
            setLocalDocument(prev => {
                if (!prev) return prev
                const elements = [...prev.elements]
                elements[docElementIndex] = {
                    ...elements[docElementIndex],
                    center: [Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2), 0] as [number, number, number],
                    width: Math.round(b.width),
                    height: Math.round(b.height),
                }
                return { ...prev, elements }
            })
        } else {
            const rect = item.children?.[0] || item
            originalSegments.forEach((pt, i) => rect.segments[i].point.set(pt.x, pt.y))
        }

        item.deselect(true)
        editingLabelRef.current = null
        setIsEditingLabel(false)
        reactivateLabelDrawingRef.current()
    }, [])

    const cancelEditingLabel = useCallback(() => {
        const editInfo = editingLabelRef.current
        if (!editInfo) return
        const { item, originalSegments } = editInfo

        const rect = item.children?.[0] || item
        originalSegments.forEach((pt, i) => rect.segments[i].point.set(pt.x, pt.y))

        item.deselect(true)
        editingLabelRef.current = null
        setIsEditingLabel(false)
        reactivateLabelDrawingRef.current()
    }, [])

    useEffect(() => { finishEditingLabelRef.current = finishEditingLabel }, [finishEditingLabel])
    useEffect(() => { cancelEditingLabelRef.current = cancelEditingLabel }, [cancelEditingLabel])

    // ── Review mode: navigate to a specific item by index ────────────────
    const goToReviewItem = useCallback((idx: number) => {
        if (idx < 0 || idx >= reviewItems.length) return
        const { item, docIdx } = reviewItems[idx]
        setReviewItemIndex(idx)
        // Sync the type selector to the focused item's current type
        const group = localDocument?.elements[docIdx]?.group
        if (group) {
            const typeIdx = config.annotationTypes.findIndex(t => t.name === group)
            if (typeIdx >= 0) setSelectedTypeIndex(typeIdx)
        }
        if (!item) return
        const el = localDocument?.elements[docIdx]
        const viewer = toolkitRef.current ? (toolkitRef.current as any).viewer : null
        if (viewer && el) {
            centerViewerOnElement(viewer, el, OpenSeadragon as any)
            refreshDisplayAndSyncRoiFill(toolkitRef.current as any)
        } else if (viewer && item.position) {
            const tiledImage = item.layer?.tiledImage
            if (tiledImage) {
                const vp = tiledImage.imageToViewportCoordinates(item.position.x, item.position.y)
                viewer.viewport.panTo(vp, true)
            }
        }
    }, [reviewItems, localDocument, config.annotationTypes, refreshDisplayAndSyncRoiFill])

    // Auto-select first item when entering review mode or switching ROIs
    useEffect(() => {
        if (workflowMode !== 'review') { setReviewItemIndex(-1); return }
        if (reviewItems.length > 0) goToReviewItem(0)
        else setReviewItemIndex(-1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRoiIndex, workflowMode])

    // Navigate to the correct item after a deletion in review mode.
    // prevReviewLengthRef is reset to -1 on ROI/mode changes so this effect
    // ignores the first fire after a switch (auto-navigate-to-0 handles that).
    const prevReviewLengthRef = useRef(-1)
    useEffect(() => { prevReviewLengthRef.current = -1 }, [selectedRoiIndex, workflowMode])
    useEffect(() => {
        if (workflowMode !== 'review') return
        const prevLen = prevReviewLengthRef.current
        prevReviewLengthRef.current = reviewItems.length
        if (prevLen === -1) return // just switched ROI/mode — handled elsewhere
        if (reviewItems.length >= prevLen) return // type change or addition — no nav needed
        // Deletion: stay at same index (now points at next item), or last if at end
        if (reviewItems.length === 0) { setReviewItemIndex(-1); return }
        goToReviewItem(Math.min(reviewItemIndexRef.current, reviewItems.length - 1))
    }, [reviewItems, workflowMode, goToReviewItem])

    const reviewNextItem = useCallback(() => {
        if (reviewItems.length === 0) return
        const cur = reviewItemIndexRef.current
        goToReviewItem(cur < 0 ? 0 : (cur + 1) % reviewItems.length)
    }, [reviewItems, goToReviewItem])

    const reviewPreviousItem = useCallback(() => {
        if (reviewItems.length === 0) return
        const cur = reviewItemIndexRef.current
        goToReviewItem(cur < 0 ? reviewItems.length - 1 : (cur - 1 + reviewItems.length) % reviewItems.length)
    }, [reviewItems, goToReviewItem])

    useEffect(() => { reviewNextItemRef.current = reviewNextItem }, [reviewNextItem])
    useEffect(() => { reviewPreviousItemRef.current = reviewPreviousItem }, [reviewPreviousItem])

    const startReviewEditShape = useCallback(() => {
        if (!toolkit || reviewItemIndex < 0 || reviewItemIndex >= reviewItems.length) return
        const { item, docIdx } = reviewItems[reviewItemIndex]
        if (!item) return
        const rect = item.children?.[0] || item
        const originalSegments = rect.segments?.map((s: any) => ({ x: s.point.x, y: s.point.y })) ?? []
        editingLabelRef.current = { item, docElementIndex: docIdx, originalSegments }
        setIsEditingLabel(true)
        item.select()
        const rectTool = (toolkit as any).getTool('rectangle')
        if (rectTool) rectTool.activate()
    }, [toolkit, reviewItemIndex, reviewItems])

    useEffect(() => { startReviewEditShapeRef.current = startReviewEditShape }, [startReviewEditShape])

    const changeReviewItemType = useCallback((typeIndex: number) => {
        if (reviewItemIndexRef.current < 0 || reviewItemIndexRef.current >= reviewItems.length) return
        const { item, docIdx } = reviewItems[reviewItemIndexRef.current]
        const annotationType = config.annotationTypes[typeIndex]
        if (!annotationType) return
        try { item.strokeColor = normalizeCssColor(annotationType.color) } catch { /* ignore */ }
        setSelectedTypeIndex(typeIndex)
        setLocalDocument(prev => {
            if (!prev) return prev
            const elements = [...prev.elements]
            elements[docIdx] = {
                ...elements[docIdx],
                group: annotationType.name,
                label: { value: annotationType.name },
                lineColor: normalizeCssColor(annotationType.color),
                lineWidth: annotationType.strokeWidth ?? 2,
            }
            return { ...prev, elements }
        })
    }, [reviewItems, config.annotationTypes])

    useEffect(() => { changeReviewItemTypeRef.current = changeReviewItemType }, [changeReviewItemType])

    // ── Persist localDocument to DSA ──────────────────────────────────────
    const persistLocalDocument = useCallback(
        async (
            doc: LocalAnnotationDocument,
            persistOptions?: { allowServerRegression?: boolean },
        ): Promise<void> => {
            if (!apiBaseUrl) {
                throw new Error('No API base URL configured — cannot save.')
            }
            const itemId = resolveItemId(imageInfo)
            if (!itemId) {
                throw new Error('Cannot determine item ID from imageInfo — cannot save.')
            }

            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (apiHeaders) {
                const entries =
                    apiHeaders instanceof Headers
                        ? Array.from(apiHeaders.entries())
                        : Object.entries(apiHeaders as Record<string, string>)
                entries.forEach(([k, v]) => {
                    headers[k] = v
                })
            }
            if (authToken) headers['Girder-Token'] = authToken

            const annotationObject = {
                name: doc.name,
                description: doc.description,
                elements: [...doc.elements, ...foreignElementsRef.current],
                ...(config.documentAttributes ? { attributes: config.documentAttributes } : {}),
            }

            const doFetch = fetchFn ?? fetch
            const existingId = annotationDocumentIdRef.current

            if (existingId) {
                const checkRes = await doFetch(`${apiBaseUrl}/annotation/${existingId}`, { headers, cache: 'no-store' })
                if (!checkRes.ok) {
                    throw new Error(`${checkRes.status} ${checkRes.statusText}`)
                }
                const serverDoc: { annotation?: { elements?: unknown[] } } = await checkRes.json()
                const serverElements = normalizeKnownDsaElements(
                    serverDoc.annotation?.elements ?? [],
                    config,
                )
                const serverCounts = countKnownAnnotationElements(serverElements, config)
                const localCounts = countKnownAnnotationElements(doc.elements, config)

                if (
                    annotationLoadSettledRef.current
                    && !persistOptions?.allowServerRegression
                    && wouldRegressServerAnnotation(
                        localCounts.roiCount,
                        localCounts.boxCount,
                        serverCounts.roiCount,
                        serverCounts.boxCount,
                    )
                ) {
                    throw new AnnotationSaveRegressionError({
                        localRoiCount: localCounts.roiCount,
                        localBoxCount: localCounts.boxCount,
                        serverRoiCount: serverCounts.roiCount,
                        serverBoxCount: serverCounts.boxCount,
                    })
                }

                if (savedSnapshotRef.current != null) {
                    const serverSnapshot = documentElementsSnapshot({ elements: serverElements })
                    if (serverSnapshot !== savedSnapshotRef.current) {
                        const baselineParsed = JSON.parse(savedSnapshotRef.current) as unknown
                        const details = {
                            serverElementCount: serverElements.length,
                            baselineElementCount: Array.isArray(baselineParsed) ? baselineParsed.length : 0,
                            localElementCount: doc.elements.length,
                        }
                        onSaveConflict?.(details)
                        throw new AnnotationSaveConflictError(details)
                    }
                }
            }

            let res: Response
            if (existingId) {
                res = await doFetch(`${apiBaseUrl}/annotation/${existingId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(annotationObject),
                })
            } else {
                res = await doFetch(`${apiBaseUrl}/annotation/item/${itemId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([annotationObject]),
                })
            }

            if (!res.ok) {
                let detail = `${res.status} ${res.statusText}`
                try {
                    const body = (await res.json()) as Record<string, unknown>
                    if (body.message) detail += `: ${body.message}`
                    else detail += `\n${JSON.stringify(body)}`
                } catch {
                    /* body not JSON */
                }
                console.error('[AnnotationEditor] Save failed —', detail, '\nPayload:', annotationObject)
                throw Object.assign(new Error(detail), { status: res.status, statusText: res.statusText })
            }

            if (!existingId) {
                let newId: string | undefined
                try {
                    const saved: unknown = await res.json()
                    const candidate = Array.isArray(saved) ? (saved[0] as any) : (saved as any)
                    newId = candidate?._id ?? candidate?.annotation?._id
                } catch {
                    /* body not JSON or already consumed */
                }

                if (!newId) {
                    try {
                        const listRes = await doFetch(
                            annotationFindByNameUrl(apiBaseUrl, itemId, doc.name),
                            { headers, cache: 'no-store' },
                        )
                        if (listRes.ok) {
                            const list: any[] = await listRes.json()
                            newId = Array.isArray(list) ? list[0]?._id : undefined
                        }
                    } catch {
                        /* ignore */
                    }
                }

                if (newId) setAnnotationDocumentId(newId)
            }
        },
        [apiBaseUrl, imageInfo, apiHeaders, authToken, fetchFn, config.documentAttributes, config, onSaveConflict],
    )

    // ── Save localDocument to DSA or export GeoJSON ───────────────────────
    const performSave = useCallback(async (options?: { silent?: boolean }): Promise<boolean> => {
        if (saveInFlightRef.current) {
            pendingSaveRef.current = true
            return false
        }

        const doc = localDocumentRef.current
        if (!doc) {
            if (!options?.silent) {
                setSaveStatus('error')
                notify('error', 'Nothing to save — add some ROIs first.', 3000)
                setTimeout(() => setSaveStatus('idle'), 3000)
            }
            return false
        }

        saveInFlightRef.current = true
        setSaveStatus('saving')

        const finish = async (): Promise<boolean> => {
            saveInFlightRef.current = false
            if (pendingSaveRef.current) {
                pendingSaveRef.current = false
                return performSaveRef.current({ silent: true })
            }
            return true
        }

        if (geoJsonExportMode) {
            if (!onGeoJsonExport) {
                setSaveStatus('error')
                if (!options?.silent) {
                    notify('error', 'onGeoJsonExport is not set — cannot export.', 3000)
                    setTimeout(() => setSaveStatus('idle'), 3000)
                }
                await finish()
                return false
            }
            try {
                const collection = localDocumentToFeatureCollection(doc)
                onGeoJsonExport(collection)
                savedSnapshotRef.current = documentElementsSnapshot(doc)
                documentDirtyRef.current = false
                setSaveDirty(false)
                setSaveStatus('saved')
                if (!options?.silent) {
                    notify('success', 'GeoJSON exported.', 2500)
                }
                onAnnotationSaved?.()
                setTimeout(() => setSaveStatus('idle'), 2500)
                await finish()
                return true
            } catch (err) {
                console.error('[AnnotationEditor] GeoJSON export failed:', err)
                setSaveStatus('error')
                notify('error', 'Failed to build GeoJSON export.', 4000)
                setTimeout(() => setSaveStatus('idle'), 4000)
                await finish()
                return false
            }
        }

        try {
            await persistLocalDocument(doc)
            savedSnapshotRef.current = documentElementsSnapshot(doc)
            documentDirtyRef.current = false
            setSaveDirty(false)
            setSaveStatus('saved')
            if (!options?.silent) {
                notify('success', 'Annotation saved successfully.', 2500)
            }
            onAnnotationSaved?.()
            setTimeout(() => setSaveStatus('idle'), 2500)
            await finish()
            return true
        } catch (err) {
            if (err instanceof AnnotationSaveConflictError) {
                documentDirtyRef.current = false
                setSaveDirty(false)
                setSaveStatus('error')
                if (!options?.silent) {
                    notify('error', err.message, 8000)
                }
                setTimeout(() => setSaveStatus('idle'), 4000)
                await finish()
                return false
            }
            if (err instanceof AnnotationSaveRegressionError) {
                documentDirtyRef.current = false
                setSaveDirty(false)
                setSaveStatus('error')
                if (!options?.silent) {
                    notify('error', err.message, 8000)
                }
                setTimeout(() => setSaveStatus('idle'), 4000)
                await finish()
                return false
            }
            const apiErr = createApiError(err)
            setSaveStatus('error')
            notify('error', `Save failed: ${apiErr.message}`, 4000)
            onApiError?.(apiErr, () => { void performSave({ silent: false }) }, {
                operation: annotationDocumentIdRef.current ? 'update' : 'create',
                endpoint: apiBaseUrl,
            })
            setTimeout(() => setSaveStatus('idle'), 4000)
            await finish()
            return false
        }
    }, [
        geoJsonExportMode,
        onGeoJsonExport,
        apiBaseUrl,
        onApiError,
        onAnnotationSaved,
        notify,
        persistLocalDocument,
    ])

    const saveAnnotation = useCallback(async () => {
        await performSave({ silent: false })
    }, [performSave])

    useEffect(() => { performSaveRef.current = performSave }, [performSave])

    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current)
                autoSaveTimerRef.current = null
            }
            if (
                autoSaveSettings.saveOnUnmount
                && autoSaveSettings.enabled
                && documentDirtyRef.current
                && annotationLoadSettledRef.current
            ) {
                void performSaveRef.current({ silent: true })
            }
        }
    }, [autoSaveSettings.enabled, autoSaveSettings.saveOnUnmount])

    const clearAllAnnotations = useCallback(
        async (options?: { saveToDsa?: boolean }) => {
            const doc = localDocumentRef.current
            const hasDocElements = Boolean(doc && doc.elements.length > 0)
            const hasCanvasItems =
                roiItemsRef.current.length > 0 || labelItemsRef.current.length > 0
            const hasPending = pendingRoiItemRef.current != null
            if (!hasDocElements && !hasCanvasItems && !hasPending) {
                notify('error', 'Nothing to clear — no ROIs or labels on this slide.', 2500)
                return 'empty' as const
            }

            const saveToDsa = options?.saveToDsa !== false
            const confirmMessage = saveToDsa
                ? 'Clear all ROIs and detection labels on this slide and save the empty document to DSA?'
                : 'Clear all ROIs and detection labels on this slide?'
            if (!window.confirm(confirmMessage)) return 'cancelled' as const

            cancelPendingRoi()
            setContextMenu(null)
            setIsEditingLabel(false)
            editingLabelRef.current = null
            addLabelsActiveRef.current = false

            if (toolkit) {
                loadLocalElementsOntoAnnotationToolkit(
                    toolkit as any,
                    config,
                    [],
                    roiItemsRef,
                    labelItemsRef,
                    { clear: true },
                )
                refreshDisplayAndSyncRoiFill(toolkit as any)
            }

            const emptyDoc: LocalAnnotationDocument = doc
                ? { ...doc, elements: [] }
                : {
                      name: config.annotationDocumentName,
                      description: config.annotationDescription ?? '',
                      elements: [],
                  }

            setLocalDocument(emptyDoc)
            localDocumentRef.current = emptyDoc
            roiItemsRef.current = []
            labelItemsRef.current = []
            setActiveLabelItemIdx(-1)
            setSelectedRoiIndex(-1)
            setReviewItemIndex(-1)
            setActiveMode(null)
            setWorkflowMode(config.defaultWorkflowMode ?? 'edit-rois')

            if (saveToDsa && apiBaseUrl && !geoJsonExportMode) {
                setSaveStatus('saving')
                try {
                    await persistLocalDocument(emptyDoc, { allowServerRegression: true })
                    savedSnapshotRef.current = documentElementsSnapshot(emptyDoc)
                    documentDirtyRef.current = false
                    setSaveDirty(false)
                    setSaveStatus('saved')
                    notify('success', 'Cleared all ROIs and labels and saved to DSA.', 3000)
                    onAnnotationSaved?.()
                    setTimeout(() => setSaveStatus('idle'), 2500)
                    return 'cleared' as const
                } catch (err) {
                    const apiErr = createApiError(err)
                    setSaveStatus('error')
                    notify('error', `Cleared canvas but save failed: ${apiErr.message}`, 5000)
                    onApiError?.(apiErr, () => { void clearAllAnnotations(options) }, {
                        operation: annotationDocumentIdRef.current ? 'update' : 'create',
                        endpoint: apiBaseUrl,
                    })
                    setTimeout(() => setSaveStatus('idle'), 4000)
                    return 'error' as const
                }
            } else {
                notify('success', 'Cleared all ROIs and labels.', 2500)
                return 'cleared' as const
            }
        },
        [apiBaseUrl, cancelPendingRoi, config, geoJsonExportMode, notify, onAnnotationSaved, onApiError, persistLocalDocument, toolkit],
    )

    const getViewerImageSize = useCallback((): { w: number; h: number } | null => {
        const viewer = (toolkit as { viewer?: { world: { getItemAt: (i: number) => { getContentSize: () => { x: number; y: number } } | null } } } | null)?.viewer
        if (!viewer) return null
        const tiled = viewer.world.getItemAt(0)
        if (!tiled) return null
        const sz = tiled.getContentSize()
        if (!sz || sz.x <= 0 || sz.y <= 0) return null
        return { w: sz.x, h: sz.y }
    }, [toolkit])

    const findRoiElementAtIndex = useCallback((roiIndexInDoc: number) => {
        const doc = localDocumentRef.current
        if (!doc) return null
        let roiCount = 0
        for (let i = 0; i < doc.elements.length; i++) {
            const el = doc.elements[i]
            if (el.group !== 'ROI') continue
            if (roiCount === roiIndexInDoc) return { el, docIdx: i }
            roiCount++
        }
        return null
    }, [])

    const resolveActiveRoiEntry = useCallback(() => {
        if (selectedRoiIndex >= 0 && rois[selectedRoiIndex]) return rois[selectedRoiIndex]
        if (rois.length > 0) return rois[0]
        return null
    }, [selectedRoiIndex, rois])

    const getActiveRoiBounds = useCallback((): RoiImageBounds | null => {
        const entry = resolveActiveRoiEntry()
        if (!entry) return null
        const found = findRoiElementAtIndex(entry.roiIndex)
        if (!found) return null
        return elementToRoiBounds(found.el)
    }, [resolveActiveRoiEntry, findRoiElementAtIndex])

    const getActiveRoiGroundTruthBoxes = useCallback(() => {
        const entry = resolveActiveRoiEntry()
        if (!entry || !localDocumentRef.current) return []
        const roiLabel = entry.label
        const knownTypeNames = new Set(config.annotationTypes.map(t => t.name))
        const out: GroundTruthBox[] = []
        for (const el of localDocumentRef.current.elements) {
            if (!knownTypeNames.has(el.group)) continue
            if (el.user?.roiLabel !== roiLabel) continue
            const bounds = elementToRoiBounds(el)
            out.push({ className: el.group, ...bounds })
        }
        return out
    }, [resolveActiveRoiEntry, config.annotationTypes])

    const applyRoiTopLeft = useCallback((roiIndexInDoc: number, left: number, top: number): boolean => {
        const img = getViewerImageSize()
        const found = findRoiElementAtIndex(roiIndexInDoc)
        if (!found || !img) return false
        const { el, docIdx } = found
        const clamped = clampRoiTopLeft(left, top, el.width, el.height, img.w, img.h)
        const prev = elementToRoiBounds(el)
        const dx = clamped.left - prev.left
        const dy = clamped.top - prev.top
        if (dx === 0 && dy === 0) return false

        setLocalDocument(prevDoc => {
            if (!prevDoc) return prevDoc
            const elements = [...prevDoc.elements]
            const current = elements[docIdx]
            elements[docIdx] = {
                ...current,
                center: [
                    Math.round(clamped.left + current.width / 2),
                    Math.round(clamped.top + current.height / 2),
                    current.center[2] ?? 0,
                ],
            }
            return { ...prevDoc, elements }
        })

        translatePaperRoiItem(roiItemsRef.current[roiIndexInDoc] ?? null, dx, dy)

        if (workflowModeRef.current === 'add-labels' && addLabelsDrawingEnabledRef.current) {
            setTimeout(() => reactivateLabelDrawingRef.current(), 0)
        }
        return true
    }, [findRoiElementAtIndex, getViewerImageSize])

    const nudgeSelectedRoi = useCallback((dx: number, dy: number): boolean => {
        const entry = resolveActiveRoiEntry()
        if (!entry) return false
        const found = findRoiElementAtIndex(entry.roiIndex)
        if (!found) return false
        const prev = elementToRoiBounds(found.el)
        return applyRoiTopLeft(entry.roiIndex, prev.left + dx, prev.top + dy)
    }, [resolveActiveRoiEntry, findRoiElementAtIndex, applyRoiTopLeft])

    const setSelectedRoiTopLeft = useCallback((left: number, top: number): boolean => {
        const entry = resolveActiveRoiEntry()
        if (!entry) return false
        return applyRoiTopLeft(entry.roiIndex, left, top)
    }, [resolveActiveRoiEntry, applyRoiTopLeft])

    const removeOverlappingLabels = useCallback(
        async (options?: RemoveOverlappingLabelsOptions) => {
            const doc = localDocumentRef.current
            if (!doc) {
                return { status: 'none' as const, removed: 0, kept: 0 }
            }

            const knownTypeNames = new Set(config.annotationTypes.map(t => t.name))
            const scope = options?.scope ?? 'slide'
            const iouThreshold = options?.iouThreshold ?? 0.5
            const containedThreshold = options?.containedThreshold ?? 0.7
            const saveToDsa = options?.saveToDsa !== false

            let roiLabelFilter: string | null = null
            if (scope === 'active-roi') {
                const entry = resolveActiveRoiEntry()
                if (!entry) {
                    notify('error', 'No ROI selected — choose an ROI first or use whole-slide cleanup.', 3000)
                    return { status: 'none' as const, removed: 0, kept: 0 }
                }
                roiLabelFilter = entry.label
            }

            const candidateBoxes: OverlapBox[] = []
            for (let i = 0; i < doc.elements.length; i++) {
                const el = doc.elements[i]!
                if (!knownTypeNames.has(el.group)) continue
                if (roiLabelFilter && el.user?.roiLabel !== roiLabelFilter) continue
                candidateBoxes.push({
                    docIdx: i,
                    className: el.group,
                    ...elementToRoiBounds(el),
                })
            }

            const dropIndices = findOverlappingBoxDocIndices(candidateBoxes, {
                iouThreshold,
                containedThreshold,
            })

            if (dropIndices.length === 0) {
                notify('success', 'No overlapping detection boxes found.', 2500)
                return { status: 'none' as const, removed: 0, kept: candidateBoxes.length }
            }

            const scopeLabel =
                scope === 'active-roi' && roiLabelFilter
                    ? `ROI "${roiLabelFilter}"`
                    : 'this slide'
            if (!options?.skipConfirm) {
                const confirmMessage = saveToDsa
                    ? `Remove ${dropIndices.length} overlapping detection box(es) from ${scopeLabel}? Keeps the larger box when same-class boxes overlap, then saves to DSA.`
                    : `Remove ${dropIndices.length} overlapping detection box(es) from ${scopeLabel}? Keeps the larger box when same-class boxes overlap.`
                if (!window.confirm(confirmMessage)) {
                    return { status: 'cancelled' as const, removed: 0, kept: candidateBoxes.length }
                }
            }

            setContextMenu(null)
            setIsEditingLabel(false)
            editingLabelRef.current = null

            const dropSet = new Set(dropIndices)
            const filteredElements = doc.elements.filter((_, i) => !dropSet.has(i))
            const newDoc = { ...doc, elements: filteredElements }

            if (toolkit) {
                loadLocalElementsOntoAnnotationToolkit(
                    toolkit as any,
                    config,
                    filteredElements,
                    roiItemsRef,
                    labelItemsRef,
                    { clear: true },
                )
                refreshDisplayAndSyncRoiFill(toolkit as any)
            }

            setLocalDocument(newDoc)
            localDocumentRef.current = newDoc
            setActiveLabelItemIdx(-1)
            setHoveredLabelItemIdx(-1)
            setHoveredLabelPointer(null)
            setReviewItemIndex(-1)

            if (saveToDsa && apiBaseUrl && !geoJsonExportMode) {
                setSaveStatus('saving')
                try {
                    await persistLocalDocument(newDoc)
                    savedSnapshotRef.current = documentElementsSnapshot(newDoc)
                    documentDirtyRef.current = false
                    setSaveDirty(false)
                    setSaveStatus('saved')
                    notify(
                        'success',
                        `Removed ${dropIndices.length} overlapping box(es) and saved to DSA.`,
                        3000,
                    )
                    onAnnotationSaved?.()
                    setTimeout(() => setSaveStatus('idle'), 2500)
                    return {
                        status: 'removed' as const,
                        removed: dropIndices.length,
                        kept: candidateBoxes.length - dropIndices.length,
                    }
                } catch (err) {
                    const apiErr = createApiError(err)
                    setSaveStatus('error')
                    notify(
                        'error',
                        `Removed overlapping boxes on screen but save failed: ${apiErr.message}`,
                        5000,
                    )
                    onApiError?.(apiErr, () => { void removeOverlappingLabels(options) }, {
                        operation: annotationDocumentIdRef.current ? 'update' : 'create',
                        endpoint: apiBaseUrl,
                    })
                    setTimeout(() => setSaveStatus('idle'), 4000)
                    return {
                        status: 'error' as const,
                        removed: dropIndices.length,
                        kept: candidateBoxes.length - dropIndices.length,
                    }
                }
            }

            notify('success', `Removed ${dropIndices.length} overlapping box(es).`, 2500)
            return {
                status: 'removed' as const,
                removed: dropIndices.length,
                kept: candidateBoxes.length - dropIndices.length,
            }
        },
        [
            apiBaseUrl,
            config,
            geoJsonExportMode,
            notify,
            onAnnotationSaved,
            onApiError,
            persistLocalDocument,
            refreshDisplayAndSyncRoiFill,
            resolveActiveRoiEntry,
            toolkit,
        ],
    )

    const getSyncSnapshot = useCallback(() => {
        const doc = localDocumentRef.current
        const counts = countKnownAnnotationElements(doc?.elements ?? [], config)
        const settled = annotationLoadSettledRef.current
        const loading = isLoadingAnnotation && !settled
        return {
            roiCount: counts.roiCount,
            boxCount: counts.boxCount,
            dirty: documentDirtyRef.current,
            saveStatus,
            ready: settled,
            loading,
        }
    }, [config, saveStatus, isLoadingAnnotation])

    const saveToDsa = useCallback(async () => {
        return performSaveRef.current({ silent: false })
    }, [])

    const fitViewerToElementDocIndices = useCallback((docIndices: number[]): boolean => {
        const viewer = toolkitRef.current ? (toolkitRef.current as any).viewer : null
        const doc = localDocumentRef.current
        if (!viewer || !doc?.elements?.length || docIndices.length === 0) return false
        const elements = docIndices
            .map(idx => doc.elements[idx])
            .filter((el): el is LocalAnnotationElement => el != null)
        if (elements.length === 0) return false
        return fitViewerToElements(viewer, elements, OpenSeadragon as any)
    }, [])

    useImperativeHandle(
        ref,
        () => ({
            clearAllAnnotations,
            getActiveRoiBounds,
            getActiveRoiGroundTruthBoxes,
            nudgeSelectedRoi,
            setSelectedRoiTopLeft,
            getSyncSnapshot,
            saveToDsa,
            removeOverlappingLabels,
            fitViewerToElementDocIndices,
        }),
        [clearAllAnnotations, getActiveRoiBounds, getActiveRoiGroundTruthBoxes, nudgeSelectedRoi, setSelectedRoiTopLeft, getSyncSnapshot, saveToDsa, removeOverlappingLabels, fitViewerToElementDocIndices],
    )

    // ── Activate / deactivate RectangleTool based on mode ────────────────
    useEffect(() => {
        if (!toolkit) return
        // add-labels mode controls the tool in its own effect
        if (workflowMode === 'add-labels') return

        const rectTool = (toolkit as any).getTool('rectangle')
        const defaultTool = (toolkit as any).getTool('default')
        if (!rectTool || !defaultTool) return

        // Not in a drawing-related mode → activate default tool
        if (activeMode !== 'add-roi' && activeMode !== 'drawing-roi') {
            defaultTool.activate()
            return
        }

        // 'drawing-roi': rectangle was just placed — tool is already active in
        // 'modifying' mode (supports move + corner-resize). Nothing to re-init.
        if (activeMode === 'drawing-roi') return

        // 'add-roi': set up fresh drawing
        const roi = config.roiSettings ?? {}
        const roiStyle = {
            strokeColor: normalizeCssColor(roi.color ?? '#ffa500'),
            fillOpacity: effectiveRoiFillOpacity(roiFillVisible, roi),
            rescale: { strokeWidth: roi.strokeWidth ?? 2 },
        }

        const onItemCreated = (payload: any) => {
            const item = payload?.item
            if (!item) return

            if (fixedSizeEnabled) {
                // Fixed-size: click point becomes the top-left corner of the ROI.
                // Commit immediately — no "Finish editing" step needed.
                const left = item.position.x
                const top = item.position.y
                const innerPath = item.children?.[0] || item
                if (innerPath?.segments?.length >= 4) {
                    // Segment order: [topLeft, topRight, bottomRight, bottomLeft]
                    innerPath.segments[0].point.set(left, top)
                    innerPath.segments[1].point.set(left + fixedWidth, top)
                    innerPath.segments[2].point.set(left + fixedWidth, top + fixedHeight)
                    innerPath.segments[3].point.set(left, top + fixedHeight)
                }
                pendingSelectRoiIndexRef.current =
                    localDocumentRef.current?.elements.filter(e => e.group === 'ROI').length ?? 0
                addRoiRef.current(left, top, fixedWidth, fixedHeight)
                roiItemsRef.current.push(item)
                pendingRoiItemRef.current = null
                setActiveMode(null)
            } else {
                // Normal: store ref and switch to editing mode — commit on "Finish editing"
                pendingRoiItemRef.current = item
                setActiveMode('drawing-roi')
            }
        }

        rectTool.addEventListener('item-created', onItemCreated)
        rectTool.activate({ createNewItem: true, style: roiStyle })

        return () => {
            rectTool.removeEventListener('item-created', onItemCreated)
            // Intentionally NOT activating defaultTool here: when transitioning
            // to 'drawing-roi' we keep the rect tool alive for move/resize.
        }
    }, [toolkit, activeMode, workflowMode, config, fixedSizeEnabled, fixedWidth, fixedHeight, roiFillVisible])

    // ── Auto-select the newly finished ROI in the dropdown ───────────────
    useEffect(() => {
        if (pendingSelectRoiIndexRef.current == null) return
        const idx = rois.findIndex(r => r.roiIndex === pendingSelectRoiIndexRef.current)
        if (idx >= 0) {
            setSelectedRoiIndex(idx)
            pendingSelectRoiIndexRef.current = null
        }
    }, [rois])

    // ── Zoom viewer to fit an ROI using its image-pixel coordinates ───────
    // Reads from localDocumentRef (not localDocument state) so this callback is
    // stable across localDocument updates (e.g. when label boxes are drawn).
    const zoomToRoiByIndex = useCallback((roiIndex: number) => {
        if (!toolkit) return
        const viewer = (toolkit as any).viewer
        if (!viewer?.viewport) return
        let roiCount = 0
        const el = localDocumentRef.current?.elements.find(e => {
            if (e.group !== 'ROI') return false
            return roiCount++ === roiIndex
        })
        if (!el) return
        const pad = 0.1
        const x = el.center[0] - el.width / 2 - el.width * pad
        const y = el.center[1] - el.height / 2 - el.height * pad
        const w = el.width * (1 + 2 * pad)
        const h = el.height * (1 + 2 * pad)
        const rect = new (OpenSeadragon as any).Rect(x, y, w, h)
        const vpRect = viewer.viewport.imageToViewportRectangle(rect)
        viewer.viewport.fitBounds(vpRect)
    }, [toolkit])

    // Tracks which selectedRoiIndex value we last zoomed to — so drawing label
    // boxes (which updates rois/localDocument but not selectedRoiIndex) never
    // triggers an unwanted re-center.
    const zoomedForRoiIndexRef = useRef(-2)

    // ── Sync canvas selection highlight with the dropdown ─────────────────
    useEffect(() => {
        // Don't interfere while the user is placing a new ROI or editing one
        if (!toolkit || activeMode === 'drawing-roi' || activeMode === 'add-roi') return

        if (selectedRoiIndex >= 0) {
            const roi = rois[selectedRoiIndex]
            if (roi) {
                const item = roiItemsRef.current[roi.roiIndex]
                if (item) {
                    // In add-labels mode, selecting a Paper.js item hands control to
                    // the rectangle tool's "modify" mode and breaks the drawing loop.
                    // Skip select() — just pan to the ROI and reactivate drawing.
                    if (workflowMode !== 'add-labels') {
                        item.select()
                    }
                    // Only zoom when the selected ROI actually changed, not when
                    // localDocument changed (e.g. a label box was drawn/deleted).
                    if (selectedRoiIndex !== zoomedForRoiIndexRef.current) {
                        zoomedForRoiIndexRef.current = selectedRoiIndex
                        zoomToRoiByIndex(roi.roiIndex)
                        // Reactivate the drawing loop after panning so the tool
                        // is ready to draw in the new ROI immediately.
                        if (workflowMode === 'add-labels' && addLabelsDrawingEnabledRef.current) {
                            reactivateLabelDrawingRef.current()
                        }
                    }
                    syncAllRoiFillVisibility()
                }
            }
        } else {
            zoomedForRoiIndexRef.current = -1
            roiItemsRef.current.forEach(item => {
                if (item) item.deselect(true)
            })
        }
    }, [toolkit, selectedRoiIndex, activeMode, workflowMode, rois, zoomToRoiByIndex, syncAllRoiFillVisibility])

    // ── Sync markComplete checkbox from the selected ROI's user data ──────
    useEffect(() => {
        if (selectedRoiIndex < 0 || !localDocument) {
            setMarkComplete(false)
            return
        }
        const roi = rois[selectedRoiIndex]
        if (!roi) { setMarkComplete(false); return }
        const roiEl = localDocument.elements.filter(e => e.group === 'ROI')[roi.roiIndex]
        setMarkComplete(!!(roiEl?.user?.complete))
    }, [selectedRoiIndex, rois, localDocument])

    // ── Apply / remove the "complete" state on the selected ROI ──────────
    const handleMarkComplete = useCallback((v: boolean) => {
        setMarkComplete(v)
        if (selectedRoiIndex < 0) return
        const roi = rois[selectedRoiIndex]
        if (!roi) return

        const completedColor = '#22c55e'
        const defaultColor = normalizeCssColor(config.roiSettings?.color ?? '#ffa500')

        // Update the Paper.js item stroke color immediately
        const item = roiItemsRef.current[roi.roiIndex]
        if (item) {
            try { item.strokeColor = v ? completedColor : defaultColor } catch { /* ignore */ }
        }

        // Update lineColor and user.complete in localDocument
        setLocalDocument(prev => {
            if (!prev) return prev
            const roiEls = prev.elements.filter(e => e.group === 'ROI')
            const roiEl = roiEls[roi.roiIndex]
            if (!roiEl) return prev
            const newUser = v
                ? { ...(roiEl.user ?? {}), complete: true }
                : Object.fromEntries(Object.entries(roiEl.user ?? {}).filter(([k]) => k !== 'complete'))
            const updatedEl: LocalAnnotationElement = {
                ...roiEl,
                lineColor: v ? completedColor : defaultColor,
                ...(Object.keys(newUser).length > 0 ? { user: newUser } : { user: undefined }),
            }
            return {
                ...prev,
                elements: prev.elements.map(e => (e === roiEl ? updatedEl : e)),
            }
        })
    }, [selectedRoiIndex, rois, config])

    const labelHoverActions = useMemo(() => {
        if (
            !showLabelHoverPanel
            || workflowMode !== 'add-labels'
            || isEditingLabel
            || hoveredLabelItemIdx < 0
            || !hoveredLabelPointer
        ) {
            return null
        }
        const docIdx = findLabelDocIndex(hoveredLabelItemIdx)
        const el = docIdx >= 0 ? localDocument?.elements[docIdx] : undefined
        const group = el?.group
        const typeIndex = group
            ? Math.max(0, config.annotationTypes.findIndex(t => t.name === group))
            : selectedTypeIndex
        return {
            x: hoveredLabelPointer.x,
            y: hoveredLabelPointer.y,
            itemIdx: hoveredLabelItemIdx,
            typeIndex: typeIndex >= 0 ? typeIndex : 0,
            labelName: el?.label?.value ?? group ?? 'Label',
            onTypeChange: (nextTypeIndex: number) => {
                changeLabelTypeByItemIdx(hoveredLabelItemIdx, nextTypeIndex)
            },
            onEditShape: () => startEditLabelByItemIdx(hoveredLabelItemIdx),
            onDelete: () => deleteLabelByItemIdx(hoveredLabelItemIdx),
        }
    }, [
        showLabelHoverPanel,
        workflowMode,
        isEditingLabel,
        hoveredLabelItemIdx,
        hoveredLabelPointer,
        findLabelDocIndex,
        localDocument,
        config.annotationTypes,
        selectedTypeIndex,
        changeLabelTypeByItemIdx,
        startEditLabelByItemIdx,
        deleteLabelByItemIdx,
    ])

    return (
        <div className={`annotation-editor ${className}`} style={style}>
            <AnnotationEditorToolbar
                rois={rois}
                detectionCount={filterCounts.total}
                selectedRoiIndex={selectedRoiIndex}
                setSelectedRoiIndex={setSelectedRoiIndex}
                markComplete={markComplete}
                setMarkComplete={handleMarkComplete}
                roiFillVisible={roiFillVisible}
                setRoiFillVisible={setRoiFillVisible}
                roiCompletedCount={roiCompletedCount}
                roiTotal={rois.length}
                workflowMode={workflowMode}
                setWorkflowMode={setWorkflowMode}
                isEditingLabel={isEditingLabel}
                finishEditingLabel={finishEditingLabel}
                cancelEditingLabel={cancelEditingLabel}
                deleteActiveLabel={deleteActiveLabel}
                canDeleteActiveLabel={isEditingLabel || hoveredLabelItemIdx >= 0 || activeLabelItemIdx >= 0}
                onRemoveOverlappingLabels={() => { void removeOverlappingLabels() }}
                labelFixedSizeEnabled={labelFixedSizeEnabled}
                setLabelFixedSizeEnabled={setLabelFixedSizeEnabled}
                addLabelsDrawingEnabled={addLabelsDrawingEnabled}
                setAddLabelsDrawingEnabled={setAddLabelsDrawingEnabled}
                drawToggleHotkey={(config.hotkeys?.insertBox ?? 't').toUpperCase()}
                finishShapeEditHotkey={(config.hotkeys?.finishShapeEdit ?? 'f').toUpperCase()}
                editLabelShapeHotkey={(config.hotkeys?.editLabelShape ?? 'e').toUpperCase()}
                annotationTypes={annotationTypes}
                selectedTypeIndex={selectedTypeIndex}
                setSelectedTypeIndex={handleSelectedTypeIndexChange}
                activeMode={activeMode}
                setActiveMode={setActiveMode}
                fixedSizeEnabled={fixedSizeEnabled}
                setFixedSizeEnabled={setFixedSizeEnabled}
                fixedWidth={fixedWidth}
                setFixedWidth={setFixedWidth}
                fixedHeight={fixedHeight}
                setFixedHeight={setFixedHeight}
                finishEditingRoi={finishEditingRoi}
                cancelPendingRoi={cancelPendingRoi}
                startEditActiveRoi={startEditActiveRoi}
                deleteActiveRoi={deleteActiveRoi}
                reviewItemIndex={reviewItemIndex}
                reviewItemCount={reviewItems.length}
                reviewNextItem={reviewNextItem}
                reviewPreviousItem={reviewPreviousItem}
                reviewSelectedTypeIndex={selectedTypeIndex}
                onReviewTypeChange={changeReviewItemType}
                startReviewEditShape={startReviewEditShape}
                showInfoControl={showInfoControl}
                showInfo={showInfo}
                setShowInfo={setShowInfo}
                confidenceThreshold={confidenceThreshold}
                setConfidenceThreshold={setConfidenceThreshold}
                filterVisibleCount={filterCounts.showing}
                filterTotalCount={filterCounts.total}
                isLoadingAnnotation={isLoadingAnnotation}
                saveStatus={saveStatus}
                saveDirty={saveDirty}
                autoSaveEnabled={autoSaveSettings.enabled}
                saveAnnotation={() => { void saveAnnotation() }}
                canSave={
                    geoJsonExportMode
                        ? localDocument != null
                        : resolveItemId(imageInfo) !== null || localDocument !== null
                }
                saveIdleLabel={
                    autoSaveSettings.enabled
                        ? (saveDirty ? 'Save now' : 'Saved')
                        : (geoJsonExportMode ? 'Export GeoJSON' : 'Save')
                }
                saveSavingLabel={geoJsonExportMode ? 'Exporting…' : 'Saving…'}
                saveButtonTitle={
                    autoSaveSettings.enabled
                        ? 'Save now (⌘S / Ctrl+S). Changes autosave after you stop editing.'
                        : geoJsonExportMode
                          ? 'Export the current document as GeoJSON (handled by onGeoJsonExport)'
                          : 'Save annotations to DSA (⌘S / Ctrl+S)'
                }
            />

            <div className="annotation-editor__viewer">
                <SlideViewer
                    imageInfo={imageInfo}
                    apiBaseUrl={apiBaseUrl}
                    authToken={authToken}
                    tokenQueryParam={tokenQueryParam}
                    fetchFn={fetchFn}
                    apiHeaders={apiHeaders}
                    showInfoBar={showInfoBar}
                    height="100%"
                    width="100%"
                    strokeWidth={config.roiSettings?.strokeWidth ?? 2}
                    osdOptions={config.viewerOptions as never}
                    onToolkitReady={setToolkit}
                    onApiError={onApiError}
                    disableVisibilityCheck={disableVisibilityCheck}
                    onViewerReady={onViewerReady}
                    onViewportChange={onViewportChange}
                    manageAnnotationsExternally
                />
            </div>

            <AnnotationEditorOverlays
                contextMenu={contextMenu}
                annotationTypes={annotationTypes}
                handleContextMenuChangeType={handleContextMenuChangeType}
                handleContextMenuEditShape={handleContextMenuEditShape}
                handleContextMenuDelete={handleContextMenuDelete}
                notification={notification}
                showDuplicateWarning={showDuplicateWarning}
                setShowDuplicateWarning={setShowDuplicateWarning}
                annotationDocumentName={config.annotationDocumentName}
                hoverInfo={hoverInfo}
                hoverInfoMode={hoverInfoMode}
                labelHoverActions={labelHoverActions}
            />
        </div>
    )
})

AnnotationEditor.displayName = 'AnnotationEditor'
