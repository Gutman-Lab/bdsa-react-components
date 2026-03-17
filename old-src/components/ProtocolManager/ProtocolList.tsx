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
    const defaultTitle = type === 'stain' ? 'Stain Protocols' : 'Region Protocols';
    const defaultDescription =
        type === 'stain'
            ? 'Define staining protocols for different tissue types and targets.'
            : 'Define region protocols for different brain regions and anatomical landmarks.';

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
                            <h4>Add New {type === 'stain' ? 'Stain' : 'Region'} Protocol</h4>
                            <p>Click to create a new protocol</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProtocolList;

