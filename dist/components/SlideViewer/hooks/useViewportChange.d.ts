import { Viewer as OpenSeadragonViewer } from 'openseadragon';
import { ViewportBounds } from '../SlideViewer.types';
import { DebugLogger } from '../../../utils/debugLog';

/**
 * Hook to handle viewport change callbacks from OpenSeadragon viewer.
 * Fires callback whenever viewport changes (pan, zoom, resize) with normalized coordinates.
 */
export declare function useViewportChange(viewer: OpenSeadragonViewer | null, onViewportChange: ((bounds: ViewportBounds) => void) | undefined, imageInfo: {
    width?: number;
    height?: number;
    dziUrl?: string;
}, debugLog: DebugLogger): void;
//# sourceMappingURL=useViewportChange.d.ts.map