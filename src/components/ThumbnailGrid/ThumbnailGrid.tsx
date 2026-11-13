import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDsaResolvedApi } from '../../auth/useDsaResolvedApi'
import { filterLargeImages, isAIModel, type Item } from '../../utils/itemUtils'
import { createDebugLogger } from '../../utils/debugLog'
import { handleApiError, type ApiErrorHandler, type ApiError } from '../../utils/apiErrorHandling'
import { extractToken } from '../SlideViewer/SlideViewer.utils'
import { computeThumbnailGridPageSize } from './thumbnailGridLayout'
import './ThumbnailGrid.css'

export interface ThumbnailGridProps {
    // Data Sources (mutually exclusive)
    /** DSA folder ID to fetch items from */
    folderId?: string
    /** Array of specific image IDs to display */
    imageIds?: string[]
    /** Pre-loaded items array (takes precedence) */
    items?: Item[]

    // API Configuration
    /**
     * DSA API base URL including `/api/v1`.
     * When omitted, uses the server URL from `DsaAuthManager` / `dsaAuthStore` (same as FolderBrowser).
     */
    apiBaseUrl?: string
    /** Backend API base URL for fetching items (optional, falls back to apiBaseUrl if not provided) */
    backendApiBaseUrl?: string
    /** Headers for API requests (auth, etc.) */
    apiHeaders?: HeadersInit
    /** Overrides the Girder token from `dsaAuthStore` when set. */
    authToken?: string
    /** If true, appends the authentication token as a query parameter (?token=...) to thumbnail URLs.
     *  This is required for some DSA servers that validate tokens via query parameters instead of (or in addition to) headers.
     *  Default: false */
    tokenQueryParam?: boolean
    /** Custom fetch function for API requests */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>

    // Display Configuration
    /** Initial items per page estimate (default: 12) */
    itemsPerPage?: number
    /** Thumbnail size preset (default: 'l') */
    thumbnailSize?: 's' | 'm' | 'l' | 'xl'
    /** Width requested from `/tiles/thumbnail` in pixels (defaults to the selected thumbnail size preset). */
    thumbnailImageSize?: number
    /** Image source for static thumbnails: DSA tile thumbnails or the original download (default: 'tiles'). */
    imageSource?: 'tiles' | 'download'
    /** When false, keep items that do not advertise a largeImage flag (default: true). */
    requireLargeImage?: boolean

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
    /** Callback when thumbnail is clicked */
    onThumbnailClick?: (item: Item) => void
    /** Callback when the pointer enters a thumbnail */
    onThumbnailHover?: (item: Item) => void
    /** Callback when a thumbnail is double-clicked */
    onThumbnailDoubleClick?: (item: Item) => void

    // Annotation filtering
    /** Name of the currently selected annotation. Requires `annotationNameToIds`. */
    selectedAnnotationName?: string
    /** Map of item ID to annotation ID; when set with `selectedAnnotationName`, only annotated items are shown. */
    annotationNameToIds?: Map<string, string> | Record<string, string>

    // Other
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
    onApiError?: ApiErrorHandler
    /** Debug mode for logging */
    debug?: boolean
    /** Custom CSS class */
    className?: string
}

/**
 * Size presets for thumbnails
 */
const THUMBNAIL_SIZES = {
    s: 120,
    m: 180,
    l: 240,
    xl: 320,
} as const

/**
 * Basic thumbnail grid component that displays static thumbnail images.
 * This is a lightweight alternative to OSDThumbnailBrowser that doesn't use OpenSeadragon.
 */
