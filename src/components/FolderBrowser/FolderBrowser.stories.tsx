import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { FolderBrowser, type Resource, type ApiError } from './FolderBrowser'
import { DsaAuthManager } from '../DsaAuthManager/DsaAuthManager'
import { useDsaAuth } from '../../auth'

const meta: Meta<typeof FolderBrowser> = {
    title: 'Components/FolderBrowser',
    component: FolderBrowser,
    tags: ['autodocs'],
    argTypes: {
        showCollections: {
            control: 'boolean',
            description: 'Show collections at the root level',
        },
        apiBaseUrl: {
            control: 'text',
            description: 'Base URL for DSA API',
        },
    },
}

export default meta
type Story = StoryObj<typeof FolderBrowser>

const exampleApiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1'

export const Default: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        showCollections: true,
    },
    parameters: {
        docs: {
            description: {
                story: 'Default FolderBrowser showing all collections. Click to expand and browse folders.',
            },
        },
    },
}

export const WithSelection: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        showCollections: true,
    },
    render: (args) => {
        const [selectedResource, setSelectedResource] = useState<Resource | null>(null)

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '600px' }}>
                <FolderBrowser
                    {...args}
                    onResourceSelect={(resource) => {
                        setSelectedResource(resource)
                        console.log('Selected resource:', resource)
                    }}
                />
                {selectedResource && (
                    <div
                        style={{
                            padding: '12px',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                        }}
                    >
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Selected Resource:</h4>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                            <div>
                                <strong>Type:</strong> {selectedResource.type}
                            </div>
                            <div>
                                <strong>ID:</strong> {selectedResource._id}
                            </div>
                            <div>
                                <strong>Name:</strong> {selectedResource.name}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'FolderBrowser with selection tracking. The selected resource is displayed below the browser.',
            },
        },
    },
}

export const WithCustomFetch: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        showCollections: true,
        fetchFn: async (url, options) => {
            console.log('Custom fetch called:', url, options)
            // Add custom headers or logic here
            return fetch(url, options)
        },
        apiHeaders: {
            'Custom-Header': 'example-value',
        },
    },
    parameters: {
        docs: {
            description: {
                story: 'FolderBrowser with custom fetch function and headers. Useful for adding authentication.',
            },
        },
    },
}

export const Compact: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        showCollections: true,
        className: 'bdsa-folder-browser--compact',
    },
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                story: 'FolderBrowser in a compact layout.',
            },
        },
    },
}

// Mock data for testing without real API
const mockCollections = [
    {
        _id: 'collection-1',
        name: 'Example Collection 1',
        description: 'A test collection',
        public: true,
    },
    {
        _id: 'collection-2',
        name: 'Example Collection 2',
        description: 'Another test collection',
        public: false,
    },
]

const mockFolders = {
    'collection-1': [
        {
            _id: 'folder-1-1',
            name: 'Folder 1 in Collection 1',
            parentId: 'collection-1',
            parentType: 'collection' as const,
        },
        {
            _id: 'folder-1-2',
            name: 'Folder 2 in Collection 1',
            parentId: 'collection-1',
            parentType: 'collection' as const,
        },
    ],
    'folder-1-1': [
        {
            _id: 'folder-1-1-1',
            name: 'Subfolder 1',
            parentId: 'folder-1-1',
            parentType: 'folder' as const,
        },
    ],
}

export const WithMockData: Story = {
    args: {
        apiBaseUrl: 'http://mock.api',
        showCollections: true,
        fetchFn: async (url) => {
            // Simulate API delay
            await new Promise((resolve) => setTimeout(resolve, 300))

            // Mock collections endpoint
            if (url.includes('/collection')) {
                return new Response(JSON.stringify(mockCollections), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            }

            // Mock folders endpoint
            if (url.includes('/folder')) {
                const urlObj = new URL(url)
                const parentId = urlObj.searchParams.get('parentId')
                const folders = parentId ? mockFolders[parentId as keyof typeof mockFolders] || [] : []
                return new Response(JSON.stringify(folders), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            }

            return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
        },
    },
    parameters: {
        docs: {
            description: {
                story: 'FolderBrowser with mock data for testing and demonstration. No real API calls are made.',
            },
        },
    },
}

export const WithRootCollection: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        rootId: '6903df5fd26a6d93de19a9af', // Valid collection ID
        rootType: 'collection',
    },
    parameters: {
        docs: {
            description: {
                story: 'FolderBrowser starting from a specific collection root. Only shows that collection and its folders, not all collections.',
            },
        },
    },
}

