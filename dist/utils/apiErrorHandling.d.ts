/**
 * Shared error handling utilities for API calls across all components
 */
/**
 * Represents an API error with status code and message
 */
export interface ApiError extends Error {
    /** HTTP status code (if available) */
    status?: number;
    /** HTTP status text (if available) */
    statusText?: string;
    /** Whether this is a network error (no response from server) */
    isNetworkError?: boolean;
    /** Whether this error is retryable (transient failure) */
    isRetryable?: boolean;
}
/**
 * Additional context about where an API error occurred
 */
export interface ApiErrorContext {
    /** The API endpoint that failed */
    endpoint?: string;
    /** Type of operation that failed */
    operation?: 'fetch' | 'load' | 'create' | 'update' | 'delete';
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Callback function type for handling API errors
 */
export type ApiErrorHandler = (error: ApiError, retry: () => void, context?: ApiErrorContext) => void;
/**
 * Creates an ApiError from various error types
 */
export declare function createApiError(error: unknown, response?: Response): ApiError;
/**
 * Handles an API error with retry capability
 */
export declare function handleApiError(error: unknown, response: Response | undefined, onApiError: ApiErrorHandler | undefined, retryFn: () => void | Promise<void>, context?: ApiErrorContext): void;
/**
 * Wraps a fetch call with error handling
 */
export declare function fetchWithErrorHandling(url: string, options: RequestInit | undefined, onApiError: ApiErrorHandler | undefined, retryFn: () => Promise<Response>, context?: ApiErrorContext): Promise<Response>;
//# sourceMappingURL=apiErrorHandling.d.ts.map