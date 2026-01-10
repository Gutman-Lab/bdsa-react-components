import { Folder } from './FolderBrowser.types';
import { DebugLogger } from '../../utils/debugLog';

/**
 * Build fetch options with API headers
 */
export declare function buildFetchOptions(apiHeaders?: HeadersInit): RequestInit;
/**
 * Find the scrollable parent container for an element
 */
export declare function findScrollContainer(element: HTMLElement | null): HTMLElement | null;
/**
 * Preserve scroll position when expanding/collapsing tree nodes
 * Returns a function to restore scroll position after DOM updates
 */
export declare function preserveScrollPosition(container: HTMLElement | null, targetElement?: HTMLElement | null): {
    scrollContainer: HTMLElement | null;
    scrollTop: number;
    initialTop: number;
    restore: () => void;
};
/**
 * Parse paginated API response (handles both array and paginated object responses)
 */
export declare function parsePaginatedResponse<T>(data: unknown, currentOffset: number, pageSize: number): {
    items: T[];
    hasMore: boolean;
    total?: number;
};
/**
 * Search for a folder recursively in collections
 */
export declare function searchFolderInCollections(folderId: string, apiBaseUrl: string, customFetch: (url: string, options?: RequestInit) => Promise<Response>, fetchOptions: RequestInit, debugLog: DebugLogger): Promise<Folder | null>;
//# sourceMappingURL=FolderBrowser.utils.d.ts.map