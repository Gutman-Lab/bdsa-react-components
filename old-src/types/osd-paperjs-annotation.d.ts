declare module 'osd-paperjs-annotation' {
  import type { Viewer } from 'openseadragon'

  interface PaperPath {
    strokeColor?: string | { r: number; g: number; b: number } | null
    strokeWidth?: number
    fillColor?: string | { r: number; g: number; b: number } | null
    data?: {
      annotation?: unknown
      onClick?: (event?: unknown) => void
      annotationId?: string | number
      style?: unknown
      remove?: () => void
    }
    annotationId?: string | number
    onClick?: (event?: unknown) => void
    moveTo(x: number, y: number): void
    lineTo(x: number, y: number): void
    closePath(): void
  }

  interface PaperRectangle {
    x: number
    y: number
    width: number
    height: number
  }

  interface PaperView {
    draw(): void
  }

  export class PaperOverlay {
    paperScope: {
      Path: {
        new (): PaperPath
        Rectangle: {
          new (rect: PaperRectangle | unknown): PaperPath
        }
      }
      Rectangle: {
        new (x: number, y: number, width: number, height: number): PaperRectangle
      }
      project: {
        activeLayer: {
          children: unknown[]
        }
      }
      view?: PaperView
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

