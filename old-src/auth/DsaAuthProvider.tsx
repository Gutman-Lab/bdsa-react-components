/**
 * DSA Authentication Provider
 * 
 * Provides authentication context to child components, supporting:
 * - Backend endpoint pattern: Fetches token from your backend endpoint
 * - Direct API key pattern: Exchanges API key for token directly
 * 
 * @example Backend Endpoint Pattern (Recommended - keeps API key secure)
 * ```tsx
 * <DsaAuthProvider
 *   apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
 *   tokenEndpoint="/api/config"
 *   onTokenChange={(token) => console.log('Token obtained:', token)}
 * >
 *   <FolderBrowser apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1" />
 * </DsaAuthProvider>
 * ```
 * 
 * @example Direct API Key Pattern
 * ```tsx
 * <DsaAuthProvider
 *   apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
 *   apiKey="your-api-key-here"
 *   onTokenChange={(token) => console.log('Token obtained:', token)}
 * >
 *   <FolderBrowser apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1" />
 * </DsaAuthProvider>
 * ```
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { dsaAuthStore } from './DsaAuthStore'
import type { DsaAuthStatus, DsaUserInfo } from './types'

export interface DsaAuthContextValue {
    /** Current authentication status */
    authStatus: DsaAuthStatus
    /** Current authentication token (null if not authenticated) */
    token: string | null
    /** Whether authentication is currently loading */
    isLoading: boolean
    /** Error message if authentication failed */
    error: string | null
    /** User information (null if not authenticated) */
    user: DsaUserInfo | null
    /** Whether user is authenticated */
    isAuthenticated: boolean
    /** Manually refresh the token */
    refreshToken: () => Promise<void>
    /** Get authentication headers for API requests */
    getAuthHeaders: () => Record<string, string>
}

const DsaAuthContext = createContext<DsaAuthContextValue | null>(null)

export interface DsaAuthProviderProps {
    /** Base URL for DSA API (e.g., 'http://bdsa.pathology.emory.edu:8080/api/v1') */
    apiBaseUrl: string
    /** 
     * Backend endpoint that returns { dsaToken: string }.
     * Your backend should keep the API key secure and exchange it for a DSA token.
     * This is the recommended pattern (Option A).
     * 
     * @example '/api/config'
     */
    tokenEndpoint?: string
    /** 
     * API key to exchange for a DSA token directly.
     * Only use this if you cannot use the backend endpoint pattern.
     * This is less secure as the API key will be in the frontend (Option B).
     */
    apiKey?: string
    /** Callback when token is obtained or changes */
    onTokenChange?: (token: string | null) => void
    /** Callback when authentication fails */
    onAuthError?: (error: Error) => void
    /** Callback when API errors occur */
    onApiError?: (error: Error, retry: () => void) => void
    /** Whether to automatically refresh token before expiry (default: true) */
    autoRefresh?: boolean
    /** Refresh token when it's this many milliseconds from expiring (default: 5 minutes) */
    refreshThreshold?: number
    /** Child components */
    children: React.ReactNode
}

/**
 * DSA Authentication Provider Component
 * 
 * Manages authentication state and provides token to child components via context.
 * Supports both backend endpoint and direct API key patterns for token acquisition.
 */
