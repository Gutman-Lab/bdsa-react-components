import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import OpenSeadragon from 'openseadragon'
import type { AnnotationToolkit } from 'osd-paperjs-annotation'
import { SlideViewer } from '../SlideViewer/SlideViewer'
import type {
    AnnotationEditorProps,
    LocalAnnotationElement,
    LocalPolylineElement,
} from './AnnotationEditor.types'
import {
    normalizeCssColor,
    resolveItemId,
    resolveStrokeColor,
    resolveFillColor,
} from './AnnotationEditor.utils'
import { AnnotationEditorPolygonsToolbar } from './AnnotationEditorPolygons.Toolbar'
import { createApiError } from '../../utils/apiErrorHandling'
import './AnnotationEditor.css'

type AnyElement = LocalAnnotationElement | LocalPolylineElement

interface PolyDoc {
    name: string
    description: string
    elements: AnyElement[]
}

/**
 * AnnotationEditorPolygons — same single viewer as AnnotationEditor but uses the
 * polygon tool for tissue-boundary annotation. ROIs are drawn elsewhere (AnnotationEditor)
 * and loaded here as read-only context. Non-selected ROIs are dimmed so the active
 * one stands out. Polygon annotations are stored in the same DSA document using
 * label.value = ROI label to associate each polygon with its parent ROI.
 */
