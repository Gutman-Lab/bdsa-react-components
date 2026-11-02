/**
 * DSA Authentication Manager Component
 * 
 * Provides a complete authentication UI for DSA (Digital Slide Archive) servers.
 * This component handles login/logout, session management, and authentication state.
 * 
 * Features:
 * - Login/logout UI with status indicators
 * - Persistent sessions using localStorage
 * - Token management with automatic validation
 * - Server URL configuration (optional)
 * - Compact mode for toolbars and headers
 * 
 * @example Basic usage
 * ```tsx
 * import { DsaAuthManager } from 'bdsa-react-components'
 * 
 * function App() {
 *   return (
 *     <div>
 *       <h1>My BDSA Application</h1>
 *       <DsaAuthManager />
 *     </div>
 *   )
 * }
 * ```
 * 
 * @example With authentication callback
 * ```tsx
 * import { DsaAuthManager } from 'bdsa-react-components'
 * import { useState } from 'react'
 * 
 * function App() {
 *   const [isAuthenticated, setIsAuthenticated] = useState(false)
 * 
 *   return (
 *     <div>
 *       <DsaAuthManager onAuthChange={setIsAuthenticated} />
 *       {isAuthenticated ? (
 *         <div>Welcome! You can now access DSA resources.</div>
 *       ) : (
 *         <div>Please login to access DSA resources.</div>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 * 
 * @example Compact mode for toolbars
 * ```tsx
 * function Toolbar() {
 *   return (
 *     <div className="toolbar">
 *       <button>Load</button>
 *       <button>Save</button>
 *       <DsaAuthManager compact={true} />
 *     </div>
 *   )
 * }
 * ```
 */

import React, { useState } from 'react'
import { useDsaAuth } from '../../auth/useDsaAuth'
import type { DsaAuthStatus } from '../../auth/types'
import './DsaAuthManager.css'

export interface DsaAuthManagerProps {
  /**
   * Callback function that fires whenever the authentication status changes.
   * 
   * @param isAuthenticated - `true` if user is logged in, `false` otherwise
   * 
   * @example
   * ```tsx
   * <DsaAuthManager 
   *   onAuthChange={(isAuthenticated) => {
   *     console.log('Auth status:', isAuthenticated)
   *     // Update your app state, redirect, etc.
   *   }}
   * />
   * ```
   */
  onAuthChange?: (isAuthenticated: boolean) => void
  /**
   * Whether to show server URL configuration in the login modal.
   * 
   * - `true` (default): Users can enter/change the DSA server URL
   * - `false`: Server URL is locked (must be configured programmatically via `dsaAuthStore`)
   * 
   * @default true
   * 
   * @example
   * ```tsx
   * // Allow users to configure server
   * <DsaAuthManager allowServerConfig={true} />
   * 
   * // Lock server URL (pre-configured)
   * <DsaAuthManager allowServerConfig={false} />
   * ```
   */
  allowServerConfig?: boolean
  /**
   * Custom CSS class name to apply to the component container.
   * Useful for styling integration with your application.
   * 
   * @example
   * ```tsx
   * <DsaAuthManager className="my-custom-auth-manager" />
   * ```
   */
  className?: string
  /**
   * Show compact version of the component (minimal UI).
   * Ideal for toolbars, headers, or space-constrained layouts.
   * 
   * Compact mode shows:
   * - Status indicator icon
   * - User name (if authenticated)
   * - Login/Logout button
   * 
   * @default false
   * 
   * @example
   * ```tsx
   * <DsaAuthManager compact={true} />
   * ```
   */
  compact?: boolean
  /**
   * When set, the Login control is a link to this URL (e.g. Girder web UI with `?dialog=login`)
   * instead of opening the in-app modal. Logout behavior is unchanged.
   */
  externalLoginUrl?: string
  /**
   * Show a companion control that opens the username/password REST login modal (next to `externalLoginUrl`).
   * Requires a configured `serverUrl` (for example via env or calling `dsaAuthStore.updateConfig`).
   */
  embeddedApiLogin?: boolean
}

