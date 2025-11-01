import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, screen, fireEvent } from '@testing-library/react'
import { FolderBrowser } from './FolderBrowser'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('FolderBrowser', () => {
    beforeEach(() => {
        mockFetch.mockClear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('renders without crashing', () => {
        const { container } = render(<FolderBrowser />)
        expect(container).toBeTruthy()
    })

    it('applies custom className', () => {
        const { container } = render(<FolderBrowser className="custom-class" />)
        expect(container.firstChild).toHaveClass('bdsa-folder-browser', 'custom-class')
    })

    it('shows error when apiBaseUrl is missing but showCollections is true', async () => {
        render(<FolderBrowser showCollections={true} />)

        await waitFor(
            () => {
                expect(screen.getByText(/API base URL is required/i)).toBeTruthy()
            },
            { timeout: 2000 }
        )
    })

    it('fetches collections when apiBaseUrl and showCollections are provided', async () => {
        const mockCollections = [
            { _id: 'coll1', name: 'Collection 1' },
            { _id: 'coll2', name: 'Collection 2' },
        ]

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockCollections,
        })

        render(<FolderBrowser apiBaseUrl="http://test.api/v1" showCollections={true} />)

        await waitFor(
            () => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://test.api/v1/collection',
                    expect.any(Object)
                )
            },
            { timeout: 2000 }
        )
    })

    it('handles paginated collection response', async () => {
        const mockPaginatedResponse = {
            items: [
                { _id: 'coll1', name: 'Collection 1' },
                { _id: 'coll2', name: 'Collection 2' },
            ],
            limit: 50,
            offset: 0,
        }

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockPaginatedResponse,
        })

        render(<FolderBrowser apiBaseUrl="http://test.api/v1" showCollections={true} />)

        await waitFor(
            () => {
                expect(mockFetch).toHaveBeenCalled()
            },
            { timeout: 2000 }
        )
    })

    it('loads folders when collection is expanded', async () => {
        const mockCollections = [{ _id: 'coll1', name: 'Collection 1' }]
        const mockFolders = [{ _id: 'folder1', name: 'Folder 1' }]

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockCollections,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockFolders,
            })

        render(<FolderBrowser apiBaseUrl="http://test.api/v1" showCollections={true} />)

        // Wait for collections to load
        await waitFor(
            () => {
                expect(screen.getByText('Collection 1')).toBeTruthy()
            },
            { timeout: 2000 }
        )

        // Click to expand collection
        const collectionHeader = screen.getByText('Collection 1').closest('.bdsa-folder-browser__folder-header')
        if (collectionHeader) {
            fireEvent.click(collectionHeader)
        }

        // Wait for folders to be fetched
        await waitFor(
            () => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/folder?parentType=collection&parentId=coll1'),
                    expect.any(Object)
                )
            },
            { timeout: 2000 }
        )
    })

    it('loads subfolders when folder is expanded', async () => {
        const mockCollections = [{ _id: 'coll1', name: 'Collection 1' }]
        const mockFolders = [{ _id: 'folder1', name: 'Folder 1', parentId: 'coll1' }]
        const mockSubFolders = [{ _id: 'subfolder1', name: 'Subfolder 1', parentId: 'folder1' }]

        // Mock fetch to handle pagination parameters
        mockFetch.mockImplementation(async (url) => {
            if (url.includes('/collection')) {
                return {
                    ok: true,
                    json: async () => mockCollections,
                }
            }
            if (url.includes('/folder?parentType=collection')) {
                return {
                    ok: true,
                    json: async () => mockFolders,
                }
            }
            if (url.includes('/folder?parentType=folder')) {
                return {
                    ok: true,
                    json: async () => mockSubFolders,
                }
            }
            return {
                ok: false,
                status: 404,
                statusText: 'Not Found',
            }
        })

        render(<FolderBrowser apiBaseUrl="http://test.api/v1" showCollections={true} />)

        // Wait for collections to load
        await waitFor(
            () => {
                expect(screen.getByText('Collection 1')).toBeTruthy()
            },
            { timeout: 2000 }
        )

        // Expand collection
        const collectionHeader = screen.getByText('Collection 1').closest('.bdsa-folder-browser__folder-header')
        if (collectionHeader) {
            fireEvent.click(collectionHeader)
        }

        // Wait for folders to load and appear
        await waitFor(
            () => {
                expect(screen.getByText('Folder 1')).toBeTruthy()
            },
            { timeout: 2000 }
        )

        // Expand folder
        const folderHeader = screen.getByText('Folder 1').closest('.bdsa-folder-browser__folder-header')
        if (folderHeader) {
            fireEvent.click(folderHeader)
        }

        // Wait for subfolders to be fetched
        await waitFor(
            () => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/folder?parentType=folder&parentId=folder1'),
                    expect.any(Object)
                )
            },
            { timeout: 2000 }
        )
    })

    it('calls onResourceSelect when resource is selected', async () => {
        const mockCollections = [{ _id: 'coll1', name: 'Collection 1' }]
        const onResourceSelect = vi.fn()

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockCollections,
        })

        render(
            <FolderBrowser
                apiBaseUrl="http://test.api/v1"
                showCollections={true}
                onResourceSelect={onResourceSelect}
            />
        )

        // Wait for collections to load
        await waitFor(
            () => {
                expect(screen.getByText('Collection 1')).toBeTruthy()
            },
            { timeout: 2000 }
        )

        // Double-click the collection header to select it
        const collectionHeader = screen.getByText('Collection 1').closest('.bdsa-folder-browser__folder-header')
        if (collectionHeader) {
            fireEvent.doubleClick(collectionHeader)
        }

        await waitFor(
            () => {
                expect(onResourceSelect).toHaveBeenCalledWith(
                    expect.objectContaining({
                        _id: 'coll1',
                        name: 'Collection 1',
                        type: 'collection',
                    })
                )
            },
            { timeout: 2000 }
        )
    })

    it('uses custom fetchFn when provided', async () => {
        const customFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        })

        render(
            <FolderBrowser
                apiBaseUrl="http://test.api/v1"
                showCollections={true}
                fetchFn={customFetch}
            />
        )

        await waitFor(
            () => {
                expect(customFetch).toHaveBeenCalled()
            },
            { timeout: 2000 }
        )
    })

    it('adds custom headers to fetch requests', async () => {
        const mockCollections = [{ _id: 'coll1', name: 'Collection 1' }]

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockCollections,
        })

        render(
            <FolderBrowser
                apiBaseUrl="http://test.api/v1"
                showCollections={true}
                apiHeaders={{ 'Authorization': 'Bearer token123' }}
            />
        )

        await waitFor(
            () => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'Authorization': 'Bearer token123',
                        }),
                    })
                )
            },
            { timeout: 2000 }
        )
    })

    it('handles API errors gracefully', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        render(<FolderBrowser apiBaseUrl="http://test.api/v1" showCollections={true} />)

        await waitFor(
            () => {
                expect(screen.getByText(/Network error/i)).toBeTruthy()
            },
            { timeout: 2000 }
        )
    })

    it('handles HTTP error responses', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        })

        render(<FolderBrowser apiBaseUrl="http://test.api/v1" showCollections={true} />)

        await waitFor(
            () => {
                expect(screen.getByText(/Failed to fetch collections/i)).toBeTruthy()
            },
            { timeout: 2000 }
        )
    })

    it('displays empty state when no collections are found', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [],
        })

        render(<FolderBrowser apiBaseUrl="http://test.api/v1" showCollections={true} />)

        await waitFor(
            () => {
                expect(screen.getByText(/No collections found/i)).toBeTruthy()
            },
            { timeout: 2000 }
        )
    })
})

