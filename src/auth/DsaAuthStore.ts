/**
 * DSA Authentication Store
 * Manages DSA server authentication and configuration with localStorage persistence
 */

import type { DsaAuthConfig, DsaUserInfo, DsaAuthStatus, DsaAuthListener } from './types'

const STORAGE_KEYS = {
  DSA_CONFIG: 'bdsa_dsa_config',
  GIRDER_TOKEN: 'bdsa_girder_token',
  USER_INFO: 'bdsa_user_info',
  LAST_LOGIN: 'bdsa_last_login',
  TOKEN_EXPIRY: 'bdsa_token_expiry',
}

class DsaAuthStore {
  private listeners: Set<DsaAuthListener> = new Set()
  private config: DsaAuthConfig
  private token: string
  private userInfo: DsaUserInfo | null
  private lastLogin: Date | null
  private tokenExpiry: Date | null
  private isAuthenticated: boolean

  constructor() {
    this.config = this.loadConfig()
    this.token = this.loadToken()
    this.userInfo = this.loadUserInfo()
    this.lastLogin = this.loadLastLogin()
    this.tokenExpiry = this.loadTokenExpiry()
    this.isAuthenticated = this.validateAuthentication()
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
      return stored
        ? JSON.parse(stored)
        : {
            baseUrl: '',
            resourceId: '',
            resourceType: 'folder' as const,
            fetchStrategy: 'unlimited' as const,
            pageSize: 100,
            metadataSyncTargetFolder: '',
          }
    } catch (error) {
      console.error('Error loading DSA config:', error)
      return {
        baseUrl: '',
        resourceId: '',
        resourceType: 'folder' as const,
        fetchStrategy: 'unlimited' as const,
        pageSize: 100,
        metadataSyncTargetFolder: '',
      }
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

  private loadLastLogin(): Date | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LAST_LOGIN)
      return stored ? new Date(stored) : null
    } catch (error) {
      console.error('Error loading last login:', error)
      return null
    }
  }

  private loadTokenExpiry(): Date | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY)
      return stored ? new Date(stored) : null
    } catch (error) {
      console.error('Error loading token expiry:', error)
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

  private saveLastLogin(): void {
    try {
      if (this.lastLogin) {
        localStorage.setItem(STORAGE_KEYS.LAST_LOGIN, this.lastLogin.toISOString())
      }
    } catch (error) {
      console.error('Error saving last login:', error)
    }
  }

  private saveTokenExpiry(): void {
    try {
      if (this.tokenExpiry) {
        localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, this.tokenExpiry.toISOString())
      }
    } catch (error) {
      console.error('Error saving token expiry:', error)
    }
  }

  // Authentication Management
  private validateAuthentication(): boolean {
    if (!this.token || !this.config.baseUrl) {
      return false
    }

    // Check if token has expired
    if (this.tokenExpiry && new Date() > this.tokenExpiry) {
      console.log('Token has expired')
      this.logout()
      return false
    }

    return true
  }

  async authenticate(username: string, password: string): Promise<{ success: boolean; user?: DsaUserInfo; error?: string }> {
    try {
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
        const errorData = await response.json().catch(() => ({}))
        throw new Error((errorData as any).message || `Authentication failed: ${response.status}`)
      }

      const authData = await response.json()
      const girderToken = authData?.authToken?.token
      const userData = authData?.user

      if (!girderToken) {
        throw new Error('No authentication token received from server')
      }

      // Store authentication data
      this.token = girderToken
      this.userInfo = {
        id: userData?._id || userData?.id || '',
        name: userData?.login || userData?.firstName || userData?.email || 'User',
        email: userData?.email,
        login: userData?.login,
      }
      this.lastLogin = new Date()

      // Set token expiry (Girder tokens typically last 30 days)
      this.tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      this.isAuthenticated = true

      // Save to localStorage
      this.saveToken()
      this.saveUserInfo()
      this.saveLastLogin()
      this.saveTokenExpiry()

      this.notify()
      return { success: true, user: this.userInfo }
    } catch (error) {
      console.error('Authentication failed:', error)
      this.logout()
      throw error
    }
  }

  logout(): void {
    // Async server logout without blocking
    if (this.token && this.config.baseUrl) {
      fetch(`${this.config.baseUrl}/api/v1/user/authentication`, {
        method: 'DELETE',
        headers: {
          'Girder-Token': this.token,
        },
      }).catch(error => {
        console.warn('Server logout failed:', error)
      })
    }

    // Clear local state
    this.token = ''
    this.userInfo = null
    this.lastLogin = null
    this.tokenExpiry = null
    this.isAuthenticated = false

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.GIRDER_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER_INFO)
    localStorage.removeItem(STORAGE_KEYS.LAST_LOGIN)
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY)

    this.notify()
  }

  async validateToken(): Promise<boolean> {
    if (!this.token || !this.config.baseUrl) {
      return false
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/user/me`, {
        headers: {
          'Girder-Token': this.token,
        },
      })

      if (response.ok) {
        return true
      } else {
        console.log('Token validation failed, logging out')
        this.logout()
        return false
      }
    } catch (error) {
      console.error('Token validation error:', error)
      this.logout()
      return false
    }
  }

  // Configuration Management
  updateConfig(newConfig: Partial<DsaAuthConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.saveConfig()
    this.notify()
  }

  setServerUrl(baseUrl: string): void {
    this.config.baseUrl = baseUrl
    this.saveConfig()
    this.notify()
  }

  // Utility Methods
  getAuthHeaders(): Record<string, string> {
    if (!this.isAuthenticated) {
      return {}
    }
    return {
      'Girder-Token': this.token,
      'Content-Type': 'application/json',
    }
  }

  getApiUrl(endpoint: string): string {
    if (!this.config.baseUrl) {
      throw new Error('DSA server URL not configured')
    }
    return `${this.config.baseUrl}${endpoint}`
  }

  isConfigured(): boolean {
    return !!this.config.baseUrl
  }

  isDataReady(): boolean {
    return !!(this.config.baseUrl && this.config.resourceId && this.isAuthenticated)
  }

  getStatus(): DsaAuthStatus {
    return {
      isAuthenticated: this.isAuthenticated,
      isConfigured: this.isConfigured(),
      hasToken: !!this.token,
      hasConfig: !!this.config.baseUrl,
      user: this.userInfo,
      serverUrl: this.config.baseUrl,
      resourceId: this.config.resourceId,
      resourceType: this.config.resourceType,
      lastLogin: this.lastLogin,
      tokenExpiry: this.tokenExpiry,
    }
  }

  getConfig(): DsaAuthConfig {
    return { ...this.config }
  }

  getToken(): string {
    return this.token
  }

  // Test connection to DSA server
  async testConnection(): Promise<{ success: boolean; version?: any; message: string }> {
    if (!this.config.baseUrl) {
      throw new Error('DSA server URL not configured')
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/system/version`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const versionData = await response.json()
        return {
          success: true,
          version: versionData,
          message: 'Connection successful',
        }
      } else {
        throw new Error(`Server responded with status: ${response.status}`)
      }
    } catch (error) {
      throw new Error(`Connection failed: ${(error as Error).message}`)
    }
  }
}

// Create singleton instance
export const dsaAuthStore = new DsaAuthStore()

export default dsaAuthStore

