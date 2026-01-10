import type { ApiErrorHandler } from '../../utils/apiErrorHandling'
import type React from 'react'

/**
 * Represents a DSA Collection - a top-level container for organizing folders and items.
 * Collections are the root organizational unit in the DSA hierarchy.
 */
export interface Collection {
    /** Unique identifier for the collection */
    _id: string
    /** Display name of the collection */
    name: string
    /** Optional description of the collection */
    description?: string
    /** Whether the collection is publicly accessible */
    public?: boolean
    /** ISO timestamp when the collection was created */
    created?: string
    /** ISO timestamp when the collection was last updated */
    updated?: string
    /** Additional properties that may be present on the collection */
    [key: string]: unknown
}

/**
 * Represents a DSA Folder - a container within a collection or another folder.
 * Folders can contain subfolders and items, creating a hierarchical structure.
 */
export interface Folder {
    /** Unique identifier for the folder */
    _id: string
    /** Display name of the folder */
    name: string
    /** Optional description of the folder */
    description?: string
    /** Whether the folder is publicly accessible */
    public?: boolean
    /** ISO timestamp when the folder was created */
    created?: string
    /** ISO timestamp when the folder was last updated */
    updated?: string
    /** ID of the parent resource (collection or folder) */
    parentId?: string
    /** Type of the parent resource */
    parentType?: 'collection' | 'folder'
    /** Additional properties that may be present on the folder */
    [key: string]: unknown
}

/**
 * Represents a DSA Item - a file or document stored in the DSA.
 * Items are the leaf nodes in the DSA hierarchy and cannot contain other resources.
 */
export interface Item {
    /** Unique identifier for the item */
    _id: string
    /** Display name of the item */
    name: string
    /** Optional description of the item */
    description?: string
    /** ID of the folder containing this item */
    folderId?: string
    /** ID of the collection containing this item (if directly in a collection) */
    collectionId?: string
    /** Whether the item is publicly accessible */
    public?: boolean
    /** ISO timestamp when the item was created */
    created?: string
    /** ISO timestamp when the item was last updated */
    updated?: string
    /** Additional properties that may be present on the item */
    [key: string]: unknown
}

/**
 * A discriminated union type representing any DSA resource (collection, folder, or item).
 * The `type` field allows TypeScript to narrow the type correctly.
 * 
 * @example
 * ```tsx
 * function handleResource(resource: Resource) {
 *   if (resource.type === 'collection') {
 *     // TypeScript knows resource is a Collection here
 *     console.log('Collection:', resource.name)
 *   } else if (resource.type === 'folder') {
 *     // TypeScript knows resource is a Folder here
 *     console.log('Folder:', resource.name)
 *   } else {
 *     // TypeScript knows resource is an Item here
 *     console.log('Item:', resource.name)
 *   }
 * }
 * ```
 */
export type Resource = (Collection | Folder | Item) & { type: 'collection' | 'folder' | 'item' }

