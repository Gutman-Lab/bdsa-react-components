import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ProtocolModal } from './ProtocolModal'
import { sampleStainProtocols, sampleRegionProtocols } from './testData'
import { SchemaValidator, BDSA_SCHEMA_DEFAULT_OPTIONS } from './utils/schemaValidator'
import type { ProtocolModalProps } from './ProtocolManager.types'

// Create schema validator instance — load bundled npm schema for Storybook
const schemaValidator = new SchemaValidator()
schemaValidator.loadSchemas(undefined, undefined, BDSA_SCHEMA_DEFAULT_OPTIONS).catch(() => {
    // Already handled in loadSchemas - fallbacks will be used
})

const meta = {
    title: 'Components/ProtocolManager/ProtocolModal',
    component: ProtocolModal,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        type: {
            control: 'select',
            options: ['stain', 'region'],
        },
    },
} satisfies Meta<typeof ProtocolModal>;

export default meta
type Story = StoryObj<typeof meta>

const ModalWrapper = (args: ProtocolModalProps) => {
    const [isOpen, setIsOpen] = useState(true)

    if (!isOpen) {
        return (
            <button type="button" onClick={() => setIsOpen(true)}>
                Open {args.type === 'stain' ? 'Stain' : 'Region'} Protocol Modal
            </button>
        )
    }

    return (
        <ProtocolModal
            {...args}
            protocol={args.protocol}
            schemaValidator={schemaValidator}
            onSave={async (data) => {
                console.log('Save:', data)
                setIsOpen(false)
            }}
            onClose={() => setIsOpen(false)}
        />
    )
}

export const NewStainProtocol: Story = {
    args: {
        type: 'stain',
        protocol: null,
    },
    render: (args) => <ModalWrapper {...args} />,
};

export const EditStainProtocol: Story = {
    args: {
        type: 'stain',
        protocol: sampleStainProtocols[0],
    },
    render: (args) => <ModalWrapper {...args} />,
};

export const NewRegionProtocol: Story = {
    args: {
        type: 'region',
        protocol: null,
    },
    render: (args) => <ModalWrapper {...args} />,
};

export const EditRegionProtocol: Story = {
    args: {
        type: 'region',
        protocol: sampleRegionProtocols[0],
    },
    render: (args) => <ModalWrapper {...args} />,
};

