/**
 * Utilities for handling different annotation formats (GeoJSON, DSA, etc.)
 */
/**
 * GeoJSON Feature types
 */
interface GeoJSONFeature {
    type: 'Feature';
    geometry: {
        type: 'Polygon' | 'LineString' | 'Point' | 'MultiPolygon' | 'MultiLineString' | 'MultiPoint';
        coordinates: number[][] | number[][][] | number[];
    };
    properties?: {
        [key: string]: unknown;
        lineColor?: string;
        fillColor?: string;
        stroke?: string;
        fill?: string;
        'stroke-width'?: number;
        lineWidth?: number;
        group?: string;
        id?: string;
        label?: string;
        name?: string;
    };
}
interface GeoJSONFeatureCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}
/**
 * DSA Annotation Element format
 */
export interface DSAElement {
    type: 'polyline' | 'rectangle' | 'point';
    points?: Array<[number, number]>;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    closed?: boolean;
    lineColor?: string;
    fillColor?: string;
    lineWidth?: number;
    group?: string;
    label?: string;
    [key: string]: unknown;
}
/**
 * Check if an object is a GeoJSON FeatureCollection
 */
export declare function isGeoJSONFeatureCollection(obj: unknown): obj is GeoJSONFeatureCollection;
/**
 * Check if an object is a DSA annotation format
 */
export declare function isDSAAnnotation(obj: unknown): boolean;
/**
 * Transform a GeoJSON Feature to DSA Element format
 */
export declare function geoJSONFeatureToDSAElement(feature: GeoJSONFeature): DSAElement | null;
/**
 * Transform a GeoJSON FeatureCollection to an array of DSA elements
 */
export declare function geoJSONToDSAElements(featureCollection: GeoJSONFeatureCollection): DSAElement[];
/**
 * Detect annotation format and extract elements array
 * Supports both GeoJSON FeatureCollection and DSA formats
 */
export declare function extractAnnotationElements(annotationDoc: unknown): DSAElement[];
/**
 * Auto-detect annotation format and return format name
 */
export declare function detectAnnotationFormat(annotationDoc: unknown): 'geojson' | 'dsa' | 'unknown';
export {};
//# sourceMappingURL=annotationFormats.d.ts.map