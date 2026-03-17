/**
 * Types for DSA Authentication
 */

/**
 * Configuration for DSA authentication and API access.
 * Used to configure the DSA server URL and optional resource restrictions.
 */
export interface DsaAuthConfig {
  /** Base URL of the DSA server (e.g., 'http://bdsa.pathology.emory.edu:8080') */
  baseUrl: string
}

/**
 * User information returned from DSA authentication.
 */
export interface DsaUserInfo {
  /** Unique user identifier */
  id: string
  /** User's display name */
  name: string
  /** User's email address (optional) */
  email?: string
  /** User's login username (optional) */
  login?: string
}

/**
 * Current authentication status for DSA.
 * Provides information about whether the user is authenticated, configured, and has a valid token.
 */
export interface DsaAuthStatus {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean
  /** Whether DSA server configuration has been set */
  isConfigured: boolean
  /** Whether a valid authentication token exists */
  user: DsaUserInfo | null
  /** URL of the configured DSA server */
  serverUrl: string
}

export type DsaAuthListener = () => void

