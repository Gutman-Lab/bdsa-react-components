import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ProtocolCard } from './ProtocolCard';
import { ProtocolModal } from './ProtocolModal';
import { sampleStainProtocols, sampleRegionProtocols } from './testData';
import { SchemaValidator } from './utils/schemaValidator';
import type { Protocol } from './ProtocolManager.types';

const schemaValidator = new SchemaValidator();
// Load schemas - will use fallbacks if schema file doesn't exist (normal in Storybook)
schemaValidator.loadSchemas().catch(() => {
    // Already handled in loadSchemas - fallbacks will be used
});

const meta = {
    title: 'Components/ProtocolManager/ProtocolCard',
    component: ProtocolCard,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        readOnly: {
            control: 'boolean',
        },
        showSync: {
            control: 'boolean',
        },
    },
} satisfies Meta<typeof ProtocolCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to show modal when editing
const CardWithModal = (args: any) => {
    const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <ProtocolCard
                {...args}
                onEdit={(protocol) => {
                    console.log('Edit clicked for:', protocol.id);
                    setEditingProtocol(protocol);
                    setShowModal(true);
                }}
                onDelete={(protocol) => {
                    console.log('Delete clicked for:', protocol.id);
                    if (window.confirm(`Delete ${protocol.name}?`)) {
                        console.log('Protocol deleted');
                    }
                }}
            />
            {showModal && editingProtocol && (
                <ProtocolModal
                    protocol={editingProtocol}
                    type={editingProtocol.type}
                    schemaValidator={schemaValidator}
                    onSave={async (data) => {
                        console.log('Save protocol:', data);
                        setShowModal(false);
                        setEditingProtocol(null);
                    }}
                    onClose={() => {
                        setShowModal(false);
                        setEditingProtocol(null);
                    }}
                />
            )}
        </>
    );
};

export const StainProtocol: Story = {
    args: {
        protocol: sampleStainProtocols[0],
    },
    render: (args) => <CardWithModal {...args} />,
};

export const RegionProtocol: Story = {
    args: {
        protocol: sampleRegionProtocols[0],
    },
    render: (args) => <CardWithModal {...args} />,
};

export const ReadOnly: Story = {
    args: {
        protocol: sampleStainProtocols[0],
        readOnly: true,
    },
};

export const WithSyncStatus: Story = {
    args: {
        protocol: {
            ...sampleStainProtocols[0],
            _localModified: true,
        },
        showSync: true,
    },
};

export const SyncedProtocol: Story = {
    args: {
        protocol: {
            ...sampleStainProtocols[0],
            _remoteVersion: 'v1.0.0',
        },
        showSync: true,
    },
};

