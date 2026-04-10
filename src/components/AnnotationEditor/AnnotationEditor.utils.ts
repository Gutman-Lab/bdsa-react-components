import type { LocalAnnotationElement, AnnotationEditorProps } from './AnnotationEditor.types'

/**
 * Converts any CSS color string to a format accepted by DSA's schema
 * (#rrggbb, #rrggbbaa, rgb(...), rgba(...)).
 * Named colors (e.g. "black", "orange") are resolved via an offscreen canvas.
 */
export function normalizeCssColor(color: string): string {
    if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color
    if (/^rgba?\(/.test(color)) return color
    try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        if (a === 255) {
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        }
        return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
    } catch {
        return color
    }
}

/**
 * Extracts the DSA item ID from imageInfo.
 * Supports explicit imageId or parses from a DZI URL like /api/v1/item/{id}/tiles/dzi.dzi
 */
export function resolveItemId(imageInfo: AnnotationEditorProps['imageInfo']): string | null {
    if (imageInfo.imageId != null) return String(imageInfo.imageId)
    if (imageInfo.dziUrl) {
        const m = imageInfo.dziUrl.match(/\/item\/([^/]+)\//)
        return m ? m[1] : null
    }
    return null
}

/** Returns the lowest positive integer not already used as a label suffix. */
export function computeNextRoiLabel(elements: LocalAnnotationElement[], labelBase: string): string {
    const usedNumbers = new Set(
        elements
            .filter(e => e.group === 'ROI')
            .map(e => {
                const m = e.label.value.match(new RegExp(`^${labelBase}(\\d+)$`))
                return m ? parseInt(m[1], 10) : null
            })
            .filter((n): n is number => n !== null)
    )
    let next = 1
    while (usedNumbers.has(next)) next++
    return `${labelBase}${next}`
}
