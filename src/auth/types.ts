/**
 * Types for DSA Authentication
 */

export interface DsaAuthConfig {
  baseUrl: string
  resourceId?: string
  resourceType?: 'folder' | 'collection'
  fetchStrategy?: 'unlimited' | 'paginate'
  pageSize?: number
  metadataSyncTargetFolder?: string
}

export interface DsaUserInfo {
  id: string
  name: string
  email?: string
  login?: string
}

export interface DsaAuthStatus {
  isAuthenticated: boolean
  isConfigured: boolean
  hasToken: boolean
  hasConfig: boolean
  user: DsaUserInfo | null
  serverUrl: string
  resourceId?: string
  resourceType?: 'folder' | 'collection'
  lastLogin?: Date | null
  tokenExpiry?: Date | null
}

export interface DsaAuthResponse {
  success: boolean
  token?: string
  user?: DsaUserInfo
  error?: string
  message?: string
}

export type DsaAuthListener = () => void