export const DsaAuthManager: React.FC<DsaAuthManagerProps> = ({
  onAuthChange,
  allowServerConfig = true,
  className = '',
  compact = false,
  externalLoginUrl,
  embeddedApiLogin = false,
}) => {
  const { authStatus, login, logout, updateConfig } = useDsaAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: '', password: '', serverUrl: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Notify parent of auth changes
  React.useEffect(() => {
    if (onAuthChange) {
      onAuthChange(authStatus.isAuthenticated)
    }
  }, [authStatus.isAuthenticated, onAuthChange])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Update server URL if changed
      if (allowServerConfig && loginForm.serverUrl && loginForm.serverUrl !== authStatus.serverUrl) {
        updateConfig({ baseUrl: loginForm.serverUrl })
      }

      await login(loginForm.username, loginForm.password)
      setShowLoginModal(false)
      setLoginForm({ username: '', password: '', serverUrl: '' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenLoginModal = () => {
    setLoginForm(prev => ({
      ...prev,
      serverUrl: authStatus.serverUrl || '',
    }))
    setShowLoginModal(true)
  }

  const getStatusDisplay = () => {
    if (!authStatus.isConfigured) {
      return { text: 'Not Configured', className: 'status-not-configured', icon: '⚙️' }
    }
    if (!authStatus.isAuthenticated) {
      return { text: 'Not Connected', className: 'status-not-connected', icon: '🔌' }
    }
    return { text: 'Connected', className: 'status-connected', icon: '✅' }
  }

  const status = getStatusDisplay()
  const loginDisabled = !externalLoginUrl && !authStatus.isConfigured && !allowServerConfig

  const loginCompact =
    externalLoginUrl && !authStatus.isAuthenticated ? (
      <div className="dsa-external-login-group">
        <a
          href={externalLoginUrl}
          className="login-button"
          target="_blank"
          rel="noopener noreferrer"
          title="Open Girder sign-in in a new tab"
        >
          Login
        </a>
        {embeddedApiLogin && (
          <button
            type="button"
            className="dsa-api-login-button"
            onClick={handleOpenLoginModal}
            title="DSA REST authentication (stores a token for this portal)"
            aria-haspopup="dialog"
            aria-expanded={showLoginModal}
          >
            API
          </button>
        )}
      </div>
    ) : (
      <button
        type="button"
        className={authStatus.isAuthenticated ? 'logout-button' : 'login-button'}
        onClick={authStatus.isAuthenticated ? logout : handleOpenLoginModal}
        disabled={loginDisabled}
        aria-haspopup={authStatus.isAuthenticated ? undefined : 'dialog'}
        aria-expanded={authStatus.isAuthenticated ? undefined : showLoginModal}
      >
        {authStatus.isAuthenticated ? 'Logout' : 'Login'}
      </button>
    )

  if (compact) {
    return (
      <div className={`dsa-auth-manager compact ${className}`}>
        <div className="dsa-status-compact">
          <span className={`status-indicator ${status.className}`} aria-hidden="true">{status.icon}</span>
          <span className="dsa-sr-only">{status.text}</span>
          {authStatus.isAuthenticated && authStatus.user && (
            <span className="user-name">{authStatus.user.name}</span>
          )}
        </div>
        {loginCompact}

        {showLoginModal && (
          <LoginModal
            onClose={() => setShowLoginModal(false)}
            onSubmit={handleLogin}
            loginForm={loginForm}
            setLoginForm={setLoginForm}
            authStatus={authStatus}
            isLoading={isLoading}
            error={error}
            allowServerConfig={allowServerConfig}
          />
        )}
      </div>
    )
  }

  return (
    <div className={`dsa-auth-manager ${className}`}>
      <div className="dsa-status">
        <span className={`status-indicator ${status.className}`} aria-hidden="true">{status.icon}</span>
        <div className="status-info">
          <div className="status-text">{status.text}</div>
          {authStatus.isAuthenticated && authStatus.user && (
            <div className="user-info">
              {authStatus.user.name}
              {authStatus.serverUrl && (
                <div className="server-url">{new URL(authStatus.serverUrl).hostname}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="dsa-actions">
        {authStatus.isAuthenticated ? (
          <button type="button" className="logout-button" onClick={logout} title="Logout from DSA server">
            Logout
          </button>
        ) : externalLoginUrl ? (
          <div className="dsa-external-login-group">
            <a
              href={externalLoginUrl}
              className="login-button"
              target="_blank"
              rel="noopener noreferrer"
              title="Open Girder sign-in in a new tab"
            >
              Login
            </a>
            {embeddedApiLogin && (
              <button
                type="button"
                className="dsa-api-login-button"
                onClick={handleOpenLoginModal}
                title="DSA REST authentication (stores a token for this portal)"
                aria-haspopup="dialog"
                aria-expanded={showLoginModal}
              >
                API
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="login-button"
            onClick={handleOpenLoginModal}
            disabled={loginDisabled}
            title={loginDisabled ? 'Configure DSA server first' : 'Login to DSA server'}
            aria-haspopup="dialog"
            aria-expanded={showLoginModal}
          >
            Login
          </button>
        )}
      </div>

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSubmit={handleLogin}
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          authStatus={authStatus}
          isLoading={isLoading}
          error={error}
          allowServerConfig={allowServerConfig}
        />
      )}
    </div>
  )
}

interface LoginModalProps {
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  loginForm: { username: string; password: string; serverUrl: string }
  setLoginForm: React.Dispatch<React.SetStateAction<{ username: string; password: string; serverUrl: string }>>
  authStatus: DsaAuthStatus
  isLoading: boolean
  error: string
  allowServerConfig: boolean
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const LoginModal: React.FC<LoginModalProps> = ({
  onClose,
  onSubmit,
  loginForm,
  setLoginForm,
  authStatus,
  isLoading,
  error,
  allowServerConfig,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
  )

  const headingId = 'dsa-login-modal-title'
  const errorId = 'dsa-login-error'
  const serverHelpId = 'dsa-login-server-help'

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }

    const previouslyFocused = previouslyFocusedRef.current

    const initialFocus =
      dialog.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    initialFocus?.focus()

    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const dialog = dialogRef.current
    if (!dialog) {
      return
    }

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-content login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2 id={headingId}>Login to DSA Server</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close login dialog">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="login-form"
          aria-describedby={error ? errorId : undefined}
        >
          {allowServerConfig && (
            <div className="form-group">
              <label htmlFor="serverUrl">DSA Server URL *</label>
              <input
                type="url"
                id="serverUrl"
                value={loginForm.serverUrl}
                onChange={e => setLoginForm(prev => ({ ...prev, serverUrl: e.target.value }))}
                placeholder="http://bdsa.pathology.emory.edu:8080"
                aria-describedby={serverHelpId}
                required
              />
              <div className="field-help" id={serverHelpId}>
                The base URL of your Digital Slide Archive server
                <br />
                <small>💡 Don't include /api/v1 - it will be added automatically</small>
              </div>
            </div>
          )}

          {!allowServerConfig && authStatus.serverUrl && (
            <div className="form-group">
              <label>Server</label>
              <div className="server-display">{authStatus.serverUrl}</div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={loginForm.username}
              onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
              placeholder="Enter your DSA username"
              aria-describedby={error ? errorId : undefined}
              data-autofocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={loginForm.password}
              onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Enter your password"
              aria-describedby={error ? errorId : undefined}
              required
            />
          </div>

          {error && (
            <div id={errorId} className="error-message" role="alert">
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button
              type="submit"
              className="login-submit-button"
              disabled={isLoading || !loginForm.username || !loginForm.password}
              aria-busy={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
            <span className="dsa-sr-only" role="status" aria-live="polite">
              {isLoading ? 'Logging in' : ''}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DsaAuthManager

