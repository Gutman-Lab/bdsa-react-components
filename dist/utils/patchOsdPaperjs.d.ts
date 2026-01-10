/**
 * Runtime patches for Paper.js to fix _transformBounds errors
 * This monkey-patches Paper.js View methods at runtime to add defensive null checks
 */
export declare function applyPaperJsPatches(): void;
/**
 * Safer wrapper for Paper.js view operations
 * Checks if view is still initialized before accessing _transformBounds-dependent methods
 */
export declare function safelyCallPaperMethod<T>(view: any, methodName: string, ...args: any[]): T | null;
//# sourceMappingURL=patchOsdPaperjs.d.ts.map