import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { AnnotationEditorConfig, LocalAnnotationDocument, LocalAnnotationElement } from './AnnotationEditor.types'
import { normalizeCssColor, resolveRoiLabelValue, getElementsImageBounds } from './AnnotationEditor.utils'

type ToolkitLike = {
    loadGeoJSON: (collections: unknown[], clear: boolean, parentImage?: unknown) => void
    addFeatureCollections?: (collections: unknown[], replace: boolean, parentImage?: unknown) => void
    getFeatureCollectionGroups: (parentLayer?: unknown) => Array<{ children: unknown[]; displayName?: string }>
    paperScope?: PaperScopeLike
    viewer?: {
        world?: {
            getItemCount?: () => number
            getItemAt?: (i: number) => unknown
            addOnceHandler?: (e: string, h: () => void) => void
            addHandler?: (e: string, h: () => void) => void
            removeHandler?: (e: string, h: () => void) => void
        }
        addOnceHandler?: (e: string, h: () => void) => void
        addHandler?: (e: string, h: () => void) => void
        removeHandler?: (e: string, h: () => void) => void
        isOpen?: () => boolean
    }
    overlay?: {
        _updatePaperView?: () => void
        _resize?: () => void
        rescaleItems?: () => void
        paperScope?: PaperScopeLike
    }
}

type PaperScopeLike = {
    Path?: { Rectangle: new (rect: unknown) => PaperPathLike }
    Rectangle?: new (x: number, y: number, w: number, h: number) => unknown
    Item?: { fromGeoJSON: (feature: Feature) => PaperPathLike }
    view?: { draw?: () => void; update?: () => void }
    project?: { emit?: (event: string) => void }
}

type PaperPathLike = {
    remove?: () => void
    visible?: boolean
    strokeColor?: unknown
    fillColor?: unknown
    style?: { rescale?: { strokeWidth: number } }
    data?: Record<string, unknown>
}

type TiledImageLike = {
    addPaperItem?: (item: unknown) => void
    paperLayer?: unknown
}

/** Tiled image layer annotations must attach to — not the bare viewport layer. */
export function getToolkitTiledImage(toolkit: ToolkitLike): unknown | null {
    const world = toolkit.viewer?.world
    if (!world?.getItemCount?.()) return null
    const item = world.getItemAt?.(0) as { paperLayer?: unknown } | undefined
    return item?.paperLayer ? item : null
}

function getTiledImagePaperLayer(toolkit: ToolkitLike): unknown | undefined {
    const tiledImage = getToolkitTiledImage(toolkit) as { paperLayer?: unknown } | null
    return tiledImage?.paperLayer
}

function clearAllFeatureCollectionGroups(toolkit: ToolkitLike): void {
    const groups = toolkit.getFeatureCollectionGroups()
    for (const group of groups) {
        ;(group as { remove?: () => void }).remove?.()
    }
}

function pushFeatureCollections(
    toolkit: ToolkitLike,
    collections: unknown[],
    replaceCurrent: boolean,
    parentImage: unknown | null | undefined,
): void {
    if (toolkit.addFeatureCollections) {
        toolkit.addFeatureCollections(collections, replaceCurrent, parentImage ?? undefined)
    } else {
        toolkit.loadGeoJSON(collections, replaceCurrent, parentImage ?? undefined)
    }
    refreshAnnotationToolkitDisplay(toolkit)
}

/** Force Paper.js / overlay to sync after programmatic load (fixes invisible-until-zoom). */
export function refreshAnnotationToolkitDisplay(toolkit: ToolkitLike): void {
    try {
        toolkit.overlay?._resize?.()
        toolkit.overlay?._updatePaperView?.()
        toolkit.overlay?.rescaleItems?.()
        toolkit.overlay?.paperScope?.view?.update?.()
        toolkit.overlay?.paperScope?.view?.draw?.()
        toolkit.overlay?.paperScope?.project?.emit?.('items-changed')
    } catch {
        // ignore draw errors during teardown
    }
}

