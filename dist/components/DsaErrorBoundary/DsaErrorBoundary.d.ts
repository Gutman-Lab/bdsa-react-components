import { default as React, Component, ReactNode } from 'react';

export interface DsaErrorBoundaryProps {
    /** Child components to wrap */
    children: ReactNode;
    /** Custom fallback UI component. Receives error and reset function. */
    fallback?: (error: Error, reset: () => void) => ReactNode;
    /** Callback when an error is caught */
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    /** Whether to show a "Retry" button (default: true) */
    showRetry?: boolean;
    /** Custom error message title */
    errorTitle?: string;
    /** Custom error message description */
    errorDescription?: string;
    /** Custom CSS class */
    className?: string;
}
interface DsaErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
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
export declare class DsaErrorBoundary extends Component<DsaErrorBoundaryProps, DsaErrorBoundaryState> {
    constructor(props: DsaErrorBoundaryProps);
    static getDerivedStateFromError(error: Error): Partial<DsaErrorBoundaryState>;
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void;
    handleReset: () => void;
    render(): string | number | boolean | Iterable<React.ReactNode> | import("react/jsx-runtime").JSX.Element | null | undefined;
    private isApiError;
}
export {};
//# sourceMappingURL=DsaErrorBoundary.d.ts.map