export const WithRootFolder: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        rootId: '6903df87d26a6d93de19a9b0', // Valid folder ID
        rootType: 'folder',
    },
    parameters: {
        docs: {
            description: {
                story: 'FolderBrowser starting from a specific folder root. Only shows that folder and its subfolders.',
            },
        },
    },
}

export const WithAuthentication: Story = {
    render: () => {
        const { authStatus, getToken } = useDsaAuth()
        const [selectedResource, setSelectedResource] = useState<Resource | null>(null)

        const token = getToken()
        const isAuthenticated = authStatus.isAuthenticated
        const userInfo = authStatus.user

        // Debug logging
        console.log('[WithAuthentication] Auth state:', { isAuthenticated, hasToken: !!token, userInfo, authStatus })

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', minHeight: '600px' }}>
                {/* Authentication Section */}
                <div style={{
                    padding: '16px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                    border: '1px solid #ddd'
                }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Authentication</h3>
                    <DsaAuthManager
                        apiBaseUrl={exampleApiBaseUrl}
                        onAuthChange={(status) => {
                            console.log('Auth status changed:', status)
                        }}
                    />
                    {isAuthenticated && userInfo && (
                        <div style={{
                            marginTop: '12px',
                            padding: '12px',
                            backgroundColor: '#e8f5e9',
                            borderRadius: '4px',
                            fontSize: '13px'
                        }}>
                            <div><strong>Logged in as:</strong> {userInfo.login}</div>
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                Token: {token?.substring(0, 20)}...
                            </div>
                        </div>
                    )}
                </div>

                {/* Folder Browser Section */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Browse Collections & Folders</h3>
                        {!isAuthenticated && (
                            <span style={{
                                padding: '4px 8px',
                                backgroundColor: '#e3f2fd',
                                borderRadius: '4px',
                                fontSize: '12px',
                                color: '#1976d2'
                            }}>
                                ℹ️ Browsing public resources
                            </span>
                        )}
                    </div>
                    <div style={{
                        flex: 1,
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        overflow: 'auto',
                        backgroundColor: 'white',
                        padding: '8px'
                    }}>
                        <FolderBrowser
                            key={isAuthenticated ? 'authenticated' : 'public'}
                            apiBaseUrl={exampleApiBaseUrl}
                            showCollections={true}
                            showItems={true}
                            showItemCount={true}
                            apiHeaders={isAuthenticated && token ? {
                                'Girder-Token': token,
                            } : undefined}
                            onResourceSelect={(resource) => {
                                setSelectedResource(resource)
                                console.log('Selected resource:', resource)
                            }}
                            persistSelection={true}
                            persistExpansion={true}
                        />
                    </div>
                </div>

                {/* Selected Resource Display */}
                {selectedResource && (
                    <div style={{
                        padding: '12px',
                        backgroundColor: '#e3f2fd',
                        borderRadius: '8px',
                        border: '1px solid #2196f3'
                    }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Selected Resource:</h4>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                            <div><strong>Type:</strong> {selectedResource.type}</div>
                            <div><strong>ID:</strong> {selectedResource._id}</div>
                            <div><strong>Name:</strong> {selectedResource.name}</div>
                        </div>
                    </div>
                )}
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: `Complete authentication example showing how to integrate DsaAuthManager with FolderBrowser.
                
**Features demonstrated:**
- Login/logout with DsaAuthManager
- Automatic token passing when authenticated
- Works for both public and private resources
- Persistence of selection and expansion state
- Real-time auth status display
- Component re-mounts on auth state change for clean state

**Usage Pattern:**
\`\`\`tsx
const { isAuthenticated, token } = useDsaAuth()

<DsaAuthManager apiBaseUrl={apiBaseUrl} />

<FolderBrowser
  key={isAuthenticated ? 'auth' : 'public'}
  apiBaseUrl={apiBaseUrl}
  apiHeaders={isAuthenticated && token ? {
    'Girder-Token': token
  } : undefined}
/>
\`\`\`

**Key Points:**
- The \`key\` prop forces re-mount on auth state change
- Public resources are accessible without authentication
- Private resources require authentication`,
            },
        },
    },
}

export const WithItemFiltering: Story = {
    render: () => {
        const { authStatus, getToken } = useDsaAuth()
        const [itemCount, setItemCount] = useState<Record<string, number>>({})

        const token = getToken()
        const isAuthenticated = authStatus.isAuthenticated

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', minHeight: '600px' }}>
                {/* Authentication Section */}
                <div style={{
                    padding: '16px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                    border: '1px solid #ddd'
                }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Authentication</h3>
                    <DsaAuthManager apiBaseUrl={exampleApiBaseUrl} />
                </div>

                {/* Folder Browser with Item Filtering */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>
                            Browse with Item Filtering & Counts
                        </h3>
                        {!isAuthenticated && (
                            <span style={{
                                padding: '4px 8px',
                                backgroundColor: '#e3f2fd',
                                borderRadius: '4px',
                                fontSize: '12px',
                                color: '#1976d2'
                            }}>
                                ℹ️ Browsing public resources
                            </span>
                        )}
                    </div>
                    <div style={{
                        padding: '12px',
                        backgroundColor: '#f0f7ff',
                        borderRadius: '4px',
                        marginBottom: '12px',
                        fontSize: '13px',
                        border: '1px solid #bbdefb'
                    }}>
                        <strong>Note:</strong> This example shows item counts next to folders.
                        Items are fetched but not displayed in the tree (you can process them with <code>onItemsFetched</code>).
                    </div>
                    <div style={{
                        flex: 1,
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        overflow: 'auto',
                        backgroundColor: 'white',
                        padding: '8px'
                    }}>
                        <FolderBrowser
                            key={isAuthenticated ? 'authenticated' : 'public'}
                            apiBaseUrl={exampleApiBaseUrl}
                            showCollections={true}
                            apiHeaders={isAuthenticated && token ? {
                                'Girder-Token': token,
                            } : undefined}
                            fetchItems={true}
                            showItems={false}
                            showItemCount={true}
                            onItemsFetched={(folderId, items) => {
                                console.log(`Folder ${folderId} has ${items.length} items`)
                                setItemCount(prev => ({ ...prev, [folderId]: items.length }))
                            }}
                            persistExpansion={true}
                        />
                    </div>
                </div>

                {/* Item Count Summary */}
                {Object.keys(itemCount).length > 0 && (
                    <div style={{
                        padding: '12px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '8px',
                        border: '1px solid #ddd'
                    }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Fetched Items Summary:</h4>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                            {Object.entries(itemCount).map(([folderId, count]) => (
                                <div key={folderId}>
                                    Folder <code>{folderId}</code>: <strong>{count} items</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: `Advanced example showing item filtering and counting with authentication.

**Features demonstrated:**
- Item fetching with \`fetchItems={true}\`
- Item counts displayed next to folder names with \`showItemCount={true}\`
- Items fetched but not shown in tree (\`showItems={false}\`)
- \`onItemsFetched\` callback to process items
- Authentication integration

**Usage Pattern:**
\`\`\`tsx
<FolderBrowser
  apiHeaders={{ 'Girder-Token': token }}
  fetchItems={true}
  showItems={false}
  showItemCount={true}
  onItemsFetched={(folderId, items) => {
    // Process items for custom logic
    const filteredItems = items.filter(item => 
      item.name.endsWith('.tif')
    )
  }}
/>
\`\`\``,
            },
        },
    },
}

/**
 * Story demonstrating error handling with onApiError callback.
 * Shows how to handle API errors, implement retry logic, and display error messages.
 */
export const WithErrorHandling: Story = {
    render: () => {
        const [errors, setErrors] = useState<Array<{ error: ApiError; context?: any; timestamp: Date }>>([])
        const [retryCount, setRetryCount] = useState<Record<string, number>>({})

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '600px' }}>
                <FolderBrowser
                    apiBaseUrl={exampleApiBaseUrl}
                    showCollections={true}
                    onApiError={(error, retry, context) => {
                        // Log the error
                        console.error('API Error:', error, context)

                        // Add to errors list
                        setErrors(prev => [...prev, { error, context, timestamp: new Date() }])

                        // Implement retry logic for transient failures
                        if (error.isRetryable) {
                            const errorKey = context?.endpoint || 'unknown'
                            const count = retryCount[errorKey] || 0

                            if (count < 3) {
                                // Auto-retry up to 3 times for retryable errors
                                setRetryCount(prev => ({ ...prev, [errorKey]: count + 1 }))

                                if (error.status === 401) {
                                    // Token expired - could refresh token here
                                    console.log('Token expired, refreshing...')
                                    setTimeout(() => retry(), 1000)
                                } else if (error.status === 503 || error.isNetworkError) {
                                    // Server unavailable or network error - retry with backoff
                                    const delay = Math.min(1000 * Math.pow(2, count), 5000) // Exponential backoff, max 5s
                                    console.log(`Retrying in ${delay}ms...`)
                                    setTimeout(() => retry(), delay)
                                } else {
                                    // Other retryable errors
                                    setTimeout(() => retry(), 1000)
                                }
                            } else {
                                console.error('Max retries reached for', errorKey)
                            }
                        } else {
                            // Non-retryable error - show to user
                            alert(`Error: ${error.message}\n\nStatus: ${error.status || 'Unknown'}\nEndpoint: ${context?.endpoint || 'Unknown'}`)
                        }
                    }}
                />

                {/* Error Display */}
                {errors.length > 0 && (
                    <div
                        style={{
                            padding: '16px',
                            backgroundColor: '#ffebee',
                            borderRadius: '8px',
                            border: '1px solid #ef5350',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#c62828' }}>
                            API Errors ({errors.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {errors.slice(-5).reverse().map((item, index) => (
                                <div
                                    key={index}
                                    style={{
                                        padding: '8px',
                                        backgroundColor: 'white',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontFamily: 'monospace',
                                    }}
                                >
                                    <div>
                                        <strong>Time:</strong> {item.timestamp.toLocaleTimeString()}
                                    </div>
                                    <div>
                                        <strong>Error:</strong> {item.error.message}
                                    </div>
                                    {item.error.status && (
                                        <div>
                                            <strong>Status:</strong> {item.error.status} {item.error.statusText}
                                        </div>
                                    )}
                                    {item.context?.endpoint && (
                                        <div>
                                            <strong>Endpoint:</strong> {item.context.endpoint}
                                        </div>
                                    )}
                                    <div>
                                        <strong>Retryable:</strong> {item.error.isRetryable ? 'Yes' : 'No'}
                                        {item.error.isNetworkError && ' (Network Error)'}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {errors.length > 5 && (
                            <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                                Showing last 5 errors. Total: {errors.length}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: `Demonstrates error handling with the \`onApiError\` callback.

**Features:**
- Automatic retry logic for transient failures (401, 503, network errors)
- Exponential backoff for retries
- Error logging and display
- Retry count tracking
- User-friendly error messages for non-retryable errors

**Error Types:**
- **401 Unauthorized**: Token expired - can refresh and retry
- **503 Service Unavailable**: Server temporarily down - retry with backoff
- **Network Errors**: Connection issues - retry with backoff
- **404 Not Found**: Not retryable - show error to user
- **403 Forbidden**: Not retryable - show error to user

**Usage Pattern:**
\`\`\`tsx
<FolderBrowser
  apiBaseUrl={apiBaseUrl}
  onApiError={(error, retry, context) => {
    if (error.status === 401) {
      // Refresh token and retry
      refreshToken().then(() => retry())
    } else if (error.isRetryable) {
      // Retry with delay
      setTimeout(() => retry(), 2000)
    } else {
      // Show error to user
      showErrorNotification(error.message)
    }
  }}
/>
\`\`\``,
            },
        },
    },
}
