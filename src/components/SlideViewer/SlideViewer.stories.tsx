import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
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
          'A slide viewer that integrates OpenSeadragon with Paper.js annotations for DSA slides and overlays.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    /** Storybook iframes often start with 0 intersection ratio; initialize OSD immediately. */
    disableVisibilityCheck: true,
  },
  argTypes: {
    imageInfo: {
      description: 'Image information for the slide to display',
    },
    annotations: {
      description: 'Annotations to render on the slide (rectangles or GeoJSON)',
    },
    annotationIds: {
      description: 'Annotation IDs to fetch from the DSA API',
    },
    apiBaseUrl: {
      description: 'Base URL for DSA API (e.g. http://host:8080/api/v1)',
    },
    onViewerReady: {
      action: 'viewer-ready',
      description: 'Callback when the OpenSeadragon viewer is ready',
    },
    onToolkitReady: {
      action: 'toolkit-ready',
      description: 'Callback when the annotation toolkit is ready',
    },
    onAnnotationClick: {
      action: 'annotation-clicked',
      description: 'Callback when an annotation is clicked',
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
      description: 'Show the annotation info panel',
    },
    showAnnotationControls: {
      control: 'boolean',
      description: 'Show annotation controls (e.g. opacity) in the sidebar',
    },
    defaultAnnotationOpacity: {
      control: { type: 'range', min: 0, max: 1, step: 0.01 },
      description: 'Default opacity for annotations (0–1)',
    },
    annotationInfoConfig: {
      description: 'Customize the annotation info panel',
    },
    maxPointsPerAnnotation: {
      control: { type: 'number', min: 100, max: 100000, step: 100 },
      description: 'Max points per annotation element',
    },
    maxTotalPoints: {
      control: { type: 'number', min: 1000, max: 1000000, step: 1000 },
      description: 'Max total points across annotations',
    },
  },
} satisfies Meta<typeof SlideViewer>

export default meta
type Story = StoryObj<typeof meta>

/** Example DZI on a public demo server (requires network). */
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
        story:
          'Fetches annotations from the DSA API. GeoJSON is loaded from `/annotation/{id}/geojson` for each id.',
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
        story: 'Annotation info panel for loaded documents. Toggle `showAnnotationInfo` in controls.',
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
        story: 'Custom header, sections, and property formatters for the info panel.',
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
        story: 'Customize OpenSeadragon controls, zoom behavior, and auto-hide.',
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
        story: 'Minimal chrome; pan/zoom still work via mouse and touch.',
      },
    },
  },
}

export const WithCustomFetch: Story = {
  args: {
    imageInfo: exampleImageInfo,
    annotationIds: ['6903df8ed26a6d93de19a9b4'],
    apiBaseUrl: exampleApiBaseUrl,
    fetchFn: async (url: string, options?: RequestInit) => {
      const headers = new Headers(options?.headers)
      return fetch(url, {
        ...options,
        headers,
      })
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Use `fetchFn` or `apiHeaders` for auth and custom request behavior.',
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
        story: 'Sidebar with opacity control and annotation info.',
      },
    },
  },
}

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
            <div style={{ fontWeight: 'bold', marginRight: '8px' }}>Viewport</div>
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
              Normalized (0–1) relative to full image
            </div>
          </div>
        )}
        <div style={{ flex: 1, position: 'relative' }}>
          <SlideViewer
            {...args}
            debug
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
        story:
          '`onViewportChange` with normalized bounds. Pan and zoom to update the readout.',
      },
    },
  },
}

