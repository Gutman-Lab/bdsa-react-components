import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DsaAuthManager } from './DsaAuthManager'
import { dsaAuthStore } from '../../auth/DsaAuthStore'

// Mock fetch for authentication tests
global.fetch = vi.fn()

describe('DsaAuthManager', () => {
  beforeEach(() => {
    // Clear fetch mock first
    vi.clearAllMocks()
    
    // Mock fetch to return a successful promise for logout
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
    
    // Clear localStorage
    localStorage.clear()
    
    // Reset auth store
    dsaAuthStore.logout()
  })

  it('renders with default props', () => {
    render(<DsaAuthManager />)
    expect(screen.getByText('Not Configured')).toBeInTheDocument()
  })

  it('shows login button when not authenticated', () => {
    render(<DsaAuthManager />)
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('opens login modal when login button is clicked', () => {
    render(<DsaAuthManager allowServerConfig={true} />)
    const loginButton = screen.getByText('Login')
    fireEvent.click(loginButton)

    expect(screen.getByText('Login to DSA Server')).toBeInTheDocument()
    expect(screen.getByLabelText('DSA Server URL *')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('closes login modal when cancel is clicked', () => {
    render(<DsaAuthManager allowServerConfig={true} />)

    // Open modal
    const loginButton = screen.getByText('Login')
    fireEvent.click(loginButton)
    expect(screen.getByText('Login to DSA Server')).toBeInTheDocument()

    // Close modal
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    // Modal should be closed (no heading visible)
    expect(screen.queryByText('Login to DSA Server')).not.toBeInTheDocument()
  })

  it('disables login button when allowServerConfig is false and not configured', () => {
    render(<DsaAuthManager allowServerConfig={false} />)
    const loginButton = screen.getByText('Login')
    expect(loginButton).toBeDisabled()
  })

  it('renders compact version', () => {
    render(<DsaAuthManager compact={true} />)
    const container = screen.getByText('Login').closest('.dsa-auth-manager')
    expect(container).toHaveClass('compact')
  })

  it('shows configured status when server URL is set', () => {
    // Configure server
    dsaAuthStore.updateConfig({ baseUrl: 'http://test.example.com' })

    render(<DsaAuthManager />)
    expect(screen.getByText('Not Connected')).toBeInTheDocument()
  })

  it('calls onAuthChange callback when provided', async () => {
    const onAuthChange = vi.fn()

    // Mock successful authentication
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authToken: { token: 'test-token' },
        user: { _id: '123', login: 'testuser' },
      }),
    })

    dsaAuthStore.updateConfig({ baseUrl: 'http://test.example.com' })

    render(<DsaAuthManager onAuthChange={onAuthChange} allowServerConfig={true} />)

    // Open login modal
    const loginButton = screen.getByText('Login')
    fireEvent.click(loginButton)

    // Fill in form
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    // Submit form
    const submitButton = screen.getByText('Login', { selector: 'button[type="submit"]' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAuthChange).toHaveBeenCalledWith(true)
    })
  })

  it('hides server URL field when allowServerConfig is false', () => {
    dsaAuthStore.updateConfig({ baseUrl: 'http://test.example.com' })

    render(<DsaAuthManager allowServerConfig={false} />)

    // Open login modal
    const loginButton = screen.getByText('Login')
    fireEvent.click(loginButton)

    // Server URL input should not be present
    expect(screen.queryByLabelText('DSA Server URL *')).not.toBeInTheDocument()

    // But should show the configured server
    expect(screen.getByText('http://test.example.com')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<DsaAuthManager className="custom-class" />)
    expect(container.querySelector('.dsa-auth-manager')).toHaveClass('custom-class')
  })
})

