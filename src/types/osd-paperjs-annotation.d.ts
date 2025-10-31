declare module 'osd-paperjs-annotation' {
  import type { Viewer, PaperOverlay } from 'openseadragon'

  export class PaperOverlay {
    paperScope: {
      Path: {
        Rectangle: new (options: unknown) => unknown
      }
      project: {
        activeLayer: {
          children: unknown[]
        }
      }
    }
    destroy(): void
  }

  export class AnnotationToolbar {
    tools: {
      [key: string]: {
        onSelectionChanged?: () => void
        selection_action?: string
        _items: unknown[]
      }
    }
  }

  export class AnnotationToolkit {
    overlay: PaperOverlay
    constructor(viewer: Viewer, options: { overlay: PaperOverlay })
    getFeatures(): unknown[]
    destroy(): void
    static registerFeature(feature: unknown): void
  }

  export { PaperOverlay, AnnotationToolbar, AnnotationToolkit }
}

