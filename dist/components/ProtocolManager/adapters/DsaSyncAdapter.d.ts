import { Protocol, DsaSyncAdapter as IDsaSyncAdapter } from '../ProtocolManager.types';

export declare class DsaSyncAdapter implements IDsaSyncAdapter {
    /**
     * Check if DSA sync is available (authenticated and configured)
     * @returns {Promise<{isAvailable: boolean, reason?: string}>}
     */
    checkAvailability(): Promise<{
        isAvailable: boolean;
        reason?: string;
    }>;
    /**
     * Pull protocols from DSA server
     * @returns {Promise<{success: boolean, pulled?: {stainProtocols: number, regionProtocols: number}, error?: string}>}
     */
    pullProtocols(): Promise<{
        success: boolean;
        pulled?: {
            stainProtocols: number;
            regionProtocols: number;
        };
        error?: string;
    }>;
    /**
     * Push protocols to DSA server
     * @param {Protocol[]} _stainProtocols - Array of stain protocol objects
     * @param {Protocol[]} _regionProtocols - Array of region protocol objects
     * @returns {Promise<{success: boolean, pushed?: {stainProtocols: number, regionProtocols: number}, error?: string}>}
     */
    pushProtocols(_stainProtocols: Protocol[], _regionProtocols: Protocol[]): Promise<{
        success: boolean;
        pushed?: {
            stainProtocols: number;
            regionProtocols: number;
        };
        error?: string;
    }>;
    /**
     * Get sync status information
     * @returns {Promise<{lastSync: string|null, hasLocalChanges: boolean}>}
     */
    getSyncStatus(): Promise<{
        lastSync: string | null;
        hasLocalChanges: boolean;
    }>;
}
/**
 * No-op adapter for applications that don't need DSA sync
 */
export declare class NoOpDsaSyncAdapter extends DsaSyncAdapter {
    checkAvailability(): Promise<{
        isAvailable: boolean;
        reason?: string;
    }>;
    pullProtocols(): Promise<{
        success: boolean;
        pulled?: {
            stainProtocols: number;
            regionProtocols: number;
        };
        error?: string;
    }>;
    pushProtocols(): Promise<{
        success: boolean;
        pushed?: {
            stainProtocols: number;
            regionProtocols: number;
        };
        error?: string;
    }>;
    getSyncStatus(): Promise<{
        lastSync: string | null;
        hasLocalChanges: boolean;
    }>;
}
//# sourceMappingURL=DsaSyncAdapter.d.ts.map