import ProtocolCard from './ProtocolCard';
import type { ProtocolListProps } from './ProtocolManager.types';
import './ProtocolList.css';

/**
 * ProtocolList - Displays a grid of protocol cards
 */
export function ProtocolList({
    protocols = [],
    type,
    onAdd,
    onEdit,
    onDelete,
    readOnly = false,
    showSync = true,
    title,
    description,
}: ProtocolListProps) {
    const defaultTitle =
        type === 'stain'
            ? 'Stain Protocols'
            : type === 'region'
              ? 'Region Protocols'
              : 'Block Protocols';
    const defaultDescription =
        type === 'stain'
            ? 'Define staining protocols for different tissue types and targets.'
            : type === 'region'
              ? 'Define region protocols for different brain regions and anatomical landmarks.'
              : 'Combine region protocols into reusable block→region templates for case mapping.';

    return (
        <div className="protocol-list">
            <div className="protocol-list-header">
                <h3>{title || defaultTitle}</h3>
                <p>{description || defaultDescription}</p>
            </div>

            <div className="protocols-grid">
                {protocols.map((protocol) => (
                    <ProtocolCard
                        key={protocol.id}
                        protocol={protocol}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        readOnly={readOnly}
                        showSync={showSync}
                    />
                ))}

                {!readOnly && onAdd && (
                    <div className="add-protocol-card" onClick={onAdd}>
                        <div className="add-content">
                            <div className="add-icon">+</div>
                            <h4>
                                Add New{' '}
                                {type === 'stain'
                                    ? 'Stain'
                                    : type === 'region'
                                      ? 'Region'
                                      : 'Block'}{' '}
                                Protocol
                            </h4>
                            <p>Click to create a new protocol</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProtocolList;

