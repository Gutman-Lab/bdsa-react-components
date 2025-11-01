import React, { useState, useEffect, useMemo } from 'react'
import './AnnotationManager.css'

export interface AnnotationSearchResult {
    _id: string
    _modelType: string
    _elementCount?: number
    _detailsCount?: number
    _version?: number
    _accessLevel?: number
    itemId?: string
    public?: boolean
    created?: string
    updated?: string
    creatorId?: string
    updatedId?: string
    groups?: (string | null)[]
    annotation?: {
        name?: string
        description?: string
        attributes?: Record<string, unknown>
        display?: Record<string, unknown>
    }
    [key: string]: unknown
}

export interface AnnotationManagerProps {
    /** Image/Item ID to search annotations for */
    imageId?: string
    /** Base URL for DSA API (e.g., http://bdsa.pathology.emory.edu:8080/api/v1) */
    apiBaseUrl?: string
    /** Maximum number of annotations to fetch per request (default: 50) */
    limit?: number
    /** Custom fetch function for API requests. Useful for adding authentication headers. */
    fetchFn?: (url: string, options?: RequestInit) => Promise<Response>
    /** Custom headers to add to all API requests. Merged with fetchFn headers if both are provided. */
    apiHeaders?: HeadersInit
    /** Callback when annotations are loaded */
    onAnnotationsLoaded?: (annotations: AnnotationSearchResult[]) => void
    /** Callback when annotation loading fails */
    onError?: (error: Error) => void
    /** Show debug panel with raw API response (default: false, hidden in production) */
    showDebugPanel?: boolean
    className?: string
    children?: React.ReactNode
}

/**
 * AnnotationManager component for managing annotation loading, visibility, and state.
 * This component handles the business logic for annotations while keeping SlideViewer
 * focused on rendering.
 * 
 * Supports fetching annotations by itemId using the DSA API search endpoint.
 * 
 * Note: By default, the API may only return public annotations. To access private
 * annotations, provide authentication via `fetchFn` or `apiHeaders` props.
 */
export const AnnotationManager = React.forwardRef<HTMLDivElement, AnnotationManagerProps>(
    (
        {
            imageId,
            apiBaseUrl,
            limit = 50,
            fetchFn,
            apiHeaders,
            onAnnotationsLoaded,
            onError,
            showDebugPanel = false,
            className = '',
            children,
        },
        ref
    ) => {
        const [annotations, setAnnotations] = useState<AnnotationSearchResult[]>([])
        const [loading, setLoading] = useState<boolean>(false)
        const [error, setError] = useState<Error | null>(null)
        const [rawApiResponse, setRawApiResponse] = useState<string | null>(null)

        // Fetch annotations when imageId or apiBaseUrl changes
        useEffect(() => {
            if (!imageId || !apiBaseUrl) {
                setAnnotations([])
                setLoading(false)
                setError(null)
                setRawApiResponse(null)
                return
            }

            const fetchAnnotations = async () => {
                setLoading(true)
                setError(null)
                setRawApiResponse(null)

                try {
                    // Build URL with pagination parameters
                    const params = new URLSearchParams({
                        itemId: imageId,
                        limit: String(limit),
                        offset: '0',
                        sort: 'lowerName',
                        sortdir: '1',
                    })
                    const url = `${apiBaseUrl}/annotation?${params.toString()}`
                    const customFetch = fetchFn || fetch
                    const fetchOptions: RequestInit = {}
                    
                    if (apiHeaders) {
                        fetchOptions.headers = apiHeaders
                    }

                    console.log(`AnnotationManager: Fetching annotations from: ${url}`)
                    const response = await customFetch(url, fetchOptions)

                    if (!response.ok) {
                        throw new Error(`Failed to fetch annotations: ${response.status} ${response.statusText}`)
                    }

                    const data = await response.json()
                    console.log(`AnnotationManager: API response:`, data)
                    
                    // Store raw response as JSON string for debug panel
                    if (showDebugPanel) {
                        setRawApiResponse(JSON.stringify(data, null, 2))
                    }
                    
                    // Handle both array response and paginated response
                    let annotationList: AnnotationSearchResult[] = []
                    if (Array.isArray(data)) {
                        // DSA API returns array directly
                        annotationList = data
                        console.log(`AnnotationManager: Parsed ${annotationList.length} annotation(s) from array response`)
                    } else if (data && Array.isArray(data.data)) {
                        // Some APIs might return paginated response
                        annotationList = data.data
                        console.log(`AnnotationManager: Parsed ${annotationList.length} annotation(s) from paginated response`)
                    } else if (data && typeof data === 'object') {
                        // If it's a single annotation object, wrap it in an array
                        annotationList = [data]
                        console.log(`AnnotationManager: Parsed 1 annotation from single object response`)
                    } else {
                        console.warn(`AnnotationManager: Unexpected response format:`, typeof data, data)
                    }

                    setAnnotations(annotationList)
                    console.log(`AnnotationManager: Fetched ${annotationList.length} annotation(s) from API`)
                    if (annotationList.length > 0) {
                        console.log(`AnnotationManager: Annotation IDs:`, annotationList.map(a => a._id))
                    }
                    
                    if (onAnnotationsLoaded) {
                        onAnnotationsLoaded(annotationList)
                    }
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err))
                    setError(error)
                    setRawApiResponse(null)
                    
                    if (onError) {
                        onError(error)
                    }
                } finally {
                    setLoading(false)
                }
            }

            fetchAnnotations()
        }, [imageId, apiBaseUrl, limit, fetchFn, apiHeaders, onAnnotationsLoaded, onError, showDebugPanel])

        // Memoize the annotations list for rendering
        const annotationContext = useMemo(() => ({
            annotations,
            loading,
            error,
            annotationIds: annotations.map(a => a._id),
        }), [annotations, loading, error])

        return (
            <div
                ref={ref}
                className={`bdsa-annotation-manager ${className}`}
            >
                {children && typeof children === 'function' 
                    ? (children as (context: typeof annotationContext) => React.ReactNode)(annotationContext)
                    : children}
                {showDebugPanel && rawApiResponse && (
                    <div className="bdsa-annotation-manager__debug-panel">
                        <div className="bdsa-annotation-manager__debug-panel-header">
                            <strong>Raw API Response (Debug)</strong>
                        </div>
                        <pre className="bdsa-annotation-manager__debug-panel-content">
                            {rawApiResponse}
                        </pre>
                    </div>
                )}
            </div>
        )
    }
)

AnnotationManager.displayName = 'AnnotationManager'

