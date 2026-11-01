import type { RoiImageBounds } from './AnnotationEditor.types'

export type OverlapBox = RoiImageBounds & {
    docIdx: number
    className: string
}

export type OverlapCleanupOptions = {
    /** IoU threshold for greedy NMS (0 disables NMS). Default 0.5. */
    iouThreshold?: number
    /** Drop smaller same-class boxes mostly inside a larger one (0 disables). Default 0.7. */
    containedThreshold?: number
    /** When true, only compare boxes with the same class. Default true. */
    sameClassOnly?: boolean
}

function boxArea(b: RoiImageBounds): number {
    return Math.max(0, b.width) * Math.max(0, b.height)
}

function boxIntersection(a: RoiImageBounds, b: RoiImageBounds): number {
    const x1 = Math.max(a.left, b.left)
    const y1 = Math.max(a.top, b.top)
    const x2 = Math.min(a.left + a.width, b.left + b.width)
    const y2 = Math.min(a.top + a.height, b.top + b.height)
    if (x2 <= x1 || y2 <= y1) return 0
    return (x2 - x1) * (y2 - y1)
}

export function boxIou(a: RoiImageBounds, b: RoiImageBounds): number {
    const inter = boxIntersection(a, b)
    if (inter <= 0) return 0
    const union = boxArea(a) + boxArea(b) - inter
    return union > 0 ? inter / union : 0
}

/**
 * Returns document element indices to drop when cleaning overlapping detection boxes.
 * Keeps the larger box when two same-class boxes overlap (NMS tie-break by area).
 */
export function findOverlappingBoxDocIndices(
    boxes: OverlapBox[],
    options?: OverlapCleanupOptions,
): number[] {
    if (boxes.length < 2) return []

    const iouThreshold = options?.iouThreshold ?? 0.5
    const containedThreshold = options?.containedThreshold ?? 0.7
    const sameClassOnly = options?.sameClassOnly !== false
    const drop = new Set<number>()

    if (containedThreshold > 0) {
        for (let i = 0; i < boxes.length; i++) {
            const a = boxes[i]!
            if (drop.has(a.docIdx)) continue
            for (let j = i + 1; j < boxes.length; j++) {
                const b = boxes[j]!
                if (drop.has(b.docIdx)) continue
                if (sameClassOnly && a.className !== b.className) continue

                const inter = boxIntersection(a, b)
                if (inter <= 0) continue

                const areaA = boxArea(a)
                const areaB = boxArea(b)
                const smaller = areaA <= areaB ? a : b
                const smallerArea = Math.min(areaA, areaB)
                if (smallerArea > 0 && inter / smallerArea >= containedThreshold) {
                    drop.add(smaller.docIdx)
                }
            }
        }
    }

    if (iouThreshold > 0) {
        const remaining = boxes.filter(b => !drop.has(b.docIdx))
        const byClass = new Map<string, OverlapBox[]>()
        for (const box of remaining) {
            const key = sameClassOnly ? box.className : '__all__'
            const list = byClass.get(key) ?? []
            list.push(box)
            byClass.set(key, list)
        }

        for (const list of byClass.values()) {
            list.sort((a, b) => boxArea(b) - boxArea(a))
            const kept: OverlapBox[] = []
            for (const candidate of list) {
                if (kept.every(k => boxIou(k, candidate) < iouThreshold)) {
                    kept.push(candidate)
                } else {
                    drop.add(candidate.docIdx)
                }
            }
        }
    }

    return [...drop]
}
