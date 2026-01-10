import { default as React } from 'react';
import { Item } from '../../utils/itemUtils';
import { ApiErrorHandler } from '../../utils/apiErrorHandling';

export interface FolderThumbnailBrowserProps {
    /** DSA folder ID to fetch items from */
    folderId?: string;
    /** Array of specific image IDs to display */
    imageIds?: string[];
    /** Pre-loaded items array (takes precedence) */
    items?: Item[];
    /** DSA API base URL (e.g., "http://bdsa.pathology.emory.edu:8080/api/v1") */
    apiBaseUrl: string;
    /** Backend API base URL for annotation caching (optional, falls back to apiBaseUrl if not provided) */
    backendApiBaseUrl?: string;
    /** Headers for API requests (auth, etc.) */
    apiHeaders?: HeadersInit;
    /** Custom fetch function for API requests */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>;
    /** Initial items per page estimate (default: 12) */
    itemsPerPage?: number;
    /** Thumbnail size preset (default: 'l') */
    viewerSize?: 's' | 'm' | 'l' | 'xl';
    /** Name of currently selected annotation to display */
    selectedAnnotationName?: string;
    /** Map of itemId -> annotationId */
    annotationNameToIds?: Map<string, string> | Record<string, string>;
    /** Opacity for annotations (0-1, default: 0.7) */
    annotationOpacity?: number;
    /** Callback when opacity changes */
    onAnnotationOpacityChange?: (opacity: number) => void;
    /** Display name for model (if viewing model training images) */
    modelName?: string;
    /** Dataset split information */
    modelDatasetInfo?: {
        train: string[];
        val: string[];
        test: string[];
    };
    /** Called when items are loaded/filtered */
    onItemsLoaded?: (itemIds: string[]) => void;
    /** Function to determine dataset type */
    getDatasetType?: (itemId: string) => 'train' | 'val' | 'test' | null;
    /** Show OpenSeadragon navigation controls (zoom, home, fullscreen) on thumbnails (default: false) */
    showViewerControls?: boolean;
    /**
     * Callback when an API error occurs.
     * Provides error details and a retry function for transient failures.
     *
     * @param error - The error that occurred
     * @param retry - Function to retry the failed operation
     * @param context - Additional context about the error (endpoint, operation type, etc.)
     *
     * @example
     * ```tsx
     * <FolderThumbnailBrowser
     *   apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
     *   folderId="folder-123"
     *   onApiError={(error, retry, context) => {
     *     if (error.status === 401) {
     *       // Token expired, refresh and retry
     *       refreshToken().then(() => retry())
     *     } else if (error.isRetryable) {
     *       // Retry with delay
     *       setTimeout(() => retry(), 2000)
     *     } else {
     *       // Show error to user
     *       showErrorNotification(error.message)
     *     }
     *   }}
     * />
     * ```
     */
    onApiError?: ApiErrorHandler;
    /** Debug mode for logging */
    debug?: boolean;
    /** Custom CSS class */
    className?: string;
}
/**
 * Main container component that manages pagination, filtering, and layout for thumbnail grid.
 */
export declare const FolderThumbnailBrowser: React.ForwardRefExoticComponent<FolderThumbnailBrowserProps & React.RefAttributes<HTMLDivElement>>;
//# sourceMappingURL=FolderThumbnailBrowser.d.ts.map