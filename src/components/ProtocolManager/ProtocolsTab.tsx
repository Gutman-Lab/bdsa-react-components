import { useState, useEffect } from 'react';
import { useProtocols } from './ProtocolContext';
import ProtocolList from './ProtocolList';
import ProtocolModal from './ProtocolModal';
import { NoOpDsaSyncAdapter } from './adapters/DsaSyncAdapter';
import type { ProtocolsTabProps, Protocol, DsaSyncAdapter } from './ProtocolManager.types';
import './ProtocolsTab.css';

/**
 * ProtocolsTab - Main component for managing stain and region protocols
 */
export function ProtocolsTab({
    dsaSyncAdapter = null,
    schemaValidator, // Required - must be provided to load options from BDSA schema
    title = 'Protocols',
    description = 'Manage stain and region protocols for BDSA schema compliance',
    showDsaSync = null, // null = auto-detect from adapter
    onProtocolChange,
    customProtocolList,
    customProtocolModal,
}: ProtocolsTabProps) {
    const {
        stainProtocols,
        regionProtocols,
        addProtocol,
        updateProtocol,
        deleteProtocol,
        clearAllProtocols,
        loading,
        error,
    } = useProtocols();

    const [activeSubTab, setActiveSubTab] = useState<'stain' | 'region'>('stain');
    const [showModal, setShowModal] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
    const [syncStatus, setSyncStatus] = useState<{
        lastSync: string | null;
        hasLocalChanges: boolean;
    }>({
        lastSync: null,
        hasLocalChanges: false,
    });
    const [isSyncing, setIsSyncing] = useState(false);
    const [dsaAvailable, setDsaAvailable] = useState(false);

    // Use provided adapter or default to NoOp
    const adapter: DsaSyncAdapter = dsaSyncAdapter || new NoOpDsaSyncAdapter();
    const shouldShowDsaSync = showDsaSync !== null ? showDsaSync : dsaSyncAdapter !== null;

    // Use custom components or defaults
    const ProtocolListComponent = customProtocolList || ProtocolList;
    const ProtocolModalComponent = customProtocolModal || ProtocolModal;

    // Load schemas for validation on mount (like the original app)
    useEffect(() => {
        const loadSchemas = async () => {
            if (!schemaValidator.loaded) {
                await schemaValidator.loadSchemas();
            }
        };
        loadSchemas();
    }, [schemaValidator]);

    // Check DSA availability on mount
    useEffect(() => {
        const checkDsa = async () => {
            const availability = await adapter.checkAvailability();
            setDsaAvailable(availability.isAvailable);
        };
        checkDsa();
    }, [adapter]);

    // Load sync status
    useEffect(() => {
        const loadSyncStatus = async () => {
            const status = await adapter.getSyncStatus();
            setSyncStatus(status);
        };
        if (shouldShowDsaSync) {
            loadSyncStatus();
        }
    }, [adapter, shouldShowDsaSync]);

    // Notify parent of protocol changes
    useEffect(() => {
        if (onProtocolChange) {
            onProtocolChange({
                stainProtocols,
                regionProtocols,
                total: stainProtocols.length + regionProtocols.length,
            });
        }
    }, [stainProtocols, regionProtocols, onProtocolChange]);

    const handleAddProtocol = () => {
        setEditingProtocol(null);
        setShowModal(true);
    };

    const handleEditProtocol = (protocol: Protocol) => {
        console.log('handleEditProtocol called with:', protocol);
        setEditingProtocol(protocol);
        setShowModal(true);
        console.log('Modal should now be visible, showModal:', true);
    };

    const handleDeleteProtocol = async (protocol: Protocol) => {
        if (window.confirm('Are you sure you want to delete this protocol?')) {
            try {
                await deleteProtocol(protocol.id);
                // Auto-sync to DSA if available
                if (shouldShowDsaSync && dsaAvailable) {
                    await handleAutoSyncToDSA();
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                alert(`Failed to delete protocol: ${errorMessage}`);
            }
        }
    };

    const handleSaveProtocol = async (protocolData: Partial<Protocol>) => {
        try {
            // Ensure type is set based on active sub-tab
            const protocolWithType: Protocol = {
                ...protocolData,
                type: activeSubTab,
                id: editingProtocol?.id || protocolData.id || '',
                name: protocolData.name || '',
            } as Protocol;

            if (editingProtocol) {
                await updateProtocol({ ...protocolWithType, id: editingProtocol.id });
            } else {
                await addProtocol(protocolWithType);
            }

            // Auto-sync to DSA if available
            if (shouldShowDsaSync && dsaAvailable) {
                await handleAutoSyncToDSA();
            }

            setShowModal(false);
            setEditingProtocol(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to save protocol: ${errorMessage}`);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingProtocol(null);
    };

    const handleAutoSyncToDSA = async () => {
        if (!dsaAvailable) return;

        try {
            const result = await adapter.pushProtocols(stainProtocols, regionProtocols);
            if (result.success) {
                const status = await adapter.getSyncStatus();
                setSyncStatus(status);
            }
        } catch (error) {
            console.warn('Auto-sync error:', error);
        }
    };

    const handleSyncWithDSA = async () => {
        if (!dsaAvailable) {
            alert('DSA sync is not available. Please check your configuration.');
            return;
        }

        setIsSyncing(true);
        try {
            const result = await adapter.pushProtocols(stainProtocols, regionProtocols);

            if (result.success) {
                const status = await adapter.getSyncStatus();
                setSyncStatus(status);
                alert(
                    `Protocols synced successfully!\n\nPushed:\n- ${result.pushed?.stainProtocols || 0} stain protocols\n- ${result.pushed?.regionProtocols || 0} region protocols`
                );
            } else {
                alert(`Sync failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`DSA sync failed: ${errorMessage}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleClearProtocols = async () => {
        const confirmMessage = `Are you sure you want to clear all protocols?\n\nThis will remove:\n- ${stainProtocols.length} stain protocols\n- ${regionProtocols.length} region protocols\n\nThis action cannot be undone.`;

        if (window.confirm(confirmMessage)) {
            try {
                await clearAllProtocols();
                console.log('🧹 Cleared all protocols and reset to defaults');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                alert(`Failed to clear protocols: ${errorMessage}`);
            }
        }
    };

    const handlePullFromDSA = async () => {
        if (!dsaAvailable) {
            alert('DSA sync is not available. Please check your configuration.');
            return;
        }

        setIsSyncing(true);
        try {
            const result = await adapter.pullProtocols();

            if (result.success) {
                // Clear existing protocols first
                await clearAllProtocols();

                // Add pulled protocols
                if (result.pulled) {
                    // Note: The adapter should handle adding protocols via the ProtocolProvider
                    // This is a simplified version - the actual implementation may vary
                    const status = await adapter.getSyncStatus();
                    setSyncStatus(status);

                    if ((result.pulled.stainProtocols > 0 || result.pulled.regionProtocols > 0) && result.pulled) {
                        alert(
                            `Protocols pulled successfully!\n\nPulled:\n- ${result.pulled.stainProtocols} stain protocols\n- ${result.pulled.regionProtocols} region protocols`
                        );
                    } else {
                        alert('No protocols found in DSA folder metadata.');
                    }
                }
            } else {
                alert(`Pull failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`DSA pull failed: ${errorMessage}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const currentProtocols = activeSubTab === 'stain' ? stainProtocols : regionProtocols;

    if (loading) {
        return (
            <div className="protocols-tab">
                <div className="loading-state">Loading protocols...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="protocols-tab">
                <div className="error-state">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="protocols-tab">
            <div className="protocols-header">
                <div className="header-content">
                    <h2>{title}</h2>
                    <p>{description}</p>
                    {shouldShowDsaSync && (
                        <div className="sync-status">
                            {syncStatus.lastSync && (
                                <span className="last-sync">
                                    Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
                                </span>
                            )}
                            {syncStatus.hasLocalChanges && (
                                <span className="local-changes">⚠️ Local changes pending</span>
                            )}
                        </div>
                    )}
                </div>
                {shouldShowDsaSync && (
                    <div className="header-actions">
                        <button
                            className="sync-button"
                            onClick={handlePullFromDSA}
                            disabled={isSyncing || !dsaAvailable}
                            title="Pull protocols from DSA server"
                        >
                            {isSyncing ? '⏳' : '⬇️'} Pull from DSA
                        </button>
                        <button
                            className={`sync-button ${syncStatus.hasLocalChanges ? 'has-changes' : ''}`}
                            onClick={handleSyncWithDSA}
                            disabled={isSyncing || !dsaAvailable}
                            title="Push protocols to DSA server"
                        >
                            {isSyncing ? '⏳' : '🔄'} Push to DSA
                            {syncStatus.hasLocalChanges && !isSyncing && (
                                <span className="change-indicator">●</span>
                            )}
                        </button>
                        <button
                            className="sync-button clear-button"
                            onClick={handleClearProtocols}
                            disabled={isSyncing}
                            title="Clear all protocols and reset to defaults"
                        >
                            🧹 Clear Protocols
                        </button>
                    </div>
                )}
            </div>

            <div className="protocols-navigation">
                <button
                    className={`nav-button ${activeSubTab === 'stain' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('stain')}
                >
                    Stain Protocols ({stainProtocols.length})
                </button>
                <button
                    className={`nav-button ${activeSubTab === 'region' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('region')}
                >
                    Region Protocols ({regionProtocols.length})
                </button>
            </div>

            <div className="protocols-content">
                <ProtocolListComponent
                    protocols={currentProtocols}
                    type={activeSubTab}
                    onEdit={handleEditProtocol}
                    onDelete={handleDeleteProtocol}
                    onAdd={handleAddProtocol}
                />
            </div>

            {showModal && (
                <ProtocolModalComponent
                    protocol={editingProtocol}
                    type={activeSubTab}
                    onSave={handleSaveProtocol}
                    onClose={handleCloseModal}
                    schemaValidator={schemaValidator}
                />
            )}
        </div>
    );
}

export default ProtocolsTab;

