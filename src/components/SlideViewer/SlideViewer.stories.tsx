import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { SlideViewer } from './SlideViewer'
import type { SlideImageInfo, ViewportBounds, OverlayTileSource } from './SlideViewer'

const meta = {
    title: 'Components/SlideViewer',
    component: SlideViewer,
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'A slide viewer component that integrates OpenSeadragon with Paper.js annotations for viewing Digital Slide Archive images with annotation overlays.',
            },
        },
    },
    tags: ['autodocs'],
    argTypes: {
        imageInfo: {
            description: 'Image information for the slide to display',
        },
        annotations: {
            description: 'Annotations to render on the slide (array of rectangles or GeoJSON)',
        },
        annotationIds: {
            description: 'Annotation IDs to fetch from DSA API',
        },
        apiBaseUrl: {
            description: 'Base URL for DSA API (e.g., http://bdsa.pathology.emory.edu:8080/api/v1)',
        },
        onViewerReady: {
            action: 'viewer-ready',
            description: 'Callback when viewer is ready',
        },
        onAnnotationClick: {
            action: 'annotation-clicked',
            description: 'Callback when annotation is clicked',
        },
        defaultAnnotationColor: {
            control: 'color',
            description: 'Default stroke color for annotations',
        },
        strokeWidth: {
            control: { type: 'number', min: 1, max: 10 },
            description: 'Stroke width for annotations',
        },
        showAnnotationInfo: {
            control: 'boolean',
            description: 'Display information panel about loaded annotation documents',
        },
        showAnnotationControls: {
            control: 'boolean',
            description: 'Show annotation controls panel (opacity slider) in sidebar',
        },
        defaultAnnotationOpacity: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
            description: 'Default opacity for all annotations (0-1)',
        },
        annotationInfoConfig: {
            description: 'Configuration for customizing the annotation info panel display',
        },
        maxPointsPerAnnotation: {
            control: { type: 'number', min: 100, max: 100000, step: 100 },
            description: 'Maximum points allowed per annotation element (default: 10000). Annotations exceeding this will be skipped.',
        },
        maxTotalPoints: {
            control: { type: 'number', min: 1000, max: 1000000, step: 1000 },
            description: 'Maximum total points across all annotations (default: 100000). If exceeded, largest annotations are filtered.',
        },
    },
} satisfies Meta<typeof SlideViewer>

export default meta
type Story = StoryObj<typeof meta>

// Example image info using DZI URL - much simpler!
// OpenSeadragon will automatically fetch all metadata from the DZI descriptor
const exampleImageInfo: SlideImageInfo = {
    dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/6903df8dd26a6d93de19a9b2/tiles/dzi.dzi',
}

const exampleApiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1'

export const Basic: Story = {
    args: {
        imageInfo: exampleImageInfo,
        annotations: [],
    },
}

export const WithAnnotations: Story = {
    args: {
        imageInfo: exampleImageInfo,
        annotations: [
            {
                id: 'annotation-1',
                left: 5000,
                top: 6000,
                width: 2000,
                height: 1500,
                color: '#ff0000',
                label: 'Region of Interest 1',
            },
            {
                id: 'annotation-2',
                left: 15000,
                top: 8000,
                width: 3000,
                height: 2000,
                color: '#00ff00',
                label: 'Region of Interest 2',
            },
            {
                id: 'annotation-3',
                left: 25000,
                top: 12000,
                width: 1500,
                height: 1500,
                color: '#0000ff',
                label: 'Region of Interest 3',
            },
        ],
    },
}

export const WithAnnotationIds: Story = {
    args: {
        imageInfo: exampleImageInfo,
        annotationIds: ['6903df8ed26a6d93de19a9b4'],
        apiBaseUrl: exampleApiBaseUrl,
    },
    parameters: {
        docs: {
            description: {
                story: 'Fetches annotations from DSA API using annotation IDs. The component will fetch GeoJSON from /annotation/{id}/geojson for each ID.',
            },
        },
    },
}

