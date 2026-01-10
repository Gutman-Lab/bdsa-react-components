import { AnnotationCache } from './AnnotationCache';

export declare class IndexedDBAnnotationCache implements AnnotationCache {
    private db;
    private initPromise;
    private init;
    private getStore;
    get(annotationId: string | number, versionHash?: string): Promise<unknown | undefined>;
    set(annotationId: string | number, data: unknown, options?: {
        ttl?: number;
        versionHash?: string;
    }): Promise<void>;
    has(annotationId: string | number, versionHash?: string): Promise<boolean>;
    delete(annotationId: string | number): Promise<void>;
    clear(): Promise<void>;
    getStats(): Promise<{
        size: number;
        count: number;
    }>;
}
//# sourceMappingURL=IndexedDBAnnotationCache.d.ts.map