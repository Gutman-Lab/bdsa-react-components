import { default as React } from 'react';
import { AnnotationFeature } from '../SlideViewer.types';
import { PaperOverlay, AnnotationToolkit } from 'osd-paperjs-annotation';
import { Viewer as OpenSeadragonViewer } from 'openseadragon';
import { DebugLogger } from '../../../utils/debugLog';

/**
 * Hook to handle annotation rendering in Paper.js
 */
export declare function useAnnotationRendering(viewer: OpenSeadragonViewer | null, overlay: PaperOverlay | null, toolkit: AnnotationToolkit | null, parsedManualAnnotations: AnnotationFeature[], fetchedAnnotations: AnnotationFeature[], annotationsKey: string, fetchedAnnotationsKey: string, annotationOpacity: number, annotationOpacities: Map<string | number, number> | Record<string, number> | undefined, visibleAnnotations: Map<string | number, boolean> | Record<string, boolean> | undefined, defaultAnnotationColor: string, strokeWidth: number, onAnnotationClickRef: React.MutableRefObject<((annotation: AnnotationFeature) => void) | undefined>, onAnnotationReady: ((annotationId: string | number) => void) | undefined, tiledImageRef: React.MutableRefObject<{
    addPaperItem: (item: unknown) => void;
    paperItems?: unknown[];
} | null>, lastRenderedAnnotationsRef: React.MutableRefObject<string>, safeDrawPaperView: (paperScope: PaperOverlay['paperScope']) => void, debugLog: DebugLogger): void;
//# sourceMappingURL=useAnnotationRendering.d.ts.map