/**
 * Read axis-aligned bounds from a GeoJSON ring (first ring of Polygon = exterior).
 */
function ringBoundsXY(ring: number[][]): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (!ring || ring.length < 1) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const pt of ring) {
        if (pt.length < 2) continue
        const x = pt[0]!
        const y = pt[1]!
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null
    return { minX, minY, maxX, maxY }
}

function resolveStyleForGroup(
    group: string,
    config: AnnotationEditorConfig
): { lineColor: string; lineWidth: number; fillColor: string; fillOpacity: number } {
    if (group === 'ROI') {
        const r = config.roiSettings ?? {}
        return {
            lineColor: normalizeCssColor(r.color ?? '#ffa500'),
            lineWidth: r.strokeWidth ?? 2,
            fillColor: normalizeCssColor(r.fillColor ?? 'rgba(0,0,0,0.05)'),
            fillOpacity: r.fillOpacity ?? 0.05,
        }
    }
    const t = config.annotationTypes.find(x => x.name === group)
    if (t) {
        return {
            lineColor: normalizeCssColor(t.color),
            lineWidth: t.strokeWidth ?? 2,
            fillColor: normalizeCssColor(t.fillColor ?? 'rgba(0,0,0,0.12)'),
            fillOpacity: 0.12,
        }
    }
    return {
        lineColor: '#6b7280',
        lineWidth: 2,
        fillColor: 'rgba(0,0,0,0.1)',
        fillOpacity: 0.1,
    }
}

function localRectangleElementToPolygonFeature(el: LocalAnnotationElement, idx: number): Feature<Polygon> {
    const [cx, cy] = [el.center[0], el.center[1]]
    const hw = el.width / 2
    const hh = el.height / 2
    const rot = el.rotation || 0
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const corner = (lx: number, ly: number): [number, number] => {
        const rx = lx * cos - ly * sin
        const ry = lx * sin + ly * cos
        return [cx + rx, cy + ry]
    }
    const p1 = corner(-hw, -hh)
    const p2 = corner(hw, -hh)
    const p3 = corner(hw, hh)
    const p4 = corner(-hw, hh)
    return {
        type: 'Feature',
        id: idx,
        geometry: {
            type: 'Polygon',
            coordinates: [[p1, p2, p3, p4, p1]],
        },
        properties: {
            group: el.group,
            label: el.label.value,
            lineColor: el.lineColor,
            lineWidth: el.lineWidth,
            fillColor: el.fillColor,
            rotation: el.rotation,
            user: el.user,
        },
    }
}

/**
 * Export the in-memory document as a standard GeoJSON FeatureCollection (WGS... image pixel coords as in the editor).
 */
export function localDocumentToFeatureCollection(doc: LocalAnnotationDocument): FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: doc.elements.map((el, i) => localRectangleElementToPolygonFeature(el, i)),
    }
}

export interface FeatureCollectionToLocalOptions {
    /**
     * How to map each feature to a `group` (editor ROI vs label types):
     * - `all-as-roi`: every box becomes `group: 'ROI'` (good for YOLO tiles / many boxes).
     * - `class-from-properties`: use `classProperty` (default `class_name`) on each feature, else fall back to first annotation type.
     */
    importMode?: 'all-as-roi' | 'class-from-properties'
    /** Property name for YOLO / detection class (when `importMode` is `class-from-properties`). */
    classProperty?: string
}

/**
 * Turn an external FeatureCollection (e.g. YOLO server output) into the editor’s in-memory model.
 * Supports Polygon and Point (tiny square) per feature; other geometry types are skipped.
 */