export const WithGeoJSON: Story = {
    args: {
        imageInfo: exampleImageInfo,
        annotations: {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    id: 'geo-annotation-1',
                    properties: {
                        color: '#ff00ff',
                        label: 'GeoJSON Annotation 1',
                        group: 'group-a',
                    },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [5000, 6000],
                                [7000, 6000],
                                [7000, 7500],
                                [5000, 7500],
                                [5000, 6000],
                            ],
                        ],
                    },
                },
                {
                    type: 'Feature',
                    id: 'geo-annotation-2',
                    properties: {
                        color: '#ffff00',
                        label: 'GeoJSON Annotation 2',
                        group: 'group-b',
                    },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [15000, 8000],
                                [18000, 8000],
                                [18000, 10000],
                                [15000, 10000],
                                [15000, 8000],
                            ],
                        ],
                    },
                },
            ],
        },
    },
}

export const CustomColors: Story = {
    args: {
        imageInfo: exampleImageInfo,
        annotations: [
            {
                id: 'ann-1',
                left: 5000,
                top: 6000,
                width: 2000,
                height: 1500,
            },
            {
                id: 'ann-2',
                left: 15000,
                top: 8000,
                width: 3000,
                height: 2000,
                color: '#00ffff',
            },
        ],
        defaultAnnotationColor: '#ff8800',
        strokeWidth: 3,
    },
}

export const WithCallbacks: Story = {
    args: {
        imageInfo: exampleImageInfo,
        annotations: [
            {
                id: 'clickable-1',
                left: 5000,
                top: 6000,
                width: 2000,
                height: 1500,
                color: '#ff0000',
                label: 'Click me!',
            },
            {
                id: 'clickable-2',
                left: 15000,
                top: 8000,
                width: 3000,
                height: 2000,
                color: '#00ff00',
                label: 'Or me!',
            },
        ],
        onViewerReady: (viewer) => {
            console.log('Viewer ready:', viewer)
        },
        onAnnotationClick: (annotation) => {
            console.log('Annotation clicked:', annotation)
            alert(`Clicked annotation: ${annotation.label || annotation.id}`)
        },
    },
}

export const WithPanel: Story = {
    args: {
        imageInfo: exampleImageInfo,
        annotationIds: ['6903df8ed26a6d93de19a9b4'],
        apiBaseUrl: exampleApiBaseUrl,
        showAnnotationInfo: true,
    },
    parameters: {
        docs: {
            description: {
                story: 'Shows the annotation info panel displaying information about loaded annotation documents. Toggle the `showAnnotationInfo` control to show/hide the panel.',
            },
        },
    },
}

export const WithCustomPanelConfig: Story = {
    args: {
        imageInfo: exampleImageInfo,
        annotationIds: ['6903df8ed26a6d93de19a9b4'],
        apiBaseUrl: exampleApiBaseUrl,
        showAnnotationInfo: true,
        annotationInfoConfig: {
            headerText: 'Custom Annotation Info',
            showFetchedSection: true,
            showProvidedSection: false,
            showTotalSection: true,
            documentProperties: [
                { key: 'id', label: 'Document ID', formatter: (value) => `Doc: ${String(value)}` },
                { key: 'elementCount', label: 'Annotation Count', formatter: (value) => `${value} items` },
            ],
        },
    },
    parameters: {
        docs: {
            description: {
                story: 'Demonstrates customizing the annotation info panel with a custom header, hidden sections, and custom property formatters.',
            },
        },
    },
}

export const CustomNavigationControls: Story = {
    args: {
        imageInfo: exampleImageInfo,
        osdOptions: {
            showNavigator: true,
            showZoomControl: true,
            showHomeControl: true,
            showFullPageControl: true,
            showRotationControl: false,
            autoHideControls: true,
            controlsFadeDelay: 2000,
            controlsFadeLength: 1500,
            zoomPerClick: 2.0,
            zoomPerScroll: 1.2,
            minZoomLevel: 0.5,
            maxZoomLevel: 10,
        },
    },
    parameters: {
        docs: {
            description: {
                story: 'Custom OpenSeadragon navigation controls. You can show/hide various controls, adjust zoom behavior, and customize auto-hide settings.',
            },
        },
    },
}

