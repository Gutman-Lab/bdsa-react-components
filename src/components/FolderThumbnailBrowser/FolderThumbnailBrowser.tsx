import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ThumbnailViewer, updateThumbnailOpacity, clearThumbnailOpacities } from '../ThumbnailViewer/ThumbnailViewer'
import { filterLargeImages, isAIModel, type Item } from '../../utils/itemUtils'
import { createDebugLogger } from '../../utils/debugLog'
import { handleApiError, type ApiErrorHandler, type ApiError } from '../../utils/apiErrorHandling'
import './FolderThumbnailBrowser.css'

export interface FolderThumbnailBrowserProps {
    // Data Sources (mutually exclusive)
    /** DSA folder ID to fetch items from */
    folderId?: string
    /** Array of specific image IDs to display */
    imageIds?: string[]
    /** Pre-loaded items array (takes precedence) */
    items?: Item[]

    // API Configuration
    /** DSA API base URL (e.g., "http://bdsa.pathology.emory.edu:8080/api/v1") */
    apiBaseUrl: string
    /** Backend API base URL for annotation caching (optional, falls back to apiBaseUrl if not provided) */
    backendApiBaseUrl?: string
    /** Headers for API requests (auth, etc.) */
    apiHeaders?: HeadersInit
    /** Custom fetch function for API requests */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>

    // Display Configuration
    /** Initial items per page estimate (default: 12) */
    itemsPerPage?: number
    /** Thumbnail size preset (default: 'l') */
    viewerSize?: 's' | 'm' | 'l' | 'xl'

    // Annotation Configuration
    /** Name of currently selected annotation to display */
    selectedAnnotationName?: string
    /** Map of itemId -> annotationId */
    annotationNameToIds?: Map<string, string> | Record<string, string>
    /** Opacity for annotations (0-1, default: 0.7) */
    annotationOpacity?: number
    /** Callback when opacity changes */
    onAnnotationOpacityChange?: (opacity: number) => void

    // Model Support
    /** Display name for model (if viewing model training images) */
    modelName?: string
    /** Dataset split information */
    modelDatasetInfo?: {
        train: string[]
        val: string[]
        test: string[]
    }

    // Callbacks
    /** Called when items are loaded/filtered */
    onItemsLoaded?: (itemIds: string[]) => void
    /** Function to determine dataset type */
    getDatasetType?: (itemId: string) => 'train' | 'val' | 'test' | null

    // Other
    /** Show OpenSeadragon navigation controls (zoom, home, fullscreen) on thumbnails (default: false) */
    showViewerControls?: boolean
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
    onApiError?: ApiErrorHandler
    /** Debug mode for logging */
    debug?: boolean
    /** Custom CSS class */
    className?: string
}

/**
 * Size presets for thumbnails
 */
const VIEWER_SIZES = {
    s: 120,
    m: 180,
    l: 240,
    xl: 320,
} as const

/**
 * Main container component that manages pagination, filtering, and layout for thumbnail grid.
 */
