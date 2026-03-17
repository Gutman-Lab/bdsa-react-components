import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import './FolderBrowser.css'
import { createDebugLogger } from '../../utils/debugLog'
import type { Collection, Folder, Item, Resource, FolderBrowserProps } from './FolderBrowser.types'
import { preserveScrollPosition } from './FolderBrowser.utils'
import { renderItemNodeContent } from './FolderBrowser.render'
import { useFolderBrowserDataFetching } from './useFolderBrowserDataFetching'

export type { Collection, Folder, Item, Resource, FolderBrowserProps }

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
            showItems = false,
            fetchItems, // Defaults to showItems value if not provided
            itemsPerPage = 50,
            itemPaginationMode = 'manual',
            onItemSelect,
            renderItem,
            itemFilter,
            onItemsFetched,
            showItemCount = false,
            persistSelection = false,
            persistSelectionKey = 'bdsa_folder_browser_selection',
            persistExpansion = false,
            persistExpansionKey = 'bdsa_folder_browser_expansion',
            onApiError,
            debug = false,
        },
        ref
    ) => {
        // Default fetchItems to showItems if not explicitly provided
        const shouldFetchItems = fetchItems !== undefined ? fetchItems : showItems

        // Create debug logger
        const debugLog = useMemo(() => createDebugLogger('FolderBrowser', debug), [debug])

        const [collections, setCollections] = useState<Collection[]>([])
        const [rootCollection, setRootCollection] = useState<Collection | null>(null)
        const [rootFolder, setRootFolder] = useState<Folder | null>(null)
        const [folders, setFolders] = useState<Record<string, Folder[]>>({})
        const [items, setItems] = useState<Record<string, Item[]>>({}) // { [folderOrCollectionId]: Item[] } - filtered items
        // Track pagination for each folder/collection: { [id]: { offset: number, hasMore: boolean, loaded: boolean } }
        // 'loaded' flag prevents infinite loops when folder has no subfolders
        const [paginationState, setPaginationState] = useState<Record<string, { offset: number; hasMore: boolean; loaded: boolean }>>({})
        // Track item pagination separately: { [id]: { offset: number, hasMore: boolean, totalCount?: number } }
        // totalCount is the TOTAL number of items in the folder (from API), not just loaded items
        const [itemPaginationState, setItemPaginationState] = useState<Record<string, { offset: number; hasMore: boolean; totalCount?: number }>>({})

        // Initialize expansion state from localStorage if persistExpansion is enabled
        const [expandedCollections, setExpandedCollections] = useState<Set<string>>(() => {
            if (persistExpansion) {
                try {
                    const saved = localStorage.getItem(`${persistExpansionKey}_collections`)
                    if (saved) {
                        const parsed = JSON.parse(saved)
                        return new Set(parsed)
                    }
                } catch (error) {
                    debugLog.warn('Failed to restore expanded collections from localStorage:', error)
                }
            }
            return new Set()
        })

        const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
            if (persistExpansion) {
                try {
                    const saved = localStorage.getItem(`${persistExpansionKey}_folders`)
                    if (saved) {
                        const parsed = JSON.parse(saved)
                        return new Set(parsed)
                    }
                } catch (error) {
                    debugLog.warn('Failed to restore expanded folders from localStorage:', error)
                }
            }
            return new Set()
        })

        const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
        const [loading, setLoading] = useState<boolean>(false)
        const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({})
        const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({})
        const [error, setError] = useState<Error | null>(null)

        // Ref to the container element for scroll position preservation
        const containerRef = useRef<HTMLDivElement | null>(null)
        // Track if we've already restored from localStorage
        const hasRestoredExpansion = useRef(false)
        const hasRestoredSelection = useRef(false)

        // Use data fetching hook
        const {
            loadCollections,
            loadFoldersForCollection,
            loadFoldersForFolder,
            loadItemsForFolder,
            loadRoot,
        } = useFolderBrowserDataFetching({
            apiBaseUrl,
            fetchFn,
            apiHeaders,
            foldersPerPage,
            itemsPerPage,
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
            paginationState,
            itemPaginationState,
            debugLog,
        })

        // Save selected resource to localStorage when it changes
        useEffect(() => {
            if (!persistSelection) return

            if (selectedResource) {
                try {
                    const toSave = {
                        resource: selectedResource,
                        timestamp: Date.now(),
                    }
                    localStorage.setItem(persistSelectionKey, JSON.stringify(toSave))
                } catch (error) {
                    debugLog.warn('Failed to save selection to localStorage:', error)
                }
            }
        }, [selectedResource, persistSelection, persistSelectionKey])

        // Restore selected resource from localStorage when persistSelection becomes true
        useEffect(() => {
            if (!persistSelection) return

            // Only restore once
            if (hasRestoredSelection.current) return
            hasRestoredSelection.current = true

            try {
                const saved = localStorage.getItem(persistSelectionKey)
                if (saved) {
                    const parsed = JSON.parse(saved)
                    if (parsed.resource && parsed.resource._id) {
                        // Restore the selection
                        // Note: We're just setting the state here. The component will need to 
                        // handle expanding parent folders to make the selection visible.
                        // This is a best-effort restoration - if the resource no longer exists,
                        // it will simply be selected but not visible.
                        setSelectedResource(parsed.resource)

                        // Auto-expand based on resource type (only if not using persistExpansion)
                        if (!persistExpansion) {
                            if (parsed.resource.type === 'collection') {
                                setExpandedCollections(new Set([parsed.resource._id]))
                            } else if (parsed.resource.type === 'folder') {
                                // For folders, we'd need to know the parent path to expand correctly
                                // For now, just expand the folder itself
                                setExpandedFolders(new Set([parsed.resource._id]))
                            }
                        }
                    }
                }
            } catch (error) {
                debugLog.warn('Failed to restore selection from localStorage:', error)
            }
        }, [persistSelection, persistSelectionKey, persistExpansion])

        // Restore expansion state when persistExpansion becomes true AND collections are loaded
        useEffect(() => {
            if (!persistExpansion) return
            if (collections.length === 0 && !rootCollection) return // Wait for collections to load

            // Only restore once
            if (hasRestoredExpansion.current) return
            hasRestoredExpansion.current = true

            // Try to restore from localStorage when persistExpansion is enabled
            try {
                const savedCollections = localStorage.getItem(`${persistExpansionKey}_collections`)
                const savedFolders = localStorage.getItem(`${persistExpansionKey}_folders`)

                if (savedCollections) {
                    const parsed = JSON.parse(savedCollections)
                    if (parsed.length > 0) {
                        setExpandedCollections(new Set(parsed))

                        // Trigger API loads for each expanded collection
                        parsed.forEach((collectionId: string) => {
                            const collection = collections.find(c => c._id === collectionId) ||
                                (rootCollection?._id === collectionId ? rootCollection : null)
                            if (collection) {
                                loadFoldersForCollection(collection)
                            }
                        })
                    }
                }

                if (savedFolders) {
                    const parsed = JSON.parse(savedFolders)
                    if (parsed.length > 0) {
                        setExpandedFolders(new Set(parsed))
                        // Note: We'll trigger folder loads in a separate effect after folders are loaded
                    }
                }
            } catch (error) {
                debugLog.warn('Failed to restore expansion state:', error)
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [persistExpansion, persistExpansionKey, collections, rootCollection, folders, shouldFetchItems])

        // Auto-load contents for any expanded folder/collection that hasn't been loaded yet
        useEffect(() => {
            if (!persistExpansion) return

            // Auto-load folders for expanded collections
            expandedCollections.forEach(collectionId => {
                // Check if we've loaded this collection's folders yet
                const hasLoadedFolders = folders[collectionId] !== undefined || paginationState[collectionId]?.loaded
                if (!hasLoadedFolders && !loadingFolders[collectionId]) {
                    const collection = collections.find(c => c._id === collectionId) ||
                        (rootCollection?._id === collectionId ? rootCollection : null)
                    if (collection) {
                        loadFoldersForCollection(collection)
                    }
                }
            })

            // Auto-load subfolders and items for expanded folders
            expandedFolders.forEach(folderId => {
                // Find this folder in the loaded folders
                let folder: Folder | null = null
                for (const folderList of Object.values(folders)) {
                    folder = folderList.find((f: Folder) => f._id === folderId) || null
                    if (folder) break
                }

                if (folder) {
                    // Check if we've loaded this folder's subfolders yet
                    const hasLoadedSubfolders = folders[folderId] !== undefined || paginationState[folderId]?.loaded
                    if (!hasLoadedSubfolders && !loadingFolders[folderId]) {
                        loadFoldersForFolder(folder)
                    }

                    // Check if we've loaded this folder's items yet
                    if (showItems) {
                        const hasLoadedItems = items[folderId] !== undefined
                        if (!hasLoadedItems && !loadingItems[folderId]) {
                            loadItemsForFolder(folderId, folder)
                        }
                    }
                }
            })
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [persistExpansion, expandedCollections, expandedFolders, folders, items, collections, rootCollection, shouldFetchItems, paginationState, loadingFolders, loadingItems])

        // Save expanded collections to localStorage when they change
        useEffect(() => {
            if (!persistExpansion) return

            try {
                const array = Array.from(expandedCollections)
                localStorage.setItem(`${persistExpansionKey}_collections`, JSON.stringify(array))
            } catch (error) {
                debugLog.warn('Failed to save expanded collections to localStorage:', error)
            }
        }, [expandedCollections, persistExpansion, persistExpansionKey])

        // Save expanded folders to localStorage when they change
        useEffect(() => {
            if (!persistExpansion) return

            try {
                const array = Array.from(expandedFolders)
                localStorage.setItem(`${persistExpansionKey}_folders`, JSON.stringify(array))
            } catch (error) {
                debugLog.warn('Failed to save expanded folders to localStorage:', error)
            }
        }, [expandedFolders, persistExpansion, persistExpansionKey])

        // Auto-scroll to selected resource after a brief delay to let DOM update
        useEffect(() => {
            if (!selectedResource || !containerRef.current) return

            // Small delay to ensure the DOM has updated
            const timeoutId = setTimeout(() => {
                const element = containerRef.current?.querySelector(
                    `[data-resource-id="${selectedResource._id}"]`
                )
                if (element) {
                    element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                    })
                }
            }, 100)

            return () => clearTimeout(timeoutId)
        }, [selectedResource])

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
                const { restore } = preserveScrollPosition(containerRef.current)

                setExpandedCollections(prev => new Set(prev).add(collection._id))
                await loadFoldersForCollection(collection, false)
                // Note: Collections don't have direct items - items are in folders, so we don't fetch items here

                // Restore scroll position after state updates
                restore()
            }
        }, [expandedCollections, loadFoldersForCollection])

        // Track last clicked folder for visual feedback
        const [lastClickedFolder, setLastClickedFolder] = useState<string | null>(null)

        // Load all remaining items for a folder
        const loadAllItems = useCallback(async (folderId: string, folder: Folder, event: React.MouseEvent) => {
            event.stopPropagation() // Prevent any parent handlers (though not needed now, good practice)

            if (!shouldFetchItems) {
                return
            }

            const itemState = itemPaginationState[folderId]
            if (!itemState?.hasMore) {
                debugLog.log(`No more items to load for folder ${folderId}`)
                return
            }

            setLoadingItems(prev => ({ ...prev, [folderId]: true }))

            try {
                // Load all remaining items by repeatedly calling loadItemsForFolder until hasMore is false
                while (itemPaginationState[folderId]?.hasMore) {
                    await loadItemsForFolder(folderId, folder, true)
                }
                debugLog.log(`Finished loading all items for folder ${folderId}`)
            } catch (error) {
                debugLog.warn(`Error loading all items for folder ${folderId}:`, error)
            } finally {
                setLoadingItems(prev => ({ ...prev, [folderId]: false }))
            }
        }, [shouldFetchItems, itemPaginationState, loadItemsForFolder, setLoadingItems, debugLog])

        // Toggle folder expansion
        const toggleFolder = useCallback(async (folder: Folder) => {
            const isExpanded = expandedFolders.has(folder._id)

            // Mark this folder as the last clicked for visual feedback
            setLastClickedFolder(folder._id)

            // Find the folder element and get its position before any DOM changes
            const container = containerRef.current
            const folderElement = container?.querySelector(`[data-resource-id="${folder._id}"]`) as HTMLElement

            // Preserve scroll position
            const { restore } = preserveScrollPosition(container, folderElement)

            if (isExpanded) {
                // Collapsing folder
                setExpandedFolders(prev => {
                    const next = new Set(prev)
                    next.delete(folder._id)
                    return next
                })

                // After collapsing, restore the folder position
                restore()
            } else {
                // Expanding folder
                setExpandedFolders(prev => new Set(prev).add(folder._id))
                await loadFoldersForFolder(folder, false)

                // Load items if shouldFetchItems is enabled AND items haven't been loaded yet
                if (shouldFetchItems) {
                    const itemsAlreadyLoaded = items[folder._id] !== undefined && items[folder._id].length > 0
                    if (!itemsAlreadyLoaded) {
                        debugLog.log(`Toggling folder ${folder._id} (${folder.name}) - shouldFetchItems=${shouldFetchItems}, calling loadItemsForFolder`)
                        await loadItemsForFolder(folder._id, folder, false)
                        
                        // If auto mode, load all remaining items
                        if (itemPaginationMode === 'auto') {
                            const itemState = itemPaginationState[folder._id]
                            if (itemState?.hasMore) {
                                debugLog.log(`Auto-loading all items for folder ${folder._id} (${folder.name})`)
                                await loadAllItems(folder._id, folder, {} as React.MouseEvent)
                            }
                        }
                    } else {
                        debugLog.log(`Toggling folder ${folder._id} (${folder.name}) - items already loaded, skipping fetch`)
                    }
                } else {
                    debugLog.log(`Toggling folder ${folder._id} (${folder.name}) - shouldFetchItems is FALSE, skipping item load`)
                }

                // After expanding, try to keep the folder header in the same position
                restore()
            }
        }, [expandedFolders, loadFoldersForFolder, shouldFetchItems, loadItemsForFolder, items, itemPaginationMode, itemPaginationState, loadAllItems])

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
            return renderItemNodeContent({
                item,
                depth,
                isSelected,
                onItemSelect: handleItemSelect,
                renderItem,
            })
        }, [selectedResource, renderItem, handleItemSelect])

        // Render folder recursively (must be defined before renderCollectionNode)
        const renderFolderNode = useCallback((folder: Folder, depth = 0) => {
            const isExpanded = expandedFolders.has(folder._id)
            const subFolders = folders[folder._id] || []
            // Show items if loaded (regardless of parentType - API determines if items exist)
            const folderItems = showItems ? (items[folder._id] || []) : []
            const isSelected = selectedResource?._id === folder._id && selectedResource?.type === 'folder'

            // Get item count from pagination state (total from API)
            const itemCount = itemPaginationState[folder._id]?.totalCount
            const hasMoreItems = itemPaginationState[folder._id]?.hasMore
            const isLoadingItems = loadingItems[folder._id]
            
            // Calculate remaining items count for "+N" indicator
            const loadedItemsCount = folderItems.length
            const remainingCount = itemCount !== undefined 
                ? Math.max(0, itemCount - loadedItemsCount)
                : undefined

            // Determine if folder should show triangle (expand/collapse indicator)
            // Logic:
            // - If showItems=true: Always show triangle (it controls item visibility)
            // - If showItems=false: Only show if there are subfolders or might be more
            const hasSubFolders = subFolders.length > 0
            const mightHaveMoreFolders = paginationState[folder._id]?.hasMore === true
            const hasBeenCheckedForFolders = paginationState[folder._id]?.loaded === true

            // If showing items, triangle is always useful (expands/collapses items)
            // If not showing items, only show triangle if there are subfolders or haven't checked yet
            const hasChildren = showItems
                ? true  // Always show triangle when items are displayed
                : (hasSubFolders || mightHaveMoreFolders || !hasBeenCheckedForFolders)

            if (renderFolder) {
                return renderFolder(folder, depth, isExpanded, () => toggleFolder(folder), itemCount)
            }

            const isLastClicked = lastClickedFolder === folder._id

            return (
                <div key={folder._id} className="bdsa-folder-browser__folder">
                    <div
                        className={`bdsa-folder-browser__folder-header ${isSelected ? 'selected' : ''} ${isLastClicked ? 'last-clicked' : ''}`}
                        onClick={() => handleResourceSelect(folder, 'folder')}
                        onDoubleClick={() => toggleFolder(folder)}
                        data-resource-id={folder._id}
                    >
                        {hasChildren && (
                            <span
                                className={`bdsa-folder-browser__folder-icon ${isExpanded ? 'expanded' : ''}`}
                                onClick={() => toggleFolder(folder)}
                                style={{ cursor: 'pointer' }}
                            ></span>
                        )}
                        {!hasChildren && (
                            <span className="bdsa-folder-browser__folder-icon-spacer"></span>
                        )}
                        <span className="bdsa-folder-browser__folder-name">{folder.name}</span>
                        {showItemCount && itemCount !== undefined && (
                            <span className="bdsa-folder-browser__item-count">
                                ({itemCount})
                                {hasMoreItems && !isLoadingItems && itemPaginationMode === 'manual' && (
                                    <span
                                        className="bdsa-folder-browser__load-all-indicator"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            loadItemsForFolder(folder._id, folder, true)
                                        }}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation()
                                            loadAllItems(folder._id, folder, e)
                                        }}
                                        title={remainingCount !== undefined 
                                            ? `Click to load next page (${itemsPerPage} items), double-click to load all ${remainingCount} remaining items`
                                            : "Click to load next page, double-click to load all items"}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {remainingCount !== undefined ? `+${remainingCount}` : '+'}
                                    </span>
                                )}
                                {isLoadingItems && hasMoreItems && (
                                    <span className="bdsa-folder-browser__load-all-indicator loading">
                                        ⏳
                                    </span>
                                )}
                            </span>
                        )}
                        <span className="bdsa-folder-browser__folder-type">Folder</span>
                    </div>

                    {isExpanded && (
                        <div className="bdsa-folder-browser__folder-contents">
                            {/* Render subfolders */}
                            {subFolders.map(subFolder => (
                                <React.Fragment key={subFolder._id}>
                                    {renderFolderNode(subFolder, depth + 1)}
                                </React.Fragment>
                            ))}
                            {/* Render items in this folder if showItems is enabled */}
                            {showItems && folderItems.map(item => (
                                <React.Fragment key={item._id}>
                                    {renderItemNode(item, depth + 1)}
                                </React.Fragment>
                            ))}
                            {/* Show loading indicator for items */}
                            {showItems && loadingItems[folder._id] && (
                                <div className="bdsa-folder-browser__loading">
                                    <span>Loading items...</span>
                                </div>
                            )}
                            {/* Load More button for folders if pagination is enabled and there are more folders */}
                            {foldersPerPage > 0 && paginationState[folder._id]?.hasMore && !loadingFolders[folder._id] && (
                                <div className="bdsa-folder-browser__load-more">
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
                            {showItems && itemsPerPage > 0 && itemPaginationState[folder._id]?.hasMore && itemPaginationMode === 'button' && (
                                <div className="bdsa-folder-browser__load-more">
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
        }, [expandedFolders, folders, items, showItems, selectedResource, renderFolder, toggleFolder, handleResourceSelect, foldersPerPage, paginationState, loadingFolders, loadFoldersForFolder, itemsPerPage, itemPaginationMode, itemPaginationState, loadingItems, loadItemsForFolder, renderItemNode, showItemCount, lastClickedFolder, loadAllItems])

        // Render collection (must be defined after renderFolderNode)
        const renderCollectionNode = useCallback((collection: Collection) => {
            const isExpanded = expandedCollections.has(collection._id)
            const collectionFolders = folders[collection._id] || []
            // Note: Collections don't have direct items - items are in folders
            const isSelected = selectedResource?._id === collection._id && selectedResource?.type === 'collection'

            // Collections don't have direct items, so itemCount is undefined
            const itemCount = undefined

            // Determine if collection has children (folders)
            // Show triangle only if:
            // 1. Has folders, OR
            // 2. Might have more folders (pagination), OR
            // 3. Haven't checked yet (optimistic - show triangle until we know)
            const hasFolders = collectionFolders.length > 0
            const mightHaveMoreFolders = paginationState[collection._id]?.hasMore === true
            const hasBeenChecked = paginationState[collection._id]?.loaded === true

            const hasChildren = hasFolders || mightHaveMoreFolders || !hasBeenChecked

            if (renderCollection) {
                return renderCollection(collection, isExpanded, () => toggleCollection(collection), itemCount)
            }

            return (
                <div key={collection._id} className="bdsa-folder-browser__collection">
                    <div
                        className={`bdsa-folder-browser__folder-header ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleResourceSelect(collection, 'collection')}
                        onDoubleClick={() => toggleCollection(collection)}
                        data-resource-id={collection._id}
                    >
                        {hasChildren && (
                            <span
                                className={`bdsa-folder-browser__folder-icon ${isExpanded ? 'expanded' : ''}`}
                                onClick={() => toggleCollection(collection)}
                                style={{ cursor: 'pointer' }}
                            ></span>
                        )}
                        {!hasChildren && (
                            <span className="bdsa-folder-browser__folder-icon-spacer"></span>
                        )}
                        <span className="bdsa-folder-browser__folder-name">{collection.name}</span>
                        <span className="bdsa-folder-browser__folder-type">Collection</span>
                    </div>

                    {isExpanded && (
                        <div className="bdsa-folder-browser__folder-contents">
                            {/* Render folders in this collection */}
                            {collectionFolders.map(folder => (
                                <React.Fragment key={folder._id}>
                                    {renderFolderNode(folder, 1)}
                                </React.Fragment>
                            ))}
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
                                    collections.map(collection => (
                                        <React.Fragment key={collection._id}>
                                            {renderCollectionNode(collection)}
                                        </React.Fragment>
                                    ))
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

