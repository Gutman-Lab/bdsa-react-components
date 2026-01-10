import { Protocol, SchemaValidator as ISchemaValidator } from '../ProtocolManager.types';

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
        antibody?: {
            enum?: string[];
        };
        technique?: {
            enum?: string[];
        };
        'phospho-specific'?: {
            enum?: string[];
        };
        dilution?: {
            pattern?: string;
        };
        vendor?: {
            pattern?: string;
        };
    };
    required?: string[];
}
interface RegionSchemaDefinition {
    regions?: {
        properties?: Record<string, RegionTypeDefinition>;
    };
    hemisphere?: {
        enum?: string[];
    };
    sliceOrientation?: {
        enum?: string[];
    };
    damage?: {
        items?: {
            enum?: string[];
        };
    };
}
interface RegionTypeDefinition {
    title?: string;
    items?: {
        enum?: string[];
    };
}
export declare class SchemaValidator implements ISchemaValidator {
    private schema;
    private stainSchema;
    private regionSchema;
    loaded: boolean;
    /**
     * Load schemas from a URL or use provided schema object
     * @param schemaUrl - URL to fetch schema from (e.g., '/bdsa-schema.json')
     * @param schemaData - Optional schema data object (if already loaded)
     */
    loadSchemas(schemaUrl?: string, schemaData?: BDSASchema): Promise<boolean>;
    getStainTypeOptions(): Array<{
        value: string;
        label: string;
    }>;
    getStainTypeDefinition(stainType: string): StainTypeDefinition | null;
    getStainTypeProperties(stainType: string): Record<string, unknown>;
    getStainTypeRequiredFields(stainType: string): string[];
    getAntibodyOptions(stainType: string): string[];
    getTechniqueOptions(stainType: string): string[];
    getPhosphoSpecificOptions(stainType: string): string[];
    getDilutionPattern(stainType: string): string | null;
    getVendorPattern(stainType: string): string | null;
    getRegionTypeOptions(): Array<{
        value: string;
        label: string;
    }>;
    getRegionTypeDefinition(regionType: string): RegionTypeDefinition | null;
    getLandmarkOptions(regionType: string): string[];
    getHemisphereOptions(): string[];
    getSliceOrientationOptions(): string[];
    getDamageOptions(): string[];
    validateStainProtocol(data: Partial<Protocol>): Record<string, string>;
    validateRegionProtocol(data: Partial<Protocol>): Record<string, string>;
    isLoaded(): boolean;
    getSchema(): BDSASchema | null;
    getStainSchema(): Record<string, StainTypeDefinition> | null;
    getRegionSchema(): RegionSchemaDefinition | null;
}
export declare function createSchemaValidator(): SchemaValidator;
export {};
//# sourceMappingURL=schemaValidator.d.ts.map