import type { Meta, StoryObj } from '@storybook/react'
import { SlideViewer } from './SlideViewer'
import type { SlideImageInfo } from './SlideViewer'

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
