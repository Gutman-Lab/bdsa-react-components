import { useMemo } from 'react'
import { useDsaAuth } from './useDsaAuth'

/** Normalize HeadersInit to a plain record for merging. */
export function headersInitToRecord(h: HeadersInit): Record<string, string> {
    if (h instanceof Headers) {
        const o: Record<string, string> = {}
        h.forEach((v, k) => {
            o[k] = v
        })
        return o
    }
    if (Array.isArray(h)) {
        return Object.fromEntries(h.map(([k, v]) => [k, String(v)]))
    }
    return { ...(h as Record<string, string>) }
}

/** Merge Girder store headers with optional overrides (override wins on key clash). */
export function mergeHeadersInit(
    base: Record<string, string>,
    override?: HeadersInit
): Record<string, string> {
    if (override === undefined) {
        return { ...base }
    }
    return { ...base, ...headersInitToRecord(override) }
}

export interface UseDsaResolvedApiOptions {
    /**
     * DSA REST root including `/api/v1`.
     * When omitted, uses `dsaAuthStore` server URL + `/api/v1` (same source as FolderBrowser).
     */
    apiBaseUrl?: string
    /** Merged on top of `dsaAuthStore.getAuthHeaders()` when authenticated. */
    apiHeaders?: HeadersInit
    /** When omitted, uses the Girder token from the store when logged in. */
    authToken?: string
}

/**
 * Resolves API base URL and auth headers from {@link dsaAuthStore}, with optional prop overrides.
 * Subscribe via {@link useDsaAuth} so login/logout and server URL changes re-render consumers.
 */
export function useDsaResolvedApi(options: UseDsaResolvedApiOptions): {
    apiBaseUrl: string
    apiHeaders: HeadersInit | undefined
    authToken: string | undefined
} {
    const { authStatus, getAuthHeaders, getToken } = useDsaAuth()

    const apiBaseUrl = useMemo(() => {
        if (options.apiBaseUrl !== undefined) {
            return options.apiBaseUrl
        }
        const u = authStatus.serverUrl?.replace(/\/+$/, '') ?? ''
        return u ? `${u}/api/v1` : ''
    }, [options.apiBaseUrl, authStatus.serverUrl])

    const apiHeaders = useMemo(() => {
        const store = getAuthHeaders()
        const merged = mergeHeadersInit(store, options.apiHeaders)
        return Object.keys(merged).length > 0 ? merged : undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getAuthHeaders reads live store; authStatus drives invalidation
    }, [authStatus.isAuthenticated, authStatus.isConfigured, authStatus.serverUrl, options.apiHeaders])

    const authToken = useMemo(() => {
        if (options.authToken !== undefined) {
            return options.authToken || undefined
        }
        return authStatus.isAuthenticated ? getToken() || undefined : undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getToken reads live store
    }, [options.authToken, authStatus.isAuthenticated])

    return { apiBaseUrl, apiHeaders, authToken }
}