export const MinimalControls: Story = {
    args: {
        imageInfo: exampleImageInfo,
        osdOptions: {
            showNavigator: false,
            showZoomControl: false,
            showHomeControl: false,
            showFullPageControl: false,
            showRotationControl: false,
            autoHideControls: false,
            // Allow panning and zooming with mouse/touch
            gestureSettingsMouse: {
                clickToZoom: true,
                dblClickToZoom: true,
                pinchToZoom: true,
                flickEnabled: true,
            },
        },
    },
    parameters: {
        docs: {
            description: {
                story: 'Minimal UI with all navigation controls hidden. Users can still interact via mouse/touch gestures.',
            },
        },
    },
}

export const WithCustomFetch: Story = {
    args: {
        imageInfo: exampleImageInfo,
        annotationIds: ['6903df8ed26a6d93de19a9b4'],
        apiBaseUrl: exampleApiBaseUrl,
        // Example: Custom fetch function for authentication
        fetchFn: async (url: string, options?: RequestInit) => {
            // In a real app, you would add auth headers here
            const headers = new Headers(options?.headers)
            // headers.set('Authorization', 'Bearer YOUR_TOKEN_HERE')
            // headers.set('X-API-Key', 'YOUR_API_KEY')
            
            return fetch(url, {
                ...options,
                headers,
            })
        },
        // Alternative: Just pass headers directly
        // apiHeaders: {
        //     'Authorization': 'Bearer YOUR_TOKEN_HERE',
        //     'X-API-Key': 'YOUR_API_KEY',
        // },
    },
    parameters: {
        docs: {
            description: {
                story: 'Example of using custom fetch function or headers for authentication. Use `fetchFn` for a custom fetch implementation, or `apiHeaders` for simple header injection.',
            },
        },
    },
}

export const WithAnnotationControls: Story = {
    args: {
        imageInfo: exampleImageInfo,
        annotationIds: ['6903df8ed26a6d93de19a9b4'],
        apiBaseUrl: exampleApiBaseUrl,
        showAnnotationControls: true,
        showAnnotationInfo: true,
        defaultAnnotationOpacity: 0.7,
    },
    parameters: {
        docs: {
            description: {
                story: 'Shows both annotation controls (opacity slider) and annotation info panel in the sidebar. Use the opacity slider to adjust visibility of all annotations.',
            },
        },
    },
}

/**
 * Story demonstrating the viewport coordinates callback.
 * Pan and zoom the viewer to see the coordinates update in real-time.
 */
export const ViewportCoordinates: Story = {
    render: (args) => {
        const [viewport, setViewport] = useState<ViewportBounds | null>(null)

        return (
            <div style={{ width: '100%', height: '800px', display: 'flex', flexDirection: 'column' }}>
                {viewport && (
                    <div
                        style={{
                            background: '#1e1e1e',
                            color: 'white',
                            padding: '12px 16px',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            borderBottom: '1px solid #333',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '24px',
                        }}
                    >
                        <div style={{ fontWeight: 'bold', marginRight: '8px' }}>📍 Viewport:</div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <span style={{ opacity: 0.8 }}>X:</span>
                            <span>{viewport.x.toFixed(4)}</span>
                            <span style={{ opacity: 0.8 }}>Y:</span>
                            <span>{viewport.y.toFixed(4)}</span>
                            <span style={{ opacity: 0.8 }}>W:</span>
                            <span>{viewport.width.toFixed(4)}</span>
                            <span style={{ opacity: 0.8 }}>H:</span>
                            <span>{viewport.height.toFixed(4)}</span>
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.6, marginLeft: 'auto' }}>
                            Normalized (0-1) relative to full image
                        </div>
                    </div>
                )}
                <div style={{ flex: 1, position: 'relative' }}>
                    <SlideViewer
                        {...args}
                        debug={true}
                        onViewportChange={(bounds) => {
                            console.log('Viewport changed:', bounds)
                            setViewport(bounds)
                        }}
                    />
                </div>
            </div>
        )
    },
    args: {
        imageInfo: exampleImageInfo,
    },
    parameters: {
        docs: {
            description: {
                story: 'Demonstrates the `onViewportChange` callback showing viewport coordinates in real-time. Pan and zoom the viewer to see the coordinates update. Coordinates are normalized (0-1) relative to the full image size.',
            },
        },
    },
}

