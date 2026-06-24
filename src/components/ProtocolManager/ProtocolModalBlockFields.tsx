import type { BlockProtocolSlot, Protocol } from './ProtocolManager.types'
import './ProtocolModalBlockFields.css'

export interface BlockFieldsState {
    name: string
    description: string
    slots: BlockProtocolSlot[]
}

interface ProtocolModalBlockFieldsProps {
    form: BlockFieldsState
    errors: Record<string, string>
    regionProtocols: Protocol[]
    onChange: (form: BlockFieldsState) => void
}

const emptySlot = (): BlockProtocolSlot => ({ blockId: '', regionProtocolId: '' })

export function ProtocolModalBlockFields({
    form,
    errors,
    regionProtocols,
    onChange,
}: ProtocolModalBlockFieldsProps) {
    const regionOptions = regionProtocols.filter((p) => !p._isDefault && p.regionType !== 'ignore')

    const updateSlot = (index: number, patch: Partial<BlockProtocolSlot>) => {
        const slots = form.slots.map((s, i) => (i === index ? { ...s, ...patch } : s))
        onChange({ ...form, slots })
    }

    const addSlot = () => {
        onChange({ ...form, slots: [...form.slots, emptySlot()] })
    }

    const removeSlot = (index: number) => {
        onChange({ ...form, slots: form.slots.filter((_, i) => i !== index) })
    }

    return (
        <div className="block-protocol-fields">
            <p className="block-protocol-hint">
                Each row maps a tissue block ID to a region protocol defined in this collection.
                Applying this template to a case fills the block→region map with those region protocol IDs.
            </p>

            {regionOptions.length === 0 && (
                <div className="block-protocol-warning" role="status">
                    Add at least one region protocol before creating a block protocol.
                </div>
            )}

            <div className="block-slots-header">
                <span>Block ID</span>
                <span>Region protocol</span>
                <span className="block-slots-actions-label">Actions</span>
            </div>

            {form.slots.map((slot, index) => (
                <div className="block-slot-row" key={index}>
                    <input
                        type="text"
                        value={slot.blockId}
                        onChange={(e) => updateSlot(index, { blockId: e.target.value.trim() })}
                        placeholder="e.g. A1, MB-01"
                        className={errors[`slots.${index}.blockId`] ? 'error' : ''}
                        aria-label={`Block ID row ${index + 1}`}
                    />
                    <select
                        value={slot.regionProtocolId}
                        onChange={(e) => updateSlot(index, { regionProtocolId: e.target.value })}
                        className={errors[`slots.${index}.regionProtocolId`] ? 'error' : ''}
                        aria-label={`Region protocol row ${index + 1}`}
                        disabled={regionOptions.length === 0}
                    >
                        <option value="">Select region protocol…</option>
                        {regionOptions.map((rp) => (
                            <option key={rp.id} value={rp.id}>
                                {rp.name} ({rp.regionType || rp.id})
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="block-slot-remove"
                        onClick={() => removeSlot(index)}
                        title="Remove row"
                        aria-label={`Remove row ${index + 1}`}
                    >
                        −
                    </button>
                    {(errors[`slots.${index}.blockId`] || errors[`slots.${index}.regionProtocolId`]) && (
                        <div className="block-slot-errors">
                            {errors[`slots.${index}.blockId`] && (
                                <span className="error-message">{errors[`slots.${index}.blockId`]}</span>
                            )}
                            {errors[`slots.${index}.regionProtocolId`] && (
                                <span className="error-message">
                                    {errors[`slots.${index}.regionProtocolId`]}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {errors.slots && <span className="error-message block-slots-global-error">{errors.slots}</span>}

            <button type="button" className="block-slot-add" onClick={addSlot}>
                + Add block mapping
            </button>
        </div>
    )
}

export function blockFormFromProtocol(protocol: Protocol | null): BlockFieldsState {
    if (!protocol) {
        return { name: '', description: '', slots: [emptySlot()] }
    }
    const slots =
        protocol.slots && protocol.slots.length > 0
            ? protocol.slots.map((s) => ({ ...s }))
            : [emptySlot()]
    return {
        name: protocol.name || '',
        description: protocol.description || '',
        slots,
    }
}
