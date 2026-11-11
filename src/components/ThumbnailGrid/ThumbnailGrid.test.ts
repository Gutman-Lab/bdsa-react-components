import { describe, expect, it } from 'vitest'
import { computeThumbnailGridPageSize } from './thumbnailGridLayout'

describe('computeThumbnailGridPageSize', () => {
    const base = {
        contentWidth: 961,
        contentHeight: 466,
        itemWidth: 180,
        itemHeight: 180,
        columnGap: 12,
        rowGap: 12,
    }

    it('fills a rectangle using the real grid box instead of the old 32/150 guesses', () => {
        // 985px grid with 12px side padding and a 180px tile fits 5 columns.
        // 482px grid with 8px top/bottom padding fits 2 rows.
        // The previous heuristic returned floor((985-32)/192) = 4 columns => 8 items.
        expect(computeThumbnailGridPageSize(base)).toBe(10)
    })

    it('accounts for the n - 1 gaps between tiles', () => {
        expect(
            computeThumbnailGridPageSize({
                ...base,
                contentWidth: 180 * 3 + 12 * 2,
                contentHeight: 180,
            })
        ).toBe(3)
    })

    it('falls back to the supplied itemsPerPage when the box is not measurable yet', () => {
        expect(computeThumbnailGridPageSize({ ...base, contentWidth: 0, fallbackItemsPerPage: 24 })).toBe(24)
        expect(computeThumbnailGridPageSize({ ...base, contentHeight: 0, fallbackItemsPerPage: 24 })).toBe(24)
    })

    it('treats a non-numeric computed gap as the 12px default', () => {
        const withNormalGap = computeThumbnailGridPageSize({
            ...base,
            contentWidth: 600,
            contentHeight: 180,
            columnGap: Number.NaN,
            rowGap: Number.NaN,
        })
        const withDefaultGap = computeThumbnailGridPageSize({
            ...base,
            contentWidth: 600,
            contentHeight: 180,
        })
        expect(withNormalGap).toBe(withDefaultGap)
    })

    it('always returns at least one item and never exceeds the hard cap', () => {
        expect(computeThumbnailGridPageSize({ ...base, contentWidth: 10, contentHeight: 10 })).toBe(1)
        expect(computeThumbnailGridPageSize({ ...base, contentWidth: 1e6, contentHeight: 1e6 })).toBe(500)
    })
})
