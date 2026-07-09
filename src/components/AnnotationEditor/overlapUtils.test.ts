import { describe, expect, it } from 'vitest'
import { boxIou, findOverlappingBoxDocIndices, type OverlapBox } from './overlapUtils'

function box(
    docIdx: number,
    className: string,
    left: number,
    top: number,
    width: number,
    height: number,
): OverlapBox {
    return { docIdx, className, left, top, width, height }
}

describe('boxIou', () => {
    it('returns 0 for non-overlapping boxes', () => {
        expect(boxIou(
            { left: 0, top: 0, width: 10, height: 10 },
            { left: 20, top: 0, width: 10, height: 10 },
        )).toBe(0)
    })

    it('returns 1 for identical boxes', () => {
        const a = { left: 0, top: 0, width: 10, height: 10 }
        expect(boxIou(a, a)).toBe(1)
    })
})

describe('findOverlappingBoxDocIndices', () => {
    it('drops the smaller contained box', () => {
        const boxes = [
            box(0, 'NFT', 0, 0, 100, 100),
            box(1, 'NFT', 10, 10, 20, 20),
        ]
        expect(findOverlappingBoxDocIndices(boxes)).toEqual([1])
    })

    it('keeps both boxes when classes differ', () => {
        const boxes = [
            box(0, 'NFT', 0, 0, 100, 100),
            box(1, 'Plaque', 10, 10, 20, 20),
        ]
        expect(findOverlappingBoxDocIndices(boxes)).toEqual([])
    })

    it('drops the smaller box under high IoU NMS', () => {
        const boxes = [
            box(0, 'NFT', 0, 0, 100, 100),
            box(1, 'NFT', 5, 5, 90, 90),
        ]
        expect(findOverlappingBoxDocIndices(boxes, { containedThreshold: 0 })).toEqual([1])
    })

    it('returns empty when fewer than two boxes overlap', () => {
        const boxes = [
            box(0, 'NFT', 0, 0, 10, 10),
            box(1, 'NFT', 100, 100, 10, 10),
        ]
        expect(findOverlappingBoxDocIndices(boxes)).toEqual([])
    })
})