export function AnnotationEditorPolygons({
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
    const [toolkit, setToolkit] = useState<AnnotationToolkit | null>(null)
    const [localDocument, setLocalDocument] = useState<PolyDoc | null>(null)
    const [annotationDocumentId, setAnnotationDocumentId] = useState<string | null>(null)
    const [selectedRoiIndex, setSelectedRoiIndex] = useState(-1)
    const [selectedTypeIndex, setSelectedTypeIndex] = useState(0)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [isLoadingAnnotation, setIsLoadingAnnotation] = useState(false)
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    const roiItemsRef = useRef<any[]>([])
    const labelItemsRef = useRef<any[]>([])
    const localDocumentRef = useRef<PolyDoc | null>(null)
    const selectedTypeIndexRef = useRef(0)
    const selectedRoiLabelRef = useRef<string | null>(null)
    const foreignElementsRef = useRef<any[]>([])

    // ── Register tools once when toolkit is ready ─────────────────────────
    useEffect(() => {
        if (!toolkit) return
        ;(toolkit as any).addTools(['default', 'polygon'])
    }, [toolkit])

    // ── Keep refs current ─────────────────────────────────────────────────
    useEffect(() => { localDocumentRef.current = localDocument }, [localDocument])
    useEffect(() => { selectedTypeIndexRef.current = selectedTypeIndex }, [selectedTypeIndex])

    // ── Derive ROI list (sorted by trailing number) ───────────────────────
    const rois = useMemo(() => {
        if (!localDocument) return []
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

    // Keep ROI label ref in sync with selected ROI
    useEffect(() => {
        selectedRoiLabelRef.current = rois[selectedRoiIndex]?.label ?? null
    }, [selectedRoiIndex, rois])

    // ── Load annotation document when toolkit first becomes ready ─────────
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
                const listRes = await doFetch(`${apiBaseUrl}/annotation/item/${itemId}`, { headers })
                if (cancelled) return
                if (!listRes.ok) throw new Error(`${listRes.status} ${listRes.statusText}`)
                const annotationList: any[] = await listRes.json()
                if (cancelled) return

                const matching = annotationList.filter(
                    (a: any) => a.annotation?.name === config.annotationDocumentName
                )
                if (matching.length === 0) return

                const docId: string = matching[0]._id
                const docRes = await doFetch(`${apiBaseUrl}/annotation/${docId}`, { headers })
                if (cancelled) return
                if (!docRes.ok) throw new Error(`${docRes.status} ${docRes.statusText}`)
                const docFull: any = await docRes.json()
                if (cancelled) return

                const knownGroups = new Set([
                    'ROI',
                    ...config.annotationTypes.map(t => t.name),
                ])
                const rawElements: any[] = docFull.annotation?.elements ?? []
                const knownRaw = rawElements.filter(el => knownGroups.has(el.group ?? ''))
                foreignElementsRef.current = rawElements.filter(el => !knownGroups.has(el.group ?? ''))

                // Partition: ROI rectangles + known-type polylines are editable;
                // known-type rectangles (from box editor) go to foreignElementsRef.
                const editableRaw: any[] = []
                const boxAnnotations: any[] = []
                for (const el of knownRaw) {
                    if (el.group === 'ROI') {
                        editableRaw.push(el)
                    } else if (el.type === 'polyline') {
                        editableRaw.push(el)
                    } else {
                        // Rectangle annotations from the box editor — preserve, don't render
                        boxAnnotations.push(el)
                    }
                }
                foreignElementsRef.current = [...foreignElementsRef.current, ...boxAnnotations]

                const elements: AnyElement[] = editableRaw.map((el: any): AnyElement => {
                    if (el.type === 'polyline') {
                        return {
                            type: 'polyline',
                            group: el.group ?? '',
                            label: typeof el.label === 'string'
                                ? { value: el.label }
                                : (el.label ?? { value: '' }),
                            points: el.points ?? [],
                            closed: el.closed ?? true,
                            lineColor: normalizeCssColor(el.lineColor ?? '#ff0000'),
                            lineWidth: el.lineWidth ?? 2,
                            fillColor: normalizeCssColor(el.fillColor ?? 'rgba(0,0,0,0)'),
                            ...(el.user != null ? { user: el.user } : {}),
                        } satisfies LocalPolylineElement
                    }
                    return {
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
                    } satisfies LocalAnnotationElement
                })

                setLocalDocument({
                    name: docFull.annotation.name,
                    description: docFull.annotation.description ?? '',
                    elements,
                })
                setAnnotationDocumentId(docId)

                // Render ROI rectangles
                const roiElements = elements.filter(
                    (e): e is LocalAnnotationElement => e.type === 'rectangle' && e.group === 'ROI'
                )
                if (roiElements.length > 0) {
                    const roiCollection = {
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
                    ;(toolkit as any).loadGeoJSON([roiCollection], false)
                    const groups = (toolkit as any).getFeatureCollectionGroups()
                    if (groups.length > 0) {
                        roiItemsRef.current = Array.from(groups[groups.length - 1].children)
                    }
                }

                // Render existing polygon annotations
                const polylineElements = elements.filter(
                    (e): e is LocalPolylineElement => e.type === 'polyline'
                )
                if (polylineElements.length > 0) {
                    const polyCollection = {
                        type: 'FeatureCollection',
                        label: `${config.annotationDocumentName} - Polygons`,
                        features: polylineElements.map(el => {
                            const coords = el.points.map(([x, y]) => [x, y] as [number, number])
                            // GeoJSON Polygon requires a closed ring
                            if (coords.length > 0) {
                                const [fx, fy] = coords[0]
                                const [lx, ly] = coords[coords.length - 1]
                                if (fx !== lx || fy !== ly) coords.push(coords[0])
                            }
                            return {
                                type: 'Feature',
                                geometry: { type: 'Polygon', coordinates: [coords] },
                                properties: {
                                    label: el.label.value,
                                    strokeColor: el.lineColor,
                                    strokeWidth: el.lineWidth,
                                    fillColor: el.fillColor,
                                    rescale: { strokeWidth: el.lineWidth },
                                },
                            }
                        }),
                        properties: {},
                    }
                    ;(toolkit as any).loadGeoJSON([polyCollection], false)
                    const allGroups = (toolkit as any).getFeatureCollectionGroups()
                    if (allGroups.length > 0) {
                        labelItemsRef.current = Array.from(allGroups[allGroups.length - 1].children)
                    }
                }

                if (roiElements.length > 0) setSelectedRoiIndex(0)
            } catch (err) {
                if (cancelled) return
                console.error('[AnnotationEditorPolygons] Failed to load annotations:', err)
                notify('error', 'Failed to load existing annotations.', 4000)
            } finally {
                if (!cancelled) setIsLoadingAnnotation(false)
            }
        })()

        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toolkit])

    // ── Polygon drawing — active whenever toolkit is ready ────────────────
    useEffect(() => {
        if (!toolkit) return

        const polygonTool = (toolkit as any).getTool('polygon')
        const defaultTool = (toolkit as any).getTool('default')
        if (!polygonTool || !defaultTool) return

        const onItemCreated = (payload: any) => {
            const item = payload?.item
            if (!item) return

            const typeIdx = selectedTypeIndexRef.current
            const annotationType = config.annotationTypes[typeIdx]
            if (!annotationType) { item.remove(); return }

            // Extract points from the CompoundPath outer ring
            const ring = item.children?.[0] || item
            const points: [number, number, number][] = (ring.segments ?? []).map((s: any) =>
                [Math.round(s.point.x), Math.round(s.point.y), 0] as [number, number, number]
            )
            if (points.length < 3) { item.remove(); return }

            // Apply type colors to the drawn item
            try { item.strokeColor = normalizeCssColor(resolveStrokeColor(annotationType)) } catch { /* ignore */ }
            try { item.fillColor = normalizeCssColor(resolveFillColor(annotationType)) } catch { /* ignore */ }

            const newElement: LocalPolylineElement = {
                type: 'polyline',
                group: annotationType.name,
                label: { value: selectedRoiLabelRef.current ?? '' },
                points,
                closed: true,
                lineColor: normalizeCssColor(resolveStrokeColor(annotationType)),
                lineWidth: annotationType.strokeWidth ?? 2,
                fillColor: normalizeCssColor(resolveFillColor(annotationType)),
                ...(selectedRoiLabelRef.current != null
                    ? { user: { roiLabel: selectedRoiLabelRef.current } }
                    : {}),
            }

            setLocalDocument(prev => {
                const elements = prev?.elements ?? []
                return prev
                    ? { ...prev, elements: [...elements, newElement] }
                    : {
                        name: config.annotationDocumentName,
                        description: config.annotationDescription ?? '',
                        elements: [newElement],
                    }
            })
            labelItemsRef.current.push(item)

            // Reactivate for the next polygon
            setTimeout(() => { polygonTool.activate() }, 0)
        }

        polygonTool.addEventListener('item-created', onItemCreated)
        polygonTool.activate()

        return () => {
            polygonTool.removeEventListener('item-created', onItemCreated)
            defaultTool.activate()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toolkit, config])

    // ── Dim non-selected ROI items ────────────────────────────────────────
    useEffect(() => {
        if (!toolkit) return
        const selectedRoi = rois[selectedRoiIndex]
        roiItemsRef.current.forEach((item, i) => {
            if (!item) return
            item.opacity = !selectedRoi || i === selectedRoi.roiIndex ? 1 : 0.15
        })
    }, [toolkit, selectedRoiIndex, rois])

    // ── Zoom to selected ROI ──────────────────────────────────────────────
    const zoomToRoiByIndex = useCallback((roiIndex: number) => {
        if (!toolkit) return
        const viewer = (toolkit as any).viewer
        if (!viewer?.viewport) return
        let roiCount = 0
        const el = localDocumentRef.current?.elements.find(e => {
            if (e.group !== 'ROI') return false
            return roiCount++ === roiIndex
        })
        if (!el || el.type !== 'rectangle') return
        const pad = 0.1
        const x = el.center[0] - el.width / 2 - el.width * pad
        const y = el.center[1] - el.height / 2 - el.height * pad
        const w = el.width * (1 + 2 * pad)
        const h = el.height * (1 + 2 * pad)
        const rect = new (OpenSeadragon as any).Rect(x, y, w, h)
        const vpRect = viewer.viewport.imageToViewportRectangle(rect)
        viewer.viewport.fitBounds(vpRect)
    }, [toolkit])

    const zoomedForRoiIndexRef = useRef(-2)
    useEffect(() => {
        if (!toolkit || selectedRoiIndex < 0) return
        if (selectedRoiIndex === zoomedForRoiIndexRef.current) return
        zoomedForRoiIndexRef.current = selectedRoiIndex
        const roi = rois[selectedRoiIndex]
        if (roi) zoomToRoiByIndex(roi.roiIndex)
    }, [toolkit, selectedRoiIndex, rois, zoomToRoiByIndex])

    // ── Undo last drawn polygon ───────────────────────────────────────────
    const undoLastPolygon = useCallback(() => {
        if (labelItemsRef.current.length === 0) return
        const item = labelItemsRef.current.pop()
        if (item) item.remove()
        setLocalDocument(prev => {
            if (!prev) return prev
            const elements = [...prev.elements]
            for (let i = elements.length - 1; i >= 0; i--) {
                if (elements[i].type === 'polyline') {
                    elements.splice(i, 1)
                    break
                }
            }
            return { ...prev, elements }
        })
    }, [])

    // ── Q / W keyboard shortcuts to cycle annotation types ────────────────
    useEffect(() => {
        const types = config.annotationTypes ?? []
        if (types.length === 0) return
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toUpperCase()
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            if (e.key.toLowerCase() === 'q') {
                e.preventDefault()
                setSelectedTypeIndex(prev => (prev - 1 + types.length) % types.length)
            } else if (e.key.toLowerCase() === 'w') {
                e.preventDefault()
                setSelectedTypeIndex(prev => (prev + 1) % types.length)
            } else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                undoLastPolygon()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [config.annotationTypes, undoLastPolygon])

    // ── Notification helper ───────────────────────────────────────────────
    const notify = useCallback((type: 'success' | 'error', message: string, durationMs: number) => {
        setNotification({ type, message })
        setTimeout(() => setNotification(null), durationMs)
    }, [])

    // ── Save to DSA ───────────────────────────────────────────────────────
    const saveAnnotation = useCallback(async () => {
        setSaveStatus('saving')

        if (!localDocument) {
            setSaveStatus('error')
            notify('error', 'Nothing to save yet.', 3000)
            setTimeout(() => setSaveStatus('idle'), 3000)
            return
        }
        if (!apiBaseUrl) {
            setSaveStatus('error')
            notify('error', 'No API base URL configured.', 3000)
            setTimeout(() => setSaveStatus('idle'), 3000)
            return
        }
        const itemId = resolveItemId(imageInfo)
        if (!itemId) {
            setSaveStatus('error')
            notify('error', 'Cannot determine item ID from imageInfo.', 3000)
            setTimeout(() => setSaveStatus('idle'), 3000)
            return
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (apiHeaders) {
            const entries =
                apiHeaders instanceof Headers
                    ? Array.from(apiHeaders.entries())
                    : Object.entries(apiHeaders as Record<string, string>)
            entries.forEach(([k, v]) => { headers[k] = v })
        }
        if (authToken) headers['Girder-Token'] = authToken

        const annotationObject = {
            name: localDocument.name,
            description: localDocument.description,
            elements: [...localDocument.elements, ...foreignElementsRef.current],
        }

        const doFetch = fetchFn ?? fetch

        try {
            let res: Response
            if (annotationDocumentId) {
                res = await doFetch(`${apiBaseUrl}/annotation/${annotationDocumentId}`, {
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
                    const body = await res.json() as Record<string, unknown>
                    if (body.message) detail += `: ${body.message}`
                } catch { /* body not JSON */ }
                throw Object.assign(new Error(detail), { status: res.status, statusText: res.statusText })
            }

            if (!annotationDocumentId) {
                let newId: string | undefined
                try {
                    const saved: unknown = await res.json()
                    const candidate = Array.isArray(saved) ? (saved[0] as any) : (saved as any)
                    newId = candidate?._id ?? candidate?.annotation?._id
                } catch { /* ignore */ }

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
            notify('success', 'Saved successfully.', 2500)
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
        localDocument, apiBaseUrl, imageInfo, apiHeaders, authToken,
        fetchFn, annotationDocumentId, onApiError, notify,
    ])

    return (
        <div className={`annotation-editor ${className}`} style={style}>
            <AnnotationEditorPolygonsToolbar
                rois={rois}
                selectedRoiIndex={selectedRoiIndex}
                setSelectedRoiIndex={setSelectedRoiIndex}
                annotationTypes={config.annotationTypes ?? []}
                selectedTypeIndex={selectedTypeIndex}
                setSelectedTypeIndex={setSelectedTypeIndex}
                saveStatus={saveStatus}
                saveAnnotation={() => { void saveAnnotation() }}
                isLoadingAnnotation={isLoadingAnnotation}
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

            {/* Notification toast */}
            {notification && (
                <div style={{
                    position: 'absolute',
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: notification.type === 'success' ? '#22c55e' : '#ef4444',
                    color: 'white',
                    padding: '8px 20px',
                    borderRadius: 6,
                    fontFamily: 'sans-serif',
                    fontSize: 13,
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    pointerEvents: 'none',
                }}>
                    {notification.message}
                </div>
            )}
        </div>
    )
}
