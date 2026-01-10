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
  /** Optional resource ID to restrict access to a specific folder or collection */
  resourceId?: string
  /** Type of resource if resourceId is provided */
  resourceType?: 'folder' | 'collection'
  /** Strategy for fetching paginated resources */
  fetchStrategy?: 'unlimited' | 'paginate'
  /** Page size for paginated fetching */
  pageSize?: number
  /** Target folder for metadata synchronization */
  metadataSyncTargetFolder?: string
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
  hasToken: boolean
  /** Whether configuration exists */
  hasConfig: boolean
  /** Current user information (null if not authenticated) */
  user: DsaUserInfo | null
  /** URL of the configured DSA server */
  serverUrl: string
  /** Optional resource ID restriction */
  resourceId?: string
  /** Type of resource restriction */
  resourceType?: 'folder' | 'collection'
  /** Timestamp of last successful login */
  lastLogin?: Date | null
  /** Timestamp when the current token expires */
  tokenExpiry?: Date | null
}

/**
 * Response from DSA authentication operations (login, token refresh, etc.)
 */
export interface DsaAuthResponse {
  /** Whether the authentication operation was successful */
  success: boolean
  /** Authentication token (if successful) */
  token?: string
  /** User information (if successful) */
  user?: DsaUserInfo
  /** Error message (if unsuccessful) */
  error?: string
  /** Additional message from the server */
  message?: string
}

/**
 * Listener function type for authentication state changes.
 * Called whenever authentication status changes (login, logout, token refresh, etc.)
 */
export type DsaAuthListener = () => void

