/**
 * DSA Authentication Store
 * Manages DSA server authentication and configuration with localStorage persistence
 */

import type { DsaAuthConfig, DsaUserInfo, DsaAuthStatus, DsaAuthListener } from './types'

const STORAGE_KEYS = {
  DSA_CONFIG: 'bdsa_dsa_config',
  GIRDER_TOKEN: 'bdsa_girder_token',
  USER_INFO: 'bdsa_user_info',
}

/** Girder origin only — `DsaAuthStore` builds `${baseUrl}/api/v1/…`. */
function normalizeGirderBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/api\/v1$/i, '')
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) {
    return {}
  }
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<')) {
    throw new Error(
      'Server returned HTML instead of JSON. Use the Girder origin only (e.g. http://host:8080 or /dsa in dev — not …/api/v1).',
    )
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Invalid JSON from DSA server — check the configured base URL and proxy.')
  }
}

class DsaAuthStore {
  private listeners: Set<DsaAuthListener> = new Set()
  private config: DsaAuthConfig
  private token: string
  private userInfo: DsaUserInfo | null
  private isAuthenticated: boolean

  constructor() {
    this.config = this.loadConfig()
    this.token = this.loadToken()
    this.userInfo = this.loadUserInfo()
    this.isAuthenticated = !!(this.token && this.config.baseUrl)
  }

  // Event system for UI updates
  subscribe(listener: DsaAuthListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach(listener => listener())
  }

  // Local Storage Management
  private loadConfig(): DsaAuthConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DSA_CONFIG)
      if (!stored) {
        return { baseUrl: '' }
      }
      const parsed = JSON.parse(stored) as DsaAuthConfig
      if (parsed.baseUrl) {
        parsed.baseUrl = normalizeGirderBaseUrl(parsed.baseUrl)
      }
      return parsed
    } catch (error) {
      console.error('Error loading DSA config:', error)
      return { baseUrl: '' }
    }
  }

  private loadToken(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.GIRDER_TOKEN) || ''
    } catch (error) {
      console.error('Error loading Girder token:', error)
      return ''
    }
  }

  private loadUserInfo(): DsaUserInfo | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_INFO)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('Error loading user info:', error)
      return null
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DSA_CONFIG, JSON.stringify(this.config))
    } catch (error) {
      console.error('Error saving DSA config:', error)
    }
  }

  private saveToken(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GIRDER_TOKEN, this.token)
    } catch (error) {
      console.error('Error saving Girder token:', error)
    }
  }

  private saveUserInfo(): void {
    try {
      if (this.userInfo) {
        localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(this.userInfo))
      }
    } catch (error) {
      console.error('Error saving user info:', error)
    }
  }

  // Authentication
  async authenticate(username: string, password: string): Promise<void> {
    if (!this.config.baseUrl) {
      throw new Error('DSA server URL not configured')
    }

    const credentials = btoa(`${username}:${password}`)
    const response = await fetch(`${this.config.baseUrl}/api/v1/user/authentication`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let message = `Authentication failed: ${response.status}`
      try {
        const errorData = (await readJsonResponse(response)) as { message?: string }
        if (errorData.message) {
          message = errorData.message
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('HTML instead of JSON')) {
          throw err
        }
      }
      throw new Error(message)
    }

    const authData = (await readJsonResponse(response)) as {
      authToken?: { token?: string }
      user?: Record<string, string | undefined>
    }
    const girderToken = authData?.authToken?.token
    const userData = authData?.user

    if (!girderToken) {
      throw new Error('No authentication token received from server')
    }

    this.token = girderToken
    this.userInfo = {
      id: userData?._id || userData?.id || '',
      name: userData?.login || userData?.firstName || userData?.email || 'User',
      email: userData?.email,
      login: userData?.login,
    }
    this.isAuthenticated = true

    this.saveToken()
    this.saveUserInfo()
    this.notify()
  }

  logout(): void {
    // Async server logout without blocking
    if (this.token && this.config.baseUrl) {
      fetch(`${this.config.baseUrl}/api/v1/user/authentication`, {
        method: 'DELETE',
        headers: { 'Girder-Token': this.token },
      }).catch(error => {
        console.warn('Server logout failed:', error)
      })
    }

    this.token = ''
    this.userInfo = null
    this.isAuthenticated = false

    localStorage.removeItem(STORAGE_KEYS.GIRDER_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER_INFO)

    this.notify()
  }

  async validateToken(): Promise<boolean> {
    if (!this.token || !this.config.baseUrl) {
      return false
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/user/me`, {
        headers: { 'Girder-Token': this.token },
      })

      if (response.ok) {
        return true
      } else {
        this.logout()
        return false
      }
    } catch (error) {
      console.error('Token validation error:', error)
      // Network error - can't verify, but don't destroy the session
      return false
    }
  }

  // Configuration
  updateConfig(newConfig: Partial<DsaAuthConfig>): void {
    if (newConfig.baseUrl) {
      newConfig.baseUrl = normalizeGirderBaseUrl(newConfig.baseUrl)
    }
    this.config = { ...this.config, ...newConfig }
    this.saveConfig()
    this.notify()
  }

  // Utilities
  getAuthHeaders(): Record<string, string> {
    if (!this.isAuthenticated) {
      return {}
    }
    return {
      'Girder-Token': this.token,
      'Content-Type': 'application/json',
    }
  }

  isConfigured(): boolean {
    return !!this.config.baseUrl
  }

  getStatus(): DsaAuthStatus {
    return {
      isAuthenticated: this.isAuthenticated,
      isConfigured: this.isConfigured(),
      user: this.userInfo,
      serverUrl: this.config.baseUrl,
    }
  }

  getToken(): string {
    return this.token
  }

}

// Singleton instance
export const dsaAuthStore = new DsaAuthStore()

export default dsaAuthStore
