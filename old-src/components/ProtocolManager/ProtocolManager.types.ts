/**
 * Protocol Manager Types
 * 
 * Type definitions for protocol management components
 */

export type ProtocolType = 'stain' | 'region';

export interface Protocol {
    id: string;
    type: ProtocolType;
    name: string;
    description?: string;
    _isDefault?: boolean;
    _localModified?: boolean;
    _remoteVersion?: string;
    
    // Stain-specific fields
    stainType?: string;
    antibody?: string;
    technique?: string;
    phosphoSpecific?: string;
    dilution?: string;
    vendor?: string;
    chromogen?: string;
    
    // Region-specific fields
    regionType?: string;
    landmarks?: string[];
    hemisphere?: string;
    sliceOrientation?: string;
    sliceThickness?: number;
    damage?: string[];
    
    // Allow additional fields
    [key: string]: unknown;
}

export interface ProtocolStorage {
    load(): Promise<Protocol[]>;
    save(protocols: Protocol[]): Promise<void>;
    clear(): Promise<void>;
}

export interface DsaSyncAdapter {
    checkAvailability(): Promise<{ isAvailable: boolean; reason?: string }>;
    pullProtocols(): Promise<{
        success: boolean;
        pulled?: { stainProtocols: number; regionProtocols: number };
        error?: string;
    }>;
    pushProtocols(
        stainProtocols: Protocol[],
        regionProtocols: Protocol[]
    ): Promise<{
        success: boolean;
        pushed?: { stainProtocols: number; regionProtocols: number };
        error?: string;
    }>;
    getSyncStatus(): Promise<{
        lastSync: string | null;
        hasLocalChanges: boolean;
    }>;
}

export interface SchemaValidator {
    loaded?: boolean;
    loadSchemas(schemaUrl?: string, schemaData?: unknown): Promise<boolean>;
    getStainTypeOptions(): Array<{ value: string; label: string }>;
    getAntibodyOptions(stainType: string): string[];
    getTechniqueOptions(stainType: string): string[];
    getPhosphoSpecificOptions(stainType: string): string[];
    getDilutionPattern?(stainType: string): string | null;
    getVendorPattern?(stainType: string): string | null;
    getRegionTypeOptions(): Array<{ value: string; label: string }>;
    getLandmarkOptions(regionType: string): string[];
    getHemisphereOptions(): string[];
    getSliceOrientationOptions(): string[];
    validateStainProtocol(data: Partial<Protocol>): Record<string, string>;
    validateRegionProtocol(data: Partial<Protocol>): Record<string, string>;
}

export interface ProtocolContextValue {
    protocols: Protocol[];
    loading: boolean;
    error: string | null;
    addProtocol: (protocol: Protocol) => void;
    updateProtocol: (protocol: Protocol) => void;
    deleteProtocol: (id: string) => void;
    clearAllProtocols: () => Promise<void>;
    getProtocolsByType: (type: ProtocolType) => Protocol[];
    getProtocolById: (id: string) => Protocol | undefined;
    stainProtocols: Protocol[];
    regionProtocols: Protocol[];
}

export interface ProtocolProviderProps {
    children: React.ReactNode;
    storage?: ProtocolStorage;
}

export interface ProtocolCardProps {
    protocol: Protocol;
    onEdit?: (protocol: Protocol) => void;
    onDelete?: (protocol: Protocol) => void;
    readOnly?: boolean;
    showSync?: boolean;
}

export interface ProtocolListProps {
    protocols?: Protocol[];
    type?: ProtocolType;
    onAdd?: () => void;
    onEdit?: (protocol: Protocol) => void;
    onDelete?: (protocol: Protocol) => void;
    readOnly?: boolean;
    showSync?: boolean;
    title?: string;
    description?: string;
}

export interface ProtocolModalProps {
    protocol: Protocol | null;
    type: ProtocolType;
    onSave: (formData: Partial<Protocol>) => Promise<void>;
    onClose: () => void;
    schemaValidator: SchemaValidator; // Required - must be provided to load options from BDSA schema
}

export interface ProtocolsTabProps {
    dsaSyncAdapter?: DsaSyncAdapter | null;
    schemaValidator: SchemaValidator; // Required - must be provided to load options from BDSA schema
    title?: string;
    description?: string;
    showDsaSync?: boolean | null;
    onProtocolChange?: (data: {
        stainProtocols: Protocol[];
        regionProtocols: Protocol[];
        total: number;
    }) => void;
    customProtocolList?: React.ComponentType<ProtocolListProps>;
    customProtocolModal?: React.ComponentType<ProtocolModalProps>;
}

