import { useCallback } from 'react'
import type { Collection, Folder, Item } from './FolderBrowser.types'
import { buildFetchOptions as buildFetchOptionsUtil, parsePaginatedResponse, searchFolderInCollections } from './FolderBrowser.utils'
import { handleApiError, type ApiError, type ApiErrorHandler } from '../../utils/apiErrorHandling'
import type { DebugLogger } from '../../utils/debugLog'

export interface UseFolderBrowserDataFetchingParams {
    // Props
    apiBaseUrl?: string
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>
    apiHeaders?: HeadersInit
    foldersPerPage?: number
    itemsPerPage?: number
    shouldFetchItems: boolean
    itemFilter?: (item: Item) => boolean
    onItemsFetched?: (folderId: string, items: Item[]) => void
    onApiError?: ApiErrorHandler
    startCollectionId?: string
    startFolderId?: string
    rootId?: string
    rootType?: 'collection' | 'folder'

    // State setters
    setCollections: React.Dispatch<React.SetStateAction<Collection[]>>
    setRootCollection: React.Dispatch<React.SetStateAction<Collection | null>>
    setRootFolder: React.Dispatch<React.SetStateAction<Folder | null>>
    setFolders: React.Dispatch<React.SetStateAction<Record<string, Folder[]>>>
    setItems: React.Dispatch<React.SetStateAction<Record<string, Item[]>>>
    setPaginationState: React.Dispatch<React.SetStateAction<Record<string, { offset: number; hasMore: boolean; loaded: boolean }>>>
    setItemPaginationState: React.Dispatch<React.SetStateAction<Record<string, { offset: number; hasMore: boolean; totalCount?: number }>>>
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
    setLoadingFolders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    setLoadingItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    setError: React.Dispatch<React.SetStateAction<Error | null>>
    setExpandedCollections: React.Dispatch<React.SetStateAction<Set<string>>>
    setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>

    // State values (for reading)
    paginationState: Record<string, { offset: number; hasMore: boolean; loaded: boolean }>
    itemPaginationState: Record<string, { offset: number; hasMore: boolean; totalCount?: number }>

    // Utilities
    debugLog: DebugLogger
}

export interface UseFolderBrowserDataFetchingReturn {
    loadCollections: () => Promise<void>
    loadFoldersForCollection: (collection: Collection, append?: boolean) => Promise<void>
    loadFoldersForFolder: (folder: Folder, append?: boolean) => Promise<void>
    loadItemsForFolder: (folderId: string, folder?: Folder, append?: boolean) => Promise<void>
    loadRoot: () => Promise<void>
}

