import { useState, useEffect } from 'react';
import type { ProtocolModalProps, Protocol } from './ProtocolManager.types';
import { useProtocols } from './ProtocolContext';
import {
    ProtocolModalBlockFields,
    blockFormFromProtocol,
    type BlockFieldsState,
} from './ProtocolModalBlockFields';
import './ProtocolModal.css';

interface ProtocolFormData {
    name: string;
    description: string;
    stainType: string;
    antibody: string;
    technique: string;
    phosphoSpecific: string;
    chemistry: string;
    dilution: string;
    vendor: string;
    chromogen: string;
    regionType: string;
    landmarks: string[];
    hemisphere: string;
    sliceOrientation: string;
    sliceThickness: string | number;
}

/**
 * ProtocolModal Component
 * 
 * A modal for creating and editing protocol data with schema-driven validation.
 */
export function ProtocolModal({
    protocol,
    type,
    onSave,
    onClose,
    schemaValidator,
}: ProtocolModalProps) {
    const { regionProtocols } = useProtocols();
    const [formData, setFormData] = useState<ProtocolFormData>({
        name: '',
        description: '',
        stainType: '',
        antibody: '',
        technique: '',
        phosphoSpecific: '',
        chemistry: '',
        dilution: '',
        vendor: '',
        chromogen: '',
        regionType: '',
        landmarks: [],
        hemisphere: '',
        sliceOrientation: '',
        sliceThickness: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [blockForm, setBlockForm] = useState<BlockFieldsState>(() => blockFormFromProtocol(null));

    useEffect(() => {
        if (type === 'block') {
            setBlockForm(blockFormFromProtocol(protocol));
            setErrors({});
            return;
        }
        if (protocol) {
            // Populate form with existing protocol data
            setFormData({
                name: protocol.name || '',
                description: protocol.description || '',
                stainType: protocol.stainType || '',
                antibody: protocol.antibody || '',
                technique: protocol.technique || '',
                phosphoSpecific: protocol.phosphoSpecific || '',
                chemistry: protocol.chemistry || '',
                dilution: protocol.dilution || '',
                vendor: protocol.vendor || '',
                chromogen: protocol.chromogen || '',
                regionType: protocol.regionType || '',
                landmarks: protocol.landmarks || [],
                hemisphere: protocol.hemisphere || '',
                sliceOrientation: protocol.sliceOrientation || '',
                sliceThickness: protocol.sliceThickness || '',
            });
        } else {
            // Reset form for new protocol
            setFormData({
                name: '',
                description: '',
                stainType: '',
                antibody: '',
                technique: '',
                phosphoSpecific: '',
                chemistry: '',
                dilution: '',
                vendor: '',
                chromogen: '',
                regionType: '',
                landmarks: [],
                hemisphere: '',
                sliceOrientation: '',
                sliceThickness: '',
            });
        }
        // Clear errors when protocol changes
        setErrors({});
    }, [protocol, type]);

    const handleFieldChange = (field: keyof ProtocolFormData, value: string | string[] | number) => {
        const newFormData = { ...formData, [field]: value };
        setFormData(newFormData);

        // Clear field error when user starts typing
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: '' }));
        }

        // Validate if schema validator is provided
        if (schemaValidator) {
            validateForm(newFormData);
        }
    };

    const validateForm = (data: ProtocolFormData): boolean => {
        if (!schemaValidator) {
            const basicErrors: Record<string, string> = {
                _general: 'Schema validator is required for validation',
            };
            setErrors(basicErrors);
            return false;
        }

        // Convert form data to protocol format for validation
        const protocolData: Partial<Protocol> = {
            ...data,
            sliceThickness: typeof data.sliceThickness === 'string' && data.sliceThickness !== ''
                ? parseFloat(data.sliceThickness)
                : typeof data.sliceThickness === 'number'
                ? data.sliceThickness
                : undefined,
        };

        const validationErrors =
            type === 'stain'
                ? schemaValidator.validateStainProtocol(protocolData)
                : schemaValidator.validateRegionProtocol(protocolData);
        setErrors(validationErrors);
        return Object.keys(validationErrors).length === 0;
    };

    const validateBlockForm = (data: BlockFieldsState): boolean => {
        const regionIds = regionProtocols
            .filter((p) => !p._isDefault && p.regionType !== 'ignore')
            .map((p) => p.id);
        const protocolData: Partial<Protocol> = {
            name: data.name,
            description: data.description,
            slots: data.slots.map((s) => ({
                blockId: s.blockId.trim(),
                regionProtocolId: s.regionProtocolId.trim(),
            })),
        };
        const validationErrors = schemaValidator.validateBlockProtocol(protocolData, regionIds);
        setErrors(validationErrors);
        return Object.keys(validationErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (type === 'block') {
            if (!validateBlockForm(blockForm)) {
                return;
            }
            setIsLoading(true);
            try {
                await onSave({
                    name: blockForm.name.trim(),
                    description: blockForm.description.trim() || undefined,
                    slots: blockForm.slots.map((s) => ({
                        blockId: s.blockId.trim(),
                        regionProtocolId: s.regionProtocolId.trim(),
                    })),
                });
            } catch (error) {
                console.error('Error saving protocol:', error);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        if (!validateForm(formData)) {
            return;
        }

        setIsLoading(true);
        try {
            const protocolData: Partial<Protocol> = {
                ...formData,
                sliceThickness:
                    typeof formData.sliceThickness === 'string' && formData.sliceThickness !== ''
                        ? parseFloat(formData.sliceThickness)
                        : typeof formData.sliceThickness === 'number'
                        ? formData.sliceThickness
                        : undefined,
            };
            await onSave(protocolData);
        } catch (error) {
            console.error('Error saving protocol:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderStainFields = () => {
        if (!schemaValidator) {
            return (
                <div className="error-message" style={{ padding: '20px', textAlign: 'center' }}>
                    Schema validator is required. Please provide a schemaValidator prop.
                </div>
            );
        }

        if (!schemaValidator.loaded) {
            return <div className="loading">Loading schema...</div>;
        }

        const stainTypeOptions = schemaValidator.getStainTypeOptions();

        const antibodyOptions = schemaValidator?.getAntibodyOptions(formData.stainType) || [];
        const techniqueOptions = schemaValidator?.getTechniqueOptions(formData.stainType) || [];
        const phosphoOptions = schemaValidator?.getPhosphoSpecificOptions(formData.stainType) || [];
        const chemistryOptions =
            (schemaValidator as { getChemistryOptions?: (t: string) => string[] })?.getChemistryOptions?.(
                formData.stainType,
            ) || [];
        const chromogenOptions =
            (schemaValidator as { getChromogenOptions?: (t: string) => string[] })?.getChromogenOptions?.(
                formData.stainType,
            ) || [];

        return (
            <>
                <div className="form-group">
                    <label htmlFor="stainType">Stain Type *</label>
                    <select
                        id="stainType"
                        value={formData.stainType}
                        onChange={(e) => {
                            const newFormData = {
                                ...formData,
                                stainType: e.target.value,
                                // Clear dependent fields when stain type changes
                                antibody: '',
                                technique: '',
                                phosphoSpecific: '',
                            };
                            setFormData(newFormData);
                            setErrors((prev) => ({
                                ...prev,
                                stainType: '',
                                antibody: '',
                                technique: '',
                                phosphoSpecific: '',
                                chemistry: '',
                                chromogen: '',
                            }));
                            if (schemaValidator) {
                                validateForm(newFormData);
                            }
                        }}
                        className={errors.stainType ? 'error' : ''}
                    >
                        <option value="">Select stain type</option>
                        {stainTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    {errors.stainType && <span className="error-message">{errors.stainType}</span>}
                </div>

                {formData.stainType && formData.stainType !== 'ignore' && (
                    <>
                        {/* Antibody field - only show if schema defines it */}
                        {antibodyOptions.length > 0 && (
                            <div className="form-group">
                                <label htmlFor="antibody">Antibody</label>
                                <select
                                    id="antibody"
                                    value={formData.antibody}
                                    onChange={(e) => handleFieldChange('antibody', e.target.value)}
                                    className={errors.antibody ? 'error' : ''}
                                >
                                    <option value="">Select antibody</option>
                                    {antibodyOptions.map((antibody) => (
                                        <option key={antibody} value={antibody}>
                                            {antibody}
                                        </option>
                                    ))}
                                </select>
                                {errors.antibody && <span className="error-message">{errors.antibody}</span>}
                            </div>
                        )}

                        {/* Technique field - only show if schema defines it */}
                        {techniqueOptions.length > 0 && (
                            <div className="form-group">
                                <label htmlFor="technique">Technique</label>
                                <select
                                    id="technique"
                                    value={formData.technique}
                                    onChange={(e) => handleFieldChange('technique', e.target.value)}
                                    className={errors.technique ? 'error' : ''}
                                >
                                    <option value="">Select technique</option>
                                    {techniqueOptions.map((technique) => (
                                        <option key={technique} value={technique}>
                                            {technique}
                                        </option>
                                    ))}
                                </select>
                                {errors.technique && <span className="error-message">{errors.technique}</span>}
                            </div>
                        )}

                        {chemistryOptions.length > 0 && (
                            <div className="form-group">
                                <label htmlFor="chemistry">Chemistry *</label>
                                <select
                                    id="chemistry"
                                    value={formData.chemistry}
                                    onChange={(e) => handleFieldChange('chemistry', e.target.value)}
                                    className={errors.chemistry ? 'error' : ''}
                                >
                                    <option value="">Select chemistry</option>
                                    {chemistryOptions.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                                {errors.chemistry && (
                                    <span className="error-message">{errors.chemistry}</span>
                                )}
                            </div>
                        )}

                        {/* Phospho-specific field - only show if schema defines it */}
                        {phosphoOptions.length > 0 && (
                            <div className="form-group">
                                <label htmlFor="phosphoSpecific">Phospho-specific</label>
                                <select
                                    id="phosphoSpecific"
                                    value={formData.phosphoSpecific}
                                    onChange={(e) => handleFieldChange('phosphoSpecific', e.target.value)}
                                    className={errors.phosphoSpecific ? 'error' : ''}
                                >
                                    <option value="">Select phospho-specific</option>
                                    {phosphoOptions.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                                {errors.phosphoSpecific && (
                                    <span className="error-message">{errors.phosphoSpecific}</span>
                                )}
                            </div>
                        )}

                        {/* Dilution field - always show for non-ignore stains */}
                        <div className="form-group">
                            <label htmlFor="dilution">Dilution</label>
                            <input
                                type="text"
                                id="dilution"
                                value={formData.dilution}
                                onChange={(e) => handleFieldChange('dilution', e.target.value)}
                                placeholder="e.g., 1:1000"
                                className={errors.dilution ? 'error' : ''}
                            />
                            {errors.dilution && <span className="error-message">{errors.dilution}</span>}
                            {schemaValidator?.getDilutionPattern?.(formData.stainType) && (
                                <small className="field-hint">
                                    Pattern: {schemaValidator.getDilutionPattern(formData.stainType)}
                                </small>
                            )}
                        </div>

                        {/* Vendor field - always show for non-ignore stains */}
                        <div className="form-group">
                            <label htmlFor="vendor">Vendor</label>
                            <input
                                type="text"
                                id="vendor"
                                value={formData.vendor}
                                onChange={(e) => handleFieldChange('vendor', e.target.value)}
                                placeholder="e.g., Abcam, Cell Signaling"
                                className={errors.vendor ? 'error' : ''}
                            />
                            {errors.vendor && <span className="error-message">{errors.vendor}</span>}
                            {schemaValidator?.getVendorPattern?.(formData.stainType) && (
                                <small className="field-hint">
                                    Pattern: {schemaValidator.getVendorPattern(formData.stainType)}
                                </small>
                            )}
                        </div>

                        {chromogenOptions.length > 0 && (
                            <div className="form-group">
                                <label htmlFor="chromogen">Chromogen</label>
                                <select
                                    id="chromogen"
                                    value={formData.chromogen || chromogenOptions[0] || ''}
                                    onChange={(e) => handleFieldChange('chromogen', e.target.value)}
                                    className={errors.chromogen ? 'error' : ''}
                                >
                                    <option value="">Select chromogen</option>
                                    {chromogenOptions.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                                {errors.chromogen && (
                                    <span className="error-message">{errors.chromogen}</span>
                                )}
                            </div>
                        )}
                    </>
                )}
            </>
        );
    };

    const renderRegionFields = () => {
        if (!schemaValidator) {
            return (
                <div className="error-message" style={{ padding: '20px', textAlign: 'center' }}>
                    Schema validator is required. Please provide a schemaValidator prop.
                </div>
            );
        }

        if (!schemaValidator.loaded) {
            return <div className="loading">Loading schema...</div>;
        }

        const regionTypeOptions = schemaValidator.getRegionTypeOptions();

        const landmarkOptions = schemaValidator?.getLandmarkOptions(formData.regionType) || [];
        const hemisphereOptions = schemaValidator?.getHemisphereOptions() || ['left', 'right', 'unknown', 'n/a'];
        const orientationOptions =
            schemaValidator?.getSliceOrientationOptions() || ['axial', 'coronal', 'sagittal'];

        return (
            <>
                <div className="form-group">
                    <label htmlFor="regionType">Region Type *</label>
                    <select
                        id="regionType"
                        value={formData.regionType}
                        onChange={(e) => {
                            const newFormData = {
                                ...formData,
                                regionType: e.target.value,
                                // Clear dependent fields when region type changes
                                landmarks: [],
                            };
                            setFormData(newFormData);
                            setErrors((prev) => ({ ...prev, regionType: '' }));
                            if (schemaValidator) {
                                validateForm(newFormData);
                            }
                        }}
                        className={errors.regionType ? 'error' : ''}
                    >
                        <option value="">Select region type</option>
                        {regionTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    {errors.regionType && <span className="error-message">{errors.regionType}</span>}
                </div>

                {formData.regionType && formData.regionType !== 'ignore' && (
                    <>
                        {/* Landmarks field - multi-select for sub-regions/landmarks */}
                        {landmarkOptions.length > 0 && (
                            <div className="form-group">
                                <label htmlFor="landmarks">Landmarks (Multiple Selection)</label>
                                <div className="landmarks-checkbox-group">
                                    {landmarkOptions.map((landmark) => (
                                        <label key={landmark} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={formData.landmarks.includes(landmark)}
                                                onChange={(e) => {
                                                    const newLandmarks = e.target.checked
                                                        ? [...formData.landmarks, landmark]
                                                        : formData.landmarks.filter((l) => l !== landmark);
                                                    handleFieldChange('landmarks', newLandmarks);
                                                }}
                                            />
                                            {landmark}
                                        </label>
                                    ))}
                                </div>
                                {errors.landmarks && <span className="error-message">{errors.landmarks}</span>}
                            </div>
                        )}

                        {/* Hemisphere field */}
                        <div className="form-group">
                            <label htmlFor="hemisphere">Hemisphere</label>
                            <select
                                id="hemisphere"
                                value={formData.hemisphere}
                                onChange={(e) => handleFieldChange('hemisphere', e.target.value)}
                                className={errors.hemisphere ? 'error' : ''}
                            >
                                <option value="">Select hemisphere</option>
                                {hemisphereOptions.map((hemisphere) => (
                                    <option key={hemisphere} value={hemisphere}>
                                        {hemisphere.charAt(0).toUpperCase() + hemisphere.slice(1)}
                                    </option>
                                ))}
                            </select>
                            {errors.hemisphere && <span className="error-message">{errors.hemisphere}</span>}
                        </div>

                        {/* Slice Orientation field */}
                        <div className="form-group">
                            <label htmlFor="sliceOrientation">Slice Orientation</label>
                            <select
                                id="sliceOrientation"
                                value={formData.sliceOrientation}
                                onChange={(e) => handleFieldChange('sliceOrientation', e.target.value)}
                                className={errors.sliceOrientation ? 'error' : ''}
                            >
                                <option value="">Select orientation</option>
                                {orientationOptions.map((orientation) => (
                                    <option key={orientation} value={orientation}>
                                        {orientation.charAt(0).toUpperCase() + orientation.slice(1)}
                                    </option>
                                ))}
                            </select>
                            {errors.sliceOrientation && (
                                <span className="error-message">{errors.sliceOrientation}</span>
                            )}
                        </div>

                        {/* Slice Thickness field */}
                        <div className="form-group">
                            <label htmlFor="sliceThickness">Slice Thickness (μm)</label>
                            <input
                                type="number"
                                id="sliceThickness"
                                value={formData.sliceThickness || ''}
                                onChange={(e) =>
                                    handleFieldChange('sliceThickness', parseFloat(e.target.value) || '')
                                }
                                placeholder="Enter thickness in microns"
                                min="0.1"
                                max="1000"
                                step="0.1"
                                className={errors.sliceThickness ? 'error' : ''}
                            />
                            {errors.sliceThickness && (
                                <span className="error-message">{errors.sliceThickness}</span>
                            )}
                            <small className="field-hint">Thickness of the tissue slice in microns (μm)</small>
                        </div>
                    </>
                )}
            </>
        );
    };

    const typeLabel =
        type === 'stain' ? 'Stain' : type === 'region' ? 'Region' : 'Block';

    return (
        <div className="protocol-modal-overlay" onClick={onClose}>
            <div
                className={`protocol-modal-content${type === 'block' ? ' protocol-modal-content--wide' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="protocol-modal-header">
                    <h2>
                        {protocol ? 'Edit' : 'Add New'} {typeLabel} Protocol
                    </h2>
                    <button className="protocol-modal-close-button" onClick={onClose}>
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="protocol-form">
                    {type === 'block' ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="block-name">Protocol Name *</label>
                                <input
                                    type="text"
                                    id="block-name"
                                    value={blockForm.name}
                                    onChange={(e) => {
                                        setBlockForm({ ...blockForm, name: e.target.value });
                                        if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                                    }}
                                    className={errors.name ? 'error' : ''}
                                    placeholder="e.g. Standard autopsy block set"
                                />
                                {errors.name && <span className="error-message">{errors.name}</span>}
                            </div>
                            <div className="form-group">
                                <label htmlFor="block-description">Description</label>
                                <textarea
                                    id="block-description"
                                    value={blockForm.description}
                                    onChange={(e) =>
                                        setBlockForm({ ...blockForm, description: e.target.value })
                                    }
                                    placeholder="Describe when to use this block template"
                                    rows={2}
                                />
                            </div>
                            <ProtocolModalBlockFields
                                form={blockForm}
                                errors={errors}
                                regionProtocols={regionProtocols}
                                onChange={setBlockForm}
                            />
                        </>
                    ) : (
                        <>
                            <div className="form-group">
                                <label htmlFor="name">Protocol Name *</label>
                                <input
                                    type="text"
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => handleFieldChange('name', e.target.value)}
                                    className={errors.name ? 'error' : ''}
                                    placeholder="Enter protocol name"
                                />
                                {errors.name && <span className="error-message">{errors.name}</span>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="description">Description</label>
                                <textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => handleFieldChange('description', e.target.value)}
                                    placeholder="Enter protocol description"
                                    rows={3}
                                />
                            </div>

                            {type === 'stain' ? renderStainFields() : renderRegionFields()}
                        </>
                    )}

                    <div className="protocol-modal-actions">
                        <button type="button" onClick={onClose} className="protocol-modal-cancel-button">
                            Cancel
                        </button>
                        <button type="submit" className="protocol-modal-save-button" disabled={isLoading}>
                            {isLoading ? 'Saving...' : protocol ? 'Update' : 'Create'} Protocol
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ProtocolModal;

