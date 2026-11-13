import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DsaThumbnailBrowser } from './DsaThumbnailBrowser'
import { DsaAuthManager } from '../DsaAuthManager/DsaAuthManager'

const meta: Meta<typeof DsaThumbnailBrowser> = {
    title: 'Components/DsaThumbnailBrowser',
    component: DsaThumbnailBrowser,
    tags: ['autodocs'],
    args: {
        onThumbnailClick: fn(),
        onItemsLoaded: fn(),
        onApiError: fn(),
    },
    argTypes: {
        viewerMode: {
            control: 'inline-radio',
            options: ['static', 'openseadragon'],
        },
        imageSource: {
            control: 'inline-radio',
            options: ['tiles', 'download'],
        },
        viewerSize: {
            control: 'select',
            options: ['s', 'm', 'l', 'xl'],
        },
    },
}

export default meta
type Story = StoryObj<typeof DsaThumbnailBrowser>

const exampleApiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1'
const exampleFolderId = '6903df87d26a6d93de19a9b0'

export const Static: Story = {
    args: {
        viewerMode: 'static',
        imageSource: 'tiles',
        requireLargeImage: true,
        thumbnailImageSize: 256,
        folderId: exampleFolderId,
        apiBaseUrl: exampleApiBaseUrl,
        viewerSize: 'm',
        itemsPerPage: 24,
    },
}

export const OpenSeadragon: Story = {
    args: {
        viewerMode: 'openseadragon',
        imageSource: 'tiles',
        requireLargeImage: true,
        thumbnailImageSize: 256,
        folderId: exampleFolderId,
        apiBaseUrl: exampleApiBaseUrl,
        viewerSize: 'm',
        itemsPerPage: 10,
        showViewerControls: true,
    },
    parameters: {
        docs: {
            description: {
                story:
                    'Whole-slide pyramid thumbnails. Limit the page size to avoid exhausting WebGL contexts on older GPUs.',
            },
        },
    },
}

export const WithAuthentication: Story = {
    args: {
        ...Static.args,
    },
    render: (args) => (
        <div style={{ height: '800px', display: 'flex', flexDirection: 'column' }}>
            <DsaAuthManager />
            <div style={{ flex: 1, marginTop: '16px' }}>
                <DsaThumbnailBrowser {...args} />
            </div>
        </div>
    ),
}
