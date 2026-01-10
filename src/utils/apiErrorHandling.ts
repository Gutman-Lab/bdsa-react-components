/**
 * Shared error handling utilities for API calls across all components
 */

/**
 * Represents an API error with status code and message
 */
export interface ApiError extends Error {
    /** HTTP status code (if available) */
    status?: number
    /** HTTP status text (if available) */
    statusText?: string
    /** Whether this is a network error (no response from server) */
    isNetworkError?: boolean
    /** Whether this error is retryable (transient failure) */
    isRetryable?: boolean
}

/**
 * Additional context about where an API error occurred
 */
export interface ApiErrorContext {
    /** The API endpoint that failed */
    endpoint?: string
    /** Type of operation that failed */
    operation?: 'fetch' | 'load' | 'create' | 'update' | 'delete'
    /** Additional metadata */
    metadata?: Record<string, unknown>
}

/**
 * Callback function type for handling API errors
 */
export type ApiErrorHandler = (
    error: ApiError,
    retry: () => void,
    context?: ApiErrorContext
) => void

/**
 * Creates an ApiError from various error types
 */
export function createApiError(
    error: unknown,
    response?: Response
): ApiError {
    if (error instanceof Error) {
        const apiError = error as ApiError

        // Check if it's a network error (no response)
        if (!response && (error.message.includes('fetch') || error.message.includes('network'))) {
            apiError.isNetworkError = true
            apiError.isRetryable = true
        }

        // Add response info if available
        if (response) {
            apiError.status = response.status
            apiError.statusText = response.statusText

            // Determine if error is retryable
            // 401: Unauthorized (token expired) - retryable after refresh
            // 403: Forbidden - not retryable
            // 404: Not Found - not retryable
            // 429: Too Many Requests - retryable with backoff
            // 500: Internal Server Error - retryable
            // 502: Bad Gateway - retryable
            // 503: Service Unavailable - retryable
            // 504: Gateway Timeout - retryable
            apiError.isRetryable = [401, 429, 500, 502, 503, 504].includes(response.status)
        }

        return apiError
    }

    // Fallback for non-Error types
    const apiError = new Error(String(error)) as ApiError
    apiError.isNetworkError = true
    apiError.isRetryable = true
    return apiError
}

/**
 * Handles an API error with retry capability
 */
export function handleApiError(
    error: unknown,
    response: Response | undefined,
    onApiError: ApiErrorHandler | undefined,
    retryFn: () => void | Promise<void>,
    context?: ApiErrorContext
): void {
    const apiError = createApiError(error, response)

    if (onApiError) {
        onApiError(apiError, () => {
            void retryFn()
        }, context)
    } else {
        // Default behavior: just log the error
        console.error('API Error:', apiError, context)
    }
}

/**
 * Wraps a fetch call with error handling
 */
export async function fetchWithErrorHandling(
    url: string,
    options: RequestInit | undefined,
    onApiError: ApiErrorHandler | undefined,
    retryFn: () => Promise<Response>,
    context?: ApiErrorContext
): Promise<Response> {
    try {
        const response = await fetch(url, options)

        if (!response.ok) {
            const error = new Error(`Request failed: ${response.status} ${response.statusText}`) as ApiError
            error.status = response.status
            error.statusText = response.statusText
            error.isRetryable = [401, 429, 500, 502, 503, 504].includes(response.status)

            handleApiError(
                error,
                response,
                onApiError,
                () => {
                    void retryFn()
                },
                {
                    ...context,
                    endpoint: url,
                }
            )

            throw error
        }

        return response
    } catch (err) {
        // Network errors or other exceptions
        handleApiError(
            err,
            undefined,
            onApiError,
            () => {
                void retryFn()
            },
            {
                ...context,
                endpoint: url,
            }
        )
        throw err
    }
}
