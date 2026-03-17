/**
 * React hook for DSA authentication
 * Provides easy access to DSA auth state and methods
 */

import { useState, useEffect } from 'react'
import { dsaAuthStore } from './DsaAuthStore'
import type { DsaAuthStatus, DsaAuthConfig } from './types'

export interface UseDsaAuthReturn {
  authStatus: DsaAuthStatus
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  updateConfig: (config: Partial<DsaAuthConfig>) => void
  validateToken: () => Promise<boolean>
  testConnection: () => Promise<{ success: boolean; version?: any; message: string }>
  getAuthHeaders: () => Record<string, string>
  getApiUrl: (endpoint: string) => string
  getToken: () => string
  getConfig: () => DsaAuthConfig
}

export function useDsaAuth(): UseDsaAuthReturn {
  const [authStatus, setAuthStatus] = useState<DsaAuthStatus>(dsaAuthStore.getStatus())

  useEffect(() => {
    // Subscribe to auth store changes
    const unsubscribe = dsaAuthStore.subscribe(() => {
      setAuthStatus(dsaAuthStore.getStatus())
    })

    // Validate token on mount
    if (authStatus.isAuthenticated) {
      dsaAuthStore.validateToken()
    }

    return unsubscribe
  }, [])

  const login = async (username: string, password: string): Promise<void> => {
    await dsaAuthStore.authenticate(username, password)
  }

  const logout = (): void => {
    dsaAuthStore.logout()
  }

  const updateConfig = (config: Partial<DsaAuthConfig>): void => {
    dsaAuthStore.updateConfig(config)
  }

  const validateToken = async (): Promise<boolean> => {
    return await dsaAuthStore.validateToken()
  }

  const testConnection = async () => {
    return await dsaAuthStore.testConnection()
  }

  const getAuthHeaders = (): Record<string, string> => {
    return dsaAuthStore.getAuthHeaders()
  }

  const getApiUrl = (endpoint: string): string => {
    return dsaAuthStore.getApiUrl(endpoint)
  }

  const getToken = (): string => {
    return dsaAuthStore.getToken()
  }

  const getConfig = (): DsaAuthConfig => {
    return dsaAuthStore.getConfig()
  }

  return {
    authStatus,
    login,
    logout,
    updateConfig,
    validateToken,
    testConnection,
    getAuthHeaders,
    getApiUrl,
    getToken,
    getConfig,
  }
}

