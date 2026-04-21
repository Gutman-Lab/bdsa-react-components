import { describe, it, expect, vi } from 'vitest'
import type { FeatureCollection } from 'geojson'
import {
    localDocumentToFeatureCollection,
    featureCollectionToLocalDocument,
    loadLocalElementsOntoAnnotationToolkit,
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
    it('with clear, calls loadGeoJSON([], true) and empties refs before loading', () => {
        const loadGeoJSON = vi.fn()
        const getFeatureCollectionGroups = vi
            .fn()
            // After ROI group load
            .mockReturnValueOnce([{ children: ['r1'] }])
            // After label group load
            .mockReturnValueOnce([{ children: [] }, { children: ['l1'] }])
        const toolkit = { loadGeoJSON, getFeatureCollectionGroups }

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

        expect(loadGeoJSON.mock.calls[0]).toEqual([[], true])
        expect(roiRef.current).toEqual(['r1'])
        expect(labelRef.current).toEqual(['l1'])
    })

    it('does not call clear when option omitted', () => {
        const loadGeoJSON = vi.fn()
        const getFeatureCollectionGroups = vi.fn().mockReturnValue([{ children: [] }])
        const toolkit = { loadGeoJSON, getFeatureCollectionGroups }
        const roiRef = { current: [] as unknown[] }
        const labelRef = { current: [] as unknown[] }
        loadLocalElementsOntoAnnotationToolkit(
            toolkit,
            baseConfig(),
            [rectEl({ group: 'ROI', label: { value: 'a' } })],
            roiRef,
            labelRef,
        )
        expect(loadGeoJSON).toHaveBeenCalledTimes(1)
        expect(loadGeoJSON.mock.calls[0]![1]).toBe(false)
    })
})
