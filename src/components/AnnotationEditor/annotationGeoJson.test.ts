import { describe, it, expect, vi } from 'vitest'
import type { FeatureCollection } from 'geojson'
import {
    localDocumentToFeatureCollection,
    featureCollectionToLocalDocument,
    loadLocalElementsOntoAnnotationToolkit,
    wrapOrphanLabelsInRoi,
    normalizeOverlayFeaturesForToolkit,
    removeOverlayFeatureCollection,
    overlayFeatureToImageRect,
} from './annotationGeoJson'
import type { AnnotationEditorConfig, LocalAnnotationDocument, LocalAnnotationElement } from './AnnotationEditor.types'

const baseConfig = (): AnnotationEditorConfig => ({
    annotationDocumentName: 'test-doc',
    annotationDescription: 'desc',
    annotationTypes: [
        { name: 'Tumor', color: '#ff0000', defaultWidth: 10, defaultHeight: 10 },
        { name: 'Stroma', color: '#0000ff', defaultWidth: 10, defaultHeight: 10 },
    ],
    roiSettings: { label: 'roi', color: '#ffa500' },
})

function rectEl(over: Partial<LocalAnnotationElement> & Pick<LocalAnnotationElement, 'group'>): LocalAnnotationElement {
    return {
        type: 'rectangle',
        group: over.group,
        label: over.label ?? { value: 'x' },
        center: over.center ?? [100, 200, 0],
        width: over.width ?? 50,
        height: over.height ?? 40,
        rotation: over.rotation ?? 0,
        lineColor: over.lineColor ?? '#112233',
        lineWidth: over.lineWidth ?? 2,
        fillColor: over.fillColor ?? 'rgba(0,0,0,0.1)',
        ...('user' in over ? { user: over.user } : {}),
    }
}

describe('localDocumentToFeatureCollection', () => {
    it('exports empty FeatureCollection', () => {
        const doc: LocalAnnotationDocument = { name: 'a', description: 'b', elements: [] }
        const fc = localDocumentToFeatureCollection(doc)
        expect(fc.type).toBe('FeatureCollection')
        expect(fc.features).toHaveLength(0)
    })

    it('exports polygons with group, label, and user on properties', () => {
        const doc: LocalAnnotationDocument = {
            name: 'a',
            description: 'b',
            elements: [
                rectEl({
                    group: 'ROI',
                    label: { value: 'roi1' },
                    center: [10, 20, 0],
                    width: 100,
                    height: 50,
                    rotation: 0,
                    user: { conf: 0.9 },
                }),
            ],
        }
        const fc = localDocumentToFeatureCollection(doc)
        expect(fc.features).toHaveLength(1)
        const f = fc.features[0]!
        expect(f.geometry.type).toBe('Polygon')
        const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : null
        expect(coords).toBeDefined()
        expect((f.properties as { group?: string }).group).toBe('ROI')
        expect((f.properties as { user?: { conf: number } }).user?.conf).toBe(0.9)
    })
})

describe('featureCollectionToLocalDocument', () => {
    it('returns empty elements for empty collection', () => {
        const fc: FeatureCollection = { type: 'FeatureCollection', features: [] }
        const local = featureCollectionToLocalDocument(fc, baseConfig(), 'mydoc')
        expect(local.name).toBe('mydoc')
        expect(local.description).toBe('desc')
        expect(local.elements).toEqual([])
    })

    it('all-as-roi maps each polygon to ROI with sequential labels', () => {
        const fc: FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { foo: 1 },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [0, 0],
                                [10, 0],
                                [10, 20],
                                [0, 20],
                                [0, 0],
                            ],
                        ],
                    },
                },
            ],
        }
        const local = featureCollectionToLocalDocument(fc, baseConfig(), 'd', { importMode: 'all-as-roi' })
        expect(local.elements).toHaveLength(1)
        expect(local.elements[0]!.group).toBe('ROI')
        expect(local.elements[0]!.label.value).toBe('roi1')
        expect(local.elements[0]!.user).toEqual({ foo: 1 })
    })

    it('class-from-properties uses annotation type by class_name', () => {
        const fc: FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { class_name: 'Tumor' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [100, 100],
                                [200, 100],
                                [200, 200],
                                [100, 200],
                                [100, 100],
                            ],
                        ],
                    },
                },
            ],
        }
        const local = featureCollectionToLocalDocument(fc, baseConfig(), 'd', {
            importMode: 'class-from-properties',
            classProperty: 'class_name',
        })
        expect(local.elements[0]!.group).toBe('Tumor')
        expect(local.elements[0]!.label.value).toBe('Tumor-1')
    })

    it('maps Point to a small axis-aligned box', () => {
        const fc: FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Point', coordinates: [50, 60] },
                },
            ],
        }
        const local = featureCollectionToLocalDocument(fc, baseConfig(), 'd', { importMode: 'all-as-roi' })
        const e = local.elements[0]!
        expect(e.center[0]).toBe(50)
        expect(e.center[1]).toBe(60)
        expect(e.width).toBe(8)
        expect(e.height).toBe(8)
    })

    it('skips LineString and invalid polygons', () => {
        const fc: FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
                },
            ],
        }
        const local = featureCollectionToLocalDocument(fc, baseConfig(), 'd')
        expect(local.elements).toHaveLength(0)
    })
})

