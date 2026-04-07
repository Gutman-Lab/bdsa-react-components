/**
 * Debug logging utility for components
 * Only logs to console when debug mode is enabled
 */

export interface DebugLogger {
    log: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    info: (...args: unknown[]) => void
}

/**
 * Creates a debug logger that only logs when debug is enabled
 * @param componentName - Name of the component (for prefixed logging)
 * @param debug - Whether debug mode is enabled
 * @returns Logger object with log, warn, error, and info methods
 */
export function createDebugLogger(componentName: string, debug: boolean = false): DebugLogger {
    const prefix = `[${componentName}]`

    return {
        log: debug ? (...args: unknown[]) => console.log(prefix, ...args) : () => { },
        warn: debug ? (...args: unknown[]) => console.warn(prefix, ...args) : () => { },
        error: (...args: unknown[]) => console.error(prefix, ...args), // Always log errors
        info: debug ? (...args: unknown[]) => console.info(prefix, ...args) : () => { },
    }
}

