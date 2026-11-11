/** Default gap used when the grid has no usable computed gap (matches ThumbnailGrid.css). */
export const DEFAULT_GRID_GAP = 12
/** Upper bound so a bad measurement can never request an enormous page. */
export const MAX_ITEMS_PER_PAGE = 500

export interface ThumbnailGridPageSizeOptions {
    /** Width available inside the grid's padding, ignoring any vertical scrollbar. */
    contentWidth: number
    /** Height available inside the grid's padding. */
    contentHeight: number
    /** Rendered width of one thumbnail tile, including borders. */
    itemWidth: number
    /** Rendered height of one thumbnail tile, including borders. */
    itemHeight: number
    columnGap?: number
    rowGap?: number
    fallbackItemsPerPage?: number
}

/**
 * Compute how many thumbnails fit in the grid's content box.
 *
 * Measures the live grid box rather than the outer container, so header height,
 * pagination wrapping, and other surrounding chrome are already excluded. The
 * formula accounts for the `n - 1` gaps between `n` tiles.
 */
export function computeThumbnailGridPageSize({
    contentWidth,
    contentHeight,
    itemWidth,
    itemHeight,
    columnGap = DEFAULT_GRID_GAP,
    rowGap = DEFAULT_GRID_GAP,
    fallbackItemsPerPage = 12,
}: ThumbnailGridPageSizeOptions): number {
    if (
        !Number.isFinite(contentWidth) ||
        !Number.isFinite(contentHeight) ||
        !Number.isFinite(itemWidth) ||
        !Number.isFinite(itemHeight) ||
        contentWidth <= 0 ||
        contentHeight <= 0 ||
        itemWidth <= 0 ||
        itemHeight <= 0
    ) {
        return Math.max(1, fallbackItemsPerPage)
    }

    const safeColumnGap = Number.isFinite(columnGap) && columnGap >= 0 ? columnGap : DEFAULT_GRID_GAP
    const safeRowGap = Number.isFinite(rowGap) && rowGap >= 0 ? rowGap : DEFAULT_GRID_GAP
    const itemsPerRow = Math.max(1, Math.floor((contentWidth + safeColumnGap) / (itemWidth + safeColumnGap)))
    const rowsPerPage = Math.max(1, Math.floor((contentHeight + safeRowGap) / (itemHeight + safeRowGap)))

    return Math.min(MAX_ITEMS_PER_PAGE, Math.max(1, itemsPerRow * rowsPerPage))
}