export const ZoomLevel: Story = {
  render: (args) => {
    const [zoom, setZoom] = useState<number | null>(null)

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
            <div style={{ fontWeight: 'bold', marginRight: '8px' }}>Zoom</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{(zoom * 100).toFixed(1)}%</div>
            <div style={{ fontSize: '14px', opacity: 0.8 }}>({zoom.toFixed(4)}x)</div>
            <div style={{ fontSize: '12px', opacity: 0.6, marginLeft: 'auto' }}>
              {zoom < 1 ? 'Zoomed out' : zoom > 2 ? 'Zoomed in' : 'Normal view'}
            </div>
          </div>
        )}
        <div style={{ flex: 1, position: 'relative' }}>
          <SlideViewer
            {...args}
            debug
            onViewportChange={(bounds) => {
              console.log('Viewport changed:', bounds)
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
        story: 'Live zoom from `onViewportChange` (`bounds.zoom`).',
      },
    },
  },
}

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
              <span style={{ fontWeight: 'bold' }}>Viewport</span>
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
              <span style={{ fontWeight: 'bold' }}>Zoom</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {(viewport.zoom * 100).toFixed(1)}%
              </span>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>({viewport.zoom.toFixed(4)}x)</span>
            </div>
          </div>
        )}
        <div style={{ flex: 1, position: 'relative' }}>
          <SlideViewer
            {...args}
            debug
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
        story: 'Combined viewport and zoom HUD driven by `onViewportChange`.',
      },
    },
  },
}

export const WithOverlayTileSources: Story = {
  render: (args) => {
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
      const randomWidth = 0.1 + Math.random() * 0.2
      const randomHeight = 0.1 + Math.random() * 0.2
      const maxX = Math.max(0, 1.0 - randomWidth)
      const maxY = Math.max(0, 1.0 - randomHeight)
      const randomX = Math.random() * maxX
      const randomY = Math.random() * maxY
      const randomColor = colorOptions[Math.floor(Math.random() * colorOptions.length)]
      const randomOpacity = 0.3 + Math.random() * 0.5

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
      setOverlays(overlays.map((o) => (o.id === id ? { ...o, opacity } : o)))
    }

    const updateOverlayPosition = (id: string | number, x: number, y: number) => {
      setOverlays(
        overlays.map((o) => {
          if (o.id !== id) return o
          const width = o.width ?? 0.2
          const height = o.height ?? 0.2
          const maxX = Math.max(0, 1.0 - width)
          const maxY = Math.max(0, 1.0 - height)
          return {
            ...o,
            x: Math.max(0, Math.min(maxX, x)),
            y: Math.max(0, Math.min(maxY, y)),
          }
        }),
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
          <div
            style={{
              fontWeight: 'bold',
              marginBottom: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Overlay tile sources</span>
            <button
              type="button"
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
              Add overlay
            </button>
          </div>

          {overlays.length === 0 ? (
            <div style={{ opacity: 0.6, fontStyle: 'italic' }}>
              No overlays yet. Use &quot;Add overlay&quot; to create a semi-transparent patch.
            </div>
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
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{overlay.id}</div>
                    <button
                      type="button"
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
                        <label style={{ opacity: 0.8, minWidth: '60px' }} htmlFor={`op-${overlay.id}`}>
                          Opacity
                        </label>
                        <input
                          id={`op-${overlay.id}`}
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={overlay.opacity ?? 1}
                          onChange={(e) => {
                            updateOverlayOpacity(overlay.id, parseFloat(e.target.value))
                          }}
                          style={{ flex: 1, maxWidth: '120px' }}
                        />
                        <span style={{ minWidth: '40px' }}>{((overlay.opacity ?? 1) * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: '200px' }}>
                        <label style={{ opacity: 0.8, minWidth: '20px' }} htmlFor={`x-${overlay.id}`}>
                          X
                        </label>
                        <input
                          id={`x-${overlay.id}`}
                          type="range"
                          min={0}
                          max={Math.max(0, 1.0 - (overlay.width ?? 0.2))}
                          step={0.01}
                          value={overlay.x ?? 0}
                          onChange={(e) => {
                            updateOverlayPosition(overlay.id, parseFloat(e.target.value), overlay.y ?? 0)
                          }}
                          style={{ flex: 1, maxWidth: '120px' }}
                        />
                        <span style={{ minWidth: '40px' }}>{(overlay.x ?? 0).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: '200px' }}>
                        <label style={{ opacity: 0.8, minWidth: '20px' }} htmlFor={`y-${overlay.id}`}>
                          Y
                        </label>
                        <input
                          id={`y-${overlay.id}`}
                          type="range"
                          min={0}
                          max={Math.max(0, 1.0 - (overlay.height ?? 0.2))}
                          step={0.01}
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
        story:
          'Dynamic `overlayTileSources`: base64 patches on the slide with position and opacity controls.',
      },
    },
  },
}
