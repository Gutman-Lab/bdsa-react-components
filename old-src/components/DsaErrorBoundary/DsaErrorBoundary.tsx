import React, { Component, type ReactNode } from 'react'
import type { ApiError } from '../../utils/apiErrorHandling'
import './DsaErrorBoundary.css'

export interface DsaErrorBoundaryProps {
    /** Child components to wrap */
    children: ReactNode
    /** Custom fallback UI component. Receives error and reset function. */
    fallback?: (error: Error, reset: () => void) => ReactNode
    /** Callback when an error is caught */
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void
    /** Whether to show a "Retry" button (default: true) */
    showRetry?: boolean
    /** Custom error message title */
    errorTitle?: string
    /** Custom error message description */
    errorDescription?: string
    /** Custom CSS class */
    className?: string
}

interface DsaErrorBoundaryState {
    hasError: boolean
    error: Error | null
    errorInfo: React.ErrorInfo | null
}

/**
 * Error Boundary component for catching and displaying React errors gracefully.
 * 
 * This component catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the entire app.
 * 
 * @example Basic usage
 * ```tsx
 * <DsaErrorBoundary>
 *   <FolderBrowser apiBaseUrl={apiBaseUrl} />
 * </DsaErrorBoundary>
 * ```
 * 
 * @example With custom fallback
 * ```tsx
 * <DsaErrorBoundary
 *   fallback={(error, reset) => (
 *     <div>
 *       <h2>Something went wrong</h2>
 *       <p>{error.message}</p>
 *       <button onClick={reset}>Try Again</button>
 *     </div>
 *   )}
 * >
 *   <SlideViewer imageInfo={imageInfo} />
 * </DsaErrorBoundary>
 * ```
 * 
 * @example With error callback
 * ```tsx
 * <DsaErrorBoundary
 *   onError={(error, errorInfo) => {
 *     // Log to error reporting service
 *     logErrorToService(error, errorInfo)
 *   }}
 * >
 *   <ThumbnailGrid apiBaseUrl={apiBaseUrl} />
 * </DsaErrorBoundary>
 * ```
 */
export class DsaErrorBoundary extends Component<DsaErrorBoundaryProps, DsaErrorBoundaryState> {
    constructor(props: DsaErrorBoundaryProps) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        }
    }

    static getDerivedStateFromError(error: Error): Partial<DsaErrorBoundaryState> {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
        }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error details
        console.error('DsaErrorBoundary caught an error:', error, errorInfo)
        
        // Store error info in state for display
        this.setState({
            errorInfo,
        })

        // Call optional error callback
        if (this.props.onError) {
            this.props.onError(error, errorInfo)
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        })
    }

    render() {
        if (this.state.hasError && this.state.error) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.handleReset)
            }

            // Default fallback UI
            return (
                <div className={`bdsa-error-boundary ${this.props.className || ''}`}>
                    <div className="bdsa-error-boundary__content">
                        <div className="bdsa-error-boundary__icon">⚠️</div>
                        <h2 className="bdsa-error-boundary__title">
                            {this.props.errorTitle || 'Something went wrong'}
                        </h2>
                        <p className="bdsa-error-boundary__description">
                            {this.props.errorDescription || 
                             'An unexpected error occurred. Please try again or contact support if the problem persists.'}
                        </p>
                        
                        {this.state.error && (
                            <details className="bdsa-error-boundary__details">
                                <summary className="bdsa-error-boundary__summary">
                                    Error Details
                                </summary>
                                <div className="bdsa-error-boundary__error-message">
                                    <strong>Error:</strong> {this.state.error.message}
                                </div>
                                {this.state.error.stack && (
                                    <pre className="bdsa-error-boundary__stack">
                                        {this.state.error.stack}
                                    </pre>
                                )}
                                {this.state.errorInfo && (
                                    <details className="bdsa-error-boundary__component-stack">
                                        <summary>Component Stack</summary>
                                        <pre>{this.state.errorInfo.componentStack}</pre>
                                    </details>
                                )}
                                {this.isApiError(this.state.error) && (
                                    <div className="bdsa-error-boundary__api-error">
                                        <strong>API Error Details:</strong>
                                        <ul>
                                            {this.state.error.status && (
                                                <li>Status: {this.state.error.status} {this.state.error.statusText}</li>
                                            )}
                                            <li>Retryable: {this.state.error.isRetryable ? 'Yes' : 'No'}</li>
                                            {this.state.error.isNetworkError && (
                                                <li>Network Error: Yes</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </details>
                        )}

                        {this.props.showRetry !== false && (
                            <div className="bdsa-error-boundary__actions">
                                <button
                                    className="bdsa-error-boundary__retry-button"
                                    onClick={this.handleReset}
                                    type="button"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )
        }

        return this.props.children
    }

    private isApiError(error: Error): error is ApiError {
        return 'status' in error || 'isRetryable' in error || 'isNetworkError' in error
    }
}
