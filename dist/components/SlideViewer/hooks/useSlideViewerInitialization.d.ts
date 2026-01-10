import { default as React } from 'react';
import { PaperOverlay, AnnotationToolkit } from 'osd-paperjs-annotation';
import { Viewer as OpenSeadragonViewer, Options as OpenSeadragonOptions } from 'openseadragon';
import { DebugLogger } from '../../../utils/debugLog';

/**
 * Hook to handle OpenSeadragon viewer initialization
 */
export declare function useSlideViewerInitialization(containerRef: React.RefObject<HTMLDivElement>, isVisible: boolean, isMountedRef: React.MutableRefObject<boolean>, isInitializedRef: React.MutableRefObject<boolean>, lastImageKeyRef: React.MutableRefObject<string>, viewerIdRef: React.MutableRefObject<string>, imageKey: string, processedDziUrl: string | null | undefined, imageInfo: {
    imageId?: string | number;
    width?: number;
    height?: number;
    tileWidth?: number;
    levels?: number;
    baseUrl?: string;
    dziUrl?: string;
}, token: string | null | undefined, tokenQueryParam: boolean, apiHeaders: HeadersInit | undefined, osdOptions: OpenSeadragonOptions | undefined, onViewerReadyRef: React.MutableRefObject<((viewer: OpenSeadragonViewer) => void) | undefined>, setViewer: (viewer: OpenSeadragonViewer | null) => void, setOverlay: (overlay: PaperOverlay | null) => void, setToolkit: (toolkit: AnnotationToolkit | null) => void, tiledImageRef: React.MutableRefObject<{
    addPaperItem: (item: unknown) => void;
    paperItems?: unknown[];
} | null>, appendTokenToUrl: (url: string, token: string) => string, debugLog: DebugLogger): void;
//# sourceMappingURL=useSlideViewerInitialization.d.ts.map