export const DsaAuthProvider: React.FC<DsaAuthProviderProps> = ({
    apiBaseUrl,
    tokenEndpoint,
    apiKey,
    onTokenChange,
    onAuthError,
    onApiError,
    autoRefresh = true,
    refreshThreshold = 5 * 60 * 1000, // 5 minutes
    children,
}) => {
    const [authStatus, setAuthStatus] = useState<DsaAuthStatus>(dsaAuthStore.getStatus())
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isRefreshingRef = useRef<boolean>(false)

    // Update DSA server URL in store
    useEffect(() => {
        dsaAuthStore.updateConfig({ baseUrl: apiBaseUrl.replace(/\/api\/v1$/, '') })
    }, [apiBaseUrl])

    // Subscribe to auth store changes
    useEffect(() => {
        const unsubscribe = dsaAuthStore.subscribe(() => {
            setAuthStatus(dsaAuthStore.getStatus())
        })
        return unsubscribe
    }, [])

    // Fetch token from backend endpoint
    const fetchTokenFromEndpoint = useCallback(async (): Promise<string> => {
        if (!tokenEndpoint) {
            throw new Error('tokenEndpoint is required')
        }

        const response = await fetch(tokenEndpoint, {
            method: 'GET',
            credentials: 'include', // Include cookies for session-based auth
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch token: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        const token = data.dsaToken || data.token || data.girderToken

        if (!token) {
            throw new Error('Token not found in response. Expected { dsaToken: string } or { token: string }')
        }

        return token
    }, [tokenEndpoint])

    // Exchange API key for token directly
    const exchangeApiKeyForToken = useCallback(async (): Promise<string> => {
        if (!apiKey) {
            throw new Error('apiKey is required')
        }

        // DSA/Girder API key authentication endpoint
        const response = await fetch(`${apiBaseUrl}/api_key/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ key: apiKey }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error((errorData as any).message || `API key authentication failed: ${response.status}`)
        }

        const data = await response.json()
        const token = data.authToken?.token || data.token

        if (!token) {
            throw new Error('Token not found in response')
        }

        return token
    }, [apiKey, apiBaseUrl])

    // Acquire token using the configured method
    const acquireToken = useCallback(async (): Promise<void> => {
        if (isRefreshingRef.current) {
            return // Already refreshing
        }

        isRefreshingRef.current = true
        setIsLoading(true)
        setError(null)

        try {
            let token: string

            if (tokenEndpoint) {
                // Option A: Backend endpoint pattern
                token = await fetchTokenFromEndpoint()
            } else if (apiKey) {
                // Option B: Direct API key pattern
                token = await exchangeApiKeyForToken()
            } else {
                throw new Error('Either tokenEndpoint or apiKey must be provided')
            }

            // Validate token by getting user info
            const userResponse = await fetch(`${apiBaseUrl}/user/me`, {
                headers: {
                    'Girder-Token': token,
                },
            })

            if (!userResponse.ok) {
                throw new Error('Token validation failed')
            }

            const userData = await userResponse.json()
            const userInfo: DsaUserInfo = {
                id: userData._id || userData.id || '',
                name: userData.login || userData.name || userData.email || 'User',
                email: userData.email,
                login: userData.login,
            }

            // Store token and user info in auth store
            dsaAuthStore.setToken(token, userInfo, 30)

            // Notify callback
            onTokenChange?.(token)

            setError(null)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error.message)
            onAuthError?.(error)

            // Clear token on error
            onTokenChange?.(null)
        } finally {
            setIsLoading(false)
            isRefreshingRef.current = false
        }
    }, [tokenEndpoint, apiKey, apiBaseUrl, fetchTokenFromEndpoint, exchangeApiKeyForToken, onTokenChange, onAuthError])

    // Initial token acquisition
    useEffect(() => {
        // Only acquire if we have a method configured
        if (tokenEndpoint || apiKey) {
            acquireToken()
        } else {
            setIsLoading(false)
        }
    }, [tokenEndpoint, apiKey, acquireToken])

    // Auto-refresh token before expiry
    useEffect(() => {
        if (!autoRefresh || !authStatus.isAuthenticated || !authStatus.tokenExpiry) {
            return
        }

        const scheduleRefresh = () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current)
            }

            const now = Date.now()
            const expiryTime = authStatus.tokenExpiry!.getTime()
            const timeUntilExpiry = expiryTime - now
            const refreshTime = Math.max(0, timeUntilExpiry - refreshThreshold)

            refreshTimerRef.current = setTimeout(() => {
                acquireToken().catch((err) => {
                    if (onApiError) {
                        onApiError(err instanceof Error ? err : new Error(String(err)), () => acquireToken())
                    }
                })
            }, refreshTime)
        }

        scheduleRefresh()

        return () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current)
            }
        }
    }, [autoRefresh, authStatus.isAuthenticated, authStatus.tokenExpiry, refreshThreshold, acquireToken, onApiError])

    const refreshToken = useCallback(async () => {
        await acquireToken()
    }, [acquireToken])

    const getAuthHeaders = useCallback((): Record<string, string> => {
        return dsaAuthStore.getAuthHeaders()
    }, [])

    const contextValue: DsaAuthContextValue = {
        authStatus,
        token: authStatus.isAuthenticated ? dsaAuthStore.getToken() : null,
        isLoading,
        error,
        user: authStatus.user,
        isAuthenticated: authStatus.isAuthenticated,
        refreshToken,
        getAuthHeaders,
    }

    return <DsaAuthContext.Provider value={contextValue}>{children}</DsaAuthContext.Provider>
}

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
export function useDsaAuth(): DsaAuthContextValue {
    const context = useContext(DsaAuthContext)
    if (!context) {
        throw new Error('useDsaAuth must be used within a DsaAuthProvider')
    }
    return context
}

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
export function useDsaToken(): string | null {
    const { token } = useDsaAuth()
    return token
}
