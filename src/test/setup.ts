/// <reference types="node" />
import { expect, afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

/**
 * Minimal in-memory Storage implementation.
 *
 * Node 26 does not expose an ambient `localStorage`, and the test suite must
 * not depend on the experimental `--experimental-webstorage` flag. Components
 * such as DsaAuthStore use the Web Storage API directly, so tests get a real
 * per-test storage implementation instead.
 */
class MemoryStorage implements Storage {
    private store = new Map<string, string>()

    get length(): number {
        return this.store.size
    }

    clear(): void {
        this.store.clear()
    }

    getItem(key: string): string | null {
        return this.store.has(key) ? (this.store.get(key) as string) : null
    }

    key(index: number): string | null {
        return Array.from(this.store.keys())[index] ?? null
    }

    removeItem(key: string): void {
        this.store.delete(key)
    }

    setItem(key: string, value: string): void {
        this.store.set(String(key), String(value))
    }
}

const localStorageStub = new MemoryStorage()
const sessionStorageStub = new MemoryStorage()

function installStorage(name: 'localStorage' | 'sessionStorage', storage: Storage) {
    Object.defineProperty(globalThis, name, {
        value: storage,
        configurable: true,
        writable: true,
    })

    if (typeof window !== 'undefined') {
        Object.defineProperty(window, name, {
            value: storage,
            configurable: true,
            writable: true,
        })
    }
}

installStorage('localStorage', localStorageStub)
installStorage('sessionStorage', sessionStorageStub)

beforeEach(() => {
    localStorageStub.clear()
    sessionStorageStub.clear()
})

afterEach(() => {
    localStorageStub.clear()
    sessionStorageStub.clear()
    cleanup()
})
