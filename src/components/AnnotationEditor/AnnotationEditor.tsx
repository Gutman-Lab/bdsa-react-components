import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { AnnotationToolkit } from 'osd-paperjs-annotation'
import { SlideViewer } from '../SlideViewer/SlideViewer'
import type {
    AnnotationEditorProps,
    EditorMode,
    WorkflowMode,
    LocalAnnotationDocument,
    LocalAnnotationElement,
} from './AnnotationEditor.types'
import { createApiError } from '../../utils/apiErrorHandling'
import './AnnotationEditor.css'

/**
 * Converts any CSS color string to a format accepted by DSA's schema
 * (#rrggbb, #rrggbbaa, rgb(...), rgba(...)).
 * Named colors (e.g. "black", "orange") are resolved via an offscreen canvas.
 */
function normalizeCssColor(color: string): string {
    if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color
    if (/^rgba?\(/.test(color)) return color
    try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        if (a === 255) {
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        }
        return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
    } catch {
        return color
    }
}

/**
 * Extracts the DSA item ID from imageInfo.
 * Supports explicit imageId or parses from a DZI URL like /api/v1/item/{id}/tiles/dzi.dzi
 */
function resolveItemId(imageInfo: AnnotationEditorProps['imageInfo']): string | null {
    if (imageInfo.imageId != null) return String(imageInfo.imageId)
    if (imageInfo.dziUrl) {
        const m = imageInfo.dziUrl.match(/\/item\/([^/]+)\//)
        return m ? m[1] : null
    }
    return null
}

/** Returns the lowest positive integer not already used as a label suffix. */
function computeNextRoiLabel(elements: LocalAnnotationElement[], labelBase: string): string {
    const usedNumbers = new Set(
        elements
            .filter(e => e.group === 'ROI')
            .map(e => {
                const m = e.label.value.match(new RegExp(`^${labelBase}(\\d+)$`))
                return m ? parseInt(m[1], 10) : null
            })
            .filter((n): n is number => n !== null)
    )
    let next = 1
    while (usedNumbers.has(next)) next++
    return `${labelBase}${next}`
}

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
    // Tracks whether the add-labels drawing loop is still active
    const addLabelsActiveRef = useRef(false)

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

                // 4. Convert DSA elements to LocalAnnotationElement[]
                const elements: LocalAnnotationElement[] = (docFull.annotation?.elements ?? []).map(
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

    // ── Q / W keyboard shortcuts to cycle annotation types ────────────────
    useEffect(() => {
        if (annotationTypes.length === 0) return
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toUpperCase()
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            if (e.key.toLowerCase() === 'q') {
                e.preventDefault()
                setSelectedTypeIndex(prev => (prev - 1 + annotationTypes.length) % annotationTypes.length)
            } else if (e.key.toLowerCase() === 'w') {
                e.preventDefault()
                setSelectedTypeIndex(prev => (prev + 1) % annotationTypes.length)
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

        const onItemCreated = (payload: any) => {
            const item = payload?.item
            if (!item) return

            const b = item.bounds
            const typeIdx = selectedTypeIndexRef.current
            const annotationType = types[typeIdx]

            if (b && b.width >= 5 && b.height >= 5 && annotationType) {
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
                    }
                    return prev
                        ? { ...prev, elements: [...elements, newElement] }
                        : {
                              name: config.annotationDocumentName,
                              description: config.annotationDescription ?? '',
                              elements: [newElement],
                          }
                })
            } else {
                item.remove()
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

        // The annotation object sent in both calls (no wrapper for PUT, wrapped for POST)
        const annotationObject = {
            name: localDocument.name,
            description: localDocument.description,
            elements: localDocument.elements,
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
                const saved: unknown = await res.json()
                const id = Array.isArray(saved)
                    ? (saved[0] as Record<string, string>)?._id
                    : (saved as Record<string, string>)?._id
                if (id) setAnnotationDocumentId(id)
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

    // ── Sync canvas selection highlight with the dropdown ─────────────────
    useEffect(() => {
        // Don't interfere while the user is placing a new ROI or editing one
        if (!toolkit || activeMode === 'drawing-roi' || activeMode === 'add-roi') return

        if (selectedRoiIndex >= 0) {
            const roi = rois[selectedRoiIndex]
            if (roi) {
                const item = roiItemsRef.current[roi.roiIndex]
                // select() automatically deselects all other items first
                if (item) item.select()
            }
        } else {
            // Deselect all committed items
            roiItemsRef.current.forEach(item => {
                if (item) item.deselect(true)
            })
        }
    }, [toolkit, selectedRoiIndex, activeMode, rois])

    return (
        <div className={`annotation-editor ${className}`} style={style}>
            {/* ── Toolbar ─────────────────────────────────────────── */}
            <div className="annotation-editor__toolbar">
                {/* ROI selector */}
                <div className="annotation-editor__toolbar-group">
                    <span className="annotation-editor__roi-label">ROI:</span>
                    <select
                        className="annotation-editor__roi-select"
                        value={selectedRoiIndex}
                        onChange={e => setSelectedRoiIndex(Number(e.target.value))}
                        disabled={rois.length === 0}
                    >
                        {rois.length === 0 ? (
                            <option value={-1}>— no ROIs loaded —</option>
                        ) : (
                            <>
                                <option value={-1}>Unselect ROI</option>
                                {rois.map((roi, i) => (
                                    <option key={i} value={i}>
                                        {roi.label}
                                    </option>
                                ))}
                            </>
                        )}
                    </select>

                    <label className="annotation-editor__checkbox-label">
                        <input
                            type="checkbox"
                            checked={markComplete}
                            onChange={e => setMarkComplete(e.target.checked)}
                            disabled={selectedRoiIndex < 0}
                        />
                        Mark Complete
                    </label>

                    <select
                        className="annotation-editor__roi-select"
                        value={workflowMode}
                        onChange={e => { setWorkflowMode(e.target.value as WorkflowMode); e.target.blur() }}
                    >
                        <option value="edit-rois">Edit ROIs</option>
                        <option value="add-labels">Add Labels</option>
                        <option value="review">Review</option>
                    </select>
                </div>

                <div className="annotation-editor__toolbar-divider" />

                {/* Annotation type selector — visible in Add Labels workflow */}
                {workflowMode === 'add-labels' && annotationTypes.length > 0 && (
                    <div className="annotation-editor__mode-group">
                        <span className="annotation-editor__roi-label">Type:</span>
                        <span
                            className="annotation-editor__type-swatch"
                            style={{ backgroundColor: annotationTypes[selectedTypeIndex]?.color ?? 'transparent' }}
                        />
                        <select
                            className="annotation-editor__roi-select"
                            value={selectedTypeIndex}
                            onChange={e => { setSelectedTypeIndex(Number(e.target.value)); e.target.blur() }}
                        >
                            {annotationTypes.map((t, i) => (
                                <option key={i} value={i}>{t.name}</option>
                            ))}
                        </select>
                        <span className="annotation-editor__roi-label" style={{ opacity: 0.55 }}>Q / W to cycle</span>
                    </div>
                )}

                {/* Mode buttons — only visible in Edit ROIs workflow */}
                {workflowMode === 'edit-rois' && (
                    <div className="annotation-editor__mode-group">
                        {activeMode === 'drawing-roi' ? (
                            <>
                                <button
                                    className="annotation-editor__mode-btn annotation-editor__mode-btn--finish"
                                    onClick={finishEditingRoi}
                                    title="Accept the drawn ROI and save it"
                                >
                                    Finish editing
                                </button>
                                <button
                                    className="annotation-editor__mode-btn annotation-editor__mode-btn--danger annotation-editor__mode-btn--cancel"
                                    onClick={cancelPendingRoi}
                                    title="Discard the drawn ROI"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Fixed-size controls */}
                                <label className="annotation-editor__checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={fixedSizeEnabled}
                                        onChange={e => setFixedSizeEnabled(e.target.checked)}
                                    />
                                    Fixed size
                                </label>
                                {fixedSizeEnabled && (
                                    <>
                                        <span className="annotation-editor__dim-label">W:</span>
                                        <input
                                            className="annotation-editor__dim-input"
                                            type="number"
                                            min={1}
                                            value={fixedWidth}
                                            onChange={e => setFixedWidth(Math.max(1, Number(e.target.value)))}
                                            title="Fixed ROI width in image pixels"
                                        />
                                        <span className="annotation-editor__dim-label">H:</span>
                                        <input
                                            className="annotation-editor__dim-input"
                                            type="number"
                                            min={1}
                                            value={fixedHeight}
                                            onChange={e => setFixedHeight(Math.max(1, Number(e.target.value)))}
                                            title="Fixed ROI height in image pixels"
                                        />
                                    </>
                                )}

                                <button
                                    className={`annotation-editor__mode-btn${activeMode === 'add-roi' ? ' annotation-editor__mode-btn--active' : ''}`}
                                    onClick={() => {
                                        if (activeMode === 'add-roi') {
                                            setActiveMode(null)
                                        } else {
                                            setSelectedRoiIndex(-1)
                                            setActiveMode('add-roi')
                                        }
                                    }}
                                    title={fixedSizeEnabled ? 'Click on slide to place a fixed-size ROI' : 'Draw a new ROI rectangle on the slide'}
                                >
                                    Add ROI
                                </button>
                                <button
                                    className="annotation-editor__mode-btn"
                                    onClick={startEditActiveRoi}
                                    disabled={selectedRoiIndex < 0}
                                    title="Edit the currently selected ROI"
                                >
                                    Edit Active ROI
                                </button>
                                <button
                                    className="annotation-editor__mode-btn annotation-editor__mode-btn--danger"
                                    onClick={deleteActiveRoi}
                                    disabled={selectedRoiIndex < 0}
                                    title="Delete the currently selected ROI"
                                >
                                    Delete Active ROI
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Spacer pushes save button to the far right */}
                <div style={{ flex: 1 }} />

                {/* Loading indicator */}
                {isLoadingAnnotation && (
                    <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                        Loading annotations…
                    </span>
                )}

                {/* Save button */}
                <button
                    className={`annotation-editor__mode-btn annotation-editor__mode-btn--save${saveStatus === 'error' ? ' annotation-editor__mode-btn--save--error' : saveStatus === 'saved' ? ' annotation-editor__mode-btn--save--saved' : ''}`}
                    onClick={() => { void saveAnnotation() }}
                    disabled={
                        saveStatus === 'saving' ||
                        (resolveItemId(imageInfo) === null && !localDocument)
                    }
                    title="Save annotations to DSA"
                >
                    {saveStatus === 'saving'
                        ? 'Saving…'
                        : saveStatus === 'saved'
                          ? 'Saved ✓'
                          : saveStatus === 'error'
                            ? 'Save failed'
                            : 'Save'}
                </button>
            </div>

            {/* ── SlideViewer ──────────────────────────────────────── */}
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

            {/* ── Save notification toast ──────────────────────────── */}
            {notification && (
                <div className={`annotation-editor__toast annotation-editor__toast--${notification.type}`}>
                    {notification.message}
                </div>
            )}

            {/* ── Duplicate document warning ───────────────────────── */}
            {showDuplicateWarning && (
                <div className="annotation-editor__modal-backdrop">
                    <div className="annotation-editor__modal" role="dialog" aria-modal="true">
                        <div className="annotation-editor__modal-title">
                            <span className="annotation-editor__modal-icon">⚠️</span>
                            Multiple annotation documents found
                        </div>
                        <div className="annotation-editor__modal-body">
                            More than one annotation document named{' '}
                            <strong>"{config.annotationDocumentName}"</strong> was found on the
                            server.
                            <br />
                            <br />
                            The first document has been loaded. Please remove the duplicate(s) on
                            the DSA server to avoid data conflicts.
                        </div>
                        <div className="annotation-editor__modal-footer">
                            <button
                                className="annotation-editor__modal-ok-btn"
                                onClick={() => setShowDuplicateWarning(false)}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
