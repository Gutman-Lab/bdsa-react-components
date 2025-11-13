/**
 * DSA Authentication Manager Component
 * Provides a UI for logging in/out of DSA servers
 */

import React, { useState } from 'react'
import { useDsaAuth } from '../../auth/useDsaAuth'
import './DsaAuthManager.css'

export interface DsaAuthManagerProps {
  /**
   * Callback when authentication status changes
   */
  onAuthChange?: (isAuthenticated: boolean) => void
  /**
   * Show server URL configuration in login modal
   */
  allowServerConfig?: boolean
  /**
   * Custom class name for the container
   */
  className?: string
  /**
   * Show compact version (minimal UI)
   */
  compact?: boolean
}

export const DsaAuthManager: React.FC<DsaAuthManagerProps> = ({
  onAuthChange,
  allowServerConfig = true,
  className = '',
  compact = false,
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

  const handleLogout = () => {
    logout()
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

  if (compact) {
    return (
      <div className={`dsa-auth-manager compact ${className}`}>
        <div className="dsa-status-compact">
          <span className={`status-indicator ${status.className}`}>{status.icon}</span>
          {authStatus.isAuthenticated && authStatus.user && (
            <span className="user-name">{authStatus.user.name}</span>
          )}
        </div>
        <button
          className={authStatus.isAuthenticated ? 'logout-button' : 'login-button'}
          onClick={authStatus.isAuthenticated ? handleLogout : handleOpenLoginModal}
          disabled={!authStatus.isConfigured && !allowServerConfig}
        >
          {authStatus.isAuthenticated ? 'Logout' : 'Login'}
        </button>

        {showLoginModal && (
          <LoginModal
            show={showLoginModal}
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
        <span className={`status-indicator ${status.className}`}>{status.icon}</span>
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
          <button className="logout-button" onClick={handleLogout} title="Logout from DSA server">
            Logout
          </button>
        ) : (
          <button
            className="login-button"
            onClick={handleOpenLoginModal}
            disabled={!authStatus.isConfigured && !allowServerConfig}
            title={!authStatus.isConfigured && !allowServerConfig ? 'Configure DSA server first' : 'Login to DSA server'}
          >
            Login
          </button>
        )}
      </div>

      {showLoginModal && (
        <LoginModal
          show={showLoginModal}
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
  show: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  loginForm: { username: string; password: string; serverUrl: string }
  setLoginForm: React.Dispatch<React.SetStateAction<{ username: string; password: string; serverUrl: string }>>
  authStatus: any
  isLoading: boolean
  error: string
  allowServerConfig: boolean
}

const LoginModal: React.FC<LoginModalProps> = ({
  show,
  onClose,
  onSubmit,
  loginForm,
  setLoginForm,
  authStatus,
  isLoading,
  error,
  allowServerConfig,
}) => {
  if (!show) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content login-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Login to DSA Server</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          {allowServerConfig && (
            <div className="form-group">
              <label htmlFor="serverUrl">DSA Server URL *</label>
              <input
                type="url"
                id="serverUrl"
                value={loginForm.serverUrl}
                onChange={e => setLoginForm(prev => ({ ...prev, serverUrl: e.target.value }))}
                placeholder="http://bdsa.pathology.emory.edu:8080"
                required
              />
              <div className="field-help">
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
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="login-submit-button" disabled={isLoading || !loginForm.username || !loginForm.password}>
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DsaAuthManager

