import { PaperOverlay, AnnotationToolkit } from 'osd-paperjs-annotation';
import { Viewer as OpenSeadragonViewer } from 'openseadragon';

/**
 * Hook to handle annotation opacity updates without full re-renders
 */
export declare function useAnnotationOpacity(viewer: OpenSeadragonViewer | null, overlay: PaperOverlay | null, toolkit: AnnotationToolkit | null, annotationOpacity: number, annotationOpacities: Map<string | number, number> | Record<string, number> | undefined, visibleAnnotations: Map<string | number, boolean> | Record<string, boolean> | undefined, defaultAnnotationOpacity: number, defaultAnnotationColor: string, safeDrawPaperView: (paperScope: PaperOverlay['paperScope']) => void): void;
//# sourceMappingURL=useAnnotationOpacity.d.ts.map