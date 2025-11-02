import React, { useState, useEffect, useCallback, useRef } from 'react'
import './FolderBrowser.css'

export interface Collection {
    _id: string
    name: string
    description?: string
    public?: boolean
    created?: string
    updated?: string
    [key: string]: unknown
}

export interface Folder {
    _id: string
    name: string
    description?: string
    public?: boolean
    created?: string
    updated?: string
    parentId?: string
    parentType?: 'collection' | 'folder'
    [key: string]: unknown
}

export interface Item {
    _id: string
    name: string
    description?: string
    folderId?: string
    collectionId?: string
    public?: boolean
    created?: string
    updated?: string
    [key: string]: unknown
}

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
    /** Callback when resource selection changes */
    onSelectionChange?: (resource: Resource | null) => void
    /** Show collections at the root level (default: true, ignored if rootId is provided) */
    showCollections?: boolean
    /** Root directory ID to start from (if provided, only shows this collection/folder and its children) */
    rootId?: string
    /** Type of root directory - 'collection' or 'folder' (required if rootId is provided) */
    rootType?: 'collection' | 'folder'
    /** Number of folders to load per page (default: 50, set to 0 to load all) */
    foldersPerPage?: number
    /** Start at a specific collection ID instead of showing all collections (deprecated: use rootId and rootType) */
    startCollectionId?: string
    /** Start at a specific folder ID (requires startCollectionId or parentFolderId) (deprecated: use rootId and rootType) */
    startFolderId?: string
    /** Start at a folder's subfolder (requires parentFolderId) (deprecated: use rootId and rootType) */
    parentFolderId?: string
    className?: string
    /** Custom render for collections */
    renderCollection?: (collection: Collection, isExpanded: boolean, onToggle: () => void) => React.ReactNode
    /** Custom render for folders */
    renderFolder?: (folder: Folder, depth: number, isExpanded: boolean, onToggle: () => void) => React.ReactNode
    /** If true, shows items (files) within folders and collections, not just folders. Default: false */
    showItems?: boolean
    /** Number of items to load per page when showItems is enabled (default: 50, set to 0 to load all) */
    itemsPerPage?: number
    /** Callback when an item is selected (only used when showItems is true) */
    onItemSelect?: (item: Item) => void
    /** Custom render for items */
    renderItem?: (item: Item, depth: number) => React.ReactNode
}

/**
 * FolderBrowser component for browsing DSA collections and folders.
 * 
 * This component provides a tree view of collections and folders in the DSA.
 * It supports:
 * - Listing collections at the root
 * - Expanding collections to show folders
 * - Expanding folders to show subfolders recursively
 * - Selecting collections and folders
 * - Optionally showing items (files) within folders and collections when `showItems={true}`
 * 
 * API Endpoints:
 * - Collections: GET /api/v1/collection
 * - Folders in collection: GET /api/v1/folder?parentType=collection&parentId={collectionId}
 * - Subfolders: GET /api/v1/folder?parentType=folder&parentId={folderId}
 * - Items in folder: GET /api/v1/item?folderId={folderId} (note: only subfolders can have items, not root folders or collections)
 */