export function featureCollectionToLocalDocument(
    fc: FeatureCollection,
    config: AnnotationEditorConfig,
    docName: string,
    options?: FeatureCollectionToLocalOptions
): LocalAnnotationDocument {
    const importMode = options?.importMode ?? 'all-as-roi'
    const classProp = options?.classProperty ?? 'class_name'
    const defaultTypeName = config.annotationTypes[0]?.name ?? 'detection'
  const elements: LocalAnnotationElement[] = []

  for (let fi = 0; fi < fc.features.length; fi++) {
        const f = fc.features[fi]!
        const props = (f.properties ?? {}) as Record<string, unknown>
        let minX: number
        let minY: number
        let maxX: number
        let maxY: number

        const g = f.geometry
        if (!g) continue

        if (g.type === 'Polygon') {
            const ext = (g as Polygon).coordinates[0]
            if (!ext) continue
            const b = ringBoundsXY(ext)
            if (!b) continue
            ;({ minX, minY, maxX, maxY } = b)
        } else if (g.type === 'Point') {
            const c = (g as { type: 'Point'; coordinates: number[] }).coordinates
            if (c.length < 2) continue
            const s = 8
            const x = c[0]!
            const y = c[1]!
            minX = x - s / 2
            minY = y - s / 2
            maxX = x + s / 2
            maxY = y + s / 2
        } else {
            continue
        }

        const width = maxX - minX
        const height = maxY - minY
        if (width < 1 || height < 1) continue

        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2

        let group: string
        if (importMode === 'all-as-roi') {
            group = 'ROI'
        } else {
            const raw = props[classProp] ?? props['class'] ?? props['name'] ?? props['label']
            const cls = raw != null ? String(raw) : defaultTypeName
            const known = new Set(config.annotationTypes.map(t => t.name))
            group = known.has(cls) || cls === 'ROI' ? cls : defaultTypeName
        }

        const style = resolveStyleForGroup(group, config)

        let labelValue: string
        if (group === 'ROI') {
            labelValue = resolveRoiLabelValue(
                elements.filter(e => e.group === 'ROI'),
                config.roiSettings,
            )
        } else {
            labelValue = group
        }

        const user: Record<string, unknown> = { ...props }
        delete user['group']
        delete user['label']

        elements.push({
            type: 'rectangle',
            group,
            label: { value: labelValue },
            center: [Math.round(cx), Math.round(cy), 0],
            width: Math.round(width),
            height: Math.round(height),
            rotation: 0,
            lineColor: style.lineColor,
            lineWidth: style.lineWidth,
            fillColor: style.fillColor,
            user: Object.keys(user).length > 0 ? user : undefined,
        })
    }

    return {
        name: docName,
        description: config.annotationDescription ?? 'Imported from GeoJSON',
        elements,
    }
}

/**
 * YOLO / flat GeoJSON often has label boxes with no ROI. The editor review workflow
 * expects labels under an ROI (`user.roiLabel`). When there are labels but no ROI,
 * synthesize a wrapper ROI around them and stamp `roiLabel` on each label.
 * When ROIs exist, stamp any unassigned labels onto the first ROI.
 */
export function wrapOrphanLabelsInRoi(
    doc: LocalAnnotationDocument,
    config: AnnotationEditorConfig,
): LocalAnnotationDocument {
    const knownTypes = new Set(config.annotationTypes.map(t => t.name))
    const roiElements = doc.elements.filter(e => e.group === 'ROI')
    const labelElements = doc.elements.filter(e => knownTypes.has(e.group))
    const otherElements = doc.elements.filter(e => e.group !== 'ROI' && !knownTypes.has(e.group))

    if (labelElements.length === 0) return doc

    if (roiElements.length > 0) {
        const primaryRoiLabel = roiElements[0]!.label.value
        const needsStamp = labelElements.some(l => l.user?.roiLabel !== primaryRoiLabel)
        if (!needsStamp) return doc
        const stamped = labelElements.map(l =>
            l.user?.roiLabel
                ? l
                : { ...l, user: { ...(l.user ?? {}), roiLabel: primaryRoiLabel } },
        )
        return { ...doc, elements: [...roiElements, ...stamped, ...otherElements] }
    }

    const bounds = getElementsImageBounds(labelElements, 0.12)
    if (!bounds) return doc

    const roiLabelValue = resolveRoiLabelValue([], config.roiSettings)
    const style = resolveStyleForGroup('ROI', config)
    const wrapperRoi: LocalAnnotationElement = {
        type: 'rectangle',
        group: 'ROI',
        label: { value: roiLabelValue },
        center: [
            Math.round(bounds.x + bounds.width / 2),
            Math.round(bounds.y + bounds.height / 2),
            0,
        ],
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        rotation: 0,
        lineColor: style.lineColor,
        lineWidth: style.lineWidth,
        fillColor: style.fillColor,
    }

    const stampedLabels = labelElements.map(l => ({
        ...l,
        user: { ...(l.user ?? {}), roiLabel: roiLabelValue },
    }))

    return {
        ...doc,
        elements: [wrapperRoi, ...stampedLabels, ...otherElements],
    }
}

