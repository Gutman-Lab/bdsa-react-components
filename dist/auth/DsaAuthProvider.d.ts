import { default as React } from 'react';
import { DsaAuthStatus, DsaUserInfo } from './types';

export interface DsaAuthContextValue {
    /** Current authentication status */
    authStatus: DsaAuthStatus;
    /** Current authentication token (null if not authenticated) */
    token: string | null;
    /** Whether authentication is currently loading */
    isLoading: boolean;
    /** Error message if authentication failed */
    error: string | null;
    /** User information (null if not authenticated) */
    user: DsaUserInfo | null;
    /** Whether user is authenticated */
    isAuthenticated: boolean;
    /** Manually refresh the token */
    refreshToken: () => Promise<void>;
    /** Get authentication headers for API requests */
    getAuthHeaders: () => Record<string, string>;
}
export interface DsaAuthProviderProps {
    /** Base URL for DSA API (e.g., 'http://bdsa.pathology.emory.edu:8080/api/v1') */
    apiBaseUrl: string;
    /**
     * Backend endpoint that returns { dsaToken: string }.
     * Your backend should keep the API key secure and exchange it for a DSA token.
     * This is the recommended pattern (Option A).
     *
     * @example '/api/config'
     */
    tokenEndpoint?: string;
    /**
     * API key to exchange for a DSA token directly.
     * Only use this if you cannot use the backend endpoint pattern.
     * This is less secure as the API key will be in the frontend (Option B).
     */
    apiKey?: string;
    /** Callback when token is obtained or changes */
    onTokenChange?: (token: string | null) => void;
    /** Callback when authentication fails */
    onAuthError?: (error: Error) => void;
    /** Callback when API errors occur */
    onApiError?: (error: Error, retry: () => void) => void;
    /** Whether to automatically refresh token before expiry (default: true) */
    autoRefresh?: boolean;
    /** Refresh token when it's this many milliseconds from expiring (default: 5 minutes) */
    refreshThreshold?: number;
    /** Child components */
    children: React.ReactNode;
}
/**
 * DSA Authentication Provider Component
 *
 * Manages authentication state and provides token to child components via context.
 * Supports both backend endpoint and direct API key patterns for token acquisition.
 */
export declare const DsaAuthProvider: React.FC<DsaAuthProviderProps>;
/**
 * Hook to access DSA authentication context
 *
 * @throws Error if used outside of DsaAuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { token, isAuthenticated, user } = useDsaAuth()
 *
 *   if (!isAuthenticated) {
 *     return <div>Not authenticated</div>
 *   }
 *
 *   return <div>Welcome, {user?.name}!</div>
 * }
 * ```
 */
export declare function useDsaAuth(): DsaAuthContextValue;
/**
 * Hook to get just the DSA token from context
 *
 * @throws Error if used outside of DsaAuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const token = useDsaToken()
 *   // Use token for API requests
 * }
 * ```
 */
export declare function useDsaToken(): string | null;
//# sourceMappingURL=DsaAuthProvider.d.ts.map