export const FolderThumbnailBrowser = React.forwardRef<HTMLDivElement, FolderThumbnailBrowserProps>(
    (
        {
            folderId,
            imageIds,
            items: providedItems,
            apiBaseUrl,
            backendApiBaseUrl,
            apiHeaders,
            fetchFn,
            itemsPerPage: initialItemsPerPage = 12,
            viewerSize: initialViewerSize = 'l',
            selectedAnnotationName,
            annotationNameToIds,
            annotationOpacity = 0.7,
            onAnnotationOpacityChange,
            modelName,
            modelDatasetInfo,
            onItemsLoaded,
            getDatasetType,
            showViewerControls = false,
            onApiError,
            debug = false,
            className = '',
        },
        ref
    ) => {
        const [items, setItems] = useState<Item[]>([])
        const [loading, setLoading] = useState<boolean>(false)
        const [error, setError] = useState<Error | null>(null)
        const [currentPage, setCurrentPage] = useState<number>(1)
        const [viewerSize, setViewerSize] = useState<'s' | 'm' | 'l' | 'xl'>(initialViewerSize)
        const [containerWidth, setContainerWidth] = useState<number>(0)
        const [containerHeight, setContainerHeight] = useState<number>(0)
        const containerRef = useRef<HTMLDivElement>(null)
        const gridRef = useRef<HTMLDivElement>(null)

        const debugLog = useMemo(() => createDebugLogger('FolderThumbnailBrowser', debug), [debug])

        // Load viewer size from localStorage
        useEffect(() => {
            const savedSize = localStorage.getItem('bdsa-thumbnail-viewer-size') as 's' | 'm' | 'l' | 'xl' | null
            if (savedSize && ['s', 'm', 'l', 'xl'].includes(savedSize)) {
                setViewerSize(savedSize)
            }
        }, [])

        // Save viewer size to localStorage
        useEffect(() => {
            localStorage.setItem('bdsa-thumbnail-viewer-size', viewerSize)
        }, [viewerSize])

        // Measure container dimensions
        useEffect(() => {
            if (!containerRef.current) return

            const measureContainer = () => {
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect()
                    setContainerWidth(rect.width)
                    setContainerHeight(rect.height)
                }
            }

            measureContainer()
            window.addEventListener('resize', measureContainer)
            // Also measure after a delay to catch initial render
            const timeoutId = setTimeout(measureContainer, 100)

            return () => {
                window.removeEventListener('resize', measureContainer)
                clearTimeout(timeoutId)
            }
        }, [])

        // Calculate items per page based on container size
        const calculatedItemsPerPage = useMemo(() => {
            if (containerWidth === 0 || containerHeight === 0) {
                return initialItemsPerPage
            }

            const viewerWidth = VIEWER_SIZES[viewerSize]
            // Account for gap between items (12px gap)
            const itemsPerRow = Math.max(1, Math.floor((containerWidth - 32) / (viewerWidth + 12))) // 32px padding, 12px gap
            // Subtract header height (approx 100px) and pagination height (approx 50px)
            const availableHeight = containerHeight - 150
            const rowsPerPage = Math.max(1, Math.floor(availableHeight / (viewerWidth + 12))) // 12px gap between rows
            const calculated = itemsPerRow * rowsPerPage
            return Math.max(1, calculated)
        }, [containerWidth, containerHeight, viewerSize, initialItemsPerPage])

        // Custom fetch function that routes through backend cache
        const proxyFetchFn = useCallback(
            async (url: string, options?: RequestInit): Promise<Response> => {
                if (!backendApiBaseUrl) {
                    return fetchFn ? fetchFn(url, options) : fetch(url, options)
                }

                // Route annotation requests through backend cache
                const annotationSearchMatch = url.match(/\/annotation\?itemId=([^&]+)/)
                const annotationIdMatch = url.match(/\/annotation\/([^/?]+)/)

                if (annotationSearchMatch || annotationIdMatch) {
                    const backendUrl = `${backendApiBaseUrl}/api/v1${url.replace(apiBaseUrl, '').replace(/^\/api\/v1/, '')}`
                    const backendOptions: RequestInit = {
                        ...options,
                        headers: {
                            ...apiHeaders,
                            ...(options?.headers || {}),
                        },
                    }
                    return fetch(backendUrl, backendOptions)
                }

                return fetchFn ? fetchFn(url, options) : fetch(url, options)
            },
            [apiBaseUrl, backendApiBaseUrl, apiHeaders, fetchFn]
        )

        // Fetch items from folder or imageIds
        const fetchItems = useCallback(async () => {
            if (providedItems) {
                // Use provided items
                processItems(providedItems)
                return
            }

            if (!folderId && !imageIds) {
                setItems([])
                return
            }

            setLoading(true)
            setError(null)

            try {
                let allItems: Item[] = []
                const customFetch = fetchFn || fetch

                if (folderId) {
                    // Fetch from folder - use apiBaseUrl directly (it already includes /api/v1)
                    const params = new URLSearchParams()
                    params.append('folderId', folderId)
                    const url = `${apiBaseUrl}/item?${params.toString()}`
                    debugLog.log(`Fetching items from: ${url}`)
                    
                    const fetchOptions: RequestInit = {}
                    if (apiHeaders) {
                        fetchOptions.headers = apiHeaders
                    }
                    
                    const response = await customFetch(url, fetchOptions)
                    if (!response.ok) {
                        const error = new Error(`Failed to fetch folder items: ${response.status} ${response.statusText}`) as ApiError
                        error.status = response.status
                        error.statusText = response.statusText
                        error.isRetryable = [401, 429, 500, 502, 503, 504].includes(response.status)
                        
                        handleApiError(
                            error,
                            response,
                            onApiError,
                            () => fetchItems(),
                            {
                                endpoint: url,
                                operation: 'fetch',
                                metadata: { folderId },
                            }
                        )
                        
                        const errorText = await response.text().catch(() => '')
                        debugLog.error(`Failed to fetch folder items: ${response.status} ${response.statusText}`, errorText)
                        setError(error)
                        return
                    }
                    const data = await response.json()
                    allItems = Array.isArray(data) ? data : data.data || []
                } else if (imageIds && imageIds.length > 0) {
                    // Fetch items individually by ID
                    // DSA API doesn't support comma-separated itemId, so fetch one at a time
                    for (const itemId of imageIds) {
                        const url = `${apiBaseUrl}/item/${itemId}`
                        debugLog.log(`Fetching item: ${url}`)
                        
                        const fetchOptions: RequestInit = {}
                        if (apiHeaders) {
                            fetchOptions.headers = apiHeaders
                        }
                        
                        try {
                            const response = await customFetch(url, fetchOptions)
                            if (!response.ok) {
                                const error = new Error(`Failed to fetch item ${itemId}: ${response.status} ${response.statusText}`) as ApiError
                                error.status = response.status
                                error.statusText = response.statusText
                                error.isRetryable = [401, 429, 500, 502, 503, 504].includes(response.status)
                                
                                handleApiError(
                                    error,
                                    response,
                                    onApiError,
                                    async () => {
                                        // Retry function - re-fetch this specific item
                                        const retryResponse = await customFetch(url, fetchOptions)
                                        if (!retryResponse.ok) {
                                            throw new Error(`Retry failed: ${retryResponse.status} ${retryResponse.statusText}`)
                                        }
                                        const retryItem = await retryResponse.json()
                                        if (retryItem) {
                                            allItems.push(retryItem)
                                        }
                                    },
                                    {
                                        endpoint: url,
                                        operation: 'fetch',
                                        metadata: { itemId, imageIds },
                                    }
                                )
                                
                                debugLog.warn(`Failed to fetch item ${itemId}: ${response.status} ${response.statusText}`)
                                continue // Skip failed items
                            }
                            const item = await response.json()
                            if (item) {
                                allItems.push(item)
                            }
                        } catch (err) {
                            handleApiError(
                                err,
                                undefined,
                                onApiError,
                                async () => {
                                    // Retry function - re-fetch this specific item
                                    const retryResponse = await customFetch(url, fetchOptions)
                                    if (!retryResponse.ok) {
                                        throw new Error(`Retry failed: ${retryResponse.status} ${retryResponse.statusText}`)
                                    }
                                    const retryItem = await retryResponse.json()
                                    if (retryItem) {
                                        allItems.push(retryItem)
                                    }
                                },
                                {
                                    endpoint: url,
                                    operation: 'fetch',
                                    metadata: { itemId, imageIds },
                                }
                            )
                            debugLog.warn(`Error fetching item ${itemId}:`, err)
                            continue // Skip failed items
                        }
                    }
                }

                processItems(allItems)
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err))
                setError(error)
                
                const url = folderId 
                    ? `${apiBaseUrl}/item?folderId=${folderId}`
                    : `${apiBaseUrl}/item`
                
                handleApiError(
                    err,
                    undefined,
                    onApiError,
                    () => fetchItems(),
                    {
                        endpoint: url,
                        operation: 'fetch',
                        metadata: { folderId, imageIds },
                    }
                )
                
                debugLog.error('Failed to fetch items:', error)
            } finally {
                setLoading(false)
            }
        }, [folderId, imageIds, providedItems, backendApiBaseUrl, apiBaseUrl, apiHeaders, proxyFetchFn, debugLog, onApiError])

        // Process fetched items
        const processItems = useCallback(
            (data: Item[]) => {
                // Filter to only items with largeImage flag
                const imageItems = filterLargeImages(data)

                // Exclude model items
                const filteredItems = imageItems.filter((item) => !isAIModel(item))

                setItems(filteredItems)

                if (onItemsLoaded) {
                    onItemsLoaded(filteredItems.map((item) => item._id))
                }

                debugLog.log(`Processed ${filteredItems.length} items from ${data.length} total`)
            },
            [onItemsLoaded, debugLog]
        )

        // Fetch items when dependencies change
        useEffect(() => {
            fetchItems()
        }, [fetchItems])

        // Update annotation opacity across all thumbnails
        useEffect(() => {
            if (!annotationNameToIds || !selectedAnnotationName) {
                clearThumbnailOpacities()
                return
            }

            // Get all annotation IDs
            const annotationIds: string[] = []
            if (annotationNameToIds instanceof Map) {
                annotationIds.push(...Array.from(annotationNameToIds.values()))
            } else {
                annotationIds.push(...Object.values(annotationNameToIds))
            }

            // Update opacity for all annotations
            annotationIds.forEach((id) => {
                updateThumbnailOpacity(id, annotationOpacity)
            })
        }, [annotationOpacity, annotationNameToIds, selectedAnnotationName])

        // Filter items by annotation name if provided
        const filteredItems = useMemo(() => {
            if (!selectedAnnotationName || !annotationNameToIds) {
                return items
            }

            // Filter to only items that have the selected annotation
            return items.filter((item) => {
                const itemId = String(item._id)
                if (annotationNameToIds instanceof Map) {
                    return annotationNameToIds.has(itemId)
                } else {
                    return itemId in annotationNameToIds
                }
            })
        }, [items, selectedAnnotationName, annotationNameToIds])

        // Pagination
        const totalPages = Math.ceil(filteredItems.length / calculatedItemsPerPage)
        const startIndex = (currentPage - 1) * calculatedItemsPerPage
        const endIndex = startIndex + calculatedItemsPerPage
        const currentPageItems = filteredItems.slice(startIndex, endIndex)

        // Reset to page 1 when items change
        useEffect(() => {
            setCurrentPage(1)
        }, [filteredItems.length])

        // Build dataset type function
        const datasetTypeFn = useMemo(() => {
            if (getDatasetType) {
                return getDatasetType
            }
            if (modelDatasetInfo) {
                return (itemId: string) => {
                    if (modelDatasetInfo.train.includes(itemId)) return 'train'
                    if (modelDatasetInfo.val.includes(itemId)) return 'val'
                    if (modelDatasetInfo.test.includes(itemId)) return 'test'
                    return null
                }
            }
            return undefined
        }, [getDatasetType, modelDatasetInfo])

        // Pagination controls
        const renderPagination = () => {
            if (totalPages <= 1) return null

            const pages: (number | 'ellipsis')[] = []
            const maxVisiblePages = 7

            if (totalPages <= maxVisiblePages) {
                // Show all pages
                for (let i = 1; i <= totalPages; i++) {
                    pages.push(i)
                }
            } else {
                // Show first page, ellipsis, current page area, ellipsis, last page
                pages.push(1)

                if (currentPage > 3) {
                    pages.push('ellipsis')
                }

                const start = Math.max(2, currentPage - 1)
                const end = Math.min(totalPages - 1, currentPage + 1)

                for (let i = start; i <= end; i++) {
                    pages.push(i)
                }

                if (currentPage < totalPages - 2) {
                    pages.push('ellipsis')
                }

                pages.push(totalPages)
            }

            return (
                <div className="bdsa-folder-thumbnail-browser__pagination">
                    <button
                        className="bdsa-folder-thumbnail-browser__pagination-button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </button>
                    {pages.map((page, idx) => {
                        if (page === 'ellipsis') {
                            return (
                                <span key={`ellipsis-${idx}`} className="bdsa-folder-thumbnail-browser__pagination-ellipsis">
                                    ...
                                </span>
                            )
                        }
                        return (
                            <button
                                key={page}
                                className={`bdsa-folder-thumbnail-browser__pagination-button ${
                                    page === currentPage ? 'bdsa-folder-thumbnail-browser__pagination-button--active' : ''
                                }`}
                                onClick={() => setCurrentPage(page)}
                            >
                                {page}
                            </button>
                        )
                    })}
                    <button
                        className="bdsa-folder-thumbnail-browser__pagination-button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </button>
                </div>
            )
        }

        const viewerWidth = VIEWER_SIZES[viewerSize]

        return (
            <div ref={ref || containerRef} className={`bdsa-folder-thumbnail-browser ${className}`}>
                <div className="bdsa-folder-thumbnail-browser__header">
                    <div className="bdsa-folder-thumbnail-browser__header-left">
                        <h3 className="bdsa-folder-thumbnail-browser__title">
                            {modelName || 'Thumbnail Browser'}
                        </h3>
                        <span className="bdsa-folder-thumbnail-browser__count">
                            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="bdsa-folder-thumbnail-browser__header-right">
                        <div className="bdsa-folder-thumbnail-browser__size-controls">
                            {(['s', 'm', 'l', 'xl'] as const).map((size) => (
                                <button
                                    key={size}
                                    className={`bdsa-folder-thumbnail-browser__size-button ${
                                        viewerSize === size ? 'bdsa-folder-thumbnail-browser__size-button--active' : ''
                                    }`}
                                    onClick={() => setViewerSize(size)}
                                >
                                    {size.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        {selectedAnnotationName && (
                            <div className="bdsa-folder-thumbnail-browser__opacity-control">
                                <label className="bdsa-folder-thumbnail-browser__opacity-label">
                                    Opacity: {Math.round(annotationOpacity * 100)}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={annotationOpacity}
                                    onChange={(e) => {
                                        const newOpacity = parseFloat(e.target.value)
                                        onAnnotationOpacityChange?.(newOpacity)
                                    }}
                                    className="bdsa-folder-thumbnail-browser__opacity-slider"
                                />
                            </div>
                        )}
                    </div>
                </div>
                {renderPagination()}
                {loading && (
                    <div className="bdsa-folder-thumbnail-browser__loading">
                        <p>Loading items...</p>
                    </div>
                )}
                {error && (
                    <div className="bdsa-folder-thumbnail-browser__error">
                        <p>Error: {error.message}</p>
                    </div>
                )}
                {!loading && !error && (
                    <div ref={gridRef} className="bdsa-folder-thumbnail-browser__grid">
                        {currentPageItems.map((item) => (
                            <ThumbnailViewer
                                key={item._id}
                                item={item}
                                viewerWidth={viewerWidth}
                                apiBaseUrl={apiBaseUrl}
                                backendApiBaseUrl={backendApiBaseUrl}
                                apiHeaders={apiHeaders}
                                fetchFn={proxyFetchFn}
                                selectedAnnotationName={selectedAnnotationName}
                                annotationNameToIds={annotationNameToIds}
                                getDatasetType={datasetTypeFn}
                                showViewerControls={showViewerControls}
                                debug={debug}
                            />
                        ))}
                    </div>
                )}
                {!loading && !error && filteredItems.length === 0 && (
                    <div className="bdsa-folder-thumbnail-browser__empty">
                        <p>No items to display</p>
                    </div>
                )}
            </div>
        )
    }
)

FolderThumbnailBrowser.displayName = 'FolderThumbnailBrowser'
