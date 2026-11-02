import { describe, it, expect } from 'vitest'
import {
    buildSimulatedYoloGeoJson,
    buildSimulatedYoloGeoJsonFromConfig,
    paperAnnotatorEditorConfig,
    simulatedYoloPositiveNegative,
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

    it('shifts every box by the requested origin', () => {
        const base = buildSimulatedYoloGeoJson({ classNames: ['A', 'B'] })
        const shifted = buildSimulatedYoloGeoJson({ classNames: ['A', 'B'], origin: [10000, 20000] })

        const starts = (fc: typeof base) =>
            fc.features.map(f => f.geometry.coordinates[0][0] as [number, number])
        const baseStarts = starts(base)
        const shiftedStarts = starts(shifted)

        expect(shiftedStarts).toHaveLength(baseStarts.length)
        shiftedStarts.forEach((start, i) => {
            expect(start[0] - baseStarts[i][0]).toBe(10000)
            expect(start[1] - baseStarts[i][1]).toBe(20000)
        })
    })

    it('places the Storybook demo fixtures in the middle of the slide, not the top-left corner', () => {
        const demoSlideWidth = 95615
        const demoSlideHeight = 84127

        for (const fc of [simulatedYoloPositiveNegative, simulatedYoloTauPredictions]) {
            const xs = fc.features.flatMap(f => f.geometry.coordinates[0].map(([x]) => x))
            const ys = fc.features.flatMap(f => f.geometry.coordinates[0].map(([, y]) => y))

            const minX = Math.min(...xs)
            const maxX = Math.max(...xs)
            const minY = Math.min(...ys)
            const maxY = Math.max(...ys)

            expect(minX).toBeGreaterThan(demoSlideWidth * 0.25)
            expect(maxX).toBeLessThan(demoSlideWidth * 0.75)
            expect(minY).toBeGreaterThan(demoSlideHeight * 0.25)
            expect(maxY).toBeLessThan(demoSlideHeight * 0.75)
        }
    })
})
