import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AnnotationManager } from './AnnotationManager'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('AnnotationManager', () => {
    beforeEach(() => {
        mockFetch.mockClear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('renders without crashing', () => {
        const { container } = render(<AnnotationManager />)
        expect(container).toBeTruthy()
    })

    it('applies custom className', () => {
        const { container } = render(<AnnotationManager className="custom-class" />)
        expect(container.firstChild).toHaveClass('bdsa-annotation-manager', 'custom-class')
    })

    it('renders children', () => {
        const { getByText } = render(
            <AnnotationManager>
                <div>Test Content</div>
            </AnnotationManager>
        )
        expect(getByText('Test Content')).toBeTruthy()
    })

    it('renders function children with context', () => {
        const { getByText } = render(
            <AnnotationManager>
                {({ annotations, loading }) => (
                    <div>
                        {loading ? 'Loading...' : `Found ${annotations.length} annotations`}
                    </div>
                )}
            </AnnotationManager>
        )
        expect(getByText('Found 0 annotations')).toBeTruthy()
    })

    it('fetches annotations when imageId and apiBaseUrl are provided', async () => {
        const mockAnnotations = [
            { _id: 'ann1', _modelType: 'annotation', annotation: { name: 'Annotation 1' } },
            { _id: 'ann2', _modelType: 'annotation', annotation: { name: 'Annotation 2' } },
        ]

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockAnnotations,
        })

        const onAnnotationsLoaded = vi.fn()
        render(
            <AnnotationManager
                imageId="test-image-id"
                apiBaseUrl="http://test.api/v1"
                onAnnotationsLoaded={onAnnotationsLoaded}
            />
        )

        await waitFor(
            () => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('http://test.api/v1/annotation?'),
                    expect.any(Object)
                )
                // Verify URL contains required parameters
                const callUrl = (mockFetch.mock.calls[0] as [string])[0]
                expect(callUrl).toContain('itemId=test-image-id')
                expect(callUrl).toContain('limit=50')
                expect(callUrl).toContain('offset=0')
            },
            { timeout: 2000 }
        )

        await waitFor(
            () => {
                expect(onAnnotationsLoaded).toHaveBeenCalledWith(mockAnnotations)
            },
            { timeout: 2000 }
        )
    })

    it('handles paginated API responses', async () => {
        const mockPaginatedResponse = {
            data: [
                { _id: 'ann1', _modelType: 'annotation' },
                { _id: 'ann2', _modelType: 'annotation' },
            ],
        }

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockPaginatedResponse,
        })

        const onAnnotationsLoaded = vi.fn()
        render(
            <AnnotationManager
                imageId="test-image-id"
                apiBaseUrl="http://test.api/v1"
                onAnnotationsLoaded={onAnnotationsLoaded}
            />
        )

        await waitFor(
            () => {
                expect(onAnnotationsLoaded).toHaveBeenCalledWith(mockPaginatedResponse.data)
            },
            { timeout: 2000 }
        )
    })

    it('handles fetch errors', async () => {
        const error = new Error('Network error')
        mockFetch.mockRejectedValueOnce(error)

        const onError = vi.fn()
        render(
            <AnnotationManager
                imageId="test-image-id"
                apiBaseUrl="http://test.api/v1"
                onError={onError}
            />
        )

        await waitFor(
            () => {
                expect(onError).toHaveBeenCalledWith(expect.any(Error))
            },
            { timeout: 2000 }
        )
    })

    it('uses custom fetch function when provided', async () => {
        const customFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => [],
        })

        render(
            <AnnotationManager
                imageId="test-image-id"
                apiBaseUrl="http://test.api/v1"
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

    it('clears annotations when imageId is removed', async () => {
        const { rerender } = render(
            <AnnotationManager imageId="test-image-id" apiBaseUrl="http://test.api/v1" />
        )

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [{ _id: 'ann1' }],
        })

        await waitFor(
            () => {
                expect(mockFetch).toHaveBeenCalled()
            },
            { timeout: 2000 }
        )

        rerender(<AnnotationManager apiBaseUrl="http://test.api/v1" />)

        // Should not fetch when imageId is removed
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })
})

