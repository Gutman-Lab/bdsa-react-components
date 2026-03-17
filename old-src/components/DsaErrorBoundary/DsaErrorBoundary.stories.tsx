import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { DsaErrorBoundary } from './DsaErrorBoundary'
import { FolderBrowser } from '../FolderBrowser/FolderBrowser'
import { SlideViewer } from '../SlideViewer/SlideViewer'
import { ThumbnailGrid } from '../ThumbnailGrid/ThumbnailGrid'

const meta: Meta<typeof DsaErrorBoundary> = {
    title: 'Components/DsaErrorBoundary',
    component: DsaErrorBoundary,
    tags: ['autodocs'],
    argTypes: {
        showRetry: {
            control: 'boolean',
            description: 'Show retry button',
        },
        errorTitle: {
            control: 'text',
            description: 'Custom error title',
        },
        errorDescription: {
            control: 'text',
            description: 'Custom error description',
        },
    },
}

export default meta
type Story = StoryObj<typeof DsaErrorBoundary>

/**
 * Component that throws an error for testing error boundaries
 */
function ErrorThrower({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
        throw new Error('This is a test error to demonstrate the error boundary!')
    }
    return <div>No error - component rendered successfully</div>
}

/**
 * Component that throws an API error
 */
function ApiErrorThrower({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
        const error = new Error('Failed to fetch data: 401 Unauthorized') as any
        error.status = 401
        error.statusText = 'Unauthorized'
        error.isRetryable = true
        error.isNetworkError = false
        throw error
    }
    return <div>No error - component rendered successfully</div>
}

export const Default: Story = {
    render: () => {
        const [shouldThrow, setShouldThrow] = useState(false)

        return (
            <div style={{ padding: '20px' }}>
                <button
                    onClick={() => setShouldThrow(true)}
                    style={{
                        padding: '8px 16px',
                        marginBottom: '16px',
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    Trigger Error
                </button>
                <DsaErrorBoundary>
                    <ErrorThrower shouldThrow={shouldThrow} />
                </DsaErrorBoundary>
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Default error boundary with standard error display and retry button.',
            },
        },
    },
}

export const WithCustomFallback: Story = {
    render: () => {
        const [shouldThrow, setShouldThrow] = useState(false)

        return (
            <div style={{ padding: '20px' }}>
                <button
                    onClick={() => setShouldThrow(true)}
                    style={{
                        padding: '8px 16px',
                        marginBottom: '16px',
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    Trigger Error
                </button>
                <DsaErrorBoundary
                    fallback={(error, reset) => (
                        <div
                            style={{
                                padding: '24px',
                                backgroundColor: '#ffebee',
                                border: '2px solid #ef5350',
                                borderRadius: '8px',
                                textAlign: 'center',
                            }}
                        >
                            <h2 style={{ color: '#c62828', marginTop: 0 }}>Custom Error Display</h2>
                            <p style={{ color: '#666' }}>{error.message}</p>
                            <button
                                onClick={reset}
                                style={{
                                    marginTop: '16px',
                                    padding: '10px 20px',
                                    backgroundColor: '#1976d2',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                            >
                                Reset Component
                            </button>
                        </div>
                    )}
                >
                    <ErrorThrower shouldThrow={shouldThrow} />
                </DsaErrorBoundary>
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Error boundary with custom fallback UI. You can provide your own error display component.',
            },
        },
    },
}

export const WithApiError: Story = {
    render: () => {
        const [shouldThrow, setShouldThrow] = useState(false)

        return (
            <div style={{ padding: '20px' }}>
                <button
                    onClick={() => setShouldThrow(true)}
                    style={{
                        padding: '8px 16px',
                        marginBottom: '16px',
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    Trigger API Error
                </button>
                <DsaErrorBoundary>
                    <ApiErrorThrower shouldThrow={shouldThrow} />
                </DsaErrorBoundary>
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Error boundary displaying an API error with status code and retry information.',
            },
        },
    },
}

export const WithErrorCallback: Story = {
    render: () => {
        const [shouldThrow, setShouldThrow] = useState(false)
        const [errorLog, setErrorLog] = useState<Array<{ error: string; timestamp: Date }>>([])

        return (
            <div style={{ padding: '20px' }}>
                <button
                    onClick={() => setShouldThrow(true)}
                    style={{
                        padding: '8px 16px',
                        marginBottom: '16px',
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    Trigger Error
                </button>
                {errorLog.length > 0 && (
                    <div
                        style={{
                            marginBottom: '16px',
                            padding: '12px',
                            backgroundColor: '#e3f2fd',
                            borderRadius: '4px',
                            border: '1px solid #2196f3',
                        }}
                    >
                        <strong>Error Log ({errorLog.length}):</strong>
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                            {errorLog.map((log, index) => (
                                <li key={index} style={{ fontSize: '12px' }}>
                                    {log.timestamp.toLocaleTimeString()}: {log.error}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <DsaErrorBoundary
                    onError={(error, errorInfo) => {
                        setErrorLog(prev => [
                            ...prev,
                            {
                                error: error.message,
                                timestamp: new Date(),
                            },
                        ])
                        console.log('Error caught:', error, errorInfo)
                    }}
                >
                    <ErrorThrower shouldThrow={shouldThrow} />
                </DsaErrorBoundary>
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Error boundary with error callback for logging errors to external services or tracking.',
            },
        },
    },
}

export const WrappingFolderBrowser: Story = {
    render: () => {
        return (
            <div style={{ padding: '20px', height: '600px' }}>
                <DsaErrorBoundary
                    errorTitle="Failed to Load Folder Browser"
                    errorDescription="The folder browser encountered an error. Please check your connection and try again."
                >
                    <FolderBrowser
                        apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
                        showCollections={true}
                    />
                </DsaErrorBoundary>
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Error boundary wrapping FolderBrowser component. If FolderBrowser crashes, the error boundary will catch it and display a user-friendly error message.',
            },
        },
    },
}

export const WithoutRetryButton: Story = {
    render: () => {
        const [shouldThrow, setShouldThrow] = useState(false)

        return (
            <div style={{ padding: '20px' }}>
                <button
                    onClick={() => setShouldThrow(true)}
                    style={{
                        padding: '8px 16px',
                        marginBottom: '16px',
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    Trigger Error
                </button>
                <DsaErrorBoundary showRetry={false}>
                    <ErrorThrower shouldThrow={shouldThrow} />
                </DsaErrorBoundary>
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Error boundary without retry button. Useful when you want to handle recovery differently.',
            },
        },
    },
}
