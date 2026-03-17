import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, useEffect } from 'react'
import { ThumbnailGrid } from './ThumbnailGrid'
import { DsaAuthManager } from '../DsaAuthManager/DsaAuthManager'
import { useDsaAuth } from '../../auth'

const meta: Meta<typeof ThumbnailGrid> = {
    title: 'Components/ThumbnailGrid',
    component: ThumbnailGrid,
    tags: ['autodocs'],
    argTypes: {
        folderId: {
            control: 'text',
            description: 'DSA folder ID to fetch items from',
        },
        apiBaseUrl: {
            control: 'text',
            description: 'Base URL for DSA API',
        },
        thumbnailSize: {
            control: 'select',
            options: ['s', 'm', 'l', 'xl'],
            description: 'Thumbnail size preset',
        },
        thumbnailImageSize: {
            control: 'number',
            description: 'Thumbnail image size in pixels (default: 512)',
        },
    },
}

export default meta
type Story = StoryObj<typeof ThumbnailGrid>

const exampleApiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1'

export const Default: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        folderId: '6903df87d26a6d93de19a9b0',
        thumbnailSize: 'l',
        itemsPerPage: 12,
        debug: true,
    },
    parameters: {
        docs: {
            description: {
                story: 'Basic thumbnail grid showing static thumbnail images. Lightweight alternative to FolderThumbnailBrowser without OpenSeadragon integration.',
            },
        },
    },
}

export const WithAuthentication: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        folderId: '6903df87d26a6d93de19a9b0',
        thumbnailSize: 'l',
    },
    render: (args) => {
        const { authStatus, getToken } = useDsaAuth()
        const isAuthenticated = authStatus === 'authenticated'
        const token = getToken()

        return (
            <div style={{ height: '800px', display: 'flex', flexDirection: 'column' }}>
                <DsaAuthManager />
                <div style={{ flex: 1, marginTop: '16px' }}>
                    <ThumbnailGrid
                        {...args}
                        apiHeaders={
                            isAuthenticated && token
                                ? {
                                      Authorization: `Bearer ${token}`,
                                  }
                                : undefined
                        }
                        key={isAuthenticated ? 'authenticated' : 'public'}
                    />
                </div>
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Thumbnail grid with authentication. Log in to access private folders and items.',
            },
        },
    },
}

export const WithImageIds: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        thumbnailSize: 'm',
    },
    render: (args) => {
        const [imageIds, setImageIds] = useState<string[]>([])
        const [loading, setLoading] = useState(true)

        // Fetch items from the default folder to get valid item IDs
        useEffect(() => {
            const fetchItemIds = async () => {
                try {
                    const response = await fetch(`${exampleApiBaseUrl}/item?folderId=6903df87d26a6d93de19a9b0&limit=10`)
                    if (response.ok) {
                        const data = await response.json()
                        const items = Array.isArray(data) ? data : data.data || []
                        // Take first 5 items for the example
                        const ids = items.slice(0, 5).map((item: { _id: string }) => item._id)
                        setImageIds(ids)
                    }
                } catch (err) {
                    console.error('Failed to fetch items:', err)
                } finally {
                    setLoading(false)
                }
            }
            fetchItemIds()
        }, [])

        return (
            <div style={{ display: 'flex', height: '800px', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                    {loading ? (
                        <div style={{ padding: '20px', textAlign: 'center' }}>Loading items...</div>
                    ) : (
                        <ThumbnailGrid
                            {...args}
                            imageIds={imageIds}
                        />
                    )}
                </div>
                <div
                    style={{
                        width: '300px',
                        padding: '16px',
                        backgroundColor: '#f5f5f5',
                        borderLeft: '1px solid #ddd',
                        overflowY: 'auto',
                    }}
                >
                    <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
                        Item IDs Array
                    </h3>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                        This panel shows the array of item IDs being passed to the ThumbnailGrid component.
                        These IDs are fetched from the default folder.
                    </p>
                    <div
                        style={{
                            backgroundColor: '#fff',
                            padding: '12px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                        }}
                    >
                        <div style={{ color: '#666', marginBottom: '8px' }}>imageIds:</div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {JSON.stringify(imageIds, null, 2)}
                        </pre>
                        <div style={{ marginTop: '12px', fontSize: '11px', color: '#666' }}>
                            Count: {imageIds.length} items
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Thumbnail grid showing specific items by their IDs. Pass an array of `imageIds` to display only those items. Useful for search results, curated lists, or when you have a specific set of items to show. Each item is fetched individually using `/item/{id}` endpoint. This example fetches items from the default folder and displays the first 5.',
            },
        },
    },
}

export const WithDatasetTypes: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        folderId: '6903df87d26a6d93de19a9b0',
        thumbnailSize: 'l',
        modelName: 'SegFormer Model v1',
        modelDatasetInfo: {
            train: ['6903df8dd26a6d93de19a9b3', '6903df8dd26a6d93de19a9b4'],
            val: ['6903df8dd26a6d93de19a9b5'],
            test: ['6903df8dd26a6d93de19a9b6'],
        },
        getDatasetType: (itemId: string) => {
            const trainIds = ['6903df8dd26a6d93de19a9b3', '6903df8dd26a6d93de19a9b4']
            const valIds = ['6903df8dd26a6d93de19a9b5']
            const testIds = ['6903df8dd26a6d93de19a9b6']
            if (trainIds.includes(itemId)) return 'train'
            if (valIds.includes(itemId)) return 'val'
            if (testIds.includes(itemId)) return 'test'
            return null
        },
    },
    parameters: {
        docs: {
            description: {
                story: 'Thumbnail grid with dataset type indicators (TRAIN/VAL/TEST) for model training images.',
            },
        },
    },
}

export const WithClickHandler: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        folderId: '6903df87d26a6d93de19a9b0',
        thumbnailSize: 'l',
    },
    render: (args) => {
        const [clickedItem, setClickedItem] = useState<string | null>(null)

        return (
            <div style={{ height: '800px', display: 'flex', flexDirection: 'column' }}>
                {clickedItem && (
                    <div style={{ padding: '12px', background: '#e3f2fd', borderBottom: '1px solid #ddd' }}>
                        <strong>Clicked:</strong> {clickedItem}
                    </div>
                )}
                <div style={{ flex: 1 }}>
                    <ThumbnailGrid
                        {...args}
                        onThumbnailClick={(item) => {
                            setClickedItem(item.name || item._id)
                            console.log('Thumbnail clicked:', item)
                        }}
                    />
                </div>
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Thumbnail grid with click handler. Click any thumbnail to see the item information.',
            },
        },
    },
}

export const DifferentSizes: Story = {
    render: () => {
        const [size, setSize] = useState<'s' | 'm' | 'l' | 'xl'>('l')

        return (
            <div style={{ height: '800px' }}>
                <ThumbnailGrid
                    apiBaseUrl={exampleApiBaseUrl}
                    folderId="6903df87d26a6d93de19a9b0"
                    thumbnailSize={size}
                    onItemsLoaded={(itemIds) => {
                        console.log('Loaded items:', itemIds)
                    }}
                />
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Demonstrates different thumbnail sizes (S, M, L, XL). Use the size controls in the header to switch between sizes.',
            },
        },
    },
}
