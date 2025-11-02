import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { FolderBrowser, type Resource } from './FolderBrowser'

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

