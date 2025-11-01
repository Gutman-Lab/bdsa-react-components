import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

// Mock IntersectionObserver for tests (jsdom doesn't provide it)
global.IntersectionObserver = class IntersectionObserver {
    private callback: IntersectionObserverCallback

    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
        // Immediately call the callback to simulate element being visible
        // This ensures components initialize in test environment
        setTimeout(() => {
            this.callback(
                [
                    {
                        target: document.body,
                        isIntersecting: true,
                        intersectionRatio: 1,
                        boundingClientRect: {} as DOMRectReadOnly,
                        intersectionRect: {} as DOMRectReadOnly,
                        rootBounds: {} as DOMRectReadOnly,
                        time: Date.now(),
                    },
                ],
                this as any
            )
        }, 0)
    }
    disconnect() {}
    observe() {}
    takeRecords() {
        return []
    }
    unobserve() {}
} as any

// Mock IndexedDB for tests (jsdom doesn't provide it)
// This is needed because IndexedDBAnnotationCache auto-creates in components
const mockIndexedDB = () => {
    const store = new Map<string, unknown>()
    
    const mockRequest = {
        onerror: null as ((event: Event) => void) | null,
        onsuccess: null as ((event: Event) => void) | null,
        error: null as DOMException | null,
        result: undefined as unknown,
        readyState: 'pending' as IDBRequestReadyState,
    }

    const mockTransaction = {
        objectStore: (name: string) => ({
            get: (key: string) => {
                const req = { ...mockRequest }
                setTimeout(() => {
                    req.result = store.get(key)
                    req.readyState = 'done'
                    if (req.onsuccess) {
                        req.onsuccess({} as Event)
                    }
                }, 0)
                return req as IDBRequest
            },
            put: (value: unknown) => {
                const req = { ...mockRequest }
                const entry = value as { id: string }
                setTimeout(() => {
                    store.set(entry.id, value)
                    req.result = value
                    req.readyState = 'done'
                    if (req.onsuccess) {
                        req.onsuccess({} as Event)
                    }
                }, 0)
                return req as IDBRequest
            },
            delete: (key: string) => {
                const req = { ...mockRequest }
                setTimeout(() => {
                    store.delete(key)
                    req.result = undefined
                    req.readyState = 'done'
                    if (req.onsuccess) {
                        req.onsuccess({} as Event)
                    }
                }, 0)
                return req as IDBRequest
            },
            clear: () => {
                const req = { ...mockRequest }
                setTimeout(() => {
                    store.clear()
                    req.result = undefined
                    req.readyState = 'done'
                    if (req.onsuccess) {
                        req.onsuccess({} as Event)
                    }
                }, 0)
                return req as IDBRequest
            },
            count: () => {
                const req = { ...mockRequest }
                setTimeout(() => {
                    req.result = store.size
                    req.readyState = 'done'
                    if (req.onsuccess) {
                        req.onsuccess({} as Event)
                    }
                }, 0)
                return req as IDBRequest
            },
        }),
    }

    const mockDB = {
        objectStoreNames: {
            contains: () => false,
        },
        createObjectStore: (name: string) => ({
            createIndex: () => ({}),
        }),
        transaction: () => mockTransaction,
    }

    global.indexedDB = {
        open: (name: string, version?: number) => {
            const req = {
                ...mockRequest,
                onupgradeneeded: null as ((event: IDBVersionChangeEvent) => void) | null,
            } as IDBOpenDBRequest
            
            setTimeout(() => {
                // First call onupgradeneeded if handler exists
                if (req.onupgradeneeded) {
                    req.onupgradeneeded({
                        target: { result: mockDB },
                        currentTarget: { result: mockDB },
                        type: 'upgradeneeded',
                        bubbles: false,
                        cancelable: false,
                        defaultPrevented: false,
                        eventPhase: 0,
                        timeStamp: Date.now(),
                        stopImmediatePropagation: () => {},
                        stopPropagation: () => {},
                        preventDefault: () => {},
                        initEvent: () => {},
                        composedPath: () => [],
                        AT_TARGET: 2,
                        BUBBLING_PHASE: 3,
                        CAPTURING_PHASE: 1,
                        NONE: 0,
                    } as IDBVersionChangeEvent)
                }
                
                // Then call onsuccess
                req.result = mockDB as IDBDatabase
                req.readyState = 'done'
                if (req.onsuccess) {
                    req.onsuccess({ target: req } as any)
                }
            }, 0)
            return req as IDBOpenDBRequest
        },
        deleteDatabase: () => mockRequest as IDBRequest,
        cmp: () => 0,
    } as IDBFactory
}

mockIndexedDB()

afterEach(() => {
    cleanup()
})

