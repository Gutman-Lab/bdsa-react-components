import type { LocalAnnotationElement, AnnotationEditorProps, AnnotationType, AutoSaveSettings, HotkeySettings, WorkflowMode, RoiSettings, RoiImageBounds } from './AnnotationEditor.types'

/**
 * Converts any CSS color string to a format accepted by DSA's schema
 * (#rrggbb, #rrggbbaa, rgb(...), rgba(...)).
 * Named colors (e.g. "black", "orange") are resolved via an offscreen canvas.
 */
export function normalizeCssColor(color: string): string {
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
export function resolveItemId(imageInfo: AnnotationEditorProps['imageInfo']): string | null {
    if (imageInfo.imageId != null) return String(imageInfo.imageId)
    if (imageInfo.dziUrl) {
        const m = imageInfo.dziUrl.match(/\/item\/([^/]+)\//)
        return m ? m[1] : null
    }
    return null
}

/** Returns the lowest positive integer not already used as a label suffix. */
export function computeNextRoiLabel(elements: LocalAnnotationElement[], labelBase: string): string {
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

/** YOLO-compatible ROI label when `fixedLabel` is set; otherwise numbered `{label}{n}`. */
export function resolveRoiLabelValue(
    elements: LocalAnnotationElement[],
    roiSettings?: RoiSettings,
): string {
    if (roiSettings?.fixedLabel) return roiSettings.fixedLabel
    return computeNextRoiLabel(elements, roiSettings?.label ?? 'roi')
}

/** Canvas fill opacity for ROI rectangles (0 when the user hides fill). */
export function effectiveRoiFillOpacity(
    fillVisible: boolean,
    roiSettings?: RoiSettings,
): number {
    if (!fillVisible) return 0
    return roiSettings?.fillOpacity ?? 0.05
}

const BDSA_ROI_FILL_STASH = '_bdsaOriginalFillColor'
const BDSA_ROI_FILL_PROPS_STASH = '_bdsaOriginalFillColorProp'

type PaperStyleNode = {
    fillColor?: { alpha?: number } | string | null
    fillOpacity?: number
    updateFillOpacity?: () => void
    annotationItem?: { _props?: Record<string, unknown> }
    descendants?: PaperStyleNode[]
    children?: PaperStyleNode[]
    [BDSA_ROI_FILL_STASH]?: unknown
}

function collectPaperStyleNodes(root: unknown): PaperStyleNode[] {
    const node = root as PaperStyleNode
    if (!node || typeof node !== 'object') return []
    const seen = new Set<unknown>()
    const out: PaperStyleNode[] = []
    const add = (n: PaperStyleNode | undefined) => {
        if (!n || typeof n !== 'object' || seen.has(n)) return
        seen.add(n)
        out.push(n)
    }
    add(node)
    if (Array.isArray(node.descendants)) {
        for (const d of node.descendants) add(d)
    } else {
        const stack = [...(node.children ?? [])]
        while (stack.length) {
            const c = stack.pop()
            if (!c) continue
            add(c)
            if (c.children?.length) stack.push(...c.children)
        }
    }
    return out
}

/** Show or hide ROI interior fill on Paper.js items (group + inner path). */
export function applyRoiFillVisibilityToPaperItem(
    item: unknown,
    fillVisible: boolean,
    roiSettings?: RoiSettings,
): void {
    if (!item || typeof item !== 'object') return
    const fillOpacity = effectiveRoiFillOpacity(fillVisible, roiSettings)
    const nodes = collectPaperStyleNodes(item)
    const ann = (item as PaperStyleNode).annotationItem

    if (ann?._props) {
        ann._props.fillOpacity = fillOpacity
        if (fillOpacity <= 0) {
            if (ann._props[BDSA_ROI_FILL_PROPS_STASH] == null && ann._props.fillColor != null) {
                ann._props[BDSA_ROI_FILL_PROPS_STASH] = ann._props.fillColor
            }
            ann._props.fillColor = 'rgba(0,0,0,0)'
        } else if (ann._props[BDSA_ROI_FILL_PROPS_STASH] != null) {
            ann._props.fillColor = ann._props[BDSA_ROI_FILL_PROPS_STASH]
        }
    }

    const fallbackFill = roiSettings?.fillColor
        ? normalizeCssColor(roiSettings.fillColor)
        : null

    for (const node of nodes) {
        try {
            if (fillOpacity <= 0) {
                if (node.fillColor != null && node[BDSA_ROI_FILL_STASH] == null) {
                    node[BDSA_ROI_FILL_STASH] = node.fillColor
                }
                node.fillOpacity = 0
                node.fillColor = null
            } else {
                if (node[BDSA_ROI_FILL_STASH] != null) {
                    node.fillColor = node[BDSA_ROI_FILL_STASH] as PaperStyleNode['fillColor']
                } else if (fallbackFill && (node.fillColor == null || node.fillColor === '')) {
                    node.fillColor = fallbackFill
                }
                node.fillOpacity = fillOpacity
            }
            node.updateFillOpacity?.()
        } catch { /* ignore */ }
    }
}

/** @deprecated Use {@link applyRoiFillVisibilityToPaperItem}. */
export function applyRoiFillOpacityToPaperItem(item: unknown, fillOpacity: number): void {
    applyRoiFillVisibilityToPaperItem(item, fillOpacity > 0, {
        fillOpacity: fillOpacity > 0 ? fillOpacity : 0,
    })
}

/** Dropdown text for an ROI — adds a numeric suffix when labels are duplicated (e.g. fixedLabel). */
export function formatRoiDropdownLabel(
    label: string,
    indexInList: number,
    allLabels: readonly string[],
): string {
    const duplicateCount = allLabels.filter(l => l === label).length
    if (duplicateCount <= 1) return label
    const indexAmongSame = allLabels
        .slice(0, indexInList + 1)
        .filter(l => l === label).length
    return `${label} ${indexAmongSame}`
}

/** Axis-aligned bounds in image pixels for a set of rectangle elements. */
export function getElementsImageBounds(
    elements: LocalAnnotationElement[],
    padding = 0.15,
): { x: number; y: number; width: number; height: number } | null {
    if (elements.length === 0) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const el of elements) {
        const left = el.center[0] - el.width / 2
        const top = el.center[1] - el.height / 2
        minX = Math.min(minX, left)
        minY = Math.min(minY, top)
        maxX = Math.max(maxX, left + el.width)
        maxY = Math.max(maxY, top + el.height)
    }

    const w = maxX - minX
    const h = maxY - minY
    if (!(w > 0 && h > 0)) return null

    return {
        x: minX - w * padding,
        y: minY - h * padding,
        width: w * (1 + 2 * padding),
        height: h * (1 + 2 * padding),
    }
}

/** Pan/zoom the OpenSeadragon viewer to fit all annotation elements (e.g. YOLO detections). */
export function fitViewerToElements(
    viewer: { viewport: { imageToViewportRectangle: (rect: unknown) => unknown; fitBounds: (rect: unknown) => void } },
    elements: LocalAnnotationElement[],
    OpenSeadragonNS: { Rect: new (x: number, y: number, w: number, h: number) => unknown },
    padding = 0.15,
): boolean {
    const bounds = getElementsImageBounds(elements, padding)
    if (!bounds) return false
    const rect = new OpenSeadragonNS.Rect(bounds.x, bounds.y, bounds.width, bounds.height)
    const vpRect = viewer.viewport.imageToViewportRectangle(rect)
    viewer.viewport.fitBounds(vpRect)
    return true
}

/** Pan the viewer to an element center without changing zoom (review navigation). */
export function centerViewerOnElement(
    viewer: {
        viewport: {
            imageToViewportCoordinates: (pt: unknown) => unknown
            panTo: (pt: unknown, immediately?: boolean) => void
        }
    },
    element: LocalAnnotationElement,
    OpenSeadragonNS: { Point: new (x: number, y: number) => unknown },
    immediately = true,
): boolean {
    const cx = element.center[0]
    const cy = element.center[1]
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false
    const imagePoint = new OpenSeadragonNS.Point(cx, cy)
    const vpPoint = viewer.viewport.imageToViewportCoordinates(imagePoint)
    viewer.viewport.panTo(vpPoint, immediately)
    return true
}

export function isFormFieldKeyboardTarget(event: KeyboardEvent | Event): boolean {
    const tag = (event.target as HTMLElement)?.tagName?.toUpperCase()
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Image-pixel top-left and size for a rectangle element. */
export function elementToRoiBounds(el: LocalAnnotationElement): RoiImageBounds {
    return {
        left: el.center[0] - el.width / 2,
        top: el.center[1] - el.height / 2,
        width: el.width,
        height: el.height,
    }
}

export function clampRoiTopLeft(
    left: number,
    top: number,
    width: number,
    height: number,
    imageW: number,
    imageH: number,
): { left: number; top: number } {
    const maxL = Math.max(0, imageW - width)
    const maxT = Math.max(0, imageH - height)
    return {
        left: Math.min(maxL, Math.max(0, left)),
        top: Math.min(maxT, Math.max(0, top)),
    }
}

/** Translate a Paper.js ROI item by slide-pixel delta. */
export function translatePaperRoiItem(item: { children?: { segments?: { point: { x: number; y: number } }[] }[]; segments?: { point: { x: number; y: number } }[] } | null, dx: number, dy: number): void {
    if (!item || (dx === 0 && dy === 0)) return
    const inner = item.children?.[0] ?? item
    const segments = inner.segments
    if (!segments?.length) return
    for (const seg of segments) {
        seg.point.x += dx
        seg.point.y += dy
    }
}

/** Map a single-character protocol key (from `annotationTypes[].key`) to a type index. */
export function findAnnotationTypeIndexForKey(types: AnnotationType[], key: string): number | null {
    const k = key.length === 1 ? key.toLowerCase() : ''
    if (!k) return null
    const idx = types.findIndex(t => t.key?.toLowerCase() === k)
    return idx >= 0 ? idx : null
}

/**
 * OpenSeadragon binds W/S/A/D/F and arrow keys on canvas focus.
 * Return true when the editor will consume the key so OSD should not pan/flip.
 */
export function isFinishShapeEditKey(key: string, hotkeys?: HotkeySettings): boolean {
    if (key === 'Enter') return true
    return key.toLowerCase() === (hotkeys?.finishShapeEdit ?? 'f').toLowerCase()
}

export function isEditLabelShapeKey(key: string, hotkeys?: HotkeySettings): boolean {
    return key.toLowerCase() === (hotkeys?.editLabelShape ?? 'e').toLowerCase()
}

export function shouldBlockOpenSeadragonKey(
    key: string,
    workflowMode: WorkflowMode,
    types: AnnotationType[],
    hotkeys?: HotkeySettings,
    addLabelsDrawingEnabled = true,
    shapeEditActive = false,
): boolean {
    if (shapeEditActive) {
        if (isFinishShapeEditKey(key, hotkeys) || key === 'Escape') return true
    }
    const k = key.toLowerCase()
    if (workflowMode === 'add-labels') {
        const drawToggleKey = (hotkeys?.insertBox ?? 't').toLowerCase()
        if (k === drawToggleKey) return true
        if (findAnnotationTypeIndexForKey(types, key) != null) return true
        const prev = (hotkeys?.typeCyclePrevious ?? '[').toLowerCase()
        const next = (hotkeys?.typeCycleNext ?? ']').toLowerCase()
        if (addLabelsDrawingEnabled && (k === prev || k === next)) return true
        return false
    }
    if (k === 'q' || k === 'w') return true
    if (findAnnotationTypeIndexForKey(types, key) != null) return true
    if (workflowMode === 'review') {
        const next = (hotkeys?.reviewNext ?? 'm').toLowerCase()
        const prev = (hotkeys?.reviewPrevious ?? 'n').toLowerCase()
        if (k === next || k === prev) return true
        if (key === 'ArrowLeft' || key === 'ArrowRight') return true
    }
    return false
}

/** JSON snapshot of document elements — used to detect unsaved edits. */
export function documentElementsSnapshot(
    doc: { elements: LocalAnnotationElement[] } | null | undefined,
): string {
    return JSON.stringify(doc?.elements ?? [])
}

export type ResolvedAutoSaveSettings = {
    enabled: boolean
    debounceMs: number
    saveOnUnmount: boolean
}

export function resolveAutoSaveSettings(
    autoSave?: boolean | AutoSaveSettings,
): ResolvedAutoSaveSettings {
    if (autoSave === true) {
        return { enabled: true, debounceMs: 2500, saveOnUnmount: true }
    }
    if (autoSave && typeof autoSave === 'object') {
        return {
            enabled: autoSave.enabled !== false,
            debounceMs: autoSave.debounceMs ?? 2500,
            saveOnUnmount: autoSave.saveOnUnmount !== false,
        }
    }
    return { enabled: false, debounceMs: 2500, saveOnUnmount: true }
}

/** Toolbar hint for type cycling / direct assignment keys. */
export function formatTypeHotkeyHint(types: AnnotationType[], workflowMode?: WorkflowMode): string {
    const keys = types.map(t => t.key).filter((k): k is string => Boolean(k))
    const assign = keys.length > 0 ? `${keys.join(' ')} assign · ` : ''
    if (workflowMode === 'add-labels') {
        return `${assign}[ ] cycle · WASD pan`
    }
    return `${assign}Q/W cycle`
}

export type ImagePoint = { x: number; y: number }

/** Topmost label item whose bounds contain the image-space point (-1 if none). */
export function findTopmostLabelItemIdxAtImagePoint(
    labelItems: ReadonlyArray<{ bounds?: { contains: (point: unknown) => boolean } } | null | undefined>,
    imagePoint: ImagePoint,
): number {
    for (let i = labelItems.length - 1; i >= 0; i--) {
        const item = labelItems[i]
        if (item?.bounds?.contains(imagePoint)) return i
    }
    return -1
}
