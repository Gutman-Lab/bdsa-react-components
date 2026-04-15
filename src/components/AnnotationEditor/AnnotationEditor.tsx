import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import OpenSeadragon from 'openseadragon'
import type { AnnotationToolkit } from 'osd-paperjs-annotation'
import { SlideViewer } from '../SlideViewer/SlideViewer'
import type {
    AnnotationEditorProps,
    EditorMode,
    WorkflowMode,
    LocalAnnotationDocument,
    LocalAnnotationElement,
} from './AnnotationEditor.types'
import { normalizeCssColor, resolveItemId, computeNextRoiLabel } from './AnnotationEditor.utils'
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
export function AnnotationEditor({
    imageInfo,
    config,
    apiBaseUrl,
    authToken,
    tokenQueryParam,
    fetchFn,
    apiHeaders,
    showInfoBar = true,
    className = '',
    style,
    onApiError,
}: AnnotationEditorProps) {
    const [selectedRoiIndex, setSelectedRoiIndex] = useState<number>(-1)
    const [markComplete, setMarkComplete] = useState(false)
    const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('edit-rois')
    const [activeMode, setActiveMode] = useState<EditorMode | null>(null)
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
    // DSA document ID — null until saved/loaded for the first time
    const [annotationDocumentId, setAnnotationDocumentId] = useState<string | null>(null)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [isLoadingAnnotation, setIsLoadingAnnotation] = useState(false)
    // Fixed-size ROI placement
    const [fixedSizeEnabled, setFixedSizeEnabled] = useState(false)
    const [fixedWidth, setFixedWidth] = useState(() => config.roiSettings?.width ?? 1000)
    const [fixedHeight, setFixedHeight] = useState(() => config.roiSettings?.height ?? 1000)

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
    // Tracks whether the add-labels drawing loop is still active
    const addLabelsActiveRef = useRef(false)
    // Paper.js item refs for label elements — parallel to the ordered label elements in localDocument
    const labelItemsRef = useRef<any[]>([])
    // Right-click context menu for label items in add-labels mode
    const [contextMenu, setContextMenu] = useState<{
        x: number; y: number; itemIdx: number; item: any
    } | null>(null)
    // State for editing an existing label's shape via the context menu
    const [isEditingLabel, setIsEditingLabel] = useState(false)
    const editingLabelRef = useRef<{
        item: any; docElementIndex: number
        originalSegments: { x: number; y: number }[]
    } | null>(null)
    // Exposed so finishEditingLabel / cancelEditingLabel can resume the drawing loop
    const reactivateLabelDrawingRef = useRef<() => void>(() => {})
    // Raw DSA element objects that don't belong to ROI or any known annotation type.
    // Stored as-is from the server and appended to save payloads to prevent data loss.
    const foreignElementsRef = useRef<any[]>([])

    // Review mode — index into reviewItems[] for the focused label box (-1 = none)
    const [reviewItemIndex, setReviewItemIndex] = useState(-1)
    const reviewItemIndexRef = useRef(-1)
    const changeReviewItemTypeRef = useRef<(typeIndex: number) => void>(() => {})
    // Stable ref so workflowMode is readable inside finishEditingLabel / cancelEditingLabel
    // without adding toolkit to their dependency arrays.
    const workflowModeRef = useRef<WorkflowMode>('edit-rois')
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
    const pendingSelectLabelRef = useRef<string | null>(null)
    // Refs to always-current values for use inside event-handler closures
    const localDocumentRef = useRef<LocalAnnotationDocument | null>(localDocument)
    const addRoiRef = useRef<(left: number, top: number, width: number, height: number) => void>(null as any)

    // ── Register tools once when toolkit is ready ─────────────────────────
    useEffect(() => {
        if (!toolkit) return
        ;(toolkit as any).addTools(['default', 'rectangle'])
    }, [toolkit])

    // ── Load existing annotation document when toolkit first becomes ready ─
    useEffect(() => {
        if (!toolkit) return

        const itemId = resolveItemId(imageInfo)
        if (!itemId || !apiBaseUrl) return

        let cancelled = false
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
                // 1. List all annotations for this item
                const listRes = await doFetch(`${apiBaseUrl}/annotation/item/${itemId}`, { headers })
                if (cancelled) return
                if (!listRes.ok) throw new Error(`${listRes.status} ${listRes.statusText}`)
                const annotationList: any[] = await listRes.json()
                if (cancelled) return

                // 2. Filter to those matching the configured document name
                const matching = annotationList.filter(
                    (a: any) => a.annotation?.name === config.annotationDocumentName
                )

                if (matching.length === 0) return // No existing document — start fresh

                if (matching.length > 1) {
                    setShowDuplicateWarning(true) // Warn user; we take the first one
                }

                const docId: string = matching[0]._id

                // 3. Fetch the full annotation document (with elements)
                const docRes = await doFetch(`${apiBaseUrl}/annotation/${docId}`, { headers })
                if (cancelled) return
                if (!docRes.ok) throw new Error(`${docRes.status} ${docRes.statusText}`)
                const docFull: any = await docRes.json()
                if (cancelled) return

                // 4. Partition DSA elements into known (ROI / annotation types) and foreign.
                // Foreign elements are preserved verbatim so save never strips them.
                const knownGroups = new Set([
                    'ROI',
                    ...config.annotationTypes.map(t => t.name),
                ])
                const rawElements: any[] = docFull.annotation?.elements ?? []
                const knownRaw = rawElements.filter(el => knownGroups.has(el.group ?? ''))
                foreignElementsRef.current = rawElements.filter(el => !knownGroups.has(el.group ?? ''))

                const elements: LocalAnnotationElement[] = knownRaw.map(
                    (el: any): LocalAnnotationElement => ({
                        type: 'rectangle',
                        group: el.group ?? '',
                        label: typeof el.label === 'string'
                            ? { value: el.label }
                            : (el.label ?? { value: '' }),
                        center: el.center ?? [0, 0, 0],
                        width: el.width ?? 0,
                        height: el.height ?? 0,
                        rotation: el.rotation ?? 0,
                        lineColor: normalizeCssColor(el.lineColor ?? '#ffa500'),
                        lineWidth: el.lineWidth ?? 1,
                        fillColor: normalizeCssColor(el.fillColor ?? 'rgba(0,0,0,0.05)'),
                        ...(el.user != null ? { user: el.user } : {}),
                    })
                )

                setLocalDocument({
                    name: docFull.annotation.name,
                    description: docFull.annotation.description ?? '',
                    elements,
                })
                setAnnotationDocumentId(docId)

                // 5. Render ROI elements on the canvas via loadGeoJSON
                const roiElements = elements.filter(e => e.group === 'ROI')
                if (roiElements.length > 0) {
                    const featureCollection = {
                        type: 'FeatureCollection',
                        label: config.annotationDocumentName,
                        features: roiElements.map(el => ({
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [el.center[0], el.center[1]],
                                properties: {
                                    subtype: 'Rectangle',
                                    width: el.width,
                                    height: el.height,
                                    angle: el.rotation,
                                },
                            },
                            properties: {
                                label: el.label.value,
                                strokeColor: el.lineColor,
                                strokeWidth: el.lineWidth,
                                fillColor: el.fillColor,
                                rescale: { strokeWidth: el.lineWidth },
                            },
                        })),
                        properties: {},
                    }

                    ;(toolkit as any).loadGeoJSON([featureCollection], false)

                    // 6. Store paper.js item refs from the new feature collection group
                    const groups = (toolkit as any).getFeatureCollectionGroups()
                    if (groups.length > 0) {
                        roiItemsRef.current = Array.from(groups[groups.length - 1].children)
                    }
                }

                // 7. Render known annotation-type elements (label boxes) on canvas.
                // These are rendered for visual context but not tracked in roiItemsRef.
                // Foreign elements (unrecognized group names) are intentionally skipped —
                // they stay in localDocument for preservation on save but are not rendered.
                const knownTypeNames = new Set(config.annotationTypes.map(t => t.name))
                const labelElements = elements.filter(e => knownTypeNames.has(e.group))
                if (labelElements.length > 0) {
                    const labelCollection = {
                        type: 'FeatureCollection',
                        label: `${config.annotationDocumentName} - Labels`,
                        features: labelElements.map(el => ({
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [el.center[0], el.center[1]],
                                properties: {
                                    subtype: 'Rectangle',
                                    width: el.width,
                                    height: el.height,
                                    angle: el.rotation,
                                },
                            },
                            properties: {
                                label: el.label.value,
                                strokeColor: el.lineColor,
                                strokeWidth: el.lineWidth,
                                fillColor: el.fillColor,
                                rescale: { strokeWidth: el.lineWidth },
                            },
                        })),
                        properties: {},
                    }
                    ;(toolkit as any).loadGeoJSON([labelCollection], false)

                    // Capture Paper.js item refs for label elements (last loaded feature group)
                    const allGroups = (toolkit as any).getFeatureCollectionGroups()
                    if (allGroups.length > 0) {
                        labelItemsRef.current = Array.from(allGroups[allGroups.length - 1].children)
                    }
                }

                // 8. Auto-select the first ROI. This triggers the canvas-sync effect
                // which calls fitBounds — that viewport change also forces Paper.js to
                // render, solving the "annotations invisible until zoom" bug.
                if (roiElements.length > 0) {
                    setSelectedRoiIndex(0)
                }
            } catch (err) {
                if (cancelled) return
                console.error('[AnnotationEditor] Failed to load annotations:', err)
                notify('error', 'Failed to load existing annotations from server.', 4000)
            } finally {
                if (!cancelled) setIsLoadingAnnotation(false)
            }
        })()

        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toolkit])

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
            .filter(e => e.group === 'ROI')
            .map((e, roiIndex) => ({ label: e.label.value, roiIndex }))
            .sort((a, b) => {
                const na = trailingNum(a.label)
                const nb = trailingNum(b.label)
                return na !== nb ? na - nb : a.label.localeCompare(b.label)
            })
    }, [localDocument])

    const roiCompletedCount = useMemo(() => {
        if (!localDocument) return 0
        return localDocument.elements.filter(e => e.group === 'ROI' && e.user?.complete === true).length
    }, [localDocument])

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
            const labelBase = roi.label ?? 'roi'
            const fillOpacity = roi.fillOpacity ?? 0.05

            setLocalDocument(prev => {
                const elements = prev?.elements ?? []
                const labelValue = computeNextRoiLabel(elements, labelBase)

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
                    fillColor: normalizeCssColor(`rgba(0,0,0,${fillOpacity})`),
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
    useEffect(() => { addRoiRef.current = addRoi }, [addRoi])
    useEffect(() => { selectedTypeIndexRef.current = selectedTypeIndex }, [selectedTypeIndex])
    useEffect(() => { selectedRoiLabelRef.current = rois[selectedRoiIndex]?.label ?? null }, [selectedRoiIndex, rois])
    useEffect(() => { labelFixedSizeEnabledRef.current = labelFixedSizeEnabled }, [labelFixedSizeEnabled])
    useEffect(() => { workflowModeRef.current = workflowMode }, [workflowMode])
    useEffect(() => { toolkitRef.current = toolkit }, [toolkit])
    useEffect(() => { reviewItemIndexRef.current = reviewItemIndex }, [reviewItemIndex])

    // ── Q / W keyboard shortcuts to cycle annotation types ────────────────
    useEffect(() => {
        if (annotationTypes.length === 0) return
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toUpperCase()
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            if (e.key.toLowerCase() === 'q') {
                e.preventDefault()
                const next = (selectedTypeIndexRef.current - 1 + annotationTypes.length) % annotationTypes.length
                setSelectedTypeIndex(next)
                if (workflowModeRef.current === 'review') changeReviewItemTypeRef.current(next)
            } else if (e.key.toLowerCase() === 'w') {
                e.preventDefault()
                const next = (selectedTypeIndexRef.current + 1) % annotationTypes.length
                setSelectedTypeIndex(next)
                if (workflowModeRef.current === 'review') changeReviewItemTypeRef.current(next)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [annotationTypes.length])

    // ── Update placeholder color when selected type changes (no restart) ──
    // This is intentionally separate from the drawing effect so that Q/W
    // never deactivates the tool mid-draw.
    useEffect(() => {
        if (!toolkit || workflowMode !== 'add-labels') return
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
    }, [toolkit, workflowMode, selectedTypeIndex, config])

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

        addLabelsActiveRef.current = true

        const getPaperScope = () => (toolkit as any).project?.paperScope

        const getStyle = (idx: number) => {
            const t = types[idx]
            if (!t) return null
            return {
                strokeColor: normalizeCssColor(t.color),
                rescale: { strokeWidth: t.strokeWidth ?? 2 },
            }
        }

        const reactivate = () => {
            const style = getStyle(selectedTypeIndexRef.current)
            if (!style) return
            // Remove any stale placeholder so activate creates a fresh one
            // with the correct style for the current type.
            const stale = getPaperScope()?.findSelectedNewItem?.()
            if (stale) stale.remove()
            rectTool.deactivate(true)
            rectTool.activate({ createNewItem: true, style })
        }

        // Expose reactivate so finishEditingLabel / cancelEditingLabel can resume drawing
        reactivateLabelDrawingRef.current = reactivate

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
                        fillColor: 'rgba(0,0,0,0.05)',
                        ...(selectedRoiLabelRef.current != null ? { user: { roiLabel: selectedRoiLabelRef.current } } : {}),
                    }
                    return prev
                        ? { ...prev, elements: [...elements, newElement] }
                        : { name: config.annotationDocumentName, description: config.annotationDescription ?? '', elements: [newElement] }
                })
                labelItemsRef.current.push(item)
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
                            fillColor: 'rgba(0,0,0,0.05)',
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
            // Remove any undrawn placeholder so it doesn't pollute the next session
            const stale = getPaperScope()?.findSelectedNewItem?.()
            if (stale) stale.remove()
            defaultTool.activate()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toolkit, workflowMode, config])

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
                    // Compute the label that addRoi will assign so we can
                    // auto-select it after localDocument updates
                    const labelBase = (config.roiSettings?.label ?? 'roi')
                    pendingSelectLabelRef.current = computeNextRoiLabel(
                        localDocument?.elements ?? [],
                        labelBase
                    )
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

    // ── Right-click context menu for label items (add-labels + review mode) ─
    useEffect(() => {
        if (!toolkit || (workflowMode !== 'add-labels' && workflowMode !== 'review')) return
        const viewer = (toolkit as any).viewer
        if (!viewer) return
        // Use tk.paperScope directly (same as archive: this.tk.paperScope)
        const paperScope = (toolkit as any).paperScope
        if (!paperScope) return
        // The Paper.js canvas sits on top of OSD's canvas and intercepts all pointer
        // events, so OSD's canvas-contextmenu never fires. We must listen on the
        // overlay canvas element directly — exactly how the archive app does it.
        const overlayCanvas: HTMLElement | undefined = (toolkit as any).overlay?.canvas()
        if (!overlayCanvas) return

        const handleContextMenu = (event: MouseEvent) => {
            event.preventDefault()

            // Convert canvas-relative coords → image pixel coords (archive pattern)
            const rect = overlayCanvas.getBoundingClientRect()
            const x = event.clientX - rect.left
            const y = event.clientY - rect.top
            const imageCoords = viewer.viewport.viewerElementToImageCoordinates(
                new (OpenSeadragon as any).Point(x, y)
            )
            const point = new paperScope.Point(imageCoords.x, imageCoords.y)

            // Use bounds-based hit detection — paper.js project.hitTest is unreliable
            // here because items have near-transparent fills and the project traversal
            // has quirks. Iterating labelItemsRef with bounds.contains() is direct and reliable.
            let hitItem: any = null
            let itemIdx = -1
            for (let i = labelItemsRef.current.length - 1; i >= 0; i--) {
                const it = labelItemsRef.current[i]
                if (it?.bounds?.contains(point)) {
                    hitItem = it
                    itemIdx = i
                    break
                }
            }
            if (itemIdx < 0) { setContextMenu(null); return }

            setContextMenu({ x: event.clientX, y: event.clientY, itemIdx, item: hitItem })
        }

        overlayCanvas.addEventListener('contextmenu', handleContextMenu)
        return () => overlayCanvas.removeEventListener('contextmenu', handleContextMenu)
    }, [toolkit, workflowMode])

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

    const handleContextMenuChangeType = useCallback((typeIndex: number) => {
        if (!contextMenu) return
        const { itemIdx, item } = contextMenu
        const annotationType = config.annotationTypes[typeIndex]
        if (!annotationType) return

        const docIdx = findLabelDocIndex(itemIdx)
        if (docIdx < 0) { setContextMenu(null); return }

        try { item.strokeColor = normalizeCssColor(annotationType.color) } catch { /* ignore */ }

        // Sync the toolbar type dropdown regardless of which mode triggered this
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
        setContextMenu(null)
    }, [contextMenu, config.annotationTypes, findLabelDocIndex])

    const handleContextMenuEditShape = useCallback(() => {
        if (!contextMenu || !toolkit) return
        const { itemIdx, item } = contextMenu
        const docIdx = findLabelDocIndex(itemIdx)
        if (docIdx < 0) { setContextMenu(null); return }

        const rect = item.children?.[0] || item
        const originalSegments = rect.segments?.map((s: any) => ({ x: s.point.x, y: s.point.y })) ?? []
        editingLabelRef.current = { item, docElementIndex: docIdx, originalSegments }
        setIsEditingLabel(true)
        setContextMenu(null)

        item.select()
        const rectTool = (toolkit as any).getTool('rectangle')
        if (rectTool) rectTool.activate()
    }, [contextMenu, toolkit, findLabelDocIndex])

    const handleContextMenuDelete = useCallback(() => {
        if (!contextMenu) return
        const { itemIdx, item } = contextMenu
        const docIdx = findLabelDocIndex(itemIdx)
        if (docIdx < 0) { setContextMenu(null); return }

        item.remove()
        labelItemsRef.current.splice(itemIdx, 1)
        setLocalDocument(prev => {
            if (!prev) return prev
            return { ...prev, elements: prev.elements.filter((_, i) => i !== docIdx) }
        })
        setContextMenu(null)
    }, [contextMenu, findLabelDocIndex])

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
        // Pan viewport to center on the item (archive pattern)
        const viewer = toolkitRef.current ? (toolkitRef.current as any).viewer : null
        if (viewer && item.position) {
            const tiledImage = item.layer?.tiledImage
            if (tiledImage) {
                const vp = tiledImage.imageToViewportCoordinates(item.position.x, item.position.y)
                viewer.viewport.panTo(vp, true)
            }
        }
    }, [reviewItems, localDocument, config.annotationTypes])

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

    // ── Review mode hotkeys (reviewNext / reviewPrevious from config) ─────
    useEffect(() => {
        if (workflowMode !== 'review') return
        const hotkeys = config.hotkeys ?? {}
        const nextKey = (hotkeys.reviewNext ?? 'm').toLowerCase()
        const prevKey = (hotkeys.reviewPrevious ?? 'n').toLowerCase()
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toUpperCase()
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            if (e.key.toLowerCase() === nextKey || e.key === 'ArrowRight') { e.preventDefault(); reviewNextItem() }
            else if (e.key.toLowerCase() === prevKey || e.key === 'ArrowLeft') { e.preventDefault(); reviewPreviousItem() }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [workflowMode, config.hotkeys, reviewNextItem, reviewPreviousItem])

    // ── Save localDocument to DSA ─────────────────────────────────────────
    const notify = useCallback(
        (type: 'success' | 'error', message: string, durationMs: number) => {
            setNotification({ type, message })
            setTimeout(() => setNotification(null), durationMs)
        },
        []
    )

    const saveAnnotation = useCallback(async () => {
        // Always set saving immediately so the button disables visually
        setSaveStatus('saving')

        if (!localDocument) {
            setSaveStatus('error')
            notify('error', 'Nothing to save — add some ROIs first.', 3000)
            setTimeout(() => setSaveStatus('idle'), 3000)
            return
        }
        if (!apiBaseUrl) {
            setSaveStatus('error')
            notify('error', 'No API base URL configured — cannot save.', 3000)
            setTimeout(() => setSaveStatus('idle'), 3000)
            return
        }
        const itemId = resolveItemId(imageInfo)
        if (!itemId) {
            setSaveStatus('error')
            notify('error', 'Cannot determine item ID from imageInfo — cannot save.', 3000)
            setTimeout(() => setSaveStatus('idle'), 3000)
            return
        }

        // Build headers
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (apiHeaders) {
            const entries =
                apiHeaders instanceof Headers
                    ? Array.from(apiHeaders.entries())
                    : Object.entries(apiHeaders as Record<string, string>)
            entries.forEach(([k, v]) => { headers[k] = v })
        }
        if (authToken) headers['Girder-Token'] = authToken

        // The annotation object sent in both calls (no wrapper for PUT, wrapped for POST).
        // Foreign elements (unrecognized group names) are appended verbatim so they
        // are never lost when this app saves back to DSA.
        const annotationObject = {
            name: localDocument.name,
            description: localDocument.description,
            elements: [...localDocument.elements, ...foreignElementsRef.current],
        }

        const doFetch = fetchFn ?? fetch

        try {
            let res: Response
            if (annotationDocumentId) {
                // PUT expects the annotation object directly (no { annotation: ... } wrapper)
                res = await doFetch(`${apiBaseUrl}/annotation/${annotationDocumentId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(annotationObject),
                })
            } else {
                // POST expects an array of annotation objects (or full model records)
                res = await doFetch(`${apiBaseUrl}/annotation/item/${itemId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([annotationObject]),
                })
            }

            if (!res.ok) {
                let detail = `${res.status} ${res.statusText}`
                try {
                    const body = await res.json() as Record<string, unknown>
                    if (body.message) detail += `: ${body.message}`
                    else detail += `\n${JSON.stringify(body)}`
                } catch { /* body not JSON */ }
                console.error('[AnnotationEditor] Save failed —', detail, '\nPayload:', annotationObject)
                throw Object.assign(new Error(detail), { status: res.status, statusText: res.statusText })
            }

            // On first save, capture the returned _id for future PUTs
            if (!annotationDocumentId) {
                let newId: string | undefined
                try {
                    const saved: unknown = await res.json()
                    // DSA may return the annotation as a single object or an array
                    const candidate = Array.isArray(saved) ? (saved[0] as any) : (saved as any)
                    newId = candidate?._id ?? candidate?.annotation?._id
                } catch { /* body not JSON or already consumed */ }

                // Fallback: re-list annotations and find by document name
                if (!newId) {
                    try {
                        const listRes = await doFetch(`${apiBaseUrl}/annotation/item/${itemId}`, { headers })
                        if (listRes.ok) {
                            const list: any[] = await listRes.json()
                            const match = list.find((a: any) => a.annotation?.name === localDocument.name)
                            newId = match?._id
                        }
                    } catch { /* ignore */ }
                }

                if (newId) setAnnotationDocumentId(newId)
            }

            setSaveStatus('saved')
            notify('success', 'Annotation saved successfully.', 2500)
            setTimeout(() => setSaveStatus('idle'), 2500)
        } catch (err) {
            const apiErr = createApiError(err)
            setSaveStatus('error')
            notify('error', `Save failed: ${apiErr.message}`, 4000)
            onApiError?.(apiErr, () => { void saveAnnotation() }, {
                operation: annotationDocumentId ? 'update' : 'create',
                endpoint: apiBaseUrl,
            })
            setTimeout(() => setSaveStatus('idle'), 4000)
        }
    }, [
        localDocument,
        apiBaseUrl,
        imageInfo,
        apiHeaders,
        authToken,
        fetchFn,
        annotationDocumentId,
        onApiError,
        notify,
    ])

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
            fillOpacity: roi.fillOpacity ?? 0.05,
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
                const labelBase = roi.label ?? 'roi'
                pendingSelectLabelRef.current = computeNextRoiLabel(
                    localDocumentRef.current?.elements ?? [],
                    labelBase
                )
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
    }, [toolkit, activeMode, workflowMode, config, fixedSizeEnabled, fixedWidth, fixedHeight])

    // ── Auto-select the newly finished ROI in the dropdown ───────────────
    useEffect(() => {
        if (!pendingSelectLabelRef.current) return
        const idx = rois.findIndex(r => r.label === pendingSelectLabelRef.current)
        if (idx >= 0) {
            setSelectedRoiIndex(idx)
            pendingSelectLabelRef.current = null
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
                        if (workflowMode === 'add-labels') {
                            reactivateLabelDrawingRef.current()
                        }
                    }
                }
            }
        } else {
            zoomedForRoiIndexRef.current = -1
            roiItemsRef.current.forEach(item => {
                if (item) item.deselect(true)
            })
        }
    }, [toolkit, selectedRoiIndex, activeMode, workflowMode, rois, zoomToRoiByIndex])

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

    return (
        <div className={`annotation-editor ${className}`} style={style}>
            <AnnotationEditorToolbar
                rois={rois}
                selectedRoiIndex={selectedRoiIndex}
                setSelectedRoiIndex={setSelectedRoiIndex}
                markComplete={markComplete}
                setMarkComplete={handleMarkComplete}
                roiCompletedCount={roiCompletedCount}
                roiTotal={rois.length}
                workflowMode={workflowMode}
                setWorkflowMode={setWorkflowMode}
                isEditingLabel={isEditingLabel}
                finishEditingLabel={finishEditingLabel}
                cancelEditingLabel={cancelEditingLabel}
                labelFixedSizeEnabled={labelFixedSizeEnabled}
                setLabelFixedSizeEnabled={setLabelFixedSizeEnabled}
                annotationTypes={annotationTypes}
                selectedTypeIndex={selectedTypeIndex}
                setSelectedTypeIndex={setSelectedTypeIndex}
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
                isLoadingAnnotation={isLoadingAnnotation}
                saveStatus={saveStatus}
                saveAnnotation={() => { void saveAnnotation() }}
                canSave={resolveItemId(imageInfo) !== null || localDocument !== null}
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
            />
        </div>
    )
}
