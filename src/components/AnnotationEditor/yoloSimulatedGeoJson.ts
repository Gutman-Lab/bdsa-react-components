import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { AnnotationEditorConfig } from './AnnotationEditor.types'

/** Mirrors `BDSA_Paper_Annotator/public/config.json` → `annotationEditor`. */
export const paperAnnotatorEditorConfig: AnnotationEditorConfig = {
    annotationDocumentName: 'Tau Annotation Objects',
    annotationDescription: 'Created by the NFT Bounding Box App',
    annotationTypes: [
        { name: 'PreTangle', color: '#ff0000', strokeWidth: 2, key: 'D', defaultWidth: 500, defaultHeight: 500 },
        { name: 'MatureTangle', color: '#0000ff', strokeWidth: 2, key: 'F', defaultWidth: 800, defaultHeight: 600 },
        { name: 'Neuritic Plaque', color: '#008000', strokeWidth: 2, key: 'G', defaultWidth: 300, defaultHeight: 300 },
        { name: 'Glial Tau', color: '#ff00ff', strokeWidth: 2, key: 'H', defaultWidth: 1000, defaultHeight: 400 },
    ],
    roiSettings: {
        label: 'region',
        color: '#000000',
        strokeWidth: 3,
        fillOpacity: 0.0,
        width: 10000,
        height: 10000,
    },
    hotkeys: {
        reviewNext: 'M',
        reviewPrevious: 'N',
        insertBox: 't',
    },
}

export const yoloClassFromPropertiesImportOptions = {
    importMode: 'class-from-properties' as const,
    classProperty: 'class_name',
}

/** Axis-aligned box in image pixel coordinates (YOLO-style polygon export). */
export function yoloRectFeature(
    className: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options?: { confidence?: number; label?: string },
): Feature<Polygon> {
    const x2 = x + width
    const y2 = y + height
    return {
        type: 'Feature',
        properties: {
            class_name: className,
            ...(options?.confidence != null ? { confidence: options.confidence } : {}),
            ...(options?.label != null ? { label: options.label } : {}),
        },
        geometry: {
            type: 'Polygon',
            coordinates: [[[x, y], [x2, y], [x2, y2], [x, y2], [x, y]]],
        },
    }
}

export interface SimulatedYoloOptions {
    /** First class name (label A). Default: first entry in `classNames`. */
    classA?: string
    /** Second class name (label B). Default: second entry in `classNames`. */
    classB?: string
    /** All class names from the editor config — used for defaults and validation. */
    classNames: string[]
    /** When true, add one sample box per remaining class (index 2+). Default: false. */
    includeSampleBoxesForOtherClasses?: boolean
}

/**
 * Fixed-layout fake YOLO output: a few boxes for class A and several for class B.
 * Positions are deterministic so Storybook renders the same scene every time.
 */
export function buildSimulatedYoloGeoJson(options: SimulatedYoloOptions): FeatureCollection {
    const classA = options.classA ?? options.classNames[0] ?? 'class-a'
    const classB = options.classB ?? options.classNames[1] ?? 'class-b'

    const classABoxes: Array<[number, number, number, number, number]> = [
        [1400, 1200, 420, 380, 0.94],
        [2400, 900, 360, 320, 0.88],
        [3200, 1600, 480, 410, 0.76],
    ]

    const classBBoxes: Array<[number, number, number, number, number]> = [
        [1800, 2800, 520, 440, 0.92],
        [3600, 2400, 390, 350, 0.81],
        [4800, 3100, 450, 400, 0.67],
        [5200, 1800, 410, 360, 0.55],
    ]

    const features: Feature<Polygon>[] = [
        ...classABoxes.map(([x, y, w, h, conf], i) =>
            yoloRectFeature(classA, x, y, w, h, { confidence: conf, label: `${classA}-${i + 1}` }),
        ),
        ...classBBoxes.map(([x, y, w, h, conf], i) =>
            yoloRectFeature(classB, x, y, w, h, { confidence: conf, label: `${classB}-${i + 1}` }),
        ),
    ]

    if (options.includeSampleBoxesForOtherClasses) {
        const extras: Array<[string, number, number, number, number, number]> = [
            [options.classNames[2], 6000, 1200, 280, 260, 0.85],
            [options.classNames[3], 6500, 4200, 960, 380, 0.72],
        ].filter((row): row is [string, number, number, number, number, number] => Boolean(row[0]))

        for (const [className, x, y, w, h, conf] of extras) {
            features.push(yoloRectFeature(className, x, y, w, h, { confidence: conf, label: `${className}-1` }))
        }
    }

    return { type: 'FeatureCollection', features }
}

/** Build simulated YOLO output from an AnnotationEditor config (uses first two types as A/B). */
export function buildSimulatedYoloGeoJsonFromConfig(
    config: AnnotationEditorConfig,
    options?: { includeSampleBoxesForOtherClasses?: boolean },
): FeatureCollection {
    const classNames = config.annotationTypes.map(t => t.name)
    return buildSimulatedYoloGeoJson({
        classNames,
        classA: classNames[0],
        classB: classNames[1] ?? classNames[0],
        includeSampleBoxesForOtherClasses: options?.includeSampleBoxesForOtherClasses,
    })
}

/** Simulated predictions using the standard Storybook classes (Positive / Negative). */
export const simulatedYoloPositiveNegative = buildSimulatedYoloGeoJson({
    classNames: ['Positive', 'Negative'],
    classA: 'Positive',
    classB: 'Negative',
})

/** Simulated predictions for the Paper Annotator tau protocol (all four classes). */
export const simulatedYoloTauPredictions = buildSimulatedYoloGeoJsonFromConfig(paperAnnotatorEditorConfig, {
    includeSampleBoxesForOtherClasses: true,
})
