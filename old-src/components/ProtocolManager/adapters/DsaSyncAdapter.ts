/**
 * DSA Sync Adapter Interface
 * 
 * Provides a pluggable interface for DSA (Digital Slide Archive) synchronization.
 * Applications can implement this adapter to provide DSA sync functionality
 * without coupling the ProtocolsTab component to specific DSA implementations.
 */

import type { Protocol, DsaSyncAdapter as IDsaSyncAdapter } from '../ProtocolManager.types';

export class DsaSyncAdapter implements IDsaSyncAdapter {
    /**
     * Check if DSA sync is available (authenticated and configured)
     * @returns {Promise<{isAvailable: boolean, reason?: string}>}
     */
    async checkAvailability(): Promise<{ isAvailable: boolean; reason?: string }> {
        throw new Error('Method "checkAvailability" must be implemented');
    }

    /**
     * Pull protocols from DSA server
     * @returns {Promise<{success: boolean, pulled?: {stainProtocols: number, regionProtocols: number}, error?: string}>}
     */
    async pullProtocols(): Promise<{
        success: boolean;
        pulled?: { stainProtocols: number; regionProtocols: number };
        error?: string;
    }> {
        throw new Error('Method "pullProtocols" must be implemented');
    }

    /**
     * Push protocols to DSA server
     * @param {Protocol[]} _stainProtocols - Array of stain protocol objects
     * @param {Protocol[]} _regionProtocols - Array of region protocol objects
     * @returns {Promise<{success: boolean, pushed?: {stainProtocols: number, regionProtocols: number}, error?: string}>}
     */
    async pushProtocols(
        _stainProtocols: Protocol[],
        _regionProtocols: Protocol[]
    ): Promise<{
        success: boolean;
        pushed?: { stainProtocols: number; regionProtocols: number };
        error?: string;
    }> {
        throw new Error('Method "pushProtocols" must be implemented');
    }

    /**
     * Get sync status information
     * @returns {Promise<{lastSync: string|null, hasLocalChanges: boolean}>}
     */
    async getSyncStatus(): Promise<{
        lastSync: string | null;
        hasLocalChanges: boolean;
    }> {
        throw new Error('Method "getSyncStatus" must be implemented');
    }
}

/**
 * No-op adapter for applications that don't need DSA sync
 */
export class NoOpDsaSyncAdapter extends DsaSyncAdapter {
    async checkAvailability(): Promise<{ isAvailable: boolean; reason?: string }> {
        return { isAvailable: false, reason: 'DSA sync not configured' };
    }

    async pullProtocols(): Promise<{
        success: boolean;
        pulled?: { stainProtocols: number; regionProtocols: number };
        error?: string;
    }> {
        return { success: false, error: 'DSA sync not available' };
    }

    async pushProtocols(): Promise<{
        success: boolean;
        pushed?: { stainProtocols: number; regionProtocols: number };
        error?: string;
    }> {
        return { success: false, error: 'DSA sync not available' };
    }

    async getSyncStatus(): Promise<{
        lastSync: string | null;
        hasLocalChanges: boolean;
    }> {
        return { lastSync: null, hasLocalChanges: false };
    }
}

