import { default as React } from 'react';
import { Item } from '../../utils/itemUtils';
import { ApiErrorHandler } from '../../utils/apiErrorHandling';

export interface ThumbnailGridProps {
    /** DSA folder ID to fetch items from */
    folderId?: string;
    /** Array of specific image IDs to display */
    imageIds?: string[];
    /** Pre-loaded items array (takes precedence) */
    items?: Item[];
    /** DSA API base URL (e.g., "http://bdsa.pathology.emory.edu:8080/api/v1") */
    apiBaseUrl: string;
    /** Backend API base URL for fetching items (optional, falls back to apiBaseUrl if not provided) */
    backendApiBaseUrl?: string;
    /** Headers for API requests (auth, etc.) */
    apiHeaders?: HeadersInit;
    /** Authentication token to use for requests. Can be extracted from apiHeaders automatically if not provided. */
    authToken?: string;
    /** If true, appends the authentication token as a query parameter (?token=...) to thumbnail URLs.
     *  This is required for some DSA servers that validate tokens via query parameters instead of (or in addition to) headers.
     *  Default: false */
    tokenQueryParam?: boolean;
    /** Custom fetch function for API requests */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>;
    /** Initial items per page estimate (default: 12) */
    itemsPerPage?: number;
    /** Thumbnail size preset (default: 'l') */
    thumbnailSize?: 's' | 'm' | 'l' | 'xl';
    /** Thumbnail image size in pixels (default: 512) - Note: Currently not used, DSA API handles size automatically */
    thumbnailImageSize?: number;
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
    /** Callback when thumbnail is clicked */
    onThumbnailClick?: (item: Item) => void;
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
     * <ThumbnailGrid
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
 * Basic thumbnail grid component that displays static thumbnail images.
 * This is a lightweight alternative to FolderThumbnailBrowser that doesn't use OpenSeadragon.
 */
export declare const ThumbnailGrid: React.ForwardRefExoticComponent<ThumbnailGridProps & React.RefAttributes<HTMLDivElement>>;
//# sourceMappingURL=ThumbnailGrid.d.ts.map