/**
 * Story demonstrating the zoom level callback.
 * Zoom in and out to see the zoom level update in real-time.
 */
export const ZoomLevel: Story = {
    render: (args) => {
        const [zoom, setZoom] = useState<number | null>(null)
        const [viewport, setViewport] = useState<ViewportBounds | null>(null)

        return (
            <div style={{ width: '100%', height: '800px', display: 'flex', flexDirection: 'column' }}>
                {zoom !== null && (
                    <div
                        style={{
                            background: '#1e1e1e',
                            color: 'white',
                            padding: '12px 16px',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            borderBottom: '1px solid #333',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '24px',
                        }}
                    >
                        <div style={{ fontWeight: 'bold', marginRight: '8px' }}>🔍 Zoom:</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                            {(zoom * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '14px', opacity: 0.8 }}>
                            ({zoom.toFixed(4)}x)
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.6, marginLeft: 'auto' }}>
                            {zoom < 1 ? 'Zoomed Out' : zoom > 2 ? 'Zoomed In' : 'Normal View'}
                        </div>
                    </div>
                )}
                <div style={{ flex: 1, position: 'relative' }}>
                    <SlideViewer
                        {...args}
                        debug={true}
                        onViewportChange={(bounds) => {
                            console.log('Viewport changed:', bounds)
                            setViewport(bounds)
                            setZoom(bounds.zoom)
                        }}
                    />
                </div>
            </div>
        )
    },
    args: {
        imageInfo: exampleImageInfo,
    },
    parameters: {
        docs: {
            description: {
                story: 'Demonstrates the `onViewportChange` callback showing zoom level in real-time. Zoom in and out using mouse wheel, pinch gestures, or zoom controls to see the zoom level update. The zoom value is shown as both percentage and multiplier.',
            },
        },
    },
}

/**
 * Story demonstrating both viewport coordinates and zoom level together.
 * Pan and zoom to see both values update simultaneously.
 */
