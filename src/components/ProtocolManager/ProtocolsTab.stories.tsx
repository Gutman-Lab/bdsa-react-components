import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ProtocolProvider } from './ProtocolContext'
import { ProtocolsTab } from './ProtocolsTab'
import { sampleProtocols } from './testData'
import { InMemoryProtocolStorage } from './storage/protocolStorage'
import { SchemaValidator } from './utils/schemaValidator'

// Pre-populate storage with sample data
const storageWithData = new InMemoryProtocolStorage()
storageWithData.save(sampleProtocols)

// Create schema validator instance — ProtocolsTab loads bundled schema via `useBundledBdsaSchema` (default true)
const schemaValidator = new SchemaValidator()

const meta = {
    title: 'Components/ProtocolManager/ProtocolsTab',
    component: ProtocolsTab,
    parameters: {
        layout: 'padded',
    },
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <ProtocolProvider storage={storageWithData}>
                <div style={{ width: '100%', height: '800px' }}>
                    <Story />
                </div>
            </ProtocolProvider>
        ),
    ],
    args: {
        schemaValidator: schemaValidator,
        onProtocolChange: fn(),
    },
    argTypes: {
        title: {
            control: 'text',
        },
        description: {
            control: 'text',
        },
        showDsaSync: {
            control: 'boolean',
        },
        useBundledBdsaSchema: {
            control: 'boolean',
        },
    },
} satisfies Meta<typeof ProtocolsTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    args: {
        title: 'Protocols',
        description: 'Manage stain and region protocols for BDSA schema compliance',
        showDsaSync: false,
    },
}

export const WithDSASync: Story = {
    args: {
        title: 'Protocols',
        description: 'Manage stain and region protocols with DSA sync enabled',
        showDsaSync: true,
    },
}

export const Empty: Story = {
    args: {
        title: 'Protocols',
        description: 'Empty protocol list',
        schemaValidator: schemaValidator,
    },
    decorators: [
        (Story) => (
            <ProtocolProvider storage={new InMemoryProtocolStorage()}>
                <div style={{ width: '100%', height: '800px' }}>
                    <Story />
                </div>
            </ProtocolProvider>
        ),
    ],
}