describe('loadLocalElementsOntoAnnotationToolkit', () => {
    it('with clear, removes existing groups and loads via addFeatureCollections when available', () => {
        const removed: unknown[] = []
        const addFeatureCollections = vi.fn()
        const loadGeoJSON = vi.fn()
        const parentLayer = { id: 'paper-layer' }
        const getFeatureCollectionGroups = vi.fn((parent?: unknown) => {
            if (parent === undefined) {
                return [{ remove: () => removed.push('old') }]
            }
            return [
                { displayName: 'test-doc', children: ['r1'], layer: parentLayer },
                { displayName: 'test-doc - Labels', children: ['l1'], layer: parentLayer },
            ]
        })
        const toolkit = {
            addFeatureCollections,
            loadGeoJSON,
            getFeatureCollectionGroups,
            viewer: { world: { getItemCount: () => 1, getItemAt: () => ({ paperLayer: parentLayer }) } },
        }

        const elements: LocalAnnotationElement[] = [
            rectEl({ group: 'ROI', label: { value: 'roi1' } }),
            rectEl({ group: 'Tumor', label: { value: 'Tumor-1' } }),
        ]
        const roiRef = { current: ['old'] as unknown[] }
        const labelRef = { current: ['old2'] as unknown[] }

        loadLocalElementsOntoAnnotationToolkit(
            toolkit,
            baseConfig(),
            elements,
            roiRef,
            labelRef,
            { clear: true },
        )

        expect(removed).toEqual(['old'])
        expect(addFeatureCollections).toHaveBeenCalledTimes(2)
        expect(loadGeoJSON).not.toHaveBeenCalled()
        expect(roiRef.current).toEqual(['r1'])
        expect(labelRef.current).toEqual(['l1'])
    })

    it('does not call clear when option omitted', () => {
        const addFeatureCollections = vi.fn()
        const getFeatureCollectionGroups = vi.fn().mockReturnValue([{ children: [], displayName: 'doc' }])
        const toolkit = {
            addFeatureCollections,
            loadGeoJSON: vi.fn(),
            getFeatureCollectionGroups,
            viewer: { world: { getItemCount: () => 1, getItemAt: () => ({ paperLayer: {} }) } },
        }
        const roiRef = { current: [] as unknown[] }
        const labelRef = { current: [] as unknown[] }
        loadLocalElementsOntoAnnotationToolkit(
            toolkit,
            baseConfig(),
            [rectEl({ group: 'ROI', label: { value: 'a' } })],
            roiRef,
            labelRef,
        )
        expect(addFeatureCollections).toHaveBeenCalledTimes(1)
        expect(addFeatureCollections.mock.calls[0]![1]).toBe(false)
    })
})

describe('overlay feature collections', () => {
    it('normalizeOverlayFeaturesForToolkit converts polygon rings to point rectangles', () => {
        const normalized = normalizeOverlayFeaturesForToolkit([
            {
                type: 'Feature',
                properties: { label: 1, strokeColor: '#f0a' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[10, 20], [110, 20], [110, 70], [10, 70], [10, 20]]],
                },
            },
        ])
        expect(normalized).toHaveLength(1)
        const geom = normalized[0]!.geometry as {
            type: string
            coordinates: number[]
            properties?: { subtype?: string; width?: number; height?: number }
        }
        expect(geom.type).toBe('Point')
        expect(geom.coordinates).toEqual([60, 45])
        expect(geom.properties?.subtype).toBe('Rectangle')
        expect(geom.properties?.width).toBe(100)
        expect(geom.properties?.height).toBe(50)
    })

    it('overlayFeatureToImageRect maps point rectangles to slide bounds', () => {
        const normalized = normalizeOverlayFeaturesForToolkit([
            {
                type: 'Feature',
                properties: { strokeColor: '#f0a', strokeWidth: 3 },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[10, 20], [110, 20], [110, 70], [10, 70], [10, 20]]],
                },
            },
        ])
        const rect = overlayFeatureToImageRect(normalized[0]!)
        expect(rect).toEqual({
            left: 10,
            top: 20,
            width: 100,
            height: 50,
            strokeColor: '#f0a',
            fillColor: 'rgba(255, 0, 170, 0.08)',
            strokeWidth: 3,
        })
    })

    it('removeOverlayFeatureCollection removes children before the group', () => {
        const removed: string[] = []
        const child = { remove: () => removed.push('child') }
        const group = {
            displayName: 'Model predictions',
            children: [child],
            remove: () => removed.push('group'),
        }
        const toolkit = {
            getFeatureCollectionGroups: vi.fn().mockReturnValue([group]),
            viewer: { world: { getItemCount: () => 1, getItemAt: () => ({ paperLayer: {} }) } },
        }
        removeOverlayFeatureCollection(toolkit as never)
        expect(removed).toEqual(['child', 'group'])
    })
})

describe('wrapOrphanLabelsInRoi', () => {
    it('creates a wrapper ROI and stamps roiLabel when labels have no ROI', () => {
        const doc: LocalAnnotationDocument = {
            name: 'yolo',
            description: '',
            elements: [
                rectEl({ group: 'Tumor', label: { value: 'Tumor-1' }, center: [1000, 1000, 0], width: 100, height: 100, user: { confidence: 0.9 } }),
                rectEl({ group: 'Stroma', label: { value: 'Stroma-1' }, center: [2000, 1500, 0], width: 200, height: 150, user: { confidence: 0.8 } }),
            ],
        }
        const wrapped = wrapOrphanLabelsInRoi(doc, baseConfig())
        expect(wrapped.elements.filter(e => e.group === 'ROI')).toHaveLength(1)
        expect(wrapped.elements[0]!.label.value).toBe('roi1')
        const labels = wrapped.elements.filter(e => e.group === 'Tumor' || e.group === 'Stroma')
        expect(labels.every(l => l.user?.roiLabel === 'roi1')).toBe(true)
    })
})
