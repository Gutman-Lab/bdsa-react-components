import { Viewer as OpenSeadragonViewer } from 'openseadragon';
import { OverlayTileSource } from '../SlideViewer.types';
import { DebugLogger } from '../../../utils/debugLog';

/**
 * Hook to manage overlay tile sources (dynamically add/remove/update tile sources on top of base image)
 */
export declare function useOverlayTileSources(viewer: OpenSeadragonViewer | null, overlayTileSources: OverlayTileSource[], baseImageWidth: number | null, baseImageHeight: number | null, debugLog: DebugLogger): void;
//# sourceMappingURL=useOverlayTileSources.d.ts.map