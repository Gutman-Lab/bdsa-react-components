import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DsaAuthProvider, useDsaAuth, useDsaToken } from './DsaAuthProvider'
import { dsaAuthStore } from './DsaAuthStore'

// Mock fetch
global.fetch = vi.fn()

// Test component that uses the hooks
function TestComponent() {
    const { token, isAuthenticated, isLoading, error, user } = useDsaAuth()
    const tokenFromHook = useDsaToken()

    return (
        <div>
            <div data-testid="token">{token || 'no-token'}</div>
            <div data-testid="token-from-hook">{tokenFromHook || 'no-token'}</div>
            <div data-testid="is-authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
            <div data-testid="is-loading">{isLoading ? 'yes' : 'no'}</div>
            <div data-testid="error">{error || 'no-error'}</div>
            <div data-testid="user">{user?.name || 'no-user'}</div>
        </div>
    )
}

describe('DsaAuthProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        dsaAuthStore.logout()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('Backend Endpoint Pattern (Option A)', () => {
        it('fetches token from backend endpoint', async () => {
            const mockToken = 'test-token-123'
            const mockUser = { _id: 'user-1', login: 'testuser', email: 'test@example.com' }

                // Mock backend endpoint response
                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ dsaToken: mockToken }),
                })

                // Mock user validation endpoint
                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockUser,
                })

            render(
                <DsaAuthProvider
                    apiBaseUrl="http://test.example.com/api/v1"
                    tokenEndpoint="/api/config"
                >
                    <TestComponent />
                </DsaAuthProvider>
            )

            // Should show loading initially
            expect(screen.getByTestId('is-loading')).toHaveTextContent('yes')

            // Wait for token to be fetched
            await waitFor(
                () => {
                    expect(screen.getByTestId('token')).toHaveTextContent(mockToken)
                },
                { timeout: 3000 }
            )

            expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes')
            expect(screen.getByTestId('is-loading')).toHaveTextContent('no')
            expect(screen.getByTestId('user')).toHaveTextContent('testuser')
        })

        it('handles backend endpoint errors', async () => {
            const onAuthError = vi.fn()

                // Mock backend endpoint error
                ; (global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

            render(
                <DsaAuthProvider
                    apiBaseUrl="http://test.example.com/api/v1"
                    tokenEndpoint="/api/config"
                    onAuthError={onAuthError}
                >
                    <TestComponent />
                </DsaAuthProvider>
            )

            await waitFor(
                () => {
                    expect(screen.getByTestId('is-loading')).toHaveTextContent('no')
                },
                { timeout: 3000 }
            )

            expect(onAuthError).toHaveBeenCalled()
            expect(screen.getByTestId('error')).not.toHaveTextContent('no-error')
            expect(screen.getByTestId('token')).toHaveTextContent('no-token')
        })

        it('calls onTokenChange when token is obtained', async () => {
            const onTokenChange = vi.fn()
            const mockToken = 'test-token-123'
            const mockUser = { _id: 'user-1', login: 'testuser' }

                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ dsaToken: mockToken }),
                })

                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockUser,
                })

            render(
                <DsaAuthProvider
                    apiBaseUrl="http://test.example.com/api/v1"
                    tokenEndpoint="/api/config"
                    onTokenChange={onTokenChange}
                >
                    <TestComponent />
                </DsaAuthProvider>
            )

            await waitFor(
                () => {
                    expect(onTokenChange).toHaveBeenCalledWith(mockToken)
                },
                { timeout: 3000 }
            )
        })
    })

    describe('Direct API Key Pattern (Option B)', () => {
        it('exchanges API key for token', async () => {
            const mockToken = 'test-token-456'
            const mockUser = { _id: 'user-2', login: 'apiuser' }

                // Mock API key exchange endpoint
                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ authToken: { token: mockToken } }),
                })

                // Mock user validation endpoint
                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockUser,
                })

            render(
                <DsaAuthProvider
                    apiBaseUrl="http://test.example.com/api/v1"
                    apiKey="test-api-key"
                >
                    <TestComponent />
                </DsaAuthProvider>
            )

            await waitFor(
                () => {
                    expect(screen.getByTestId('token')).toHaveTextContent(mockToken)
                },
                { timeout: 3000 }
            )

            expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes')
        })

        it('handles API key authentication errors', async () => {
            const onAuthError = vi.fn()

                // Mock API key exchange error
                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    json: async () => ({ message: 'Invalid API key' }),
                })

            render(
                <DsaAuthProvider
                    apiBaseUrl="http://test.example.com/api/v1"
                    apiKey="invalid-key"
                    onAuthError={onAuthError}
                >
                    <TestComponent />
                </DsaAuthProvider>
            )

            await waitFor(
                () => {
                    expect(screen.getByTestId('is-loading')).toHaveTextContent('no')
                },
                { timeout: 3000 }
            )

            expect(onAuthError).toHaveBeenCalled()
            expect(screen.getByTestId('error')).not.toHaveTextContent('no-error')
        })
    })

    describe('Hooks', () => {
        it('useDsaAuth throws error when used outside provider', () => {
            // Suppress console.error for this test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            expect(() => {
                render(<TestComponent />)
            }).toThrow('useDsaAuth must be used within a DsaAuthProvider')

            consoleSpy.mockRestore()
        })

        it('useDsaToken returns token from context', async () => {
            const mockToken = 'test-token-789'
            const mockUser = { _id: 'user-3', login: 'hookuser' }

                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ dsaToken: mockToken }),
                })

                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockUser,
                })

            render(
                <DsaAuthProvider
                    apiBaseUrl="http://test.example.com/api/v1"
                    tokenEndpoint="/api/config"
                >
                    <TestComponent />
                </DsaAuthProvider>
            )

            await waitFor(
                () => {
                    expect(screen.getByTestId('token-from-hook')).toHaveTextContent(mockToken)
                },
                { timeout: 3000 }
            )
        })
    })

    describe('Error Handling', () => {
        it('calls onApiError for API errors with retry', async () => {
            const onApiError = vi.fn()
            const mockToken = 'retry-token'
            const mockUser = { _id: 'user-4', login: 'retryuser' }

                // First call fails
                ; (global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

                // Retry succeeds
                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ dsaToken: mockToken }),
                })

                ; (global.fetch as any).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockUser,
                })

            render(
                <DsaAuthProvider
                    apiBaseUrl="http://test.example.com/api/v1"
                    tokenEndpoint="/api/config"
                    onApiError={onApiError}
                >
                    <TestComponent />
                </DsaAuthProvider>
            )

            await waitFor(
                () => {
                    expect(onApiError).toHaveBeenCalled()
                },
                { timeout: 3000 }
            )

            // Call retry function
            const retryCall = onApiError.mock.calls[0]
            if (retryCall && typeof retryCall[1] === 'function') {
                retryCall[1]() // Call retry function
            }

            await waitFor(
                () => {
                    expect(screen.getByTestId('token')).toHaveTextContent(mockToken)
                },
                { timeout: 3000 }
            )
        })
    })

    describe('Configuration', () => {
        it('requires either tokenEndpoint or apiKey', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            render(
                <DsaAuthProvider apiBaseUrl="http://test.example.com/api/v1">
                    <TestComponent />
                </DsaAuthProvider>
            )

            await waitFor(
                () => {
                    expect(screen.getByTestId('is-loading')).toHaveTextContent('no')
                },
                { timeout: 3000 }
            )

            // Should show error about missing configuration
            expect(screen.getByTestId('error')).not.toHaveTextContent('no-error')

            consoleSpy.mockRestore()
        })
    })
})