export interface FolderBrowserProps {
    /** Base URL for DSA API (e.g., http://bdsa.pathology.emory.edu:8080/api/v1) */
    apiBaseUrl?: string
    /** Custom fetch function for API requests. Useful for adding authentication headers. */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>
    /** Custom headers to add to all API requests. Merged with fetchFn headers if both are provided. */
    apiHeaders?: HeadersInit
    /** Callback when a resource (collection or folder) is selected */
    onResourceSelect?: (resource: Resource) => void
    /** Callback when an item is selected */
    onItemSelect?: (item: Item) => void
    /** Unified callback for any selection (resource or item) */
    onSelectionChange?: (resource: Resource) => void
    /** Whether to show collections (default: true) */
    showCollections?: boolean
    /** 
     * Root collection or folder ID to start from. 
     * When provided, the component will navigate directly to and display only this resource and its children.
     * This is useful for:
     * - Deep linking to a specific folder/collection
     * - Starting at a default or "home" folder
     * - Restricting the view to a specific subtree
     * 
     * @example
     * ```tsx
     * <FolderBrowser
     *   apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
     *   rootId="695d6a148c871f3a02969b00"
     *   rootType="collection"
     * />
     * ```
     */
    rootId?: string
    /** 
     * Type of root resource. Required if `rootId` is provided.
     * 
     * - `'collection'`: Start at a specific collection
     * - `'folder'`: Start at a specific folder
     * 
     * @example
     * ```tsx
     * <FolderBrowser
     *   apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
     *   rootId="695d6a148c871f3a02969b00"
     *   rootType="folder"
     *   onResourceSelect={(resource) => console.log('Selected:', resource)}
     * />
     * ```
     */
    rootType?: 'collection' | 'folder'
    /** Collection ID to auto-expand on load */
    startCollectionId?: string
    /** Folder ID to auto-expand on load */
    startFolderId?: string
    /** Start at a folder's subfolder (requires parentFolderId) (deprecated: use rootId and rootType) */
    parentFolderId?: string
    /** Custom render function for collections */
    renderCollection?: (collection: Collection, isExpanded: boolean, onToggle: () => void, itemCount?: number) => React.ReactNode
    /** Custom render function for folders */
    renderFolder?: (folder: Folder, depth: number, isExpanded: boolean, onToggle: () => void, itemCount?: number) => React.ReactNode
    /** Custom render function for items */
    renderItem?: (item: Item, depth: number) => React.ReactNode
    /** Custom CSS class name */
    className?: string
    /** Whether to persist expansion state to localStorage (default: false) */
    persistExpansion?: boolean
    /** Key prefix for localStorage keys when persistExpansion is true (default: 'bdsa-folder-browser') */
    persistExpansionKey?: string
    /** Whether to persist selection to localStorage (default: false) */
    persistSelection?: boolean
    /** Key for localStorage when persistSelection is true (default: 'bdsa-folder-browser-selection') */
    persistSelectionKey?: string
    /** Maximum number of folders to fetch per page (0 = fetch all, default: 0) */
    foldersPerPage?: number
    /** Maximum number of items to fetch per page (0 = fetch all, default: 0) */
    itemsPerPage?: number
    /** Whether to fetch and display items (default: false) */
    showItems?: boolean
    /** Whether to fetch items (for counting) even if not displaying them (default: false) */
    fetchItems?: boolean
    /** 
     * Controls how item pagination works when there are more items than `itemsPerPage`.
     * 
     * - `'manual'` (default): Show `+N` indicator (e.g., `+25` for 25 more items). 
     *   Single click loads next page, double click loads all remaining items.
     * - `'auto'`: Auto-load all items when folder expands (no manual pagination needed).
     * - `'button'`: Show explicit "Load More Items" button instead of `+N` indicator.
     * 
     * @example
     * ```tsx
     * <FolderBrowser
     *   apiBaseUrl={apiBaseUrl}
     *   showItems={true}
     *   itemsPerPage={50}
     *   itemPaginationMode="auto"  // Auto-load all items
     * />
     * ```
     */
    itemPaginationMode?: 'manual' | 'auto' | 'button'
    /** Filter function for items (applied after fetching) */
    itemFilter?: (item: Item) => boolean
    /** Callback when items are fetched for a folder */
    onItemsFetched?: (folderId: string, items: Item[]) => void
    /** Whether to show item count next to folder names (default: false) */
    showItemCount?: boolean
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
     * <FolderBrowser
     *   apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
     *   onApiError={(error, retry, context) => {
     *     if (error.status === 401) {
     *       // Token expired, refresh and retry
     *       refreshToken().then(() => retry())
     *     } else if (error.status === 503) {
     *       // Server temporarily unavailable, retry after delay
     *       setTimeout(() => retry(), 2000)
     *     } else {
     *       // Show error to user
     *       showErrorNotification(error.message)
     *     }
     *   }}
     * />
     * ```
     */
    onApiError?: ApiErrorHandler
    /** If true, enables debug logging to console. Default: false */
    debug?: boolean
}

