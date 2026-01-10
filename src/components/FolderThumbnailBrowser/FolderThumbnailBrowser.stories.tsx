import type { Meta, StoryObj } from '@storybook/react'
import { useState, useEffect } from 'react'
import { FolderThumbnailBrowser } from './FolderThumbnailBrowser'
import { DsaAuthManager } from '../DsaAuthManager/DsaAuthManager'
import { useDsaAuth } from '../../auth'

const meta: Meta<typeof FolderThumbnailBrowser> = {
    title: 'Components/FolderThumbnailBrowser',
    component: FolderThumbnailBrowser,
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
        viewerSize: {
            control: 'select',
            options: ['s', 'm', 'l', 'xl'],
            description: 'Thumbnail size preset',
        },
        annotationOpacity: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
            description: 'Opacity for annotations (0-1)',
        },
    },
}

export default meta
type Story = StoryObj<typeof FolderThumbnailBrowser>

const exampleApiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1'

export const Default: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        folderId: '6903df87d26a6d93de19a9b0',
        viewerSize: 'l',
        itemsPerPage: 12,
    },
    parameters: {
        docs: {
            description: {
                story: 'Default thumbnail browser showing items from a folder. Use size controls to adjust thumbnail size.',
            },
        },
    },
}

export const WithAuthentication: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        folderId: '6903df87d26a6d93de19a9b0',
        viewerSize: 'l',
    },
    render: (args) => {
        const { authStatus, getToken } = useDsaAuth()
        const isAuthenticated = authStatus === 'authenticated'
        const token = getToken()

        return (
            <div style={{ height: '800px', display: 'flex', flexDirection: 'column' }}>
                <DsaAuthManager />
                <div style={{ flex: 1, marginTop: '16px' }}>
                    <FolderThumbnailBrowser
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
                story: 'Thumbnail browser with authentication. Log in to access private folders and items.',
            },
        },
    },
}

export const WithAnnotationOverlay: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        folderId: '6903df87d26a6d93de19a9b0',
        viewerSize: 'l',
        // selectedAnnotationName will be set dynamically based on first annotation found
        annotationOpacity: 0.7,
    },
    render: (args) => {
        const [opacity, setOpacity] = useState(0.7)
        const [annotationMap, setAnnotationMap] = useState<Map<string, string>>(new Map())
        const [annotationName, setAnnotationName] = useState<string | null>(null)
        const [loading, setLoading] = useState(true)

        // Fetch annotations for items in the folder - use first annotation found per item
        useEffect(() => {
            const fetchAnnotations = async () => {
                try {
                    // First, get items from the folder
                    const itemsResponse = await fetch(`${exampleApiBaseUrl}/item?folderId=6903df87d26a6d93de19a9b0&limit=20`)
                    if (!itemsResponse.ok) {
                        console.warn('Failed to fetch items for annotation mapping')
                        setLoading(false)
                        return
                    }

                    const itemsData = await itemsResponse.json()
                    const items = Array.isArray(itemsData) ? itemsData : itemsData.data || []

                    // For each item, get the first annotation found
                    const map = new Map<string, string>()
                    let foundAnnotationName: string | null = null

                    // Fetch annotations for all items (not just first 10)
                    // This ensures all visible thumbnails can show annotations
                    for (const item of items) {
                        // Search for annotations on this item
                        try {
                            const annResponse = await fetch(
                                `${exampleApiBaseUrl}/annotation?itemId=${item._id}&limit=1`
                            )
                            if (annResponse.ok) {
                                const annData = await annResponse.json()
                                const annotations = Array.isArray(annData) ? annData : annData.data || []

                                // Use the first annotation found
                                if (annotations.length > 0) {
                                    const firstAnn = annotations[0]
                                    const annId = String(firstAnn._id || firstAnn.id)
                                    map.set(item._id, annId)

                                    // Capture the annotation name from the first one we find
                                    if (!foundAnnotationName) {
                                        foundAnnotationName =
                                            firstAnn.annotation?.name || firstAnn.name || 'Annotation'
                                    }
                                }
                            }
                        } catch (err) {
                            // Skip items that fail to fetch annotations
                            console.warn(`Failed to fetch annotations for item ${item._id}:`, err)
                        }
                    }

                    setAnnotationMap(map)
                    if (foundAnnotationName) {
                        setAnnotationName(foundAnnotationName)
                    }
                } catch (err) {
                    console.error('Failed to fetch annotation mapping:', err)
                } finally {
                    setLoading(false)
                }
            }

            fetchAnnotations()
        }, [])

        return (
            <div style={{ height: '800px' }}>
                {loading && (
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                        Loading annotations...
                    </div>
                )}
                <FolderThumbnailBrowser
                    {...args}
                    selectedAnnotationName={annotationName || undefined}
                    annotationOpacity={opacity}
                    onAnnotationOpacityChange={setOpacity}
                    annotationNameToIds={annotationMap}
                />
            </div>
        )
    },
    parameters: {
        docs: {
            description: {
                story: 'Thumbnail browser with annotation overlay. This example automatically finds and displays the first annotation found for each item in the folder. Use the opacity slider in the header to adjust annotation visibility (0-100%). Each thumbnail shows the annotation as colored shapes/regions overlaid on the image. Items without annotations will display without overlays.',
            },
        },
    },
}

export const WithImageIds: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        viewerSize: 'm',
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
                        <FolderThumbnailBrowser
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
                        This panel shows the array of item IDs being passed to the FolderThumbnailBrowser component.
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
                story: 'Thumbnail browser showing specific items by their IDs. Pass an array of `imageIds` to display only those items. Useful for search results, curated lists, or when you have a specific set of items to show. Each item is fetched individually using `/item/{id}` endpoint. This example fetches items from the default folder and displays the first 5.',
            },
        },
    },
}

export const WithDatasetTypes: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        folderId: '6903df87d26a6d93de19a9b0',
        viewerSize: 'l',
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
                story: 'Thumbnail browser with dataset type indicators (TRAIN/VAL/TEST) for model training images.',
            },
        },
    },
}

export const DifferentSizes: Story = {
    render: () => {
        const [size, setSize] = useState<'s' | 'm' | 'l' | 'xl'>('l')

        return (
            <div style={{ height: '800px' }}>
                <FolderThumbnailBrowser
                    apiBaseUrl={exampleApiBaseUrl}
                    folderId="6903df87d26a6d93de19a9b0"
                    viewerSize={size}
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
