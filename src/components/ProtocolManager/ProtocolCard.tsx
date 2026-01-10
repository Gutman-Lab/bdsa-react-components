import type { ProtocolCardProps } from './ProtocolManager.types';
import './ProtocolCard.css';

/**
 * ProtocolCard - Displays a single protocol in a card format
 */
export function ProtocolCard({
    protocol,
    onEdit,
    onDelete,
    readOnly = false,
    showSync = true,
}: ProtocolCardProps) {
    const isStain = protocol.type === 'stain';
    const isIgnore =
        protocol.id === 'ignore' ||
        protocol.id === 'ignore_stain' ||
        protocol.id === 'ignore_region';

    // Sync status for display
    const getSyncStatus = () => {
        if (!showSync) return null;

        if (protocol._localModified) {
            return { label: 'Modified', className: 'status-modified' };
        }
        if (protocol._remoteVersion) {
            return { label: 'Synced', className: 'status-synced' };
        }
        return { label: 'Local', className: 'status-local' };
    };

    const status = getSyncStatus();

    return (
        <div className="protocol-card">
            <div className="protocol-header">
                <div className="protocol-title">
                    <h4>{protocol.name}</h4>
                    {status && (
                        <div className="protocol-badges">
                            <span className={`status-badge ${status.className}`}>{status.label}</span>
                        </div>
                    )}
                </div>

                {!readOnly && !isIgnore && (
                    <div className="protocol-actions">
                        <button
                            className="edit-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('Edit button clicked for protocol:', protocol.id);
                                onEdit?.(protocol);
                            }}
                            title="Edit protocol"
                            aria-label="Edit protocol"
                        >
                            ✏️
                        </button>
                        <button
                            className="delete-button"
                            onClick={() => onDelete?.(protocol)}
                            title="Delete protocol"
                            aria-label="Delete protocol"
                        >
                            🗑️
                        </button>
                    </div>
                )}
            </div>

            <div className="protocol-details">
                <p>
                    <strong>ID:</strong> <code>{protocol.id}</code>
                </p>
                <p>
                    <strong>Description:</strong> {protocol.description || 'No description'}
                </p>

                {isStain ? (
                    <>
                        {protocol.stainType && protocol.stainType !== 'ignore' && (
                            <p>
                                <strong>Stain Type:</strong> {protocol.stainType}
                            </p>
                        )}
                        {protocol.antibody && (
                            <p>
                                <strong>Antibody:</strong> {protocol.antibody}
                            </p>
                        )}
                        {protocol.technique && (
                            <p>
                                <strong>Technique:</strong> {protocol.technique}
                            </p>
                        )}
                        {protocol.phosphoSpecific && (
                            <p>
                                <strong>Phospho-specific:</strong> {protocol.phosphoSpecific}
                            </p>
                        )}
                        {protocol.dilution && (
                            <p>
                                <strong>Dilution:</strong> {protocol.dilution}
                            </p>
                        )}
                        {protocol.vendor && (
                            <p>
                                <strong>Vendor:</strong> {protocol.vendor}
                            </p>
                        )}
                        {protocol.chromogen && (
                            <p>
                                <strong>Chromogen:</strong> {protocol.chromogen}
                            </p>
                        )}
                    </>
                ) : (
                    <>
                        {protocol.regionType && protocol.regionType !== 'ignore' && (
                            <p>
                                <strong>Region Type:</strong> {protocol.regionType}
                            </p>
                        )}
                        {protocol.landmarks && protocol.landmarks.length > 0 && (
                            <p>
                                <strong>Landmarks:</strong> {protocol.landmarks.join(', ')}
                            </p>
                        )}
                        {protocol.hemisphere && (
                            <p>
                                <strong>Hemisphere:</strong> {protocol.hemisphere}
                            </p>
                        )}
                        {protocol.sliceOrientation && (
                            <p>
                                <strong>Slice Orientation:</strong> {protocol.sliceOrientation}
                            </p>
                        )}
                        {protocol.sliceThickness && (
                            <p>
                                <strong>Slice Thickness:</strong> {protocol.sliceThickness}µm
                            </p>
                        )}
                        {protocol.damage && protocol.damage.length > 0 && (
                            <p>
                                <strong>Damage:</strong> {protocol.damage.join(', ')}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default ProtocolCard;

