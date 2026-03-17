/**
 * Utilities for handling different annotation formats (GeoJSON, DSA, etc.)
 */

/**
 * GeoJSON Feature types
 */
interface GeoJSONFeature {
    type: 'Feature'
    geometry: {
        type: 'Polygon' | 'LineString' | 'Point' | 'MultiPolygon' | 'MultiLineString' | 'MultiPoint'
        coordinates: number[][] | number[][][] | number[]
    }
    properties?: {
        [key: string]: unknown
        lineColor?: string
        fillColor?: string
        stroke?: string
        fill?: string
        'stroke-width'?: number
        lineWidth?: number
        group?: string
        id?: string
        label?: string
        name?: string
    }
}

interface GeoJSONFeatureCollection {
    type: 'FeatureCollection'
    features: GeoJSONFeature[]
}

/**
 * DSA Annotation Element format
 */
export interface DSAElement {
    type: 'polyline' | 'rectangle' | 'point'
    points?: Array<[number, number]>
    x?: number
    y?: number
    width?: number
    height?: number
    closed?: boolean
    lineColor?: string
    fillColor?: string
    lineWidth?: number
    group?: string
    label?: string
    [key: string]: unknown
}

/**
 * Check if an object is a GeoJSON FeatureCollection
 */
export function isGeoJSONFeatureCollection(obj: unknown): obj is GeoJSONFeatureCollection {
    if (!obj || typeof obj !== 'object') return false
    const candidate = obj as Partial<GeoJSONFeatureCollection>
    return candidate.type === 'FeatureCollection' && Array.isArray(candidate.features)
}

/**
 * Check if an object is a DSA annotation format
 */
export function isDSAAnnotation(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false
    const candidate = obj as { elements?: unknown; annotation?: { elements?: unknown } }
    
    // Check for root-level elements array
    if (Array.isArray(candidate.elements)) {
        return true
    }
    
    // Check for nested annotation.elements array
    if (candidate.annotation && typeof candidate.annotation === 'object' && Array.isArray(candidate.annotation.elements)) {
        return true
    }
    
    return false
}

/**
 * Transform a GeoJSON Feature to DSA Element format
 */
export function geoJSONFeatureToDSAElement(feature: GeoJSONFeature): DSAElement | null {
    const geom = feature.geometry
    const props = feature.properties || {}

    // Extract styling properties (support multiple naming conventions)
    const lineColor = props.lineColor || props.stroke || '#ff0000'
    const fillColor = props.fillColor || props.fill || 'rgba(255,0,0,0.3)'
    const lineWidth = props.lineWidth || props['stroke-width'] || 1
    const group = props.group || props.id
    const label = props.label || props.name

    switch (geom.type) {
        case 'Polygon': {
            // Polygon coordinates are [exterior ring, hole1, hole2, ...]
            // Each ring is [[x1,y1], [x2,y2], ...]
            const coords = geom.coordinates as number[][][]
            if (!coords || coords.length === 0) return null

            const exteriorRing = coords[0] // Just use exterior ring, ignore holes for now
            if (!exteriorRing || exteriorRing.length < 3) return null

            return {
                type: 'polyline',
                points: exteriorRing.map((coord) => [coord[0], coord[1]] as [number, number]),
                closed: true,
                lineColor: String(lineColor),
                fillColor: String(fillColor),
                lineWidth: Number(lineWidth),
                group: group ? String(group) : undefined,
                label: label ? String(label) : undefined,
            }
        }

        case 'LineString': {
            // LineString coordinates are [[x1,y1], [x2,y2], ...]
            const coords = geom.coordinates as number[][]
            if (!coords || coords.length < 2) return null

            return {
                type: 'polyline',
                points: coords.map((coord) => [coord[0], coord[1]] as [number, number]),
                closed: false,
                lineColor: String(lineColor),
                fillColor: String(fillColor),
                lineWidth: Number(lineWidth),
                group: group ? String(group) : undefined,
                label: label ? String(label) : undefined,
            }
        }

        case 'Point': {
            // Point coordinates are [x, y]
            const coords = geom.coordinates as number[]
            if (!coords || coords.length < 2) return null

            // Convert point to a small circle approximation or rectangle
            // For now, create a small polyline circle
            const [x, y] = coords
            const radius = lineWidth * 2 || 2 // Use lineWidth as radius hint

            // Create a simple 8-point circle approximation
            const circlePoints: Array<[number, number]> = []
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * 2 * Math.PI
                circlePoints.push([
                    x + radius * Math.cos(angle),
                    y + radius * Math.sin(angle),
                ])
            }

            return {
                type: 'polyline',
                points: circlePoints,
                closed: true,
                lineColor: String(lineColor),
                fillColor: String(fillColor),
                lineWidth: Number(lineWidth),
                group: group ? String(group) : undefined,
                label: label ? String(label) : undefined,
            }
        }

        case 'MultiPolygon':
        case 'MultiLineString':
        case 'MultiPoint':
            console.warn(`GeoJSON ${geom.type} not yet supported, skipping feature`)
            return null

        default:
            console.warn(`Unknown GeoJSON geometry type: ${(geom as { type?: string }).type}`)
            return null
    }
}

/**
 * Transform a GeoJSON FeatureCollection to an array of DSA elements
 */
export function geoJSONToDSAElements(featureCollection: GeoJSONFeatureCollection): DSAElement[] {
    const elements: DSAElement[] = []

    for (const feature of featureCollection.features) {
        const element = geoJSONFeatureToDSAElement(feature)
        if (element) {
            elements.push(element)
        }
    }

    return elements
}

/**
 * Detect annotation format and extract elements array
 * Supports both GeoJSON FeatureCollection and DSA formats
 */
export function extractAnnotationElements(annotationDoc: unknown): DSAElement[] {
    if (!annotationDoc || typeof annotationDoc !== 'object') {
        return []
    }

    // Check for GeoJSON FeatureCollection format
    if (isGeoJSONFeatureCollection(annotationDoc)) {
        console.log('Detected GeoJSON FeatureCollection format, transforming to DSA elements...')
        return geoJSONToDSAElements(annotationDoc)
    }

    // Check for DSA format
    const ann = annotationDoc as {
        elements?: unknown[]
        annotation?: { elements?: unknown[] }
    }

    if (ann.elements && Array.isArray(ann.elements)) {
        console.log('Detected DSA format (root level elements)')
        return ann.elements as DSAElement[]
    }

    if (ann.annotation?.elements && Array.isArray(ann.annotation.elements)) {
        console.log('Detected DSA format (nested annotation.elements)')
        return ann.annotation.elements as DSAElement[]
    }

    // Unknown format
    console.warn('Unknown annotation format, expected GeoJSON FeatureCollection or DSA format. Got:', {
        type: (annotationDoc as { type?: unknown }).type,
        hasElements: 'elements' in ann,
        hasAnnotation: 'annotation' in ann,
        keys: Object.keys(annotationDoc).slice(0, 10), // Show first 10 keys for debugging
    })

    return []
}

/**
 * Auto-detect annotation format and return format name
 */
export function detectAnnotationFormat(annotationDoc: unknown): 'geojson' | 'dsa' | 'unknown' {
    if (!annotationDoc || typeof annotationDoc !== 'object') {
        return 'unknown'
    }

    if (isGeoJSONFeatureCollection(annotationDoc)) {
        return 'geojson'
    }

    if (isDSAAnnotation(annotationDoc)) {
        return 'dsa'
    }

    return 'unknown'
}

