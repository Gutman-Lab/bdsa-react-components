import type { Collection, Folder } from './FolderBrowser.types'
import type { DebugLogger } from '../../utils/debugLog'

/**
 * Build fetch options with API headers
 */
export function buildFetchOptions(apiHeaders?: HeadersInit): RequestInit {
    const options: RequestInit = {}
    if (apiHeaders) {
        options.headers = apiHeaders
    }
    return options
}

/**
 * Find the scrollable parent container for an element
 */
export function findScrollContainer(element: HTMLElement | null): HTMLElement | null {
    if (!element) return null
    
    let current: HTMLElement | null = element.parentElement
    while (current && current !== document.body) {
        const style = window.getComputedStyle(current)
        const overflowY = style.overflowY || style.overflow
        if (overflowY === 'auto' || overflowY === 'scroll') {
            return current
        }
        if (current.scrollHeight > current.clientHeight && current.clientHeight > 0) {
            return current
        }
        current = current.parentElement
    }
    return null
}

/**
 * Preserve scroll position when expanding/collapsing tree nodes
 * Returns a function to restore scroll position after DOM updates
 */
export function preserveScrollPosition(
    container: HTMLElement | null,
    targetElement?: HTMLElement | null
): {
    scrollContainer: HTMLElement | null
    scrollTop: number
    initialTop: number
    restore: () => void
} {
    const scrollContainer = findScrollContainer(container)
    let scrollTop = 0
    let initialTop = 0

    if (targetElement && scrollContainer) {
        const rect = targetElement.getBoundingClientRect()
        const containerRect = scrollContainer.getBoundingClientRect()
        initialTop = rect.top - containerRect.top
        scrollTop = scrollContainer.scrollTop
    } else if (scrollContainer) {
        scrollTop = scrollContainer.scrollTop
    }

    const restore = () => {
        if (targetElement && scrollContainer) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (scrollContainer) {
                        const newRect = targetElement.getBoundingClientRect()
                        const containerRect = scrollContainer.getBoundingClientRect()
                        const newTop = newRect.top - containerRect.top
                        const diff = newTop - initialTop
                        scrollContainer.scrollTop -= diff
                    }
                })
            })
        } else if (scrollContainer) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (scrollContainer && scrollContainer.scrollTop !== undefined) {
                        scrollContainer.scrollTop = scrollTop
                    }
                })
            })
        }
    }

    return { scrollContainer, scrollTop, initialTop, restore }
}

/**
 * Parse paginated API response (handles both array and paginated object responses)
 */
export function parsePaginatedResponse<T>(
    data: unknown,
    currentOffset: number,
    pageSize: number
): { items: T[]; hasMore: boolean; total?: number } {
    let items: T[] = []
    let hasMore = false
    let total: number | undefined

    if (Array.isArray(data)) {
        items = data as T[]
        // If we got fewer items than the limit, there's no more
        hasMore = pageSize > 0 && data.length === pageSize
        // For array responses, estimate total from offset + length
        total = currentOffset + data.length
    } else if (data && typeof data === 'object') {
        const obj = data as { items?: T[]; total?: number }
        items = obj.items || []
        total = obj.total
        hasMore = pageSize > 0 && total !== undefined && total > (currentOffset + items.length)
    }

    return { items, hasMore, total }
}

/**
 * Search for a folder recursively in collections
 */
export async function searchFolderInCollections(
    folderId: string,
    apiBaseUrl: string,
    customFetch: (url: string, options?: RequestInit) => Promise<Response>,
    fetchOptions: RequestInit,
    debugLog: DebugLogger
): Promise<Folder | null> {
    // First try listing all folders (if API supports it)
    try {
        const listUrl = `${apiBaseUrl}/folder`
        const response = await customFetch(listUrl, fetchOptions)
        
        if (response.ok) {
            const listData = await response.json()
            const foldersList: Folder[] = Array.isArray(listData) ? listData : (listData.items || [])
            const found = foldersList.find(f => f._id === folderId)
            if (found) return found
        }
    } catch (listErr) {
        debugLog.warn('Could not list folders directly, will need to search through collections')
    }
    
    // If still not found, search through collections
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
            const found = foldersList.find(f => f._id === folderId)
            
            if (found) return found
            
            // Recursively search subfolders (depth-first search)
            const searchSubfolders = async (folder: Folder): Promise<Folder | null> => {
                const subfoldersUrl = `${apiBaseUrl}/folder?parentType=folder&parentId=${folder._id}`
                const subfoldersResponse = await customFetch(subfoldersUrl, fetchOptions)
                
                if (subfoldersResponse.ok) {
                    const subfoldersData = await subfoldersResponse.json()
                    const subfoldersList: Folder[] = Array.isArray(subfoldersData) ? subfoldersData : (subfoldersData.items || [])
                    
                    const found = subfoldersList.find(f => f._id === folderId)
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
                if (found) return found
            }
        }
    }
    
    return null
}

