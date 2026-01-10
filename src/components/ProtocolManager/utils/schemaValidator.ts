/**
 * Schema Validator - Loads and validates protocols against BDSA schema
 * Provides schema-driven form generation and validation
 */

import type { Protocol, SchemaValidator as ISchemaValidator } from '../ProtocolManager.types';

interface BDSASchema {
    properties?: {
        stainIDs?: {
            items?: {
                properties?: Record<string, StainTypeDefinition>;
            };
        };
        regionIDs?: {
            properties?: RegionSchemaDefinition;
        };
    };
}

interface StainTypeDefinition {
    title?: string;
    properties?: {
        antibody?: { enum?: string[] };
        technique?: { enum?: string[] };
        'phospho-specific'?: { enum?: string[] };
        dilution?: { pattern?: string };
        vendor?: { pattern?: string };
    };
    required?: string[];
}

interface RegionSchemaDefinition {
    regions?: {
        properties?: Record<string, RegionTypeDefinition>;
    };
    hemisphere?: { enum?: string[] };
    sliceOrientation?: { enum?: string[] };
    damage?: {
        items?: { enum?: string[] };
    };
}

interface RegionTypeDefinition {
    title?: string;
    items?: {
        enum?: string[];
    };
}

export class SchemaValidator implements ISchemaValidator {
    private schema: BDSASchema | null = null;
    private stainSchema: Record<string, StainTypeDefinition> | null = null;
    private regionSchema: RegionSchemaDefinition | null = null;
    public loaded: boolean = false;

    /**
     * Load schemas from a URL or use provided schema object
     * @param schemaUrl - URL to fetch schema from (e.g., '/bdsa-schema.json')
     * @param schemaData - Optional schema data object (if already loaded)
     */
    async loadSchemas(schemaUrl?: string, schemaData?: BDSASchema): Promise<boolean> {
        try {
            let schema: BDSASchema;

            if (schemaData) {
                schema = schemaData;
            } else if (schemaUrl) {
                const response = await fetch(schemaUrl);
                if (!response.ok) {
                    // Schema file not found - use fallback options
                    console.warn(`Schema file not found at ${schemaUrl}, using fallback options`);
                    this.loaded = true; // Mark as loaded so fallbacks are used
                    return true;
                }
                schema = await response.json();
            } else {
                // Try default location
                const response = await fetch('/bdsa-schema.json');
                if (!response.ok) {
                    // Schema file not found - use fallback options
                    console.warn('BDSA schema file not found at /bdsa-schema.json, using fallback options');
                    this.loaded = true; // Mark as loaded so fallbacks are used
                    return true;
                }
                schema = await response.json();
            }

            this.schema = schema;

            // Extract stain definitions from the schema
            if (
                this.schema.properties?.stainIDs?.items?.properties
            ) {
                this.stainSchema = this.schema.properties.stainIDs.items.properties;
            }

            // Extract region definitions from the schema
            if (this.schema.properties?.regionIDs?.properties) {
                this.regionSchema = this.schema.properties.regionIDs.properties;
            }

            this.loaded = true;
            console.log('BDSA schema loaded successfully', {
                stainTypes: Object.keys(this.stainSchema || {}),
                regionTypes: Object.keys(this.regionSchema?.regions?.properties || {}),
            });

            return true;
        } catch (error) {
            // If schema loading fails, use fallback options
            console.warn('Error loading BDSA schema, using fallback options:', error);
            this.loaded = true; // Mark as loaded so fallbacks are used
            return true; // Return true so components can still work with fallbacks
        }
    }

    // Stain Schema Methods
    getStainTypeOptions(): Array<{ value: string; label: string }> {
        if (!this.stainSchema) {
            // Return fallback options if schema isn't loaded
            return [
                { value: 'TDP-43', label: 'TDP-43' },
                { value: 'aSyn', label: 'Alpha Synuclein' },
                { value: 'Tau', label: 'Tau' },
                { value: 'aBeta', label: 'Amyloid Beta' },
                { value: 'GFAP', label: 'GFAP' },
                { value: 'IBA1', label: 'IBA1' },
                { value: 'NeuN', label: 'NeuN' },
                { value: 'HE', label: 'H&E' },
                { value: 'Silver', label: 'Silver' },
                { value: 'ignore', label: 'IGNORE' },
            ];
        }
        const options = Object.keys(this.stainSchema).map((key) => ({
            value: key,
            label: this.stainSchema![key].title || key,
        }));
        return options;
    }

