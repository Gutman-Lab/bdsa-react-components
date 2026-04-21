import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { AnnotationEditorConfig, LocalAnnotationDocument, LocalAnnotationElement } from './AnnotationEditor.types'
import { normalizeCssColor } from './AnnotationEditor.utils'

type ToolkitLike = {
    loadGeoJSON: (collections: unknown[], clear: boolean) => void
    getFeatureCollectionGroups: () => { children: unknown[] }[]
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
            fillColor: normalizeCssColor('rgba(0,0,0,0.05)'),
            fillOpacity: r.fillOpacity ?? 0.05,
        }
    }
    const t = config.annotationTypes.find(x => x.name === group)
    if (t) {
        return {
            lineColor: normalizeCssColor(t.color),
            lineWidth: t.strokeWidth ?? 2,
            fillColor: 'rgba(0,0,0,0.12)',
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
    let roiIndex = 0

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
            roiIndex += 1
            const base = config.roiSettings?.label ?? 'roi'
            labelValue = `${base}${roiIndex}`
        } else {
            labelValue = props['label'] != null ? String(props['label']) : `${group}-${fi + 1}`
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

export interface LoadLocalElementsOptions {
    /** When true, clears existing feature collections on the toolkit before loading (e.g. GeoJSON re-import). */
    clear?: boolean
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
    if (options?.clear) {
        ;(toolkit as { loadGeoJSON: (a: unknown[], b: boolean) => void }).loadGeoJSON([], true)
        roiItemsRef.current = []
        labelItemsRef.current = []
    }

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

        ;(toolkit as { loadGeoJSON: (a: unknown[], b: boolean) => void }).loadGeoJSON([featureCollection], false)

        const groups = toolkit.getFeatureCollectionGroups()
        if (groups.length > 0) {
            roiItemsRef.current = Array.from(groups[groups.length - 1]!.children) as unknown[]
        }
    }

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
        ;(toolkit as { loadGeoJSON: (a: unknown[], b: boolean) => void }).loadGeoJSON([labelCollection], false)

        const allGroups = toolkit.getFeatureCollectionGroups()
        if (allGroups.length > 0) {
            labelItemsRef.current = Array.from(allGroups[allGroups.length - 1]!.children) as unknown[]
        }
    }
}
