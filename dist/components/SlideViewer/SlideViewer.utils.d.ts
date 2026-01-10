import { AnnotationInfoConfig, AnnotationFeature } from './SlideViewer.types';

/**
 * Compute version hash from annotation header for cache invalidation
 * Extracts version-relevant fields and computes a hash
 */
export declare function computeVersionHash(header: Record<string, unknown>): string;
/**
 * Extract authentication token from authToken prop or apiHeaders
 */
export declare function extractToken(authToken?: string, apiHeaders?: HeadersInit): string | undefined;
/**
 * Append authentication token as query parameter to a URL
 */
export declare function appendTokenToUrl(url: string, token?: string): string;
/**
 * Helper function to apply opacity to a color string
 * Always returns rgba format for consistency, even at 100% opacity
 */
export declare function applyOpacity(color: string, opacity: number): string;
/**
 * Parse annotation document into AnnotationFeature array
 */
export interface ParseAnnotationResult {
    features: AnnotationFeature[];
    docInfo: {
        id: string | number;
        elementCount: number;
        totalPoints: number;
        types: string[];
        filteredCount?: number;
        filteredPoints?: number;
    };
    filteredCount: number;
    filteredPoints: number;
}
export declare function parseAnnotationDocument(annotationDoc: unknown, annotationId: string | number, defaultAnnotationColor: string, maxPointsPerAnnotation: number): ParseAnnotationResult;
/**
 * Filter annotations by total point limit
 */
export declare function filterAnnotationsByTotalPoints(annotations: AnnotationFeature[], maxTotalPoints: number): AnnotationFeature[];
/**
 * Default configuration for annotation info panel
 */
export declare const DEFAULT_ANNOTATION_INFO_CONFIG: AnnotationInfoConfig;
//# sourceMappingURL=SlideViewer.utils.d.ts.map