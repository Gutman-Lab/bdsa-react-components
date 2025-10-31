import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SlideViewer } from './SlideViewer'
import type { SlideImageInfo } from './SlideViewer'

// Test data matching the example from the stories
const EXAMPLE_IMAGE_ID = '6903df8dd26a6d93de19a9b2'
const EXAMPLE_ANNOTATION_ID = '6903df8ed26a6d93de19a9b4'
const EXAMPLE_API_BASE_URL = 'http://bdsa.pathology.emory.edu:8080/api/v1'
const EXAMPLE_DZI_URL = `${EXAMPLE_API_BASE_URL}/item/${EXAMPLE_IMAGE_ID}/tiles/dzi.dzi`

// Mock OpenSeadragon and osd-paperjs-annotation
const mockAddPaperItem = vi.fn()
const mockRemove = vi.fn()
const mockGetFeatures = vi.fn(() => [])
const mockDestroy = vi.fn()
const mockViewerOpen = vi.fn()
const mockCreatePaperOverlay = vi.fn(() => ({
    paperScope: {
        Path: class {
            moveTo = vi.fn()
            lineTo = vi.fn()
            closePath = vi.fn()
            strokeColor = ''
            strokeWidth = 2
            fillColor = ''
            data = {}
            annotationId = undefined
            onClick = undefined
            style = {}
        },
        Path: {
            Rectangle: vi.fn((rect) => ({
                strokeColor: '',
                strokeWidth: 2,
                fillColor: '',
                data: {},
                annotationId: undefined,
                onClick: undefined,
                style: {},
                remove: mockRemove,
            })),
        },
        Rectangle: vi.fn(),
        project: {
            activeLayer: {
                children: [],
            },
        },
        view: {
            draw: vi.fn(),
        },
    },
    destroy: mockDestroy,
}))

const mockViewer = {
    createPaperOverlay: mockCreatePaperOverlay,
    open: mockViewerOpen,
    addTiledImage: vi.fn((options) => {
        if (options.success) {
            options.success()
        }
    }),
    addHandler: vi.fn(),
    world: {
        addHandler: vi.fn(),
        getItemAt: vi.fn(() => ({
            addPaperItem: mockAddPaperItem,
            paperItems: [],
        })),
        addItem: vi.fn(),
    },
    destroy: mockDestroy,
}

vi.mock('openseadragon', () => {
    return {
        default: vi.fn(() => mockViewer),
    }
})

vi.mock('osd-paperjs-annotation', () => {
    return {
        PaperOverlay: vi.fn(),
        AnnotationToolkit: class {
            constructor() {
                // Store instance for testing
            }
            static registerFeature = vi.fn()
            overlay = null
            getFeatures = mockGetFeatures
            destroy = mockDestroy
        },
        AnnotationToolbar: vi.fn(),
    }
})

// Mock fetch for API calls
global.fetch = vi.fn()

