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
    disconnect() { }
    observe() { }
    takeRecords() {
        return []
    }
    unobserve() { }
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
                        stopImmediatePropagation: () => { },
                        stopPropagation: () => { },
                        preventDefault: () => { },
                        initEvent: () => { },
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

// Mock HTMLCanvasElement.getContext for Paper.js
// Paper.js tries to initialize canvas during import, which jsdom doesn't support
if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = function (contextType: string) {
        if (contextType === '2d') {
            // Return a minimal mock 2D context
            return {
                canvas: this,
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 1,
                lineCap: 'butt',
                lineJoin: 'miter',
                miterLimit: 10,
                shadowBlur: 0,
                shadowColor: '',
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                globalAlpha: 1,
                globalCompositeOperation: 'source-over',
                font: '10px sans-serif',
                textAlign: 'start',
                textBaseline: 'alphabetic',
                fillRect: () => { },
                strokeRect: () => { },
                clearRect: () => { },
                fill: () => { },
                stroke: () => { },
                beginPath: () => { },
                moveTo: () => { },
                lineTo: () => { },
                closePath: () => { },
                arc: () => { },
                arcTo: () => { },
                bezierCurveTo: () => { },
                quadraticCurveTo: () => { },
                rect: () => { },
                save: () => { },
                restore: () => { },
                scale: () => { },
                rotate: () => { },
                translate: () => { },
                transform: () => { },
                setTransform: () => { },
                resetTransform: () => { },
                clip: () => { },
                isPointInPath: () => false,
                isPointInStroke: () => false,
                fillText: () => { },
                strokeText: () => { },
                measureText: () => ({ width: 0 }),
                drawImage: () => { },
                createImageData: () => ({ width: 0, height: 0, data: new Uint8ClampedArray() }),
                getImageData: () => ({ width: 0, height: 0, data: new Uint8ClampedArray() }),
                putImageData: () => { },
                createLinearGradient: () => ({
                    addColorStop: () => { },
                }),
                createRadialGradient: () => ({
                    addColorStop: () => { },
                }),
                createPattern: () => null,
                getLineDash: () => [],
                setLineDash: () => { },
                lineDashOffset: 0,
            } as any
        }
        return null
    } as any
}

afterEach(() => {
    cleanup()
})

