import type { Meta, StoryObj } from '@storybook/react-vite'
import type { FeatureCollection } from 'geojson'
import type { SlideImageInfo } from '../SlideViewer/SlideViewer.types'
import { DsaAuthManager } from '../DsaAuthManager/DsaAuthManager'
import { AnnotationEditor } from './AnnotationEditor'
import type { AnnotationEditorConfig } from './AnnotationEditor.types'
import {
    simulatedYoloPositiveNegative,
    simulatedYoloTauPredictions,
    paperAnnotatorEditorConfig,
    yoloClassFromPropertiesImportOptions,
} from './yoloSimulatedGeoJson'

const exampleApiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1'

const exampleImageInfo: SlideImageInfo = {
    dziUrl: `${exampleApiBaseUrl}/item/6903df8dd26a6d93de19a9b2/tiles/dzi.dzi`,
}

const exampleConfig: AnnotationEditorConfig = {
    annotationDocumentName: 'storybook-demo',
    annotationDescription: 'Storybook demo document',
    annotationTypes: [
        {
            name: 'Positive',
            color: '#c62828',
            strokeWidth: 2,
            key: '1',
            defaultWidth: 96,
            defaultHeight: 72,
        },
        {
            name: 'Negative',
            color: '#1565c0',
            strokeWidth: 2,
            key: '2',
            defaultWidth: 96,
            defaultHeight: 72,
        },
    ],
    roiSettings: {
        label: 'roi',
        color: '#ef6c00',
        strokeWidth: 2,
        fillOpacity: 0.08,
        width: 900,
        height: 700,
    },
    hotkeys: {
        reviewNext: 'M',
        reviewPrevious: 'N',
        insertBox: 't',
    },
}

/** Two axis-aligned boxes in image space (YOLO-style export) */
const yoloStyleSample: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            properties: { class_name: 'Positive', confidence: 0.91 },
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [1200, 800],
                        [1800, 800],
                        [1800, 1400],
                        [1200, 1400],
                        [1200, 800],
                    ],
                ],
            },
        },
        {
            type: 'Feature',
            properties: { class_name: 'Negative' },
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [2200, 2000],
                        [2800, 2000],
                        [2800, 2600],
                        [2200, 2600],
                        [2200, 2000],
                    ],
                ],
            },
        },
    ],
}

const meta = {
    title: 'Components/AnnotationEditor',
    component: AnnotationEditor,
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Protocol-driven ROI and label editing on top of SlideViewer. Requires network access to the DSA host in `imageInfo` / `apiBaseUrl`. Use **WithDsaAuthManager** for the standard login + annotate flow, or **WithDsaAuthManagerWithoutShowInfo** to hide the toolbar "Show Info" button. Storybook manager shortcuts are disabled in `.storybook/manager.ts` so Q/W, D/F/G/H, and review keys are not stolen by the Storybook UI.',
            },
        },
    },
    tags: ['autodocs'],
    args: {
        disableVisibilityCheck: true,
        showInfoBar: true,
        showInfoControl: true,
    },
    argTypes: {
        imageInfo: { description: 'Slide source (e.g. `dziUrl` with `/item/{id}/tiles/dzi.dzi`)' },
        config: { description: 'Annotation protocol: document name, types, ROI styling, hotkeys' },
        apiBaseUrl: {
            control: 'text',
            description: 'Optional override; defaults from `dsaAuthStore` when omitted',
        },
        showInfoBar: {
            control: 'boolean',
            description: 'Show the SlideViewer info bar (coords, zoom, preset zoom buttons). Default: true.',
        },
        showInfoControl: {
            control: 'boolean',
            description: 'Show the toolbar "Show Info" hover-tooltip toggle. Default: true.',
        },
        defaultShowInfo: {
            control: 'boolean',
            description: 'Enable hover tooltips on load (no need to click Show Info). Default: false.',
        },
        hoverInfoMode: {
            control: 'select',
            options: ['full', 'cleanup'],
            description: 'Tooltip layout: full geometry table or cleanup (class, label, confidence).',
        },
        disableVisibilityCheck: {
            control: 'boolean',
            description: 'Set true in Storybook so OpenSeadragon initializes inside the iframe',
        },
    },
} satisfies Meta<typeof AnnotationEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    args: {
        imageInfo: exampleImageInfo,
        config: exampleConfig,
        apiBaseUrl: exampleApiBaseUrl,
    },
    render: (args) => (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <AnnotationEditor {...args} />
        </div>
    ),
}

export const WithDsaAuthManager: Story = {
    args: {
        imageInfo: exampleImageInfo,
        config: exampleConfig,
        apiBaseUrl: exampleApiBaseUrl,
        showInfoControl: true,
    },
    render: (args) => (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <DsaAuthManager />
            <div style={{ flex: 1, minHeight: 0 }}>
                <AnnotationEditor {...args} />
            </div>
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story:
                    'Use the auth bar to set the same server as in `imageInfo` / `apiBaseUrl`, then log in. The toolbar includes the "Show Info" toggle by default.',
            },
        },
    },
}

export const WithDsaAuthManagerWithoutShowInfo: Story = {
    args: {
        imageInfo: exampleImageInfo,
        config: exampleConfig,
        apiBaseUrl: exampleApiBaseUrl,
        showInfoControl: false,
    },
    render: (args) => (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <DsaAuthManager />
            <div style={{ flex: 1, minHeight: 0 }}>
                <AnnotationEditor {...args} />
            </div>
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story:
                    'Same as **WithDsaAuthManager** but the toolbar "Show Info" button is hidden (`showInfoControl={false}`).',
            },
        },
    },
}

