import { default as React } from 'react';
import { AnnotationFeature } from '../SlideViewer.types';
import { ApiErrorHandler } from '../../../utils/apiErrorHandling';

export interface UseAnnotationFetchingResult {
    fetchedAnnotations: AnnotationFeature[];
    annotationDocuments: Array<{
        id: string | number;
        elementCount: number;
        totalPoints: number;
        types: string[];
        filteredCount?: number;
        filteredPoints?: number;
    }>;
}
export declare function useAnnotationFetching(annotationIds: (string | number)[] | undefined, apiBaseUrl: string | undefined, defaultAnnotationColor: string, maxPointsPerAnnotation: number, maxTotalPoints: number, wrappedFetch: (url: string, options?: RequestInit) => Promise<Response>, cache: {
    get(annotationId: string | number, versionHash?: string): Promise<unknown | null>;
    set(annotationId: string | number, data: unknown, options?: {
        ttl?: number;
        versionHash?: string;
    }): Promise<void>;
    delete(annotationId: string | number): Promise<void>;
} | null, annotationHeaders: Map<string | number, unknown> | Record<string, unknown> | undefined, apiHeaders: HeadersInit | undefined, isMountedRef: React.MutableRefObject<boolean>, debug: boolean, onApiError?: ApiErrorHandler): UseAnnotationFetchingResult;
//# sourceMappingURL=useAnnotationFetching.d.ts.map