export const FolderBrowser = React.forwardRef<HTMLDivElement, FolderBrowserProps>(
    (
        {
            apiBaseUrl,
            fetchFn,
            apiHeaders,
            onResourceSelect,
            onSelectionChange,
            showCollections = true,
            rootId,
            rootType,
            startCollectionId,
            startFolderId,
            parentFolderId: _parentFolderId,
            foldersPerPage = 50,
            className = '',
            renderCollection,
            renderFolder,
            showItems = true,
            itemsPerPage = 50,
            onItemSelect,
            renderItem,
        },
        ref
    ) => {
        const [collections, setCollections] = useState<Collection[]>([])
        const [rootCollection, setRootCollection] = useState<Collection | null>(null)
        const [rootFolder, setRootFolder] = useState<Folder | null>(null)
        const [folders, setFolders] = useState<Record<string, Folder[]>>({})
        const [items, setItems] = useState<Record<string, Item[]>>({}) // { [folderOrCollectionId]: Item[] }
        // Track pagination for each folder/collection: { [id]: { offset: number, hasMore: boolean, loaded: boolean } }
        // 'loaded' flag prevents infinite loops when folder has no subfolders
        const [paginationState, setPaginationState] = useState<Record<string, { offset: number; hasMore: boolean; loaded: boolean }>>({})
        // Track item pagination separately: { [id]: { offset: number, hasMore: boolean } }
        const [itemPaginationState, setItemPaginationState] = useState<Record<string, { offset: number; hasMore: boolean }>>({})
        const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
        const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
        const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
        const [loading, setLoading] = useState<boolean>(false)
        const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({})
        const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({})
        const [error, setError] = useState<Error | null>(null)
        
        // Ref to the container element for scroll position preservation
        const containerRef = useRef<HTMLDivElement | null>(null)

        // Build fetch options helper
        const buildFetchOptions = useCallback((): RequestInit => {
            const options: RequestInit = {}
            if (apiHeaders) {
                options.headers = apiHeaders
            }
            return options
        }, [apiHeaders])

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
                    throw new Error(`Failed to fetch collections: ${response.status} ${response.statusText}`)
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
                console.error('Error loading collections:', error)
            } finally {
                setLoading(false)
            }
        }, [apiBaseUrl, fetchFn, buildFetchOptions, startCollectionId])

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
                    console.warn(`Failed to fetch folders for collection ${collection._id}:`, response.statusText)
                    return
                }

                const data = await response.json()
                
                // Handle both array and paginated response
                let foldersList: Folder[] = []
                let hasMore = false

                if (Array.isArray(data)) {
                    foldersList = data
                    // If we got fewer items than the limit, there's no more
                    hasMore = foldersPerPage > 0 && data.length === foldersPerPage
                } else {
                    foldersList = data.items || []
                    hasMore = foldersPerPage > 0 && (data.total > (currentOffset + foldersList.length))
                }

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
                if (!append && startFolderId && foldersList.some(f => f._id === startFolderId)) {
                    setExpandedFolders(prev => new Set(prev).add(startFolderId))
                    await loadFoldersForFolder(foldersList.find(f => f._id === startFolderId)!, true)
                }
            } catch (err) {
                console.error(`Error loading folders for collection ${collection._id}:`, err)
            } finally {
                setLoadingFolders(prev => ({ ...prev, [collection._id]: false }))
            }
        }, [apiBaseUrl, fetchFn, buildFetchOptions, startFolderId, foldersPerPage])

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
                    console.warn(`Failed to fetch subfolders for folder ${folder._id}:`, response.statusText)
                    return
                }

                const data = await response.json()
                
                // Handle both array and paginated response
                let foldersList: Folder[] = []
                let hasMore = false

                if (Array.isArray(data)) {
                    foldersList = data
                    // If we got fewer items than the limit, there's no more
                    hasMore = foldersPerPage > 0 && data.length === foldersPerPage
                } else {
                    foldersList = data.items || []
                    hasMore = foldersPerPage > 0 && (data.total > (currentOffset + foldersList.length))
                }

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
                console.error(`Error loading subfolders for folder ${folder._id}:`, err)
            } finally {
                setLoadingFolders(prev => ({ ...prev, [folder._id]: false }))
            }
        }, [apiBaseUrl, fetchFn, buildFetchOptions, foldersPerPage])

        // Fetch items for a folder (only for subfolders, not root folders)
        const loadItemsForFolder = useCallback(async (folderId: string, folder?: Folder, append = false) => {
            if (!apiBaseUrl || !showItems) return

            // Debug: Log folder info to understand structure
            if (folder) {
                console.log(`[FolderBrowser] Checking folder ${folderId} (${folder.name}):`, {
                    parentType: folder.parentType,
                    parentId: folder.parentId,
                    hasItems: true // Always try to fetch if showItems is enabled
                })
            }

            // Check folder type for debugging
            // Note: Root folders (parentType='collection') typically don't have items per DSA API
            // But we'll attempt fetch anyway - the API will return empty if there are none
            if (folder) {
                if (folder.parentType === 'collection') {
                    console.log(`[FolderBrowser] Root folder ${folderId} (${folder.name}) - attempting item fetch (typically empty, but checking anyway)`)
                } else if (folder.parentType === 'folder') {
                    console.log(`[FolderBrowser] Subfolder ${folderId} (${folder.name}) - fetching items`)
                } else {
                    console.log(`[FolderBrowser] Folder ${folderId} (${folder.name}) - parentType unknown (${folder.parentType}), attempting fetch`)
                }
            } else {
                console.log(`[FolderBrowser] Folder object not provided for ${folderId} - attempting item fetch`)
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
                console.log(`[FolderBrowser] Fetching items from: ${url}`)
                
                const customFetch = fetchFn || fetch
                const fetchOptions = buildFetchOptions()

                const response = await customFetch(url, fetchOptions)

                if (!response.ok) {
                    console.warn(`[FolderBrowser] Failed to fetch items for folder ${folderId}:`, response.status, response.statusText)
                    
                    return
                }

                const data = await response.json()
                console.log(`[FolderBrowser] Received response:`, data)
                
                // Handle both array and paginated response
                let itemsList: Item[] = []
                let hasMore = false

                if (Array.isArray(data)) {
                    itemsList = data
                    hasMore = itemsPerPage > 0 && data.length === itemsPerPage
                } else {
                    itemsList = data.items || []
                    hasMore = itemsPerPage > 0 && (data.total > (currentOffset + itemsList.length))
                }

                console.log(`[FolderBrowser] Parsed ${itemsList.length} items for folder ${folderId}`)

                setItems(prev => ({
                    ...prev,
                    [folderId]: append
                        ? [...(prev[folderId] || []), ...itemsList]
                        : itemsList,
                }))

                // Update item pagination state
                if (itemsPerPage > 0) {
                    setItemPaginationState(prev => ({
                        ...prev,
                        [folderId]: {
                            offset: currentOffset + itemsList.length,
                            hasMore,
                        },
                    }))
                }
            } catch (err) {
                console.error(`[FolderBrowser] Error loading items for folder ${folderId}:`, err)
            } finally {
                setLoadingItems(prev => ({ ...prev, [folderId]: false }))
            }
        }, [apiBaseUrl, fetchFn, buildFetchOptions, showItems, itemsPerPage, itemPaginationState])

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
                    console.warn(`Direct fetch failed for ${rootType} ${rootId}, trying list endpoint...`)
                    
                    if (rootType === 'collection') {
                        // List all collections and find the matching one
                        const listUrl = `${apiBaseUrl}/collection`
                        response = await customFetch(listUrl, fetchOptions)
                        
                        if (!response.ok) {
                            throw new Error(`Failed to fetch collections: ${response.status} ${response.statusText}`)
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
                            console.warn('Could not list folders directly, will need to search through collections')
                        }
                        
                        // If still not found, search through collections
                        if (!data) {
                            const collectionsUrl = `${apiBaseUrl}/collection`
                            const collectionsResponse = await customFetch(collectionsUrl, fetchOptions)
                            
                            if (!collectionsResponse.ok) {
                                throw new Error(`Failed to fetch collections for folder search: ${collectionsResponse.status}`)
                            }
                            
                            const collectionsData = await collectionsResponse.json()
                            const collectionsList: Collection[] = Array.isArray(collectionsData) ? collectionsData : (collectionsData.items || [])
                            
                            // Search through each collection's folders
                            for (const collection of collectionsList) {
                                const foldersUrl = `${apiBaseUrl}/folder?parentType=collection&parentId=${collection._id}`
                                const foldersResponse = await customFetch(foldersUrl, fetchOptions)
                                
                                if (foldersResponse.ok) {
                                    const foldersData = await foldersResponse.json()
                                    const foldersList: Folder[] = Array.isArray(foldersData) ? foldersData : (foldersData.items || [])
                                    const found = foldersList.find(f => f._id === rootId)
                                    
                                    if (found) {
                                        data = found
                                        break
                                    }
                                    
                                    // Recursively search subfolders (depth-first search)
                                    const searchSubfolders = async (folder: Folder): Promise<Folder | null> => {
                                        const subfoldersUrl = `${apiBaseUrl}/folder?parentType=folder&parentId=${folder._id}`
                                        const subfoldersResponse = await customFetch(subfoldersUrl, fetchOptions)
                                        
                                        if (subfoldersResponse.ok) {
                                            const subfoldersData = await subfoldersResponse.json()
                                            const subfoldersList: Folder[] = Array.isArray(subfoldersData) ? subfoldersData : (subfoldersData.items || [])
                                            
                                            const found = subfoldersList.find(f => f._id === rootId)
                                            if (found) return found
                                            
                                            for (const subfolder of subfoldersList) {
                                                const deeper = await searchSubfolders(subfolder)
                                                if (deeper) return deeper
                                            }
                                        }
                                        return null
                                    }
                                    
                                    for (const folder of foldersList) {
                                        const found = await searchSubfolders(folder)
                                        if (found) {
                                            data = found
                                            break
                                        }
                                    }
                                    
                                    if (data) break
                                }
                            }
                            
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
                console.error(`Error loading root ${rootType}:`, error)
            } finally {
                setLoading(false)
            }
        }, [apiBaseUrl, rootId, rootType, fetchFn, buildFetchOptions, loadFoldersForCollection, loadFoldersForFolder])

        // Toggle collection expansion
        const toggleCollection = useCallback(async (collection: Collection) => {
            const isExpanded = expandedCollections.has(collection._id)

            if (isExpanded) {
                setExpandedCollections(prev => {
                    const next = new Set(prev)
                    next.delete(collection._id)
                    return next
                })
            } else {
                // Preserve scroll position before expanding to prevent scroll jumping
                const container = containerRef.current
                let scrollContainer: HTMLElement | null = null
                let scrollTop = 0
                
                // Find the scrollable parent element
                if (container) {
                    let element: HTMLElement | null = container.parentElement
                    while (element && element !== document.body) {
                        const style = window.getComputedStyle(element)
                        const overflowY = style.overflowY || style.overflow
                        if (overflowY === 'auto' || overflowY === 'scroll') {
                            scrollContainer = element
                            scrollTop = element.scrollTop
                            break
                        }
                        if (element.scrollHeight > element.clientHeight && element.clientHeight > 0) {
                            scrollContainer = element
                            scrollTop = element.scrollTop
                            break
                        }
                        element = element.parentElement
                    }
                }
                
                setExpandedCollections(prev => new Set(prev).add(collection._id))
                await loadFoldersForCollection(collection, false)
                // Note: Collections don't have direct items - items are in folders, so we don't fetch items here
                
                // Restore scroll position after state updates
                if (scrollContainer) {
                    const savedScrollTop = scrollTop
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (scrollContainer && scrollContainer.scrollTop !== undefined) {
                                scrollContainer.scrollTop = savedScrollTop
                            }
                        })
                    })
                }
            }
        }, [expandedCollections, loadFoldersForCollection])

        // Toggle folder expansion
        const toggleFolder = useCallback(async (folder: Folder) => {
            const isExpanded = expandedFolders.has(folder._id)

            if (isExpanded) {
                setExpandedFolders(prev => {
                    const next = new Set(prev)
                    next.delete(folder._id)
                    return next
                })
            } else {
                // Preserve scroll position before expanding to prevent scroll jumping
                const container = containerRef.current
                let scrollContainer: HTMLElement | null = null
                let scrollTop = 0
                
                // Find the scrollable parent element (typically the storybook container or a div with overflow)
                if (container) {
                    let element: HTMLElement | null = container.parentElement
                    while (element && element !== document.body) {
                        const style = window.getComputedStyle(element)
                        const overflowY = style.overflowY || style.overflow
                        // Check if element is scrollable
                        if (overflowY === 'auto' || overflowY === 'scroll') {
                            scrollContainer = element
                            scrollTop = element.scrollTop
                            break
                        }
                        // Also check if element has scrollable content even without explicit overflow
                        if (element.scrollHeight > element.clientHeight && element.clientHeight > 0) {
                            scrollContainer = element
                            scrollTop = element.scrollTop
                            break
                        }
                        element = element.parentElement
                    }
                }
                
                setExpandedFolders(prev => new Set(prev).add(folder._id))
                await loadFoldersForFolder(folder, false)
                // Load items if showItems is enabled
                if (showItems) {
                    console.log(`[FolderBrowser] Toggling folder ${folder._id} (${folder.name}) - showItems=${showItems}, calling loadItemsForFolder`)
                    await loadItemsForFolder(folder._id, folder, false)
                } else {
                    console.log(`[FolderBrowser] Toggling folder ${folder._id} (${folder.name}) - showItems is FALSE, skipping item load`)
                }
                
                // Restore scroll position after state updates
                // Use double requestAnimationFrame to ensure DOM has fully updated and rendered
                if (scrollContainer) {
                    const savedScrollTop = scrollTop
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (scrollContainer && scrollContainer.scrollTop !== undefined) {
                                scrollContainer.scrollTop = savedScrollTop
                            }
                        })
                    })
                }
            }
        }, [expandedFolders, loadFoldersForFolder, showItems, loadItemsForFolder])

        // Handle resource selection
        const handleResourceSelect = useCallback((resource: Collection | Folder, type: 'collection' | 'folder') => {
            const resourceWithType: Resource = { ...resource, type }
            setSelectedResource(resourceWithType)
            onResourceSelect?.(resourceWithType)
            onSelectionChange?.(resourceWithType)
        }, [onResourceSelect, onSelectionChange])

        // Handle item selection
        const handleItemSelect = useCallback((item: Item) => {
            const resourceWithType: Resource = { ...item, type: 'item' }
            setSelectedResource(resourceWithType)
            onItemSelect?.(item)
            onSelectionChange?.(resourceWithType)
        }, [onItemSelect, onSelectionChange])

        // Load root or collections on mount or when props change
        useEffect(() => {
            if (rootId && rootType && apiBaseUrl) {
                // Load specific root collection or folder
                loadRoot()
            } else if (showCollections && apiBaseUrl) {
                // Load all collections
                loadCollections()
            } else if (showCollections && !apiBaseUrl) {
                setError(new Error('API base URL is required'))
                setLoading(false)
            }
        }, [rootId, rootType, showCollections, apiBaseUrl, loadCollections, loadRoot])

        // Render item
        const renderItemNode = useCallback((item: Item, depth: number) => {
            const isSelected = selectedResource?._id === item._id && selectedResource?.type === 'item'

            if (renderItem) {
                return renderItem(item, depth)
            }

            return (
                <div key={item._id} className="bdsa-folder-browser__item" style={{ marginLeft: `${depth * 20}px` }}>
                    <div
                        className={`bdsa-folder-browser__folder-header ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleItemSelect(item)}
                        onDoubleClick={() => handleItemSelect(item)}
                    >
                        <span className="bdsa-folder-browser__folder-icon">📄</span>
                        <span className="bdsa-folder-browser__folder-name">{item.name}</span>
                        <span className="bdsa-folder-browser__folder-type">Item</span>
                    </div>
                </div>
            )
        }, [selectedResource, renderItem, handleItemSelect])

        // Render folder recursively (must be defined before renderCollectionNode)
        const renderFolderNode = useCallback((folder: Folder, depth = 0) => {
            const isExpanded = expandedFolders.has(folder._id)
            const subFolders = folders[folder._id] || []
            // Show items if loaded (regardless of parentType - API determines if items exist)
            const folderItems = showItems ? (items[folder._id] || []) : []
            const isSelected = selectedResource?._id === folder._id && selectedResource?.type === 'folder'

            if (renderFolder) {
                return renderFolder(folder, depth, isExpanded, () => toggleFolder(folder))
            }

            return (
                <div key={folder._id} className="bdsa-folder-browser__folder" style={{ marginLeft: `${depth * 20}px` }}>
                    <div
                        className={`bdsa-folder-browser__folder-header ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleFolder(folder)}
                        onDoubleClick={() => handleResourceSelect(folder, 'folder')}
                    >
                        <span className={`bdsa-folder-browser__folder-icon ${isExpanded ? 'expanded' : ''}`}>
                            {isExpanded ? '📂' : '📁'}
                        </span>
                        <span className="bdsa-folder-browser__folder-name">{folder.name}</span>
                        <span className="bdsa-folder-browser__folder-type">Folder</span>
                    </div>

                    {isExpanded && (
                        <div className="bdsa-folder-browser__folder-contents">
                            {/* Render subfolders */}
                            {subFolders.map(subFolder => renderFolderNode(subFolder, depth + 1))}
                            {/* Render items in this folder if showItems is enabled */}
                            {showItems && folderItems.map(item => renderItemNode(item, depth + 1))}
                            {/* Show loading indicator for items */}
                            {showItems && loadingItems[folder._id] && (
                                <div className="bdsa-folder-browser__loading" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
                                    <span>Loading items...</span>
                                </div>
                            )}
                            {/* Load More button for folders if pagination is enabled and there are more folders */}
                            {foldersPerPage > 0 && paginationState[folder._id]?.hasMore && !loadingFolders[folder._id] && (
                                <div className="bdsa-folder-browser__load-more" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
                                    <button
                                        className="bdsa-folder-browser__load-more-btn"
                                        onClick={() => loadFoldersForFolder(folder, true)}
                                        disabled={loadingFolders[folder._id]}
                                    >
                                        {loadingFolders[folder._id] ? 'Loading...' : 'Load More Folders'}
                                    </button>
                                </div>
                            )}
                            {/* Load More button for items if pagination is enabled and there are more items */}
                            {showItems && itemsPerPage > 0 && itemPaginationState[folder._id]?.hasMore && (
                                <div className="bdsa-folder-browser__load-more" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
                                    <button
                                        className="bdsa-folder-browser__load-more-btn"
                                        onClick={() => loadItemsForFolder(folder._id, folder, true)}
                                        disabled={loadingItems[folder._id]}
                                    >
                                        {loadingItems[folder._id] ? 'Loading...' : 'Load More Items'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        }, [expandedFolders, folders, items, showItems, selectedResource, renderFolder, toggleFolder, handleResourceSelect, foldersPerPage, paginationState, loadingFolders, loadFoldersForFolder, itemsPerPage, itemPaginationState, loadingItems, loadItemsForFolder, renderItemNode])

        // Render collection (must be defined after renderFolderNode)
        const renderCollectionNode = useCallback((collection: Collection) => {
            const isExpanded = expandedCollections.has(collection._id)
            const collectionFolders = folders[collection._id] || []
            // Note: Collections don't have direct items - items are in folders
            const isSelected = selectedResource?._id === collection._id && selectedResource?.type === 'collection'

            if (renderCollection) {
                return renderCollection(collection, isExpanded, () => toggleCollection(collection))
            }

            return (
                <div key={collection._id} className="bdsa-folder-browser__collection">
                    <div
                        className={`bdsa-folder-browser__folder-header ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleCollection(collection)}
                        onDoubleClick={() => handleResourceSelect(collection, 'collection')}
                    >
                        <span className={`bdsa-folder-browser__folder-icon ${isExpanded ? 'expanded' : ''}`}>
                            {isExpanded ? '📂' : '📁'}
                        </span>
                        <span className="bdsa-folder-browser__folder-name">{collection.name}</span>
                        <span className="bdsa-folder-browser__folder-type">Collection</span>
                    </div>

                    {isExpanded && (
                        <div className="bdsa-folder-browser__folder-contents">
                            {/* Render folders in this collection */}
                            {collectionFolders.map(folder => renderFolderNode(folder, 1))}
                            {/* Note: Collections don't have direct items - items are in folders */}
                            {/* Load More button for folders if pagination is enabled and there are more folders */}
                            {foldersPerPage > 0 && paginationState[collection._id]?.hasMore && !loadingFolders[collection._id] && (
                                <div className="bdsa-folder-browser__load-more">
                                    <button
                                        className="bdsa-folder-browser__load-more-btn"
                                        onClick={() => loadFoldersForCollection(collection, true)}
                                        disabled={loadingFolders[collection._id]}
                                    >
                                        {loadingFolders[collection._id] ? 'Loading...' : 'Load More Folders'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        }, [expandedCollections, folders, selectedResource, renderCollection, toggleCollection, handleResourceSelect, foldersPerPage, paginationState, loadingFolders, loadFoldersForCollection, renderFolderNode])

        return (
            <div 
                ref={(node) => {
                    // Support both forwarded ref and internal ref
                    if (typeof ref === 'function') {
                        ref(node)
                    } else if (ref && 'current' in ref) {
                        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
                    }
                    containerRef.current = node
                }}
                className={`bdsa-folder-browser ${className}`}
            >
                {loading && (
                    <div className="bdsa-folder-browser__loading">
                        <span>
                            {rootId && rootType 
                                ? `Loading ${rootType}...` 
                                : 'Loading collections...'}
                        </span>
                    </div>
                )}

                {error && (
                    <div className="bdsa-folder-browser__error">
                        <span>{error.message}</span>
                        <button onClick={() => {
                            if (rootId && rootType) {
                                loadRoot()
                            } else {
                                loadCollections()
                            }
                        }}>Retry</button>
                    </div>
                )}

                {!loading && !error && (
                    <>
                        {/* Show root collection or folder if specified */}
                        {rootId && rootType === 'collection' && rootCollection && (
                            <div className="bdsa-folder-browser__collections">
                                {renderCollectionNode(rootCollection)}
                            </div>
                        )}
                        {rootId && rootType === 'folder' && rootFolder && (
                            <div className="bdsa-folder-browser__collections">
                                {renderFolderNode(rootFolder, 0)}
                            </div>
                        )}
                        {/* Show all collections if no root is specified */}
                        {!rootId && showCollections && (
                            <div className="bdsa-folder-browser__collections">
                                {collections.length === 0 ? (
                                    <div className="bdsa-folder-browser__empty">
                                        <span>No collections found</span>
                                    </div>
                                ) : (
                                    collections.map(collection => renderCollectionNode(collection))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        )
    }
)

FolderBrowser.displayName = 'FolderBrowser'