export interface LoadLocalElementsOptions {
    /** When true, clears existing feature collections on the toolkit before loading (e.g. GeoJSON re-import). */
    clear?: boolean
    /** OpenSeadragon tiled image; annotations must be parented here once the slide is open. */
    parentImage?: unknown
    /** Paper.js fill opacity for ROI rectangles (0 = outline only). */
    roiFillOpacity?: number
    /** Called after ROI/label Paper items are attached (canvas may still need a refresh pass). */
    onLoaded?: () => void
}

/**
 * Push already-built `LocalAnnotationElement`s into the Paper.js stack (mirrors the DSA load path).
 */
export function loadLocalElementsOntoAnnotationToolkit(
    toolkit: ToolkitLike,
    config: AnnotationEditorConfig,
    elements: LocalAnnotationElement[],
    roiItemsRef: { current: unknown[] },
    labelItemsRef: { current: unknown[] },
    options?: LoadLocalElementsOptions
): void {
    const parentImage = options?.parentImage ?? getToolkitTiledImage(toolkit)
    const parentLayer = getTiledImagePaperLayer({ ...toolkit, viewer: toolkit.viewer })

    if (options?.clear) {
        clearAllFeatureCollectionGroups(toolkit)
        roiItemsRef.current = []
        labelItemsRef.current = []
    }

    const roiElements = elements.filter(e => e.group === 'ROI')
    const roiFillOpacity = options?.roiFillOpacity ?? config.roiSettings?.fillOpacity ?? 0.05
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
                    fillColor: roiFillOpacity > 0 ? el.fillColor : 'rgba(0,0,0,0)',
                    fillOpacity: roiFillOpacity,
                    rescale: { strokeWidth: el.lineWidth },
                },
            })),
            properties: {},
        }

        pushFeatureCollections(toolkit, [featureCollection], false, parentImage)

        const roiGroups = toolkit.getFeatureCollectionGroups(parentLayer)
        const roiGroup =
            roiGroups.find(g => g.displayName === config.annotationDocumentName)
            ?? (roiGroups.length > 0 ? roiGroups[roiGroups.length - 1] : undefined)
        if (roiGroup) {
            roiItemsRef.current = Array.from(roiGroup.children) as unknown[]
        }
    }

    const knownTypeNames = new Set(config.annotationTypes.map(t => t.name))
    const labelElements = elements.filter(e => knownTypeNames.has(e.group))
    if (labelElements.length > 0) {
        const labelCollectionName = `${config.annotationDocumentName} - Labels`
        const labelCollection = {
            type: 'FeatureCollection',
            label: labelCollectionName,
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
                    fillOpacity: 0.12,
                    rescale: { strokeWidth: el.lineWidth },
                },
            })),
            properties: {},
        }
        pushFeatureCollections(toolkit, [labelCollection], false, parentImage)

        const labelGroups = toolkit.getFeatureCollectionGroups(parentLayer)
        const labelGroup =
            labelGroups.find(g => g.displayName === labelCollectionName)
            ?? (labelGroups.length > 0 ? labelGroups[labelGroups.length - 1] : undefined)
        if (labelGroup) {
            labelItemsRef.current = Array.from(labelGroup.children) as unknown[]
        }
    }

    options?.onLoaded?.()
}

