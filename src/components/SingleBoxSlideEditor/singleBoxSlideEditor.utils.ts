import type { SlideImageBox } from './SingleBoxSlideEditor.types'

export function boxesNearlyEqual(a: SlideImageBox, b: SlideImageBox): boolean {
    return (
        Math.abs(a.left - b.left) < 0.5 &&
        Math.abs(a.top - b.top) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5
    )
}

export function formatSlideBoxCoords(box: SlideImageBox): string {
    const x1 = Math.round(box.left)
    const y1 = Math.round(box.top)
    const x2 = Math.round(box.left + box.width)
    const y2 = Math.round(box.top + box.height)
    const w = Math.round(box.width)
    const h = Math.round(box.height)
    return `${x1}, ${y1} → ${x2}, ${y2} (${w}×${h} px)`
}

export function isFormFieldKeyboardTarget(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
    )
}

type OsdTiledImageLike = {
    getContentSize?: () => { x: number; y: number }
    source?: { width?: number; height?: number }
    imageToViewportRectangle?: (
        x: number,
        y: number,
        w: number,
        h: number,
        loose?: boolean,
    ) => unknown
}

export type OsdViewerLike = {
    addHandler?: (event: string, handler: () => void) => void
    removeHandler?: (event: string, handler: () => void) => void
    world: {
        getItemAt: (index: number) => OsdTiledImageLike | null
    }
    viewport: {
        fitBounds: (rect: unknown, immediately?: boolean) => void
        zoomBy: (factor: number) => void
        applyConstraints: () => void
        goHome?: (immediately?: boolean) => void
    }
}

function slideImageDimensions(tiled: OsdTiledImageLike): { w: number; h: number } | null {
    const cs = tiled.getContentSize?.()
    const w = cs?.x ?? tiled.source?.width
    const h = cs?.y ?? tiled.source?.height
    if (!w || !h || w <= 1 || h <= 1) return null
    return { w, h }
}

export function fitViewerToSlideBox(
    viewer: OsdViewerLike,
    box: SlideImageBox,
    tight = false,
): boolean {
    const tiled = viewer.world.getItemAt(0)
    if (!tiled?.imageToViewportRectangle) return false

    const dims = slideImageDimensions(tiled)
    if (!dims) return false
    const { w: imageW, h: imageH } = dims

    const bw = Math.max(1, box.width)
    const bh = Math.max(1, box.height)
    const pad = tight ? Math.max(bw, bh) * 0.12 + 24 : Math.max(bw, bh) * 0.35 + 64
    let x = box.left - pad
    let y = box.top - pad
    let w = bw + 2 * pad
    let h = bh + 2 * pad

    if (!tight) {
        const minFrame = 640
        if (w < minFrame) {
            const expand = (minFrame - w) / 2
            x -= expand
            w = minFrame
        }
        if (h < minFrame) {
            const expand = (minFrame - h) / 2
            y -= expand
            h = minFrame
        }
    }

    if (x < 0) {
        w += x
        x = 0
    }
    if (y < 0) {
        h += y
        y = 0
    }
    if (x >= imageW || y >= imageH) return false
    w = Math.min(w, imageW - x)
    h = Math.min(h, imageH - y)
    if (w < 8 || h < 8) return false

    const vpRect = tiled.imageToViewportRectangle(x, y, w, h, true)
    viewer.viewport.fitBounds(vpRect, true)
    return true
}

export function zoomViewerBy(viewer: OsdViewerLike, factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return
    viewer.viewport.zoomBy(factor)
    viewer.viewport.applyConstraints()
}
