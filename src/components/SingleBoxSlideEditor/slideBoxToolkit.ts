import { getToolkitTiledImage, refreshAnnotationToolkitDisplay } from '../AnnotationEditor/annotationGeoJson'
import type { SlideImageBox } from './SingleBoxSlideEditor.types'

type PaperPoint = { x: number; y: number; set: (x: number, y: number) => void }

export type EditablePaperItem = {
    bounds?: { x: number; y: number; width: number; height: number }
    children?: EditablePaperItem[]
    segments?: { point: PaperPoint }[]
    select?: () => void
    deselect?: (clear?: boolean) => void
}

export type BoxEditSession = {
    item: EditablePaperItem
    originalSegments: { x: number; y: number }[]
}

/** Runtime toolkit surface — AnnotationToolkit typings are incomplete in osd-paperjs-annotation.d.ts */
type SingleBoxToolkit = {
    addFeatureCollections?: (
        collections: unknown[],
        replace: boolean,
        parentImage?: unknown,
    ) => void
    loadGeoJSON?: (collections: unknown[], replace: boolean, parentImage?: unknown) => void
    getFeatureCollectionGroups?: (layer?: unknown) => Array<{
        displayName?: string
        children?: EditablePaperItem[]
        remove?: () => void
    }>
    getTool?: (name: string) => { activate?: () => void; deactivate?: (finish?: boolean) => void } | null
    addTools?: (names: string[]) => void
}

function asSingleBoxToolkit(toolkit: unknown): SingleBoxToolkit {
    return toolkit as SingleBoxToolkit
}

function asGeoJsonToolkit(toolkit: unknown): Parameters<typeof refreshAnnotationToolkitDisplay>[0] {
    return toolkit as Parameters<typeof refreshAnnotationToolkitDisplay>[0]
}

function asGeoJsonTiledImage(toolkit: unknown): Parameters<typeof getToolkitTiledImage>[0] {
    return toolkit as Parameters<typeof getToolkitTiledImage>[0]
}

export const SINGLE_BOX_COLLECTION = 'Single box editor'

export function roundSlideImageBox(box: SlideImageBox): SlideImageBox {
    return {
        left: Math.round(box.left),
        top: Math.round(box.top),
        width: Math.max(1, Math.round(box.width)),
        height: Math.max(1, Math.round(box.height)),
    }
}

export function paperItemToSlideBox(item: EditablePaperItem | null | undefined): SlideImageBox | null {
    const bounds = item?.bounds
    if (!bounds || bounds.width < 1 || bounds.height < 1) return null
    return roundSlideImageBox({
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
    })
}

export function capturePaperItemSegments(item: EditablePaperItem): { x: number; y: number }[] {
    const rect = item.children?.[0] ?? item
    return rect.segments?.map((segment) => ({ x: segment.point.x, y: segment.point.y })) ?? []
}

export function restorePaperItemSegments(
    item: EditablePaperItem,
    segments: { x: number; y: number }[],
): void {
    const rect = item.children?.[0] ?? item
    if (!rect.segments?.length) return
    segments.forEach((point, index) => {
        rect.segments?.[index]?.point.set(point.x, point.y)
    })
}

function getTiledImagePaperLayer(toolkit: unknown): unknown | undefined {
    const tiledImage = getToolkitTiledImage(asGeoJsonTiledImage(toolkit)) as
        | { paperLayer?: unknown }
        | null
    return tiledImage?.paperLayer
}

function pushFeatureCollection(toolkit: unknown, collection: unknown, parentImage: unknown): void {
    const tk = asSingleBoxToolkit(toolkit)
    if (tk.addFeatureCollections) {
        tk.addFeatureCollections([collection], false, parentImage)
    } else if (tk.loadGeoJSON) {
        tk.loadGeoJSON([collection], false, parentImage)
    }
    refreshAnnotationToolkitDisplay(asGeoJsonToolkit(toolkit))
}

export function removeSingleBoxFromToolkit(toolkit: unknown): void {
    const tk = asSingleBoxToolkit(toolkit)
    if (!tk.getFeatureCollectionGroups) return
    const parentLayer = getTiledImagePaperLayer(toolkit)
    const groups = tk.getFeatureCollectionGroups(parentLayer)
    for (const group of groups) {
        if (group.displayName === SINGLE_BOX_COLLECTION) {
            group.remove?.()
        }
    }
}

/** Load one rectangle via GeoJSON (same path as AnnotationEditor labels). */
export function loadSingleBoxOntoToolkit(
    toolkit: unknown,
    box: SlideImageBox,
    options: { strokeColor: string; label: string },
): EditablePaperItem | null {
    const parentImage = getToolkitTiledImage(asGeoJsonTiledImage(toolkit))
    if (!parentImage) return null

    removeSingleBoxFromToolkit(toolkit)

    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    const strokeWidth = 2

    const featureCollection = {
        type: 'FeatureCollection',
        label: SINGLE_BOX_COLLECTION,
        features: [
            {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [cx, cy],
                    properties: {
                        subtype: 'Rectangle',
                        width: box.width,
                        height: box.height,
                        angle: 0,
                    },
                },
                properties: {
                    label: options.label,
                    strokeColor: options.strokeColor,
                    strokeWidth,
                    fillColor: 'rgba(0, 0, 0, 0.05)',
                    fillOpacity: 0.12,
                    rescale: { strokeWidth },
                },
            },
        ],
        properties: {},
    }

    pushFeatureCollection(toolkit, featureCollection, parentImage)

    const parentLayer = getTiledImagePaperLayer(toolkit)
    const groups = asSingleBoxToolkit(toolkit).getFeatureCollectionGroups?.(parentLayer) ?? []
    const boxGroup = groups.find((group) => group.displayName === SINGLE_BOX_COLLECTION)
    return boxGroup?.children?.[0] ?? null
}

function ensureEditTools(toolkit: unknown): void {
    try {
        asSingleBoxToolkit(toolkit).addTools?.(['default', 'rectangle'])
    } catch {
        /* tools may already exist */
    }
}

/** Image navigation — mirrors AnnotationEditor activatePanTool. */
export function activatePanTool(toolkit: unknown): void {
    ensureEditTools(toolkit)
    const tk = asSingleBoxToolkit(toolkit)
    tk.getTool?.('rectangle')?.deactivate?.(true)
    tk.getTool?.('default')?.activate?.()
}

/** Rectangle modify mode — mirrors AnnotationEditor startEditLabelByItemIdx. */
export function activateShapeEditTool(toolkit: unknown, item: EditablePaperItem): BoxEditSession {
    ensureEditTools(toolkit)
    const originalSegments = capturePaperItemSegments(item)
    item.select?.()
    asSingleBoxToolkit(toolkit).getTool?.('rectangle')?.activate?.()
    return { item, originalSegments }
}