export const ThumbnailGrid = React.forwardRef<HTMLDivElement, ThumbnailGridProps>(
    (
        {
            folderId,
            imageIds,
            items: providedItems,
            apiBaseUrl,
            backendApiBaseUrl,
            apiHeaders,
            authToken,
            tokenQueryParam = false,
            fetchFn,
            itemsPerPage: initialItemsPerPage = 12,
            thumbnailSize: initialThumbnailSize = 'l',
            thumbnailImageSize,
            imageSource = 'tiles',
            requireLargeImage = true,
            modelName,
            modelDatasetInfo,
            onItemsLoaded,
            getDatasetType,
            onThumbnailClick,
            onThumbnailHover,
            onThumbnailDoubleClick,
            selectedAnnotationName,
            annotationNameToIds,
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
        const [thumbnailSize, setThumbnailSize] = useState<'s' | 'm' | 'l' | 'xl'>(initialThumbnailSize)
        const [itemsPerPage, setItemsPerPage] = useState<number>(Math.max(1, initialItemsPerPage))
        const [gridNode, setGridNode] = useState<HTMLDivElement | null>(null)
        const containerRef = useRef<HTMLDivElement | null>(null)
        const gridRef = useRef<HTMLDivElement | null>(null)

        const assignContainerRef = useCallback(
            (node: HTMLDivElement | null) => {
                containerRef.current = node
                if (typeof ref === 'function') {
                    ref(node)
                } else if (ref != null) {
                    const forwarded = ref as { current: HTMLDivElement | null }
                    forwarded.current = node
                }
            },
            [ref]
        )

        const debugLog = useMemo(() => createDebugLogger('ThumbnailGrid', debug), [debug])

        const {
            apiBaseUrl: effectiveApiBaseUrl,
            apiHeaders: effectiveApiHeaders,
            authToken: resolvedAuthToken,
        } = useDsaResolvedApi({ apiBaseUrl, apiHeaders, authToken })

        // Load thumbnail size from localStorage
        useEffect(() => {
            const savedSize = localStorage.getItem('bdsa-thumbnail-grid-size') as 's' | 'm' | 'l' | 'xl' | null
            if (savedSize && ['s', 'm', 'l', 'xl'].includes(savedSize)) {
                setThumbnailSize(savedSize)
            }
        }, [])

        // Save thumbnail size to localStorage
        useEffect(() => {
            localStorage.setItem('bdsa-thumbnail-grid-size', thumbnailSize)
        }, [thumbnailSize])

        const assignGridRef = useCallback((node: HTMLDivElement | null) => {
            gridRef.current = node
            setGridNode(node)
        }, [])

        // Measure the live grid box and recompute the page size whenever the box
        // or thumbnail size changes. A ResizeObserver catches container-only
        // changes (sidebar toggles, expanders, wrapped pagination) that never
        // fire a window resize event.
        useEffect(() => {
            if (!gridNode) return

            const measure = () => {
                const style = window.getComputedStyle(gridNode)
                const paddingLeft = parseFloat(style.paddingLeft) || 0
                const paddingRight = parseFloat(style.paddingRight) || 0
                const paddingTop = parseFloat(style.paddingTop) || 0
                const paddingBottom = parseFloat(style.paddingBottom) || 0
                const borderLeft = parseFloat(style.borderLeftWidth) || 0
                const borderRight = parseFloat(style.borderRightWidth) || 0
                const columnGap = parseFloat(style.columnGap)
                const rowGap = parseFloat(style.rowGap)

                // offsetWidth includes a vertical scrollbar, so an over-full page
                // cannot shrink its own column count and oscillate.
                const contentWidth = gridNode.offsetWidth - borderLeft - borderRight - paddingLeft - paddingRight
                const contentHeight = gridNode.clientHeight - paddingTop - paddingBottom

                const firstItem = gridNode.querySelector<HTMLElement>('.bdsa-thumbnail-grid__item')
                const nominalSize = THUMBNAIL_SIZES[thumbnailSize]
                // Read the inline target size rather than offsetWidth/offsetHeight:
                // the tile has a short CSS transition, so a measurement taken right
                // after an S/M/L/XL change can catch an intermediate size and lock in
                // the wrong page count until the next container resize.
                const inlineWidth = firstItem ? parseFloat(firstItem.style.width) : Number.NaN
                const inlineHeight = firstItem ? parseFloat(firstItem.style.height) : Number.NaN
                const itemWidth =
                    Number.isFinite(inlineWidth) && inlineWidth > 0
                        ? inlineWidth
                        : firstItem?.offsetWidth || nominalSize
                const itemHeight =
                    Number.isFinite(inlineHeight) && inlineHeight > 0
                        ? inlineHeight
                        : firstItem?.offsetHeight || nominalSize

                const nextItemsPerPage = computeThumbnailGridPageSize({
                    contentWidth,
                    contentHeight,
                    itemWidth,
                    itemHeight,
                    columnGap,
                    rowGap,
                    fallbackItemsPerPage: initialItemsPerPage,
                })
                setItemsPerPage((previous) => (previous === nextItemsPerPage ? previous : nextItemsPerPage))
            }

            measure()

            let observer: ResizeObserver | null = null
            if (typeof ResizeObserver !== 'undefined') {
                observer = new ResizeObserver(measure)
                observer.observe(gridNode)
            }
            window.addEventListener('resize', measure)
            const timeoutId = window.setTimeout(measure, 100)

            return () => {
                observer?.disconnect()
                window.removeEventListener('resize', measure)
                window.clearTimeout(timeoutId)
            }
        }, [gridNode, thumbnailSize, initialItemsPerPage])

        // Fetch items from folder or imageIds
        const fetchItems = useCallback(async () => {
            if (providedItems) {
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
                    const url = `${effectiveApiBaseUrl}/item?${params.toString()}`
                    debugLog.log(`Fetching items from: ${url}`)
                    
                    const fetchOptions: RequestInit = {}
                    if (effectiveApiHeaders) {
                        fetchOptions.headers = effectiveApiHeaders
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
                        const url = `${effectiveApiBaseUrl}/item/${itemId}`
                        debugLog.log(`Fetching item: ${url}`)
                        
                        const fetchOptions: RequestInit = {}
                        if (effectiveApiHeaders) {
                            fetchOptions.headers = effectiveApiHeaders
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
                    ? `${effectiveApiBaseUrl}/item?folderId=${folderId}`
                    : `${effectiveApiBaseUrl}/item`
                
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
            // eslint-disable-next-line react-hooks/exhaustive-deps -- processItems is defined below; deps here intentionally exclude it
        }, [folderId, imageIds, providedItems, backendApiBaseUrl, effectiveApiBaseUrl, effectiveApiHeaders, fetchFn, debugLog, onApiError])

        // Process fetched items
        const processItems = useCallback(
            (data: Item[]) => {
                // Only require the DSA largeImage flag when the caller asked for it.
                const imageItems = requireLargeImage ? filterLargeImages(data) : data

                // Exclude model items
                const filteredItems = imageItems.filter((item) => !isAIModel(item))

                setItems(filteredItems)

                if (onItemsLoaded) {
                    onItemsLoaded(filteredItems.map((item) => item._id))
                }

                debugLog.log(`Processed ${filteredItems.length} items from ${data.length} total`)
            },
            [onItemsLoaded, debugLog, requireLargeImage]
        )

        // Fetch items when dependencies change
        useEffect(() => {
            fetchItems()
        }, [fetchItems])

        // Annotation-name filtering mirrors OSDThumbnailBrowser: only show items
        // that have an annotation id in the supplied map.
        const visibleItems = useMemo(() => {
            if (!selectedAnnotationName || !annotationNameToIds) {
                return items
            }

            return items.filter((item) => {
                const itemId = String(item._id)
                if (annotationNameToIds instanceof Map) {
                    return annotationNameToIds.has(itemId)
                }
                return itemId in annotationNameToIds
            })
        }, [items, selectedAnnotationName, annotationNameToIds])

        // Pagination
        const totalPages = Math.max(1, Math.ceil(visibleItems.length / itemsPerPage))
        const startIndex = (currentPage - 1) * itemsPerPage
        const endIndex = startIndex + itemsPerPage
        const currentPageItems = visibleItems.slice(startIndex, endIndex)

        // Reset to page 1 when the visible set changes
        useEffect(() => {
            setCurrentPage(1)
        }, [visibleItems.length])

        // Keep the current page in range when the measured page size changes
        useEffect(() => {
            setCurrentPage((page) => (page > totalPages ? totalPages : page))
        }, [totalPages])

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

        const token = useMemo(
            () => extractToken(resolvedAuthToken, effectiveApiHeaders),
            [resolvedAuthToken, effectiveApiHeaders]
        )

        // Helper to append token to URL
        const appendTokenToUrl = useCallback((url: string, token?: string): string => {
            if (!token || !tokenQueryParam) {
                return url
            }
            
            const separator = url.includes('?') ? '&' : '?'
            return `${url}${separator}token=${encodeURIComponent(token)}`
        }, [tokenQueryParam])

        // Build thumbnail URL for an item
        const getThumbnailUrl = useCallback(
            (item: Item): string => {
                // apiBaseUrl already includes /api/v1.
                let url: string
                if (imageSource === 'download') {
                    url = `${effectiveApiBaseUrl}/item/${item._id}/download?contentDisposition=inline`
                } else {
                    const thumbWidth = thumbnailImageSize ?? THUMBNAIL_SIZES[thumbnailSize]
                    url = `${effectiveApiBaseUrl}/item/${item._id}/tiles/thumbnail?width=${thumbWidth}`
                }
                // Append token as query parameter if enabled
                url = appendTokenToUrl(url, token)
                return url
            },
            [effectiveApiBaseUrl, thumbnailSize, thumbnailImageSize, imageSource, token, appendTokenToUrl]
        )

        // Pagination controls
        const renderPagination = () => {
            if (totalPages <= 1) return null

            const pages: (number | 'ellipsis')[] = []
            const maxVisiblePages = 7

            if (totalPages <= maxVisiblePages) {
                for (let i = 1; i <= totalPages; i++) {
                    pages.push(i)
                }
            } else {
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
                <div className="bdsa-thumbnail-grid__pagination">
                    <button
                        className="bdsa-thumbnail-grid__pagination-button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </button>
                    {pages.map((page, idx) => {
                        if (page === 'ellipsis') {
                            return (
                                <span key={`ellipsis-${idx}`} className="bdsa-thumbnail-grid__pagination-ellipsis">
                                    ...
                                </span>
                            )
                        }
                        return (
                            <button
                                key={page}
                                className={`bdsa-thumbnail-grid__pagination-button ${
                                    page === currentPage ? 'bdsa-thumbnail-grid__pagination-button--active' : ''
                                }`}
                                onClick={() => setCurrentPage(page)}
                            >
                                {page}
                            </button>
                        )
                    })}
                    <button
                        className="bdsa-thumbnail-grid__pagination-button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </button>
                </div>
            )
        }

        const thumbWidth = THUMBNAIL_SIZES[thumbnailSize]

        return (
            <div ref={assignContainerRef} className={`bdsa-thumbnail-grid ${className}`}>
                <div className="bdsa-thumbnail-grid__header">
                    <div className="bdsa-thumbnail-grid__header-left">
                        <h3 className="bdsa-thumbnail-grid__title">{modelName || 'Thumbnail Grid'}</h3>
                        <span className="bdsa-thumbnail-grid__count">
                            {visibleItems.length} item{visibleItems.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="bdsa-thumbnail-grid__header-right">
                        <div className="bdsa-thumbnail-grid__size-controls">
                            {(['s', 'm', 'l', 'xl'] as const).map((size) => (
                                <button
                                    key={size}
                                    className={`bdsa-thumbnail-grid__size-button ${
                                        thumbnailSize === size ? 'bdsa-thumbnail-grid__size-button--active' : ''
                                    }`}
                                    onClick={() => setThumbnailSize(size)}
                                >
                                    {size.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                {renderPagination()}
                {loading && (
                    <div className="bdsa-thumbnail-grid__loading">
                        <p>Loading items...</p>
                    </div>
                )}
                {error && (
                    <div className="bdsa-thumbnail-grid__error">
                        <p>Error: {error.message}</p>
                    </div>
                )}
                {!loading && !error && (
                    <div ref={assignGridRef} className="bdsa-thumbnail-grid__grid">
                        {currentPageItems.map((item) => {
                            const datasetType = datasetTypeFn ? datasetTypeFn(item._id) : null
                            return (
                                <div
                                    key={item._id}
                                    className={`bdsa-thumbnail-grid__item ${datasetType ? `bdsa-thumbnail-grid__item--${datasetType}` : ''}`}
                                    style={{ width: thumbWidth, height: thumbWidth }}
                                    onClick={() => onThumbnailClick?.(item)}
                                    onDoubleClick={() => onThumbnailDoubleClick?.(item)}
                                    onMouseEnter={() => onThumbnailHover?.(item)}
                                >
                                    {datasetType && (
                                        <div className={`bdsa-thumbnail-grid__dataset-badge bdsa-thumbnail-grid__dataset-badge--${datasetType}`}>
                                            {datasetType.toUpperCase()}
                                        </div>
                                    )}
                                    <div className="bdsa-thumbnail-grid__image-container">
                                        <img
                                            src={getThumbnailUrl(item)}
                                            alt={item.name || item._id}
                                            className="bdsa-thumbnail-grid__image"
                                            loading="lazy"
                                            crossOrigin="anonymous"
                                            onError={(e) => {
                                                // Log error and show placeholder
                                                const target = e.target as HTMLImageElement
                                                const url = target.src
                                                debugLog.error(`Failed to load thumbnail for ${item._id}:`, url)
                                                // Show a placeholder instead of hiding
                                                target.style.backgroundColor = '#f0f0f0'
                                                target.style.display = 'block'
                                                target.alt = `Failed to load: ${item.name || item._id}`
                                            }}
                                            onLoad={() => {
                                                debugLog.log(`Successfully loaded thumbnail for ${item._id}`)
                                            }}
                                        />
                                    </div>
                                    {item.name && (
                                        <div className="bdsa-thumbnail-grid__label" title={item.name}>
                                            {item.name}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
                {!loading && !error && visibleItems.length === 0 && (
                    <div className="bdsa-thumbnail-grid__empty">
                        <p>No items to display</p>
                    </div>
                )}
            </div>
        )
    }
)

ThumbnailGrid.displayName = 'ThumbnailGrid'
