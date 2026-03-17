/**
 * Protocol Storage Abstraction
 * 
 * Provides a clean interface for storing/retrieving protocols.
 * Can be swapped with different implementations (localStorage, DSA server, in-memory)
 */

import type { Protocol, ProtocolStorage } from '../ProtocolManager.types';

const STORAGE_KEY = 'bdsa_protocols';

/**
 * Generate a unique ID for a protocol
 */
export const generateProtocolId = (): string => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${randomStr}`;
};

/**
 * LocalStorage implementation of protocol storage
 */
export class LocalStorageProtocolStorage implements ProtocolStorage {
    /**
     * Load all protocols from storage
     * @returns {Promise<Protocol[]>} Array of protocol objects
     */
    async load(): Promise<Protocol[]> {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading protocols from localStorage:', error);
            return [];
        }
    }

    /**
     * Save all protocols to storage
     * @param {Protocol[]} protocols - Array of protocol objects
     */
    async save(protocols: Protocol[]): Promise<void> {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(protocols));
        } catch (error) {
            console.error('Error saving protocols to localStorage:', error);
            throw error;
        }
    }

    /**
     * Clear all protocols from storage
     */
    async clear(): Promise<void> {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing protocols from localStorage:', error);
            throw error;
        }
    }
}

/**
 * In-memory implementation (useful for testing)
 */
export class InMemoryProtocolStorage implements ProtocolStorage {
    private protocols: Protocol[] = [];

    async load(): Promise<Protocol[]> {
        return [...this.protocols];
    }

    async save(protocols: Protocol[]): Promise<void> {
        this.protocols = [...protocols];
    }

    async clear(): Promise<void> {
        this.protocols = [];
    }
}

/**
 * Default storage instance
 */
export const defaultStorage = new LocalStorageProtocolStorage();




