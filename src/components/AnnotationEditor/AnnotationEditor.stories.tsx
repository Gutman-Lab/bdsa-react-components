import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SlideImageInfo } from '../SlideViewer/SlideViewer.types'
import { DsaAuthManager } from '../DsaAuthManager/DsaAuthManager'
import { AnnotationEditor } from './AnnotationEditor'
import type { AnnotationEditorConfig } from './AnnotationEditor.types'

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
        insertBox: 'b',
    },
}

const meta = {
    title: 'Components/AnnotationEditor',
    component: AnnotationEditor,
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Protocol-driven ROI and label editing on top of SlideViewer. Requires network access to the DSA host in `imageInfo` / `apiBaseUrl` (or configure `DsaAuthManager` and omit overrides).',
            },
        },
    },
    tags: ['autodocs'],
    args: {
        disableVisibilityCheck: true,
        showInfoBar: true,
    },
    argTypes: {
        imageInfo: { description: 'Slide source (e.g. `dziUrl` with `/item/{id}/tiles/dzi.dzi`)' },
        config: { description: 'Annotation protocol: document name, types, ROI styling, hotkeys' },
        apiBaseUrl: {
            control: 'text',
            description: 'Optional override; defaults from `dsaAuthStore` when omitted',
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
                    'Use the auth bar to set the same server as in `imageInfo` / `apiBaseUrl`, then log in. You can later omit `apiBaseUrl` so the editor uses only `dsaAuthStore` (via SlideViewer).',
            },
        },
    },
}
