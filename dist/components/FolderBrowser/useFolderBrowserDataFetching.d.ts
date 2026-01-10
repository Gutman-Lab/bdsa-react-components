import { Collection, Folder, Item } from './FolderBrowser.types';
import { ApiErrorHandler } from '../../utils/apiErrorHandling';
import { DebugLogger } from '../../utils/debugLog';

export interface UseFolderBrowserDataFetchingParams {
    apiBaseUrl?: string;
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>;
    apiHeaders?: HeadersInit;
    foldersPerPage?: number;
    itemsPerPage?: number;
    shouldFetchItems: boolean;
    itemFilter?: (item: Item) => boolean;
    onItemsFetched?: (folderId: string, items: Item[]) => void;
    onApiError?: ApiErrorHandler;
    startCollectionId?: string;
    startFolderId?: string;
    rootId?: string;
    rootType?: 'collection' | 'folder';
    setCollections: React.Dispatch<React.SetStateAction<Collection[]>>;
    setRootCollection: React.Dispatch<React.SetStateAction<Collection | null>>;
    setRootFolder: React.Dispatch<React.SetStateAction<Folder | null>>;
    setFolders: React.Dispatch<React.SetStateAction<Record<string, Folder[]>>>;
    setItems: React.Dispatch<React.SetStateAction<Record<string, Item[]>>>;
    setPaginationState: React.Dispatch<React.SetStateAction<Record<string, {
        offset: number;
        hasMore: boolean;
        loaded: boolean;
    }>>>;
    setItemPaginationState: React.Dispatch<React.SetStateAction<Record<string, {
        offset: number;
        hasMore: boolean;
        totalCount?: number;
    }>>>;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setLoadingFolders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setLoadingItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setError: React.Dispatch<React.SetStateAction<Error | null>>;
    setExpandedCollections: React.Dispatch<React.SetStateAction<Set<string>>>;
    setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
    paginationState: Record<string, {
        offset: number;
        hasMore: boolean;
        loaded: boolean;
    }>;
    itemPaginationState: Record<string, {
        offset: number;
        hasMore: boolean;
        totalCount?: number;
    }>;
    debugLog: DebugLogger;
}
export interface UseFolderBrowserDataFetchingReturn {
    loadCollections: () => Promise<void>;
    loadFoldersForCollection: (collection: Collection, append?: boolean) => Promise<void>;
    loadFoldersForFolder: (folder: Folder, append?: boolean) => Promise<void>;
    loadItemsForFolder: (folderId: string, folder?: Folder, append?: boolean) => Promise<void>;
    loadRoot: () => Promise<void>;
}
export declare function useFolderBrowserDataFetching(params: UseFolderBrowserDataFetchingParams): UseFolderBrowserDataFetchingReturn;
//# sourceMappingURL=useFolderBrowserDataFetching.d.ts.map