import { Protocol, ProtocolStorage } from '../ProtocolManager.types';

/**
 * Generate a unique ID for a protocol
 */
export declare const generateProtocolId: () => string;
/**
 * LocalStorage implementation of protocol storage
 */
export declare class LocalStorageProtocolStorage implements ProtocolStorage {
    /**
     * Load all protocols from storage
     * @returns {Promise<Protocol[]>} Array of protocol objects
     */
    load(): Promise<Protocol[]>;
    /**
     * Save all protocols to storage
     * @param {Protocol[]} protocols - Array of protocol objects
     */
    save(protocols: Protocol[]): Promise<void>;
    /**
     * Clear all protocols from storage
     */
    clear(): Promise<void>;
}
/**
 * In-memory implementation (useful for testing)
 */
export declare class InMemoryProtocolStorage implements ProtocolStorage {
    private protocols;
    load(): Promise<Protocol[]>;
    save(protocols: Protocol[]): Promise<void>;
    clear(): Promise<void>;
}
/**
 * Default storage instance
 */
export declare const defaultStorage: LocalStorageProtocolStorage;
//# sourceMappingURL=protocolStorage.d.ts.map