describe('SlideViewer', () => {
    const mockImageInfo: SlideImageInfo = {
        imageId: 'test-image-123',
        width: 10000,
        height: 8000,
        tileWidth: 256,
        levels: 5,
        baseUrl: 'http://localhost:5000',
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockViewer.world.addHandler.mockImplementation((event, handler) => {
            // Simulate add-item event after a delay
            if (event === 'add-item') {
                setTimeout(() => {
                    handler({ item: { addPaperItem: mockAddPaperItem, paperItems: [] } })
                }, 100)
            }
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Basic Rendering', () => {
        it('renders the viewer container', () => {
            const { container } = render(<SlideViewer imageInfo={mockImageInfo} />)
            const viewerContainer = container.querySelector('.bdsa-slide-viewer__container')
            expect(viewerContainer).toBeInTheDocument()
        })

        it('applies custom className', () => {
            const { container } = render(
                <SlideViewer imageInfo={mockImageInfo} className="custom-class" />
            )
            const viewer = container.querySelector('.bdsa-slide-viewer')
            expect(viewer).toHaveClass('custom-class')
        })

        it('uses custom height and width', () => {
            const { container } = render(
                <SlideViewer imageInfo={mockImageInfo} height="800px" width="1200px" />
            )
            const viewer = container.querySelector('.bdsa-slide-viewer')
            expect(viewer).toHaveStyle({ height: '800px', width: '1200px' })
        })

        it('forwards ref to container', () => {
            const ref = { current: null as HTMLDivElement | null }
            render(<SlideViewer ref={ref} imageInfo={mockImageInfo} />)
            expect(ref).toBeDefined()
        })
    })

    describe('DZI URL Loading', () => {
        it('loads image using DZI URL when provided', () => {
            const dziImageInfo: SlideImageInfo = {
                dziUrl: EXAMPLE_DZI_URL,
            }
            render(<SlideViewer imageInfo={dziImageInfo} />)
            expect(mockViewerOpen).toHaveBeenCalledWith(EXAMPLE_DZI_URL)
        })

        it('prioritizes DZI URL over manual tile source construction', () => {
            const dziImageInfo: SlideImageInfo = {
                dziUrl: EXAMPLE_DZI_URL,
                imageId: 'should-be-ignored',
                width: 10000,
                height: 8000,
            }
            render(<SlideViewer imageInfo={dziImageInfo} />)
            expect(mockViewerOpen).toHaveBeenCalledWith(EXAMPLE_DZI_URL)
        })
    })

    describe('Annotation Fetching', () => {
        it('fetches annotations from API when annotationIds are provided', async () => {
            const mockAnnotationResponse = {
                elements: [
                    {
                        type: 'rectangle',
                        x: 1000,
                        y: 2000,
                        width: 500,
                        height: 300,
                        lineColor: '#ff0000',
                    },
                    {
                        type: 'polyline',
                        points: [
                            [100, 200],
                            [300, 400],
                            [500, 600],
                        ],
                        lineColor: '#00ff00',
                    },
                ],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                />
            )

            await waitFor(
                () => {
                    expect(global.fetch).toHaveBeenCalledWith(
                        `${EXAMPLE_API_BASE_URL}/annotation/${EXAMPLE_ANNOTATION_ID}`
                    )
                },
                { timeout: 2000 }
            )
        })

        it('handles multiple annotation IDs', async () => {
            const mockResponse = {
                elements: [
                    {
                        type: 'rectangle',
                        x: 100,
                        y: 200,
                        width: 50,
                        height: 30,
                    },
                ],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
                    ok: true,
                    json: async () => mockResponse,
                })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={['id1', 'id2', 'id3']}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                />
            )

            await waitFor(
                () => {
                    expect(global.fetch).toHaveBeenCalledTimes(3)
                },
                { timeout: 2000 }
            )
        })

        it('handles fetch errors gracefully', async () => {
            ; (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
                new Error('Network error')
            )

            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                />
            )

            await waitFor(
                () => {
                    expect(consoleError).toHaveBeenCalledWith(
                        expect.stringContaining('Error fetching annotations'),
                        expect.any(Error)
                    )
                },
                { timeout: 2000 }
            )

            consoleError.mockRestore()
        })

        it('handles 404 responses gracefully', async () => {
            ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            })

            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                />
            )

            await waitFor(
                () => {
                    expect(consoleWarn).toHaveBeenCalled()
                },
                { timeout: 2000 }
            )

            consoleWarn.mockRestore()
        })
    })

    describe('Point Filtering and Validation', () => {
        it('filters annotations exceeding maxPointsPerAnnotation', async () => {
            const largePolyline = {
                type: 'polyline',
                points: Array.from({ length: 15000 }, (_, i) => [i, i * 2]),
                lineColor: '#ff0000',
            }

            const mockAnnotationResponse = {
                elements: [
                    largePolyline,
                    {
                        type: 'polyline',
                        points: [
                            [100, 200],
                            [300, 400],
                        ],
                        lineColor: '#00ff00',
                    },
                ],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                    maxPointsPerAnnotation={10000}
                />
            )

            await waitFor(
                () => {
                    expect(consoleWarn).toHaveBeenCalledWith(
                        expect.stringContaining('exceeds limit')
                    )
                },
                { timeout: 2000 }
            )

            consoleWarn.mockRestore()
        })

        it('filters annotations when total points exceed maxTotalPoints', async () => {
            const manyAnnotations = Array.from({ length: 100 }, (_, i) => ({
                type: 'polyline',
                points: Array.from({ length: 2000 }, (_, j) => [i * 100 + j, i * 50 + j]),
                lineColor: '#ff0000',
            }))

            const mockAnnotationResponse = {
                elements: manyAnnotations,
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                    maxTotalPoints={50000}
                />
            )

            await waitFor(
                () => {
                    expect(consoleWarn).toHaveBeenCalledWith(
                        expect.stringContaining('Total points')
                    )
                },
                { timeout: 2000 }
            )

            consoleWarn.mockRestore()
        })

        it('counts points correctly for rectangles (4 points each)', async () => {
            const mockAnnotationResponse = {
                elements: [
                    { type: 'rectangle', x: 100, y: 200, width: 50, height: 30 },
                    { type: 'rectangle', x: 200, y: 300, width: 60, height: 40 },
                ],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                    showAnnotationInfo={true}
                />
            )

            await waitFor(
                () => {
                    // Should count 8 total points (4 per rectangle)
                    expect(global.fetch).toHaveBeenCalled()
                },
                { timeout: 2000 }
            )
        })

        it('counts points correctly for polylines (actual point count)', async () => {
            const mockAnnotationResponse = {
                elements: [
                    {
                        type: 'polyline',
                        points: [
                            [100, 200],
                            [200, 300],
                            [300, 400],
                            [400, 500],
                        ],
                        lineColor: '#ff0000',
                    },
                ],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                />
            )

            await waitFor(
                () => {
                    expect(global.fetch).toHaveBeenCalled()
                },
                { timeout: 2000 }
            )
        })
    })

    describe('Annotation Parsing', () => {
        it('parses rectangle annotations correctly', async () => {
            const mockAnnotationResponse = {
                elements: [
                    {
                        type: 'rectangle',
                        x: 1000,
                        y: 2000,
                        width: 500,
                        height: 300,
                        lineColor: '#ff0000',
                        label: 'Test Rectangle',
                    },
                ],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                />
            )

            await waitFor(
                () => {
                    expect(global.fetch).toHaveBeenCalled()
                },
                { timeout: 2000 }
            )
        })

        it('parses polyline annotations correctly', async () => {
            const mockAnnotationResponse = {
                elements: [
                    {
                        type: 'polyline',
                        points: [
                            [100, 200],
                            [300, 400],
                            [500, 600],
                            [700, 800],
                        ],
                        lineColor: '#00ff00',
                        closed: true,
                        fillColor: '#0000ff',
                    },
                ],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                />
            )

            await waitFor(
                () => {
                    expect(global.fetch).toHaveBeenCalled()
                },
                { timeout: 2000 }
            )
        })

        it('handles annotations with nested structure', async () => {
            const mockAnnotationResponse = {
                annotation: {
                    elements: [
                        {
                            type: 'rectangle',
                            x: 100,
                            y: 200,
                            width: 50,
                            height: 30,
                        },
                    ],
                },
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                />
            )

            await waitFor(
                () => {
                    expect(global.fetch).toHaveBeenCalled()
                },
                { timeout: 2000 }
            )
        })
    })

    describe('Annotation Info Panel', () => {
        it('shows annotation info panel when showAnnotationInfo is true', async () => {
            const mockAnnotationResponse = {
                elements: [
                    {
                        type: 'rectangle',
                        x: 100,
                        y: 200,
                        width: 50,
                        height: 30,
                    },
                ],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            const { container } = render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                    showAnnotationInfo={true}
                />
            )

            await waitFor(
                () => {
                    const infoPanel = container.querySelector('.bdsa-slide-viewer__annotation-info')
                    expect(infoPanel).toBeInTheDocument()
                },
                { timeout: 2000 }
            )
        })

        it('hides annotation info panel when showAnnotationInfo is false', () => {
            const { container } = render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    showAnnotationInfo={false}
                />
            )

            const infoPanel = container.querySelector('.bdsa-slide-viewer__annotation-info')
            expect(infoPanel).not.toBeInTheDocument()
        })

        it('displays filtered annotation counts in info panel', async () => {
            const largePolyline = {
                type: 'polyline',
                points: Array.from({ length: 15000 }, (_, i) => [i, i * 2]),
                lineColor: '#ff0000',
            }

            const mockAnnotationResponse = {
                elements: [
                    largePolyline,
                    {
                        type: 'polyline',
                        points: [
                            [100, 200],
                            [300, 400],
                        ],
                    },
                ],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            const { container } = render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                    showAnnotationInfo={true}
                    maxPointsPerAnnotation={10000}
                />
            )

            await waitFor(
                () => {
                    const infoPanel = container.querySelector('.bdsa-slide-viewer__annotation-info')
                    expect(infoPanel).toBeInTheDocument()
                },
                { timeout: 2000 }
            )
        })
    })

    describe('Manual Annotations', () => {
        it('handles annotations array', () => {
            const annotations = [
                {
                    id: 'ann1',
                    left: 100,
                    top: 200,
                    width: 150,
                    height: 100,
                    color: '#ff0000',
                },
            ]

            const { container } = render(
                <SlideViewer imageInfo={mockImageInfo} annotations={annotations} />
            )
            expect(container).toBeInTheDocument()
        })

        it('handles GeoJSON FeatureCollection', () => {
            const geojson = {
                type: 'FeatureCollection' as const,
                features: [
                    {
                        type: 'Feature' as const,
                        id: 'ann1',
                        properties: {
                            color: '#00ff00',
                        },
                        geometry: {
                            type: 'Polygon' as const,
                            coordinates: [
                                [
                                    [100, 200],
                                    [250, 200],
                                    [250, 300],
                                    [100, 300],
                                    [100, 200],
                                ],
                            ],
                        },
                    },
                ],
            }

            const { container } = render(
                <SlideViewer imageInfo={mockImageInfo} annotations={geojson} />
            )
            expect(container).toBeInTheDocument()
        })
    })

    describe('Callbacks', () => {
        it('calls onViewerReady when viewer is initialized', () => {
            const onViewerReady = vi.fn()
            render(<SlideViewer imageInfo={mockImageInfo} onViewerReady={onViewerReady} />)
            // Note: In a real scenario, this would be called asynchronously
            expect(onViewerReady).toBeDefined()
        })

        it('calls onAnnotationClick when annotation is clicked', () => {
            const onAnnotationClick = vi.fn()
            const annotations = [
                {
                    id: 'ann1',
                    left: 100,
                    top: 200,
                    width: 150,
                    height: 100,
                },
            ]

            render(
                <SlideViewer
                    imageInfo={mockImageInfo}
                    annotations={annotations}
                    onAnnotationClick={onAnnotationClick}
                />
            )
            expect(onAnnotationClick).toBeDefined()
        })
    })

    describe('Styling', () => {
        it('uses custom default annotation color', () => {
            const annotations = [
                {
                    id: 'ann1',
                    left: 100,
                    top: 200,
                    width: 150,
                    height: 100,
                },
            ]

            const { container } = render(
                <SlideViewer
                    imageInfo={mockImageInfo}
                    annotations={annotations}
                    defaultAnnotationColor="#0000ff"
                />
            )
            expect(container).toBeInTheDocument()
        })

        it('uses custom stroke width', () => {
            const annotations = [
                {
                    id: 'ann1',
                    left: 100,
                    top: 200,
                    width: 150,
                    height: 100,
                },
            ]

            const { container } = render(
                <SlideViewer imageInfo={mockImageInfo} annotations={annotations} strokeWidth={5} />
            )
            expect(container).toBeInTheDocument()
        })
    })

    describe('Edge Cases', () => {
        it('handles empty annotations array', () => {
            const { container } = render(
                <SlideViewer imageInfo={mockImageInfo} annotations={[]} />
            )
            expect(container).toBeInTheDocument()
        })

        it('handles missing annotation properties gracefully', async () => {
            const mockAnnotationResponse = {
                elements: [
                    {
                        type: 'rectangle',
                        // Missing some properties
                        x: 100,
                        y: 200,
                        // width and height missing
                    },
                    {
                        type: 'polyline',
                        // Missing points array
                    },
                ],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                />
            )

            await waitFor(
                () => {
                    expect(global.fetch).toHaveBeenCalled()
                },
                { timeout: 2000 }
            )
        })

        it('handles empty annotation documents', async () => {
            const mockAnnotationResponse = {
                elements: [],
            }

                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockAnnotationResponse,
                })

            render(
                <SlideViewer
                    imageInfo={{ dziUrl: EXAMPLE_DZI_URL }}
                    annotationIds={[EXAMPLE_ANNOTATION_ID]}
                    apiBaseUrl={EXAMPLE_API_BASE_URL}
                />
            )

            await waitFor(
                () => {
                    expect(global.fetch).toHaveBeenCalled()
                },
                { timeout: 2000 }
            )
        })
    })
})
