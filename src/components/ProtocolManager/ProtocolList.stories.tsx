import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ProtocolList } from './ProtocolList';
import { ProtocolModal } from './ProtocolModal';
import { sampleStainProtocols, sampleRegionProtocols } from './testData';
import { SchemaValidator } from './utils/schemaValidator';
import type { Protocol } from './ProtocolManager.types';

const schemaValidator = new SchemaValidator();
schemaValidator.loadSchemas().catch(() => {
    // Already handled in loadSchemas - fallbacks will be used
});

const meta = {
    title: 'Components/ProtocolManager/ProtocolList',
    component: ProtocolList,
    parameters: {
        layout: 'padded',
    },
    tags: ['autodocs'],
    argTypes: {
        type: {
            control: 'select',
            options: ['stain', 'region'],
        },
        readOnly: {
            control: 'boolean',
        },
        showSync: {
            control: 'boolean',
        },
    },
} satisfies Meta<typeof ProtocolList>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to show modal when adding/editing
const ListWithModal = (args: any) => {
    const [showModal, setShowModal] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
    const [protocols, setProtocols] = useState(args.protocols || []);

    return (
        <>
            <ProtocolList
                {...args}
                protocols={protocols}
                onAdd={() => {
                    console.log('Add clicked');
                    setEditingProtocol(null);
                    setShowModal(true);
                }}
                onEdit={(protocol) => {
                    console.log('Edit:', protocol);
                    setEditingProtocol(protocol);
                    setShowModal(true);
                }}
                onDelete={(protocol) => {
                    console.log('Delete:', protocol);
                    if (window.confirm(`Delete ${protocol.name}?`)) {
                        setProtocols(protocols.filter((p) => p.id !== protocol.id));
                    }
                }}
            />
            {showModal && (
                <ProtocolModal
                    protocol={editingProtocol}
                    type={args.type || 'stain'}
                    schemaValidator={schemaValidator}
                    onSave={async (data) => {
                        console.log('Save protocol:', data);
                        if (editingProtocol) {
                            // Update existing
                            setProtocols(
                                protocols.map((p) =>
                                    p.id === editingProtocol.id ? { ...p, ...data } : p
                                )
                            );
                        } else {
                            // Add new
                            const newProtocol: Protocol = {
                                ...data,
                                id: `new_${Date.now()}`,
                                type: args.type || 'stain',
                                name: data.name || 'New Protocol',
                            } as Protocol;
                            setProtocols([...protocols, newProtocol]);
                        }
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

export const StainProtocols: Story = {
    args: {
        protocols: sampleStainProtocols,
        type: 'stain',
    },
    render: (args) => <ListWithModal {...args} />,
};

export const RegionProtocols: Story = {
    args: {
        protocols: sampleRegionProtocols,
        type: 'region',
    },
    render: (args) => <ListWithModal {...args} />,
};

export const Empty: Story = {
    args: {
        protocols: [],
        type: 'stain',
    },
    render: (args) => <ListWithModal {...args} />,
};

export const ReadOnly: Story = {
    args: {
        protocols: sampleStainProtocols.slice(0, 3),
        type: 'stain',
        readOnly: true,
    },
};

