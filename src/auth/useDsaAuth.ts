import { useState, useEffect } from 'react'
import { dsaAuthStore } from './DsaAuthStore'
import type { DsaAuthStatus, DsaAuthConfig } from './types'

export interface UseDsaAuthReturn {
  authStatus: DsaAuthStatus
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  updateConfig: (config: Partial<DsaAuthConfig>) => void
  getAuthHeaders: () => Record<string, string>
  getToken: () => string
}

export function useDsaAuth(): UseDsaAuthReturn {
  const [authStatus, setAuthStatus] = useState<DsaAuthStatus>(dsaAuthStore.getStatus())

  useEffect(() => {
    const unsubscribe = dsaAuthStore.subscribe(() => {
      setAuthStatus(dsaAuthStore.getStatus())
    })

    if (authStatus.isAuthenticated) {
      dsaAuthStore.validateToken()
    }

    return unsubscribe
  }, [])

  return {
    authStatus,
    login: (username, password) => dsaAuthStore.authenticate(username, password).then(() => {}),
    logout: () => dsaAuthStore.logout(),
    updateConfig: (config) => dsaAuthStore.updateConfig(config),
    getAuthHeaders: () => dsaAuthStore.getAuthHeaders(),
    getToken: () => dsaAuthStore.getToken(),
  }
}
