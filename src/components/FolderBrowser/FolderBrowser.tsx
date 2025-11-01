import React, { useState, useEffect, useCallback } from 'react'
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

export type Resource = (Collection | Folder) & { type: 'collection' | 'folder' }

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
 * 
 * API Endpoints:
 * - Collections: GET /api/v1/collection
 * - Folders in collection: GET /api/v1/folder?parentType=collection&parentId={collectionId}
 * - Subfolders: GET /api/v1/folder?parentType=folder&parentId={folderId}
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
        },
        ref
    ) => {
        const [collections, setCollections] = useState<Collection[]>([])
        const [rootCollection, setRootCollection] = useState<Collection | null>(null)
        const [rootFolder, setRootFolder] = useState<Folder | null>(null)
        const [folders, setFolders] = useState<Record<string, Folder[]>>({})
        // Track pagination for each folder/collection: { [id]: { offset: number, hasMore: boolean } }
        const [paginationState, setPaginationState] = useState<Record<string, { offset: number; hasMore: boolean }>>({})
        const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
        const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
        const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
        const [loading, setLoading] = useState<boolean>(false)
        const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({})
        const [error, setError] = useState<Error | null>(null)

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

            const currentOffset = append && paginationState[collection._id] 
                ? paginationState[collection._id].offset 
                : 0

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

                // Update pagination state
                if (foldersPerPage > 0) {
                    setPaginationState(prev => ({
                        ...prev,
                        [collection._id]: {
                            offset: currentOffset + foldersList.length,
                            hasMore,
                        },
                    }))
                }

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
        }, [apiBaseUrl, fetchFn, buildFetchOptions, startFolderId, foldersPerPage, paginationState])

        // Fetch subfolders for a folder
        const loadFoldersForFolder = useCallback(async (folder: Folder, append = false) => {
            if (!apiBaseUrl || !folder?._id) return

            const currentOffset = append && paginationState[folder._id]
                ? paginationState[folder._id].offset
                : 0

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

                // Update pagination state
                if (foldersPerPage > 0) {
                    setPaginationState(prev => ({
                        ...prev,
                        [folder._id]: {
                            offset: currentOffset + foldersList.length,
                            hasMore,
                        },
                    }))
                }
            } catch (err) {
                console.error(`Error loading subfolders for folder ${folder._id}:`, err)
            } finally {
                setLoadingFolders(prev => ({ ...prev, [folder._id]: false }))
            }
        }, [apiBaseUrl, fetchFn, buildFetchOptions, foldersPerPage, paginationState])

        // Load root collection or folder
        const loadRoot = useCallback(async () => {
            if (!apiBaseUrl || !rootId || !rootType) {
                return
            }

            setLoading(true)
            setError(null)

            try {
                const url = rootType === 'collection' 
                    ? `${apiBaseUrl}/collection/${rootId}`
                    : `${apiBaseUrl}/folder/${rootId}`
                
                const customFetch = fetchFn || fetch
                const fetchOptions = buildFetchOptions()

                const response = await customFetch(url, fetchOptions)

                if (!response.ok) {
                    throw new Error(`Failed to fetch ${rootType}: ${response.status} ${response.statusText}`)
                }

                const data = await response.json()

                if (rootType === 'collection') {
                    const collection = data as Collection
                    setRootCollection(collection)
                    setExpandedCollections(new Set([rootId]))
                    // Load folders for this root collection
                    await loadFoldersForCollection(collection)
                } else {
                    const folder = data as Folder
                    setRootFolder(folder)
                    setExpandedFolders(new Set([rootId]))
                    // Load subfolders for this root folder
                    await loadFoldersForFolder(folder)
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
                setExpandedCollections(prev => new Set(prev).add(collection._id))
                await loadFoldersForCollection(collection, false)
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
                setExpandedFolders(prev => new Set(prev).add(folder._id))
                await loadFoldersForFolder(folder, false)
            }
        }, [expandedFolders, loadFoldersForFolder])

        // Handle resource selection
        const handleResourceSelect = useCallback((resource: Collection | Folder, type: 'collection' | 'folder') => {
            const resourceWithType: Resource = { ...resource, type }
            setSelectedResource(resourceWithType)
            onResourceSelect?.(resourceWithType)
            onSelectionChange?.(resourceWithType)
        }, [onResourceSelect, onSelectionChange])

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

        // Render collection
        const renderCollectionNode = useCallback((collection: Collection) => {
            const isExpanded = expandedCollections.has(collection._id)
            const collectionFolders = folders[collection._id] || []
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
                            {/* Load More button if pagination is enabled and there are more folders */}
                            {foldersPerPage > 0 && paginationState[collection._id]?.hasMore && (
                                <div className="bdsa-folder-browser__load-more">
                                    <button
                                        className="bdsa-folder-browser__load-more-btn"
                                        onClick={() => loadFoldersForCollection(collection, true)}
                                        disabled={loadingFolders[collection._id]}
                                    >
                                        {loadingFolders[collection._id] ? 'Loading...' : 'Load More'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        }, [expandedCollections, folders, selectedResource, renderCollection, toggleCollection, handleResourceSelect, foldersPerPage, paginationState, loadingFolders, loadFoldersForCollection])

        // Render folder recursively
        const renderFolderNode = useCallback((folder: Folder, depth = 0) => {
            const isExpanded = expandedFolders.has(folder._id)
            const subFolders = folders[folder._id] || []
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
                            {/* Load More button if pagination is enabled and there are more folders */}
                            {foldersPerPage > 0 && paginationState[folder._id]?.hasMore && (
                                <div className="bdsa-folder-browser__load-more" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
                                    <button
                                        className="bdsa-folder-browser__load-more-btn"
                                        onClick={() => loadFoldersForFolder(folder, true)}
                                        disabled={loadingFolders[folder._id]}
                                    >
                                        {loadingFolders[folder._id] ? 'Loading...' : 'Load More'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        }, [expandedFolders, folders, selectedResource, renderFolder, toggleFolder, handleResourceSelect, foldersPerPage, paginationState, loadingFolders, loadFoldersForFolder])

        return (
            <div ref={ref} className={`bdsa-folder-browser ${className}`}>
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

