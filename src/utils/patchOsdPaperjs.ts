/**
 * Runtime patches for Paper.js to fix _transformBounds errors
 * This monkey-patches Paper.js View methods at runtime to add defensive null checks
 */

// Import Paper.js directly so we can patch it
import * as paper from 'paper'

export function applyPaperJsPatches() {
    // Only apply once
    if ((window as any).__paperJsPatchesApplied) {
        return
    }

    // Try to apply patches immediately
    const tryApplyPatches = () => {
        try {
            // Resolve the actual Paper.js scope — `import * as paper` may wrap the
            // PaperScope instance under `.default` depending on the bundler/ESM interop.
            const paperLib = (paper as any).default ?? paper
            if (!paperLib?.View?.prototype) {
                return false
            }

            const ViewProto = paperLib.View.prototype

            // Patch getBounds - THE CORE ISSUE
            const originalGetBounds = ViewProto.getBounds
            ViewProto.getBounds = function(this: any) {
                if (!this._transformBounds) {
                    return null
                }
                try {
                    return originalGetBounds.call(this)
                } catch (e) {
                    return null
                }
            }

            // Patch getCenter
            const originalGetCenter = ViewProto.getCenter
            ViewProto.getCenter = function(this: any) {
                if (!this._transformBounds) {
                    return null
                }
                try {
                    return originalGetCenter.call(this)
                } catch (e) {
                    return null
                }
            }

            // Patch setCenter
            const originalSetCenter = ViewProto.setCenter
            ViewProto.setCenter = function(this: any, ...args: any[]) {
                if (!this._transformBounds) {
                    return
                }
                try {
                    return originalSetCenter.apply(this, args)
                } catch (e) {
                    // Ignore
                }
            }

            // Patch _handleMouseEvent (may not exist in all Paper.js versions)
            if (ViewProto._handleMouseEvent) {
                const originalHandleMouseEvent = ViewProto._handleMouseEvent
                ViewProto._handleMouseEvent = function(this: any, ...args: any[]) {
                    if (!this._transformBounds) {
                        return
                    }
                    try {
                        return originalHandleMouseEvent.apply(this, args)
                    } catch (e) {
                        // Ignore mouse events after destruction
                    }
                }
            }

            console.log('[bdsa-react-components] Applied Paper.js runtime patches')
            ;(window as any).__paperJsPatchesApplied = true
            return true
        } catch (e) {
            console.warn('[bdsa-react-components] Failed to apply Paper.js patches:', e)
            return false
        }
    }

    // Try immediately
    if (tryApplyPatches()) {
        return
    }

    // If Paper.js isn't available yet, retry after a short delay
    // This handles cases where Paper.js is loaded asynchronously
    let retryCount = 0
    const maxRetries = 10
    const retryInterval = 100 // ms

    const retryTimer = setInterval(() => {
        retryCount++
        if (tryApplyPatches()) {
            clearInterval(retryTimer)
        } else if (retryCount >= maxRetries) {
            clearInterval(retryTimer)
            // Only warn if we've exhausted all retries
            console.warn('[bdsa-react-components] Paper.js View not found after retries, patches not applied')
        }
    }, retryInterval)
}

/**
 * Safer wrapper for Paper.js view operations
 * Checks if view is still initialized before accessing _transformBounds-dependent methods
 */
export function safelyCallPaperMethod<T>(
    view: any,
    methodName: string,
    ...args: any[]
): T | null {
    if (!view || !view._transformBounds) {
        return null
    }
    
    try {
        return view[methodName](...args)
    } catch (e) {
        // View was destroyed during call
        return null
    }
}

