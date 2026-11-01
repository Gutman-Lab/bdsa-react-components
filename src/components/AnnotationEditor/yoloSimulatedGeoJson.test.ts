import { describe, it, expect } from 'vitest'
import {
    buildSimulatedYoloGeoJson,
    buildSimulatedYoloGeoJsonFromConfig,
    paperAnnotatorEditorConfig,
    simulatedYoloTauPredictions,
    yoloRectFeature,
} from './yoloSimulatedGeoJson'

describe('yoloSimulatedGeoJson', () => {
    it('builds fixed counts per class with confidence on each feature', () => {
        const fc = buildSimulatedYoloGeoJson({
            classNames: ['Positive', 'Negative'],
            classA: 'Positive',
            classB: 'Negative',
        })
        expect(fc.type).toBe('FeatureCollection')
        expect(fc.features).toHaveLength(7)

        const positive = fc.features.filter(f => f.properties?.class_name === 'Positive')
        const negative = fc.features.filter(f => f.properties?.class_name === 'Negative')
        expect(positive).toHaveLength(3)
        expect(negative).toHaveLength(4)
        expect(positive.every(f => typeof f.properties?.confidence === 'number')).toBe(true)
    })

    it('builds tau predictions from paper annotator config with all four classes', () => {
        const fc = buildSimulatedYoloGeoJsonFromConfig(paperAnnotatorEditorConfig, {
            includeSampleBoxesForOtherClasses: true,
        })
        expect(fc.features).toHaveLength(9)
        expect(simulatedYoloTauPredictions.features).toHaveLength(9)
        expect(fc.features.filter(f => f.properties?.class_name === 'PreTangle')).toHaveLength(3)
        expect(fc.features.filter(f => f.properties?.class_name === 'MatureTangle')).toHaveLength(4)
        expect(fc.features.filter(f => f.properties?.class_name === 'Neuritic Plaque')).toHaveLength(1)
        expect(fc.features.filter(f => f.properties?.class_name === 'Glial Tau')).toHaveLength(1)
    })

    it('yoloRectFeature produces a closed polygon ring', () => {
        const f = yoloRectFeature('Foo', 10, 20, 100, 50, { confidence: 0.9 })
        const ring = f.geometry.coordinates[0]
        expect(ring[0]).toEqual(ring[ring.length - 1])
        expect(f.properties?.class_name).toBe('Foo')
    })
})
