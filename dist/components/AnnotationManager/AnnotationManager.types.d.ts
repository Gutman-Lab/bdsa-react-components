import { default as React } from 'react';
import { IndexedDBAnnotationCache } from '../../cache';

export interface AnnotationSearchResult {
    _id: string;
    _modelType: string;
    _elementCount?: number;
    _detailsCount?: number;
    _version?: number;
    _accessLevel?: number;
    itemId?: string;
    public?: boolean;
    created?: string;
    updated?: string;
    creatorId?: string;
    updatedId?: string;
    groups?: (string | null)[];
    annotation?: {
        name?: string;
        description?: string;
        attributes?: Record<string, unknown>;
        display?: Record<string, unknown>;
    };
    [key: string]: unknown;
}
export interface AnnotationManagerProps {
    /** Image/Item ID to search annotations for */
    imageId?: string;
    /** Base URL for DSA API (e.g., http://bdsa.pathology.emory.edu:8080/api/v1) */
    apiBaseUrl?: string;
    /** Maximum number of annotations to fetch per request (default: 50) */
    limit?: number;
    /** Custom fetch function for API requests. Useful for adding authentication headers. */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>;
    /** Custom headers to add to all API requests. Merged with fetchFn headers if both are provided. */
    apiHeaders?: HeadersInit;
    /** Callback when annotations are loaded */
    onAnnotationsLoaded?: (annotations: AnnotationSearchResult[]) => void;
    /** Callback when annotation loading fails */
    onError?: (error: Error) => void;
    /** Show debug panel with raw API response (default: false, hidden in production) */
    showDebugPanel?: boolean;
    /** Callback when annotation is loaded/unloaded */
    onAnnotationLoadChange?: (annotationId: string, loaded: boolean) => void;
    /** Callback when annotation visibility is toggled */
    onAnnotationVisibilityChange?: (annotationId: string, visible: boolean) => void;
    /** Callback when annotation opacity changes */
    onAnnotationOpacityChange?: (annotationId: string, opacity: number) => void;
    /** Callback when annotation is ready (fully rendered) */
    onAnnotationReady?: (annotationId: string) => void;
    /** Callback for SlideViewer's onAnnotationReady (internal use) */
    slideViewerOnAnnotationReady?: (annotationId: string | number) => void;
    /** Callback when loaded annotation IDs change */
    onLoadedAnnotationIdsChange?: (annotationIds: string[]) => void;
    /** Callback when annotation is loaded */
    onAnnotationLoad?: (annotationId: string) => void;
    /** Callback when annotation is hidden */
    onAnnotationHide?: (annotationId: string) => void;
    /** Unified callback for annotation state changes */
    onAnnotationStateChange?: (state: {
        loadedAnnotationIds: string[];
        opacities: Map<string, number>;
        visibility: Map<string, boolean>;
        onAnnotationReady?: (id: string | number) => void;
    }) => void;
    /** Callback when annotation opacities change */
    onAnnotationOpacitiesChange?: (opacities: Map<string, number>) => void;
    /** Callback when annotation headers change */
    onAnnotationHeadersChange?: (headers: Map<string | number, AnnotationSearchResult>) => void;
    /** External state: loaded annotation IDs */
    loadedAnnotations?: Set<string>;
    /** External state: visible annotation IDs */
    visibleAnnotations?: Map<string, boolean>;
    /** External state: annotation opacities */
    annotationOpacities?: Map<string, number>;
    /** External annotation cache */
    annotationCache?: IndexedDBAnnotationCache | null;
    /** Disable annotation caching (default: false) */
    disableCache?: boolean;
    /** Show default UI (default: true) */
    showDefaultUI?: boolean;
    /** Custom CSS class name */
    className?: string;
    /** Custom render function (render prop) */
    children?: ((context: AnnotationManagerContext) => React.ReactNode) | React.ReactNode;
    /** If true, enables debug logging to console. Default: false */
    debug?: boolean;
}
export interface AnnotationManagerContext {
    annotations: AnnotationSearchResult[];
    loading: boolean;
    error: Error | null;
    annotationIds: string[];
    loadedAnnotations: Set<string>;
    visibleAnnotations: Map<string, boolean>;
    annotationOpacities: Map<string, number>;
    toggleLoad: (annotationId: string) => void;
    toggleVisibility: (annotationId: string) => void;
    setOpacity: (annotationId: string, opacity: number) => void;
    handleAnnotationReady: (id: string | number) => void;
    onAnnotationReady: (id: string | number) => void;
    loadingAnnotations: Set<string>;
}
export interface AnnotationManagerHandle {
    getAnnotations: () => AnnotationSearchResult[];
    getAnnotation: (id: string) => AnnotationSearchResult | undefined;
    getLoadedAnnotationIds: () => string[];
    isAnnotationLoaded: (id: string) => boolean;
    isAnnotationVisible: (id: string) => boolean;
    getAnnotationOpacity: (id: string) => number;
    isAnnotationLoading: (id: string) => boolean;
    getVisibleAnnotationIds: () => string[];
    getAnnotationState: () => {
        loadedAnnotationIds: string[];
        opacities: Map<string, number>;
        visibility: Map<string, boolean>;
        loadingAnnotationIds: string[];
    };
}
//# sourceMappingURL=AnnotationManager.types.d.ts.map