    getStainTypeDefinition(stainType: string): StainTypeDefinition | null {
        if (!this.stainSchema || !this.stainSchema[stainType]) {
            return null;
        }
        return this.stainSchema[stainType];
    }

    getStainTypeProperties(stainType: string): Record<string, unknown> {
        const definition = this.getStainTypeDefinition(stainType);
        return (definition?.properties as Record<string, unknown>) || {};
    }

    getStainTypeRequiredFields(stainType: string): string[] {
        const definition = this.getStainTypeDefinition(stainType);
        return definition?.required || [];
    }

    getAntibodyOptions(stainType: string): string[] {
        const properties = this.getStainTypeProperties(stainType);
        return (properties.antibody as { enum?: string[] })?.enum || [];
    }

    getTechniqueOptions(stainType: string): string[] {
        const properties = this.getStainTypeProperties(stainType);
        return (properties.technique as { enum?: string[] })?.enum || [];
    }

    getPhosphoSpecificOptions(stainType: string): string[] {
        const properties = this.getStainTypeProperties(stainType);
        return (properties['phospho-specific'] as { enum?: string[] })?.enum || [];
    }

    getDilutionPattern(stainType: string): string | null {
        const properties = this.getStainTypeProperties(stainType);
        return (properties.dilution as { pattern?: string })?.pattern || null;
    }

    getVendorPattern(stainType: string): string | null {
        const properties = this.getStainTypeProperties(stainType);
        return (properties.vendor as { pattern?: string })?.pattern || null;
    }

    // Region Schema Methods
    getRegionTypeOptions(): Array<{ value: string; label: string }> {
        if (!this.regionSchema?.regions?.properties) {
            return [
                { value: 'hippocampus', label: 'Hippocampus' },
                { value: 'cortex', label: 'Cortex' },
                { value: 'ignore', label: 'IGNORE' },
            ];
        }
        return Object.keys(this.regionSchema.regions.properties).map((key) => ({
            value: key,
            label: this.regionSchema!.regions!.properties![key].title || key,
        }));
    }

    getRegionTypeDefinition(regionType: string): RegionTypeDefinition | null {
        if (
            !this.regionSchema?.regions?.properties ||
            !this.regionSchema.regions.properties[regionType]
        ) {
            return null;
        }
        return this.regionSchema.regions.properties[regionType];
    }

    getLandmarkOptions(regionType: string): string[] {
        const definition = this.getRegionTypeDefinition(regionType);
        return definition?.items?.enum || [];
    }

    getHemisphereOptions(): string[] {
        return this.regionSchema?.hemisphere?.enum || ['left', 'right', 'unknown', 'n/a'];
    }

    getSliceOrientationOptions(): string[] {
        return this.regionSchema?.sliceOrientation?.enum || ['axial', 'coronal', 'sagittal'];
    }

    getDamageOptions(): string[] {
        return this.regionSchema?.damage?.items?.enum || ['Infarct', 'Lacune', 'Microinfarct', 'CTE', 'TBI'];
    }

    // Validation Methods
    validateStainProtocol(data: Partial<Protocol>): Record<string, string> {
        const errors: Record<string, string> = {};

        // Basic validation
        if (!data.name?.trim()) {
            errors.name = 'Protocol name is required';
        }
        if (!data.stainType) {
            errors.stainType = 'Stain type is required';
        }

        // Schema-based validation
        if (data.stainType && this.stainSchema && this.stainSchema[data.stainType]) {
            const stainDef = this.stainSchema[data.stainType];
            const properties = stainDef.properties || {};

            // Check required fields
            const requiredFields = stainDef.required || [];
            requiredFields.forEach((field) => {
                // Map schema field names to form field names
                const formFieldName = field === 'phospho-specific' ? 'phosphoSpecific' : field;
                if (!data[formFieldName as keyof Protocol]) {
                    errors[formFieldName] = `${field} is required for ${data.stainType}`;
                }
            });

            // Check pattern validation
            if (data.dilution && (properties.dilution as { pattern?: string })?.pattern) {
                const pattern = new RegExp((properties.dilution as { pattern: string }).pattern);
                if (!pattern.test(data.dilution)) {
                    errors.dilution = `Dilution must match pattern: ${(properties.dilution as { pattern: string }).pattern}`;
                }
            }

            // Check vendor pattern
            if (data.vendor && (properties.vendor as { pattern?: string })?.pattern) {
                const pattern = new RegExp((properties.vendor as { pattern: string }).pattern);
                if (!pattern.test(data.vendor)) {
                    errors.vendor = `Vendor must match pattern: ${(properties.vendor as { pattern: string }).pattern}`;
                }
            }

            // Check enum values
            if (data.antibody && (properties.antibody as { enum?: string[] })?.enum) {
                if (!(properties.antibody as { enum: string[] }).enum.includes(data.antibody)) {
                    errors.antibody = `Antibody must be one of: ${(properties.antibody as { enum: string[] }).enum.join(', ')}`;
                }
            }

            if (data.technique && (properties.technique as { enum?: string[] })?.enum) {
                if (!(properties.technique as { enum: string[] }).enum.includes(data.technique)) {
                    errors.technique = `Technique must be one of: ${(properties.technique as { enum: string[] }).enum.join(', ')}`;
                }
            }

            if (
                data.phosphoSpecific &&
                (properties['phospho-specific'] as { enum?: string[] })?.enum
            ) {
                if (
                    !(properties['phospho-specific'] as { enum: string[] }).enum.includes(
                        data.phosphoSpecific
                    )
                ) {
                    errors.phosphoSpecific = `Phospho-specific must be one of: ${(properties['phospho-specific'] as { enum: string[] }).enum.join(', ')}`;
                }
            }
        }

        return errors;
    }

    validateRegionProtocol(data: Partial<Protocol>): Record<string, string> {
        const errors: Record<string, string> = {};

        // Basic validation
        if (!data.name?.trim()) {
            errors.name = 'Protocol name is required';
        }
        if (!data.regionType) {
            errors.regionType = 'Region type is required';
        }

        // Schema-based validation
        if (
            data.regionType &&
            this.regionSchema?.regions?.properties &&
            this.regionSchema.regions.properties[data.regionType]
        ) {
            const regionDef = this.regionSchema.regions.properties[data.regionType];

            // Check enum values for landmarks (multi-select)
            if (
                data.landmarks &&
                Array.isArray(data.landmarks) &&
                regionDef.items?.enum
            ) {
                const invalidLandmarks = data.landmarks.filter(
                    (landmark) => !regionDef.items!.enum!.includes(landmark)
                );
                if (invalidLandmarks.length > 0) {
                    errors.landmarks = `Invalid landmarks: ${invalidLandmarks.join(', ')}. Must be from: ${regionDef.items.enum.join(', ')}`;
                }
            }
        }

        // Validate hemisphere
        if (data.hemisphere && this.regionSchema?.hemisphere?.enum) {
            if (!this.regionSchema.hemisphere.enum.includes(data.hemisphere)) {
                errors.hemisphere = `Hemisphere must be one of: ${this.regionSchema.hemisphere.enum.join(', ')}`;
            }
        }

        // Validate slice orientation
        if (data.sliceOrientation && this.regionSchema?.sliceOrientation?.enum) {
            if (!this.regionSchema.sliceOrientation.enum.includes(data.sliceOrientation)) {
                errors.sliceOrientation = `Slice orientation must be one of: ${this.regionSchema.sliceOrientation.enum.join(', ')}`;
            }
        }

        // Validate damage array
        if (
            data.damage &&
            Array.isArray(data.damage) &&
            this.regionSchema?.damage?.items?.enum
        ) {
            const invalidDamage = data.damage.filter(
                (d) => !this.regionSchema!.damage!.items!.enum!.includes(d)
            );
            if (invalidDamage.length > 0) {
                errors.damage = `Invalid damage types: ${invalidDamage.join(', ')}. Must be one of: ${this.regionSchema.damage.items.enum.join(', ')}`;
            }
        }

        return errors;
    }

    // Utility Methods
    isLoaded(): boolean {
        return this.loaded;
    }

    getSchema(): BDSASchema | null {
        return this.schema;
    }

    getStainSchema(): Record<string, StainTypeDefinition> | null {
        return this.stainSchema;
    }

    getRegionSchema(): RegionSchemaDefinition | null {
        return this.regionSchema;
    }
}

// Export a factory function to create instances
export function createSchemaValidator(): SchemaValidator {
    return new SchemaValidator();
}