/** Display name for read-only model prediction overlays (separate from editable annotations). */
export const MODEL_PREDICTION_OVERLAY_NAME = 'Model predictions'

const OVERLAY_PREDICTION_FLAG = 'isModelPredictionOverlay'

/** Direct Paper items for prediction overlay — avoids osd-paperjs feature-collection insertChildren bugs. */
const overlayPaperItemsByToolkit = new WeakMap<object, PaperPathLike[]>()

type PaperItemLike = {
    remove?: () => void
    children?: PaperItemLike[]
    visible?: boolean
    displayName?: string
}

function getToolkitPaperScope(toolkit: ToolkitLike): PaperScopeLike | null {
    const tk = toolkit as { paperScope?: PaperScopeLike; overlay?: { paperScope?: PaperScopeLike } }
    return tk.paperScope ?? tk.overlay?.paperScope ?? null
}

export type OverlayImageRect = {
    left: number
    top: number
    width: number
    height: number
    strokeColor: string
    fillColor: string
    strokeWidth: number
}

/** Map normalized overlay feature (Point + Rectangle) to slide pixel bounds. */
export function overlayFeatureToImageRect(feature: Feature): OverlayImageRect | null {
    const geom = feature.geometry as {
        type?: string
        coordinates?: number[]
        properties?: { subtype?: string; width?: number; height?: number }
    } | null
    if (geom?.type !== 'Point' || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
        return null
    }
    const gp = geom.properties
    const width = gp?.width
    const height = gp?.height
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
        return null
    }
    const cx = geom.coordinates[0]!
    const cy = geom.coordinates[1]!
    const props = feature.properties ?? {}
    const strokeWidth = typeof props.strokeWidth === 'number' ? props.strokeWidth : 2
    return {
        left: cx - width / 2,
        top: cy - height / 2,
        width,
        height,
        strokeColor: normalizeCssColor(
            (props.strokeColor as string | undefined) ??
                (props.lineColor as string | undefined) ??
                '#ff00aa',
        ),
        fillColor: normalizeCssColor(
            (props.fillColor as string | undefined) ?? 'rgba(255, 0, 170, 0.08)',
        ),
        strokeWidth,
    }
}

function removeLegacyOverlayFeatureCollectionGroups(
    toolkit: ToolkitLike,
    collectionDisplayName: string,
): void {
    for (const group of findOverlayFeatureCollectionGroups(toolkit, collectionDisplayName)) {
        removePaperGroupSafely(group)
    }
}

function removeOverlayPaperItems(toolkit: ToolkitLike): void {
    const key = toolkit as object
    const items = overlayPaperItemsByToolkit.get(key) ?? []
    for (let i = items.length - 1; i >= 0; i--) {
        try {
            items[i]?.remove?.()
        } catch {
            /* teardown race */
        }
    }
    overlayPaperItemsByToolkit.set(key, [])
}

function findOverlayFeatureCollectionGroups(
    toolkit: ToolkitLike,
    collectionDisplayName: string,
): PaperItemLike[] {
    const parentLayer = getTiledImagePaperLayer(toolkit)
    return toolkit
        .getFeatureCollectionGroups(parentLayer)
        .filter(g => g.displayName === collectionDisplayName) as PaperItemLike[]
}

/** Remove children before the group so Paper.js does not leave holes in the layer children array. */
function removePaperGroupSafely(group: PaperItemLike): void {
    const children = group.children ? [...group.children] : []
    for (const child of children) {
        try {
            child.remove?.()
        } catch {
            /* teardown race */
        }
    }
    try {
        group.remove?.()
    } catch {
        /* teardown race */
    }
}

