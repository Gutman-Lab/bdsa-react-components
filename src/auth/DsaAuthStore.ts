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
      return stored ? JSON.parse(stored) : { baseUrl: '' }
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
      const errorData = await response.json().catch(() => ({}))
      throw new Error((errorData as any).message || `Authentication failed: ${response.status}`)
    }

    const authData = await response.json()
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
      this.logout()
      return false
    }
  }

  // Configuration
  updateConfig(newConfig: Partial<DsaAuthConfig>): void {
    if (newConfig.baseUrl) {
      newConfig.baseUrl = newConfig.baseUrl.replace(/\/+$/, '')
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