export const ViewportAndZoom: Story = {
    render: (args) => {
        const [viewport, setViewport] = useState<ViewportBounds | null>(null)

        return (
            <div style={{ width: '100%', height: '800px', display: 'flex', flexDirection: 'column' }}>
                {viewport && (
                    <div
                        style={{
                            background: '#1e1e1e',
                            color: 'white',
                            padding: '12px 16px',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            borderBottom: '1px solid #333',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '32px',
                            flexWrap: 'wrap',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold' }}>📍 Viewport:</span>
                            <span style={{ opacity: 0.8 }}>X:</span>
                            <span>{viewport.x.toFixed(4)}</span>
                            <span style={{ opacity: 0.8 }}>Y:</span>
                            <span>{viewport.y.toFixed(4)}</span>
                            <span style={{ opacity: 0.8 }}>W:</span>
                            <span>{viewport.width.toFixed(4)}</span>
                            <span style={{ opacity: 0.8 }}>H:</span>
                            <span>{viewport.height.toFixed(4)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold' }}>🔍 Zoom:</span>
                            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                {(viewport.zoom * 100).toFixed(1)}%
                            </span>
                            <span style={{ fontSize: '12px', opacity: 0.8 }}>
                                ({viewport.zoom.toFixed(4)}x)
                            </span>
                        </div>
                    </div>
                )}
                <div style={{ flex: 1, position: 'relative' }}>
                    <SlideViewer
                        {...args}
                        debug={true}
                        onViewportChange={(bounds) => {
                            console.log('Viewport changed:', bounds)
                            setViewport(bounds)
                        }}
                    />
                </div>
            </div>
        )
    },
    args: {
        imageInfo: exampleImageInfo,
    },
    parameters: {
        docs: {
            description: {
                story: 'Combined viewport coordinates and zoom level display. Pan and zoom the viewer to see both values update in real-time. This demonstrates how you can use the `onViewportChange` callback to create custom UI widgets that track the viewer state.',
            },
        },
    },
}

/**
 * Story demonstrating overlay tile sources (dynamically adding images on top of the base image).
 * This example shows how to add a base64 encoded image overlay with position and opacity control.
 */
export const WithOverlayTileSources: Story = {
    render: (args) => {
        // Create a simple base64 test image (red square with transparency)
        const createTestImage = (color: string = 'red'): string => {
            const canvas = document.createElement('canvas')
            canvas.width = 200
            canvas.height = 200
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            if (ctx) {
                const colors: Record<string, string> = {
                    red: 'rgba(255, 0, 0, 0.5)',
                    blue: 'rgba(0, 0, 255, 0.5)',
                    green: 'rgba(0, 255, 0, 0.5)',
                    yellow: 'rgba(255, 255, 0, 0.5)',
                    purple: 'rgba(255, 0, 255, 0.5)',
                }
                ctx.fillStyle = colors[color] || colors.red
                ctx.fillRect(0, 0, 200, 200)
                ctx.strokeStyle = colors[color]?.replace('0.5', '1') || 'rgba(255, 0, 0, 1)'
                ctx.lineWidth = 4
                ctx.strokeRect(0, 0, 200, 200)
            }
            return canvas.toDataURL('image/png')
        }

        const [overlays, setOverlays] = useState<OverlayTileSource[]>([])
        const [nextId, setNextId] = useState(1)

        const colorOptions = ['red', 'blue', 'green', 'yellow', 'purple']

        const addOverlay = () => {
            // Randomize size first, then constrain position to ensure overlay stays within bounds
            const randomWidth = 0.1 + Math.random() * 0.2 // 0.1 to 0.3
            const randomHeight = 0.1 + Math.random() * 0.2 // 0.1 to 0.3
            
            // Constrain position so overlay doesn't extend beyond viewport (0-1)
            // x + width <= 1.0, so x <= 1.0 - width
            // y + height <= 1.0, so y <= 1.0 - height
            const maxX = Math.max(0, 1.0 - randomWidth)
            const maxY = Math.max(0, 1.0 - randomHeight)
            const randomX = Math.random() * maxX
            const randomY = Math.random() * maxY
            
            const randomColor = colorOptions[Math.floor(Math.random() * colorOptions.length)]
            const randomOpacity = 0.3 + Math.random() * 0.5 // 0.3 to 0.8

            const newOverlay: OverlayTileSource = {
                id: `overlay-${nextId}`,
                tileSource: createTestImage(randomColor),
                x: randomX,
                y: randomY,
                width: randomWidth,
                height: randomHeight,
                opacity: randomOpacity,
            }

            setOverlays([...overlays, newOverlay])
            setNextId(nextId + 1)
        }

        const removeOverlay = (id: string | number) => {
            setOverlays(overlays.filter((o) => o.id !== id))
        }

        const updateOverlayOpacity = (id: string | number, opacity: number) => {
            setOverlays(
                overlays.map((o) => (o.id === id ? { ...o, opacity } : o))
            )
        }

        const updateOverlayPosition = (id: string | number, x: number, y: number) => {
            setOverlays(
                overlays.map((o) => {
                    if (o.id !== id) return o
                    // Constrain position to ensure overlay stays within viewport
                    const width = o.width ?? 0.2
                    const height = o.height ?? 0.2
                    const maxX = Math.max(0, 1.0 - width)
                    const maxY = Math.max(0, 1.0 - height)
                    return {
                        ...o,
                        x: Math.max(0, Math.min(maxX, x)),
                        y: Math.max(0, Math.min(maxY, y)),
                    }
                })
            )
        }

        return (
            <div style={{ width: '100%', height: '800px', display: 'flex', flexDirection: 'column' }}>
                <div
                    style={{
                        background: '#1e1e1e',
                        color: 'white',
                        padding: '12px 16px',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        borderBottom: '1px solid #333',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                    }}
                >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Overlay Tile Source Controls</span>
                        <button
                            onClick={addOverlay}
                            style={{
                                padding: '6px 16px',
                                background: '#4a9eff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                            }}
                        >
                            Add Overlay
                        </button>
                    </div>

                    {overlays.length === 0 ? (
                        <div style={{ opacity: 0.6, fontStyle: 'italic' }}>No overlays added. Click "Add Overlay" to add one.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {overlays.map((overlay) => (
                                <div
                                    key={overlay.id}
                                    style={{
                                        background: '#2a2a2a',
                                        padding: '12px',
                                        borderRadius: '4px',
                                        border: '1px solid #444',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ fontWeight: 'bold' }}>{overlay.id}</div>
                                        <button
                                            onClick={() => removeOverlay(overlay.id)}
                                            style={{
                                                padding: '4px 12px',
                                                background: '#d32f2f',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: '200px' }}>
                                                <label style={{ opacity: 0.8, minWidth: '60px' }}>Opacity:</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.01"
                                                    value={overlay.opacity ?? 1}
                                                    onChange={(e) => {
                                                        updateOverlayOpacity(overlay.id, parseFloat(e.target.value))
                                                    }}
                                                    style={{ flex: 1, maxWidth: '120px' }}
                                                />
                                                <span style={{ minWidth: '40px' }}>{((overlay.opacity ?? 1) * 100).toFixed(0)}%</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: '200px' }}>
                                                <label style={{ opacity: 0.8, minWidth: '20px' }}>X:</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max={Math.max(0, 1.0 - (overlay.width ?? 0.2))}
                                                    step="0.01"
                                                    value={overlay.x ?? 0}
                                                    onChange={(e) => {
                                                        updateOverlayPosition(overlay.id, parseFloat(e.target.value), overlay.y ?? 0)
                                                    }}
                                                    style={{ flex: 1, maxWidth: '120px' }}
                                                />
                                                <span style={{ minWidth: '40px' }}>{(overlay.x ?? 0).toFixed(2)}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: '200px' }}>
                                                <label style={{ opacity: 0.8, minWidth: '20px' }}>Y:</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max={Math.max(0, 1.0 - (overlay.height ?? 0.2))}
                                                    step="0.01"
                                                    value={overlay.y ?? 0}
                                                    onChange={(e) => {
                                                        updateOverlayPosition(overlay.id, overlay.x ?? 0, parseFloat(e.target.value))
                                                    }}
                                                    style={{ flex: 1, maxWidth: '120px' }}
                                                />
                                                <span style={{ minWidth: '40px' }}>{(overlay.y ?? 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '11px', opacity: 0.7 }}>
                                            Size: {((overlay.width ?? 0) * 100).toFixed(0)}% × {((overlay.height ?? 0) * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                    <SlideViewer {...args} overlayTileSources={overlays} />
                </div>
            </div>
        )
    },
    args: {
        imageInfo: exampleImageInfo,
    },
    parameters: {
        docs: {
            description: {
                story: 'Demonstrates dynamically adding and removing overlay tile sources on top of the base image. The overlay can be a base64 encoded image, DZI URL, or simple image URL. You can control position (x, y), size (width, height), opacity, rotation, and composite operation. In this example, you can add multiple overlays with randomized positions and colors, and manage each one individually by adjusting opacity and position, or removing them.',
            },
        },
    },
}