/**
 * YOLO inference returns Polygon rings; osd-paperjs loads Point+Rectangle reliably (same as ROI boxes).
 */
export function normalizeOverlayFeaturesForToolkit(features: Feature[]): Feature[] {
    const out: Feature[] = []
    for (const feature of features) {
        const props = { ...(feature.properties ?? {}) }
        const geom = feature.geometry
        if (!geom) continue

        const x1 = props.x1
        const y1 = props.y1
        const x2 = props.x2
        const y2 = props.y2
        if (
            typeof x1 === 'number' &&
            typeof y1 === 'number' &&
            typeof x2 === 'number' &&
            typeof y2 === 'number'
        ) {
            const left = Math.min(x1, x2)
            const top = Math.min(y1, y2)
            const width = Math.abs(x2 - x1)
            const height = Math.abs(y2 - y1)
            if (width <= 0 || height <= 0) continue
            const strokeWidth = typeof props.strokeWidth === 'number' ? props.strokeWidth : 2
            out.push(buildOverlayPointRectangleFeature(left, top, width, height, props, strokeWidth))
            continue
        }

        if (geom.type === 'Point') {
            const gp = (geom as { properties?: { width?: number; height?: number } }).properties
            const pw = gp?.width ?? props.width
            const ph = gp?.height ?? props.height
            if (typeof pw === 'number' && typeof ph === 'number' && pw > 0 && ph > 0) {
                out.push({ ...feature, properties: props })
                continue
            }
        }

        let ring: number[][] | null = null
        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
            ring = (geom.coordinates as number[][][])[0] ?? null
        } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
            ring = (geom.coordinates as number[][][][])[0]?.[0] ?? null
        }
        if (!ring) continue

        const bounds = ringBoundsXY(ring)
        if (!bounds) continue
        const width = bounds.maxX - bounds.minX
        const height = bounds.maxY - bounds.minY
        if (width <= 0 || height <= 0) continue

        const strokeWidth = typeof props.strokeWidth === 'number' ? props.strokeWidth : 2
        out.push(
            buildOverlayPointRectangleFeature(
                bounds.minX,
                bounds.minY,
                width,
                height,
                props,
                strokeWidth,
            ),
        )
    }
    return out
}

function buildOverlayPointRectangleFeature(
    left: number,
    top: number,
    width: number,
    height: number,
    props: Record<string, unknown>,
    strokeWidth: number,
): Feature {
    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [left + width / 2, top + height / 2],
            properties: {
                subtype: 'Rectangle',
                width,
                height,
                angle: 0,
            },
        } as Feature['geometry'],
        properties: {
            ...props,
            strokeColor: props.strokeColor ?? props.lineColor ?? '#ff00aa',
            strokeWidth,
            fillColor: props.fillColor ?? 'rgba(255, 0, 170, 0.06)',
            fillOpacity: typeof props.fillOpacity === 'number' ? props.fillOpacity : 0.06,
            rescale: { strokeWidth },
        },
    }
}

/** Remove a feature collection group by its Paper.js display name. */
export function removeOverlayFeatureCollection(
    toolkit: ToolkitLike,
    collectionDisplayName: string = MODEL_PREDICTION_OVERLAY_NAME,
): void {
    removeOverlayPaperItems(toolkit)
    removeLegacyOverlayFeatureCollectionGroups(toolkit, collectionDisplayName)
    refreshAnnotationToolkitDisplay(toolkit)
}