const yoloGeoJsonImportOptions = yoloClassFromPropertiesImportOptions

const yoloReviewEditorArgs = {
    imageInfo: exampleImageInfo,
    config: exampleConfig,
    apiBaseUrl: exampleApiBaseUrl,
    initialGeoJson: simulatedYoloPositiveNegative,
    geoJsonImportOptions: yoloGeoJsonImportOptions,
    geoJsonExportMode: true,
    onGeoJsonExport: (fc: FeatureCollection) => {
        console.info('[AnnotationEditor YOLO review] exported FeatureCollection', fc)
    },
    showInfoControl: false,
}

const yoloReviewTauArgs = {
    imageInfo: exampleImageInfo,
    config: paperAnnotatorEditorConfig,
    apiBaseUrl: exampleApiBaseUrl,
    initialGeoJson: simulatedYoloTauPredictions,
    geoJsonImportOptions: yoloGeoJsonImportOptions,
    geoJsonExportMode: true,
    onGeoJsonExport: (fc: FeatureCollection) => {
        console.info('[AnnotationEditor tau YOLO review] exported FeatureCollection', fc)
    },
    showInfoControl: false,
}

/**
 * **Alternate mode:** pass `initialGeoJson` + `geoJsonExportMode` to hydrate from
 * server/ML output and export edited GeoJSON. Open the console to see `onGeoJsonExport` output.
 */
export const GeoJsonInputAndExport: Story = {
    args: {
        imageInfo: exampleImageInfo,
        config: exampleConfig,
        apiBaseUrl: exampleApiBaseUrl,
        initialGeoJson: yoloStyleSample,
        geoJsonImportOptions: { importMode: 'class-from-properties', classProperty: 'class_name' },
        geoJsonExportMode: true,
        onGeoJsonExport: (fc) => { console.info('[AnnotationEditor story] exported FeatureCollection', fc) },
    },
    render: (args) => (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <AnnotationEditor {...args} />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story:
                    'Skips DSA annotation load because `initialGeoJson` is set. Tiles still use `apiBaseUrl` for the slide. For URL-based GeoJSON, set `initialGeoJsonUrl` instead and omit `initialGeoJson`.',
            },
        },
    },
}

/**
 * Simulated YOLO run: several **Positive** and **Negative** boxes with confidence scores.
 * Use **Review** / **Filter** workflow modes; export edits via **Export GeoJSON** (console).
 */
export const YoloReviewSimulated: Story = {
    args: yoloReviewEditorArgs,
    render: (args) => (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <AnnotationEditor {...args} />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story:
                    'Fake model output (`yoloSimulatedGeoJson`) — 3 Positive boxes and 4 Negative boxes with varying confidence. Skips DSA annotation load. Try **Filter** mode to threshold by confidence, then **Export GeoJSON**.',
            },
        },
    },
}

export const YoloReviewSimulatedWithAuth: Story = {
    args: yoloReviewEditorArgs,
    render: (args) => (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <DsaAuthManager />
            <div style={{ flex: 1, minHeight: 0 }}>
                <AnnotationEditor {...args} />
            </div>
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story:
                    'Same simulated YOLO output as **YoloReviewSimulated**, with **DsaAuthManager** for tile auth.',
            },
        },
    },
}

/**
 * Paper Annotator tau classes (`PreTangle`, `MatureTangle`, …): simulated YOLO output
 * matching `BDSA_Paper_Annotator/public/config.json`.
 */
export const YoloReviewTauSimulated: Story = {
    args: yoloReviewTauArgs,
    render: (args) => (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <AnnotationEditor {...args} />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story:
                    '3 **PreTangle** + 4 **MatureTangle** boxes (varying confidence), plus one sample each for **Neuritic Plaque** and **Glial Tau**. Same protocol as the Paper Annotator app.',
            },
        },
    },
}

export const YoloReviewTauSimulatedWithAuth: Story = {
    args: yoloReviewTauArgs,
    render: (args) => (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <DsaAuthManager />
            <div style={{ flex: 1, minHeight: 0 }}>
                <AnnotationEditor {...args} />
            </div>
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story:
                    'Tau YOLO review simulation with **DsaAuthManager** for tile authentication.',
            },
        },
    },
}

const yoloCleanupHoverArgs = {
    ...yoloReviewTauArgs,
    showInfoControl: true,
    defaultShowInfo: true,
    hoverInfoMode: 'cleanup' as const,
}

/**
 * YOLO cleanup helper: hover any detection to see **class**, **label**, and **confidence**.
 * Show Info is on by default; use Review mode to step through boxes or right-click to delete.
 */
export const YoloReviewCleanupHoverTau: Story = {
    args: yoloCleanupHoverArgs,
    render: (args) => (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <AnnotationEditor {...args} />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story:
                    'Simulated tau YOLO output with **cleanup hover tooltips** enabled on load. Move the cursor over a box to read its class, label, and confidence score. Toggle **Show Info** in the toolbar to disable. Use **Review** to jump between detections or right-click a box to delete during cleanup. Click the slide once so the canvas has keyboard focus. Storybook UI shortcuts are disabled for this project so letter keys are not hijacked.',
            },
        },
    },
}

export const YoloReviewCleanupHoverTauWithAuth: Story = {
    args: yoloCleanupHoverArgs,
    render: (args) => (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <DsaAuthManager />
            <div style={{ flex: 1, minHeight: 0 }}>
                <AnnotationEditor {...args} />
            </div>
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story:
                    'Same as **YoloReviewCleanupHoverTau** with **DsaAuthManager** for tile auth.',
            },
        },
    },
}