export function useFolderBrowserDataFetching(
    params: UseFolderBrowserDataFetchingParams
): UseFolderBrowserDataFetchingReturn {
    const {
        apiBaseUrl,
        fetchFn,
        apiHeaders,
        foldersPerPage = 50,
        itemsPerPage = 50,
        shouldFetchItems,
        itemFilter,
        onItemsFetched,
        onApiError,
        startCollectionId,
        startFolderId,
        rootId,
        rootType,
        setCollections,
        setRootCollection,
        setRootFolder,
        setFolders,
        setItems,
        setPaginationState,
        setItemPaginationState,
        setLoading,
        setLoadingFolders,
        setLoadingItems,
        setError,
        setExpandedCollections,
        setExpandedFolders,
        itemPaginationState,
        debugLog,
    } = params

    // Build fetch options helper
    const buildFetchOptions = useCallback((): RequestInit => {
        return buildFetchOptionsUtil(apiHeaders)
    }, [apiHeaders])

    // Fetch folders for a collection
    const loadFoldersForCollection = useCallback(async (collection: Collection, append = false) => {
        if (!apiBaseUrl || !collection?._id) return

        // Check if already loaded (prevents infinite loops for collections with no folders)
        let alreadyLoaded = false
        let currentOffset = 0
        setPaginationState(prev => {
            const existing = prev[collection._id]
            if (existing?.loaded && !append) {
                alreadyLoaded = true
            }
            if (append && existing) {
                currentOffset = existing.offset
            }
            return prev
        })

        // If already loaded and not appending, skip the fetch
        if (alreadyLoaded) {
            return
        }

        setLoadingFolders(prev => ({ ...prev, [collection._id]: true }))

        try {
            const params = new URLSearchParams({
                parentType: 'collection',
                parentId: collection._id,
            })

            // Add pagination if foldersPerPage > 0
            if (foldersPerPage > 0) {
                params.append('limit', String(foldersPerPage))
                params.append('offset', String(currentOffset))
            }

            const url = `${apiBaseUrl}/folder?${params.toString()}`
            const customFetch = fetchFn || fetch
            const fetchOptions = buildFetchOptions()

            const response = await customFetch(url, fetchOptions)

            if (!response.ok) {
                const error = new Error(`Failed to fetch folders for collection ${collection._id}: ${response.status} ${response.statusText}`) as ApiError
                error.status = response.status
                error.statusText = response.statusText
                error.isRetryable = [401, 429, 500, 502, 503, 504].includes(response.status)

                handleApiError(
                    error,
                    response,
                    onApiError,
                    () => loadFoldersForCollection(collection, append),
                    {
                        endpoint: url,
                        operation: 'fetch',
                        metadata: { collectionId: collection._id, append },
                    }
                )

                debugLog.warn(`Failed to fetch folders for collection ${collection._id}:`, response.statusText)
                return
            }

            const data = await response.json()

            // Handle both array and paginated response
            const parsed = parsePaginatedResponse<Folder>(data, currentOffset, foldersPerPage)
            const foldersList = parsed.items
            const hasMore = parsed.hasMore

            setFolders(prev => ({
                ...prev,
                [collection._id]: append
                    ? [...(prev[collection._id] || []), ...foldersList]
                    : foldersList,
            }))

            // Update pagination state - mark as loaded even if empty
            setPaginationState(prev => ({
                ...prev,
                [collection._id]: {
                    offset: foldersPerPage > 0 ? currentOffset + foldersList.length : 0,
                    hasMore: foldersPerPage > 0 ? hasMore : false,
                    loaded: true, // Mark as loaded to prevent re-fetching
                },
            }))

            // If startFolderId is provided and this is the target collection, expand the folder
            // Note: loadFoldersForFolder is defined below, but we'll call it after it's defined
            // For now, we'll skip auto-expanding subfolders here to avoid the order issue
            if (!append && startFolderId && foldersList.some(f => f._id === startFolderId)) {
                setExpandedFolders(prev => new Set(prev).add(startFolderId))
                // loadFoldersForFolder will be called separately if needed
            }
        } catch (err) {
            const url = `${apiBaseUrl}/folder?parentType=collection&parentId=${collection._id}`
            handleApiError(
                err,
                undefined,
                onApiError,
                () => loadFoldersForCollection(collection, append),
                {
                    endpoint: url,
                    operation: 'fetch',
                    metadata: { collectionId: collection._id, append },
                }
            )
            console.error(`Error loading folders for collection ${collection._id}:`, err)
        } finally {
            setLoadingFolders(prev => ({ ...prev, [collection._id]: false }))
        }
    }, [apiBaseUrl, fetchFn, buildFetchOptions, startFolderId, foldersPerPage, setFolders, setPaginationState, setLoadingFolders, setExpandedFolders, debugLog, onApiError])

    // Fetch subfolders for a folder
    const loadFoldersForFolder = useCallback(async (folder: Folder, append = false) => {
        if (!apiBaseUrl || !folder?._id) return

        // Check if already loaded (prevents infinite loops for folders with no subfolders)
        let alreadyLoaded = false
        let currentOffset = 0
        setPaginationState(prev => {
            const existing = prev[folder._id]
            if (existing?.loaded && !append) {
                alreadyLoaded = true
            }
            if (append && existing) {
                currentOffset = existing.offset
            }
            return prev
        })

        // If already loaded and not appending, skip the fetch
        if (alreadyLoaded) {
            return
        }

        setLoadingFolders(prev => ({ ...prev, [folder._id]: true }))

        try {
            const params = new URLSearchParams({
                parentType: 'folder',
                parentId: folder._id,
            })

            // Add pagination if foldersPerPage > 0
            if (foldersPerPage > 0) {
                params.append('limit', String(foldersPerPage))
                params.append('offset', String(currentOffset))
            }

            const url = `${apiBaseUrl}/folder?${params.toString()}`
            const customFetch = fetchFn || fetch
            const fetchOptions = buildFetchOptions()

            const response = await customFetch(url, fetchOptions)

            if (!response.ok) {
                const error = new Error(`Failed to fetch subfolders for folder ${folder._id}: ${response.status} ${response.statusText}`) as ApiError
                error.status = response.status
                error.statusText = response.statusText
                error.isRetryable = [401, 429, 500, 502, 503, 504].includes(response.status)

                handleApiError(
                    error,
                    response,
                    onApiError,
                    () => loadFoldersForFolder(folder, append),
                    {
                        endpoint: url,
                        operation: 'fetch',
                        metadata: { folderId: folder._id, append },
                    }
                )

                debugLog.warn(`Failed to fetch subfolders for folder ${folder._id}:`, response.statusText)
                return
            }

            const data = await response.json()

            // Handle both array and paginated response
            const parsed = parsePaginatedResponse<Folder>(data, currentOffset, foldersPerPage)
            const foldersList = parsed.items
            const hasMore = parsed.hasMore

            setFolders(prev => ({
                ...prev,
                [folder._id]: append
                    ? [...(prev[folder._id] || []), ...foldersList]
                    : foldersList,
            }))

            // Update pagination state - mark as loaded even if empty (prevents infinite loops)
            setPaginationState(prev => ({
                ...prev,
                [folder._id]: {
                    offset: foldersPerPage > 0 ? currentOffset + foldersList.length : 0,
                    hasMore: foldersPerPage > 0 ? hasMore : false,
                    loaded: true, // Mark as loaded to prevent re-fetching empty folders
                },
            }))
        } catch (err) {
            const url = `${apiBaseUrl}/folder?parentType=folder&parentId=${folder._id}`
            handleApiError(
                err,
                undefined,
                onApiError,
                () => loadFoldersForFolder(folder, append),
                {
                    endpoint: url,
                    operation: 'fetch',
                    metadata: { folderId: folder._id, append },
                }
            )
            console.error(`Error loading subfolders for folder ${folder._id}:`, err)
        } finally {
            setLoadingFolders(prev => ({ ...prev, [folder._id]: false }))
        }
    }, [apiBaseUrl, fetchFn, buildFetchOptions, foldersPerPage, setFolders, setPaginationState, setLoadingFolders, debugLog, onApiError])

    // Fetch items for a folder (only for subfolders, not root folders)
    const loadItemsForFolder = useCallback(async (folderId: string, folder?: Folder, append = false) => {
        // Only fetch if shouldFetchItems is enabled
        if (!apiBaseUrl || !shouldFetchItems) return

        // Debug: Log folder info to understand structure
        if (folder) {
            debugLog.log(`Checking folder ${folderId} (${folder.name}):`, {
                parentType: folder.parentType,
                parentId: folder.parentId,
                shouldFetchItems,
            })
        }

        const currentOffset = append && itemPaginationState[folderId]
            ? itemPaginationState[folderId].offset
            : 0

        setLoadingItems(prev => ({ ...prev, [folderId]: true }))

        try {
            const params = new URLSearchParams()
            // Use folderId parameter (required by API)
            params.append('folderId', folderId)

            // Add pagination if itemsPerPage > 0
            if (itemsPerPage > 0) {
                params.append('limit', String(itemsPerPage))
                params.append('offset', String(currentOffset))
            }

            const url = `${apiBaseUrl}/item?${params.toString()}`
            debugLog.log(`Fetching items from: ${url}`)

            const customFetch = fetchFn || fetch
            const fetchOptions = buildFetchOptions()

            const response = await customFetch(url, fetchOptions)

            if (!response.ok) {
                const error = new Error(`Failed to fetch items for folder ${folderId}: ${response.status} ${response.statusText}`) as ApiError
                error.status = response.status
                error.statusText = response.statusText
                error.isRetryable = [401, 429, 500, 502, 503, 504].includes(response.status)

                handleApiError(
                    error,
                    response,
                    onApiError,
                    () => loadItemsForFolder(folderId, folder, append),
                    {
                        endpoint: url,
                        operation: 'fetch',
                        metadata: { folderId, append },
                    }
                )

                debugLog.warn(`Failed to fetch items for folder ${folderId}:`, response.status, response.statusText)
                return
            }

            const data = await response.json()
            debugLog.log(`Received response:`, data)

            // Handle both array and paginated response
            const parsed = parsePaginatedResponse<Item>(data, currentOffset, itemsPerPage)
            const itemsList = parsed.items
            const hasMore = parsed.hasMore
            const totalCount = parsed.total

            debugLog.log(`Parsed ${itemsList.length} items for folder ${folderId}, total: ${totalCount || 'unknown'}, hasMore: ${hasMore}, currentOffset: ${currentOffset}`)

            // Call onItemsFetched with ALL fetched items (before filtering)
            if (onItemsFetched) {
                onItemsFetched(folderId, itemsList)
            }

            // Apply item filter if provided
            let filteredItems = itemsList
            if (itemFilter) {
                filteredItems = itemsList.filter(itemFilter)
                debugLog.log(`Filtered ${itemsList.length} → ${filteredItems.length} items for folder ${folderId}`)
            }

            setItems(prev => ({
                ...prev,
                [folderId]: append
                    ? [...(prev[folderId] || []), ...filteredItems]
                    : filteredItems,
            }))

            // Update item pagination state with total count
            setItemPaginationState(prev => ({
                ...prev,
                [folderId]: {
                    offset: currentOffset + itemsList.length, // Track offset of ALL items (not filtered)
                    hasMore,
                    totalCount: totalCount !== undefined ? totalCount : prev[folderId]?.totalCount, // Preserve existing totalCount if not provided
                },
            }))
        } catch (err) {
            const url = `${apiBaseUrl}/item?folderId=${folderId}`
            handleApiError(
                err,
                undefined,
                onApiError,
                () => loadItemsForFolder(folderId, folder, append),
                {
                    endpoint: url,
                    operation: 'fetch',
                    metadata: { folderId, append },
                }
            )
            console.error(`[FolderBrowser] Error loading items for folder ${folderId}:`, err)
        } finally {
            setLoadingItems(prev => ({ ...prev, [folderId]: false }))
        }
    }, [apiBaseUrl, fetchFn, buildFetchOptions, shouldFetchItems, itemsPerPage, itemPaginationState, itemFilter, onItemsFetched, setItems, setItemPaginationState, setLoadingItems, debugLog, onApiError])

    // Fetch collections
    const loadCollections = useCallback(async () => {
        if (!apiBaseUrl) {
            setError(new Error('API base URL is required'))
            return
        }

        setLoading(true)
        setError(null)

        try {
            const url = `${apiBaseUrl}/collection`
            const customFetch = fetchFn || fetch
            const fetchOptions = buildFetchOptions()

            const response = await customFetch(url, fetchOptions)

            if (!response.ok) {
                const error = new Error(`Failed to fetch collections: ${response.status} ${response.statusText}`) as ApiError
                error.status = response.status
                error.statusText = response.statusText
                error.isRetryable = [401, 429, 500, 502, 503, 504].includes(response.status)

                handleApiError(
                    error,
                    response,
                    onApiError,
                    () => loadCollections(),
                    {
                        endpoint: url,
                        operation: 'fetch',
                        metadata: { type: 'collections' },
                    }
                )

                setError(error)
                return
            }

            const data = await response.json()
            // Handle both array and paginated response
            const collectionsList: Collection[] = Array.isArray(data)
                ? data
                : data.items || []

            setCollections(collectionsList)

            // If startCollectionId is provided, expand it automatically
            if (startCollectionId && collectionsList.some(c => c._id === startCollectionId)) {
                setExpandedCollections(new Set([startCollectionId]))
                await loadFoldersForCollection(collectionsList.find(c => c._id === startCollectionId)!)
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error loading collections')
            setError(error)

            handleApiError(
                err,
                undefined,
                onApiError,
                () => loadCollections(),
                {
                    endpoint: `${apiBaseUrl}/collection`,
                    operation: 'fetch',
                    metadata: { type: 'collections' },
                }
            )

            console.error('Error loading collections:', error)
        } finally {
            setLoading(false)
        }
    }, [apiBaseUrl, fetchFn, buildFetchOptions, startCollectionId, setCollections, setExpandedCollections, setLoading, setError, loadFoldersForCollection, onApiError])

    // Load root collection or folder
    const loadRoot = useCallback(async () => {
        if (!apiBaseUrl || !rootId || !rootType) {
            return
        }

        setLoading(true)
        setError(null)

        try {
            // Try direct fetch first (some APIs support /collection/{id} or /folder/{id})
            let url = rootType === 'collection'
                ? `${apiBaseUrl}/collection/${rootId}`
                : `${apiBaseUrl}/folder/${rootId}`

            const customFetch = fetchFn || fetch
            const fetchOptions = buildFetchOptions()

            let response = await customFetch(url, fetchOptions)

            let data: Collection | Folder | null = null

            // If direct fetch fails, fall back to listing and finding by ID
            if (!response.ok) {
                const error = new Error(`Failed to fetch ${rootType} ${rootId}: ${response.status} ${response.statusText}`) as ApiError
                error.status = response.status
                error.statusText = response.statusText
                error.isRetryable = [401, 429, 500, 502, 503, 504].includes(response.status)

                // Only call onApiError if it's not retryable or if it's a 404 (not found)
                // For retryable errors, we'll try fallback first
                if (!error.isRetryable || response.status === 404) {
                    handleApiError(
                        error,
                        response,
                        onApiError,
                        () => loadRoot(),
                        {
                            endpoint: url,
                            operation: 'fetch',
                            metadata: { rootId, rootType },
                        }
                    )
                }

                debugLog.warn(`Direct fetch failed for ${rootType} ${rootId}, trying list endpoint...`)

                if (rootType === 'collection') {
                    // List all collections and find the matching one
                    const listUrl = `${apiBaseUrl}/collection`
                    response = await customFetch(listUrl, fetchOptions)

                    if (!response.ok) {
                        const error = new Error(`Failed to fetch collections: ${response.status} ${response.statusText}`) as ApiError
                        error.status = response.status
                        error.statusText = response.statusText
                        error.isRetryable = [401, 429, 500, 502, 503, 504].includes(response.status)

                        handleApiError(
                            error,
                            response,
                            onApiError,
                            () => loadRoot(),
                            {
                                endpoint: listUrl,
                                operation: 'fetch',
                                metadata: { rootId, rootType, fallback: true },
                            }
                        )

                        throw error
                    }

                    const listData = await response.json()
                    const collectionsList: Collection[] = Array.isArray(listData) ? listData : (listData.items || [])
                    data = collectionsList.find(c => c._id === rootId) || null

                    if (!data) {
                        throw new Error(`Collection with ID ${rootId} not found`)
                    }
                } else {
                    // For folders, we need to search through collections and their folders
                    // This is more complex, so we'll try a different approach
                    // First try listing all folders (if API supports it)
                    try {
                        const listUrl = `${apiBaseUrl}/folder`
                        response = await customFetch(listUrl, fetchOptions)

                        if (response.ok) {
                            const listData = await response.json()
                            const foldersList: Folder[] = Array.isArray(listData) ? listData : (listData.items || [])
                            data = foldersList.find(f => f._id === rootId) || null
                        }
                    } catch (listErr) {
                        debugLog.warn('Could not list folders directly, will need to search through collections')
                    }

                    // If still not found, search through collections
                    if (!data) {
                        data = await searchFolderInCollections(rootId, apiBaseUrl, customFetch, fetchOptions, debugLog)
                        if (!data) {
                            throw new Error(`Folder with ID ${rootId} not found in any collection`)
                        }
                    }
                }
            } else {
                data = await response.json()
            }

            if (!data) {
                throw new Error(`${rootType} with ID ${rootId} not found`)
            }

            if (rootType === 'collection') {
                const collection = data as Collection
                setRootCollection(collection)
                setExpandedCollections(new Set([rootId]))
                // Load folders for this root collection (auto-expand)
                await loadFoldersForCollection(collection)
                // Note: Collections can have folders, but NOT items - items are only in folders
            } else {
                const folder = data as Folder
                setRootFolder(folder)
                setExpandedFolders(new Set([rootId]))
                // Load subfolders for this root folder (auto-expand)
                await loadFoldersForFolder(folder)
                // Note: Root folders can have subfolders, but typically don't have items
                // Only subfolders (parentType='folder') can have items
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(`Unknown error loading ${rootType}`)
            setError(error)

            const url = rootType === 'collection'
                ? `${apiBaseUrl}/collection/${rootId}`
                : `${apiBaseUrl}/folder/${rootId}`

            handleApiError(
                err,
                undefined,
                onApiError,
                () => loadRoot(),
                {
                    endpoint: url,
                    operation: 'fetch',
                    metadata: { rootId, rootType },
                }
            )

            console.error(`Error loading root ${rootType}:`, error)
        } finally {
            setLoading(false)
        }
    }, [apiBaseUrl, rootId, rootType, fetchFn, buildFetchOptions, setRootCollection, setRootFolder, setExpandedCollections, setExpandedFolders, setLoading, setError, loadFoldersForCollection, loadFoldersForFolder, debugLog, onApiError])

    return {
        loadCollections,
        loadFoldersForCollection,
        loadFoldersForFolder,
        loadItemsForFolder,
        loadRoot,
    }
}