/** Show or hide an existing overlay collection without tearing down Paper.js groups. */
export function setOverlayFeatureCollectionVisibility(
    toolkit: ToolkitLike,
    visible: boolean,
    collectionDisplayName: string = MODEL_PREDICTION_OVERLAY_NAME,
): boolean {
    const items = overlayPaperItemsByToolkit.get(toolkit as object) ?? []
    if (items.length > 0) {
        for (const item of items) {
            item.visible = visible
        }
        refreshAnnotationToolkitDisplay(toolkit)
        return true
    }

    const groups = findOverlayFeatureCollectionGroups(toolkit, collectionDisplayName)
    if (groups.length === 0) return false
    const applyVisibility = (item: PaperItemLike) => {
        item.visible = visible
        item.children?.forEach(applyVisibility)
    }
    for (const group of groups) {
        applyVisibility(group)
    }
    refreshAnnotationToolkitDisplay(toolkit)
    return true
}

/** Load GeoJSON detections as a non-destructive overlay (does not clear ROI/label collections). */
export function loadOverlayFeatureCollectionOntoToolkit(
    toolkit: ToolkitLike,
    fc: FeatureCollection,
    collectionDisplayName: string = MODEL_PREDICTION_OVERLAY_NAME,
): boolean {
    const parentImage = getToolkitTiledImage(toolkit) as TiledImageLike | null
    const paperScope = getToolkitPaperScope(toolkit)
    const fromGeoJSON = paperScope?.Item?.fromGeoJSON
    if (!parentImage?.addPaperItem || !fromGeoJSON) {
        return false
    }

    const features = normalizeOverlayFeaturesForToolkit(fc.features as Feature[])
    removeOverlayFeatureCollection(toolkit, collectionDisplayName)

    if (features.length === 0) {
        return true
    }

    const created: PaperPathLike[] = []
    for (const feature of features) {
        try {
            const item = fromGeoJSON(feature)
            item.data = {
                ...(item.data ?? {}),
                [OVERLAY_PREDICTION_FLAG]: true,
                collectionDisplayName,
            }
            parentImage.addPaperItem(item)
            created.push(item)
        } catch {
            /* skip invalid geometry during bulk load */
        }
    }

    overlayPaperItemsByToolkit.set(toolkit as object, created)
    refreshAnnotationToolkitDisplay(toolkit)
    return created.length > 0
}

/**
 * Load elements onto the toolkit once the slide tiled image + paperLayer exist.
 * Retries until ready — `open` / `add-item` may fire before React subscribes.
 * @returns disposer to cancel pending retries/handlers
 */
export function applyLocalDocumentToToolkitWhenReady(
    toolkit: ToolkitLike,
    config: AnnotationEditorConfig,
    doc: LocalAnnotationDocument,
    roiItemsRef: { current: unknown[] },
    labelItemsRef: { current: unknown[] },
    onApplied?: () => void,
    loadOptions?: Pick<LoadLocalElementsOptions, 'roiFillOpacity' | 'onLoaded'>,
): (() => void) | void {
    let cancelled = false
    let applied = false

    const tryApply = (): boolean => {
        if (cancelled || applied) return applied
        const parentImage = getToolkitTiledImage(toolkit)
        if (!parentImage) return false
        loadLocalElementsOntoAnnotationToolkit(
            toolkit,
            config,
            doc.elements,
            roiItemsRef,
            labelItemsRef,
            { clear: true, parentImage, ...loadOptions },
        )
        applied = true
        onApplied?.()
        return true
    }

    if (tryApply()) return

    const viewer = toolkit.viewer
    if (!viewer) return

    const onReady = () => {
        tryApply()
    }

    viewer.addHandler?.('open', onReady)
    viewer.world?.addHandler?.('add-item', onReady)

    let attempts = 0
    const maxAttempts = 120
    const poll = () => {
        if (cancelled || applied) return
        if (tryApply()) {
            cleanup()
            return
        }
        attempts += 1
        if (attempts < maxAttempts) {
            requestAnimationFrame(poll)
        } else {
            cleanup()
        }
    }
    requestAnimationFrame(poll)

    function cleanup() {
        if (!viewer) return
        viewer.removeHandler?.('open', onReady)
        viewer.world?.removeHandler?.('add-item', onReady)
    }

    return () => {
        cancelled = true
        cleanup()
    }
}
