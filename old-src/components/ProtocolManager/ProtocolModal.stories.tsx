import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ProtocolModal } from './ProtocolModal';
import { sampleStainProtocols, sampleRegionProtocols } from './testData';
import { SchemaValidator } from './utils/schemaValidator';

// Create schema validator instance (will use fallbacks in Storybook)
const schemaValidator = new SchemaValidator();
// In real usage, you would call: await schemaValidator.loadSchemas('/bdsa-schema.json')

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

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to handle modal state
const ModalWrapper = (args: any) => {
    const [isOpen, setIsOpen] = useState(true);
    const [protocol, setProtocol] = useState(args.protocol || null);

    if (!isOpen) {
        return (
            <button onClick={() => setIsOpen(true)}>
                Open {args.type === 'stain' ? 'Stain' : 'Region'} Protocol Modal
            </button>
        );
    }

    return (
        <ProtocolModal
            {...args}
            protocol={protocol}
            schemaValidator={schemaValidator}
            onSave={async (data) => {
                console.log('Save:', data);
                setIsOpen(false);
            }}
            onClose={() => setIsOpen(false)}
        />
    );
};

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

