import { default as React } from 'react';
import { Item } from '../../utils/itemUtils';

/**
 * Update opacity for a specific annotation across all thumbnails
 */
export declare function updateThumbnailOpacity(annotationId: string, opacity: number): void;
/**
 * Get current opacity for an annotation
 */
export declare function getThumbnailOpacity(annotationId: string): number;
/**
 * Clear all opacity settings
 */
export declare function clearThumbnailOpacities(): void;
export interface ThumbnailViewerProps {
    /** DSA item object with _id, name, meta, etc. */
    item: Item;
    /** Width of thumbnail in pixels */
    viewerWidth: number;
    /** DSA API base URL */
    apiBaseUrl: string;
    /** Backend API base URL for annotation caching (optional) */
    backendApiBaseUrl?: string;
    /** Headers for API requests */
    apiHeaders?: HeadersInit;
    /** Name of currently selected annotation */
    selectedAnnotationName?: string;
    /** Map of itemId -> annotationId */
    annotationNameToIds?: Map<string, string> | Record<string, string>;
    /** Function to determine dataset type (train/val/test) */
    getDatasetType?: (itemId: string) => 'train' | 'val' | 'test' | null;
    /** Show OpenSeadragon navigation controls (zoom, home, fullscreen) (default: false) */
    showViewerControls?: boolean;
    /** Custom fetch function for API requests */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>;
    /** Debug mode for logging */
    debug?: boolean;
}
/**
 * Individual thumbnail component that wraps SlideViewer for displaying a single DSA item
 * with optional annotation overlay.
 */
export declare const ThumbnailViewer: React.NamedExoticComponent<ThumbnailViewerProps>;
//# sourceMappingURL=ThumbnailViewer.d.ts.map