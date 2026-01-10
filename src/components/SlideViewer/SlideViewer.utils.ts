import type { AnnotationInfoConfig, AnnotationFeature } from './SlideViewer.types'
import { extractAnnotationElements } from '../../utils/annotationFormats'

/**
 * Compute version hash from annotation header for cache invalidation
 * Extracts version-relevant fields and computes a hash
 */
export function computeVersionHash(header: Record<string, unknown>): string {
    // Extract fields that indicate changes
    const versionFields: Record<string, unknown> = {}
    if (header._id !== undefined) versionFields._id = header._id
    if (header._version !== undefined) versionFields._version = header._version
    if (header._modelType !== undefined) versionFields._modelType = header._modelType
    if (header.updated !== undefined) versionFields.updated = header.updated
    if (header.modified !== undefined) versionFields.modified = header.modified
    if (header._accessLevel !== undefined) versionFields._accessLevel = header._accessLevel
    
    // Include annotation metadata if present
    if (header.annotation && typeof header.annotation === 'object') {
        const ann = header.annotation as Record<string, unknown>
        if (ann.name !== undefined) versionFields.name = ann.name
    }
    
    // Simple hash function (djb2 variant)
    const jsonString = JSON.stringify(versionFields, Object.keys(versionFields).sort())
    let hash = 5381
    for (let i = 0; i < jsonString.length; i++) {
        hash = ((hash << 5) + hash) + jsonString.charCodeAt(i)
        hash = hash & hash // Convert to 32-bit integer
    }
    return (hash >>> 0).toString(16)
}

/**
 * Extract authentication token from authToken prop or apiHeaders
 */
export function extractToken(authToken?: string, apiHeaders?: HeadersInit): string | undefined {
    // Use authToken if provided
    if (authToken) {
        return authToken
    }
    
    // Try to extract from apiHeaders
    if (!apiHeaders) {
        return undefined
    }
    
    // Handle different header formats
    if (apiHeaders instanceof Headers) {
        // Headers object
        const authHeader = apiHeaders.get('Authorization') || apiHeaders.get('Girder-Token')
        if (authHeader) {
            return authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader
        }
    } else if (Array.isArray(apiHeaders)) {
        // Array of [key, value] tuples
        for (const [key, value] of apiHeaders) {
            if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'girder-token') {
                return value.startsWith('Bearer ') ? value.substring(7) : value
            }
        }
    } else {
        // Plain object
        const headers = apiHeaders as Record<string, string>
        const authHeader = headers['Authorization'] || headers['authorization'] || 
                          headers['Girder-Token'] || headers['girder-token']
        if (authHeader) {
            return authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader
        }
    }
    
    return undefined
}

/**
 * Append authentication token as query parameter to a URL
 */
export function appendTokenToUrl(url: string, token?: string): string {
    if (!token) {
        return url
    }
    
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}token=${encodeURIComponent(token)}`
}

/**
 * Helper function to apply opacity to a color string
 * Always returns rgba format for consistency, even at 100% opacity
 */
export function applyOpacity(color: string, opacity: number): string {
    // Clamp opacity to valid range
    const clampedOpacity = Math.max(0, Math.min(1, opacity))
    
    // Always convert to rgba for consistent rendering, even at 100%
    if (color.startsWith('rgba(')) {
        // Extract RGB values, ignore existing alpha
        const match = color.match(/(\d+(?:\.\d+)?)/g)
        if (match && match.length >= 3) {
            const r = match[0]
            const g = match[1]
            const b = match[2]
            return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`
        }
    } else if (color.startsWith('rgb(')) {
        // Extract RGB values from rgb() format
        const match = color.match(/(\d+(?:\.\d+)?)/g)
        if (match && match.length >= 3) {
            const r = match[0]
            const g = match[1]
            const b = match[2]
            return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`
        }
    } else if (color.startsWith('#')) {
        // Convert hex to rgba
        const hex = color.replace('#', '')
        // Handle both 3-digit and 6-digit hex
        let r: number, g: number, b: number
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16)
            g = parseInt(hex[1] + hex[1], 16)
            b = parseInt(hex[2] + hex[2], 16)
        } else {
            r = parseInt(hex.substring(0, 2), 16)
            g = parseInt(hex.substring(2, 4), 16)
            b = parseInt(hex.substring(4, 6), 16)
        }
        return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`
    }

    // Fallback: return as-is if we can't parse it
    // This should rarely happen, but preserves original behavior for edge cases
    return color
}

/**
 * Parse annotation document into AnnotationFeature array
 */
export interface ParseAnnotationResult {
    features: AnnotationFeature[]
    docInfo: {
        id: string | number
        elementCount: number
        totalPoints: number
        types: string[]
        filteredCount?: number
        filteredPoints?: number
    }
    filteredCount: number
    filteredPoints: number
}

export function parseAnnotationDocument(
    annotationDoc: unknown,
    annotationId: string | number,
    defaultAnnotationColor: string,
    maxPointsPerAnnotation: number
): ParseAnnotationResult {
    const types = new Set<string>()
    const parsed: AnnotationFeature[] = []
    let totalPoints = 0
    let filteredCount = 0
    let filteredPoints = 0

    // Auto-detect format and extract elements (supports GeoJSON and DSA formats)
    const elements = extractAnnotationElements(annotationDoc)

    // Parse each element
    for (const element of elements) {
        if (element && typeof element === 'object') {
            const el = element as {
                type?: string
                points?: Array<[number, number]>
                x?: number
                y?: number
                width?: number
                height?: number
                lineColor?: string
                fillColor?: string
                lineWidth?: number
                group?: string
                label?: string
                closed?: boolean
                [key: string]: unknown
            }

            // Track element type
            if (el.type) {
                types.add(el.type)
            }

            if (el.type === 'rectangle' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
                // Rectangles have 4 vertices (corners)
                const pointsInElement = 4
                if (pointsInElement > maxPointsPerAnnotation) {
                    filteredCount++
                    filteredPoints += pointsInElement
                    console.warn(
                        `Skipping rectangle annotation ${el.group || parsed.length} in document ${annotationId}: ` +
                        `has ${pointsInElement} points (exceeds limit of ${maxPointsPerAnnotation})`
                    )
                } else {
                    totalPoints += pointsInElement
                    parsed.push({
                        id: el.group || parsed.length,
                        left: el.x,
                        top: el.y,
                        width: el.width,
                        height: el.height,
                        color: el.lineColor || defaultAnnotationColor,
                        group: el.group,
                        label: el.label,
                        annotationType: 'rectangle',
                        element: el, // Store full element for rendering
                        documentId: annotationId, // Store document ID for opacity lookup
                    })
                }
            } else if (el.type === 'polyline' && el.points && el.points.length >= 2) {
                // For polylines, check point count before processing
                const pointsInElement = el.points.length
                if (pointsInElement > maxPointsPerAnnotation) {
                    filteredCount++
                    filteredPoints += pointsInElement
                    console.warn(
                        `Skipping polyline annotation ${el.group || parsed.length} in document ${annotationId}: ` +
                        `has ${pointsInElement} points (exceeds limit of ${maxPointsPerAnnotation})`
                    )
                } else {
                    // For polylines, count the actual points
                    totalPoints += pointsInElement
                    // For polylines, store the actual points and type
                    // Calculate bounding box for compatibility
                    const xs = el.points.map((p) => p[0])
                    const ys = el.points.map((p) => p[1])
                    const left = Math.min(...xs)
                    const top = Math.min(...ys)
                    const right = Math.max(...xs)
                    const bottom = Math.max(...ys)
                    const width = right - left
                    const height = bottom - top

                    parsed.push({
                        id: el.group || parsed.length,
                        left,
                        top,
                        width,
                        height,
                        color: el.lineColor || defaultAnnotationColor,
                        group: el.group,
                        label: el.label,
                        annotationType: 'polyline',
                        points: el.points,
                        closed: el.closed,
                        fillColor: el.fillColor,
                        element: el, // Store full element for rendering
                        documentId: annotationId, // Store document ID for opacity lookup
                    })
                }
            }
        }
    }

    return {
        features: parsed,
        docInfo: {
            id: annotationId,
            elementCount: parsed.length,
            totalPoints,
            types: Array.from(types),
            filteredCount: filteredCount > 0 ? filteredCount : undefined,
            filteredPoints: filteredPoints > 0 ? filteredPoints : undefined,
        },
        filteredCount,
        filteredPoints,
    }
}

/**
 * Filter annotations by total point limit
 */
export function filterAnnotationsByTotalPoints(
    annotations: AnnotationFeature[],
    maxTotalPoints: number
): AnnotationFeature[] {
    const totalPointsAcrossAll = annotations.reduce((sum: number, ann: AnnotationFeature) => {
        if (ann.annotationType === 'polyline' && ann.points) {
            return sum + ann.points.length
        } else {
            return sum + 4 // rectangles have 4 points
        }
    }, 0)

    if (totalPointsAcrossAll <= maxTotalPoints) {
        return annotations
    }

    console.warn(
        `Total points (${totalPointsAcrossAll}) exceeds limit (${maxTotalPoints}). ` +
        `Filtering annotations starting from largest ones...`
    )

    // Sort annotations by point count (largest first) and filter
    const annotationsWithPointCounts = annotations.map((ann: AnnotationFeature) => ({
        annotation: ann,
        pointCount: ann.annotationType === 'polyline' && ann.points
            ? ann.points.length
            : 4,
    }))

    annotationsWithPointCounts.sort((a, b) => b.pointCount - a.pointCount)

    let cumulativePoints = 0
    const finalAnnotations: AnnotationFeature[] = []
    for (const { annotation, pointCount } of annotationsWithPointCounts) {
        if (cumulativePoints + pointCount <= maxTotalPoints) {
            finalAnnotations.push(annotation)
            cumulativePoints += pointCount
        } else {
            console.warn(
                `Skipping annotation ${annotation.id}: adding ${pointCount} points would exceed total limit ` +
                `(${cumulativePoints + pointCount} > ${maxTotalPoints})`
            )
        }
    }

    console.warn(
        `Filtered annotations: ${annotations.length} → ${finalAnnotations.length} ` +
        `(${annotations.length - finalAnnotations.length} skipped)`
    )

    return finalAnnotations
}

/**
 * Default configuration for annotation info panel
 */
export const DEFAULT_ANNOTATION_INFO_CONFIG: AnnotationInfoConfig = {
    documentProperties: [
        { key: 'id', label: 'ID', formatter: (value) => String(value) },
        { key: 'elementCount', label: 'Elements', formatter: (value) => String(value) },
        { key: 'totalPoints', label: 'Points/Vertices', formatter: (value) => String(value) },
        {
            key: 'types',
            label: 'Types',
            formatter: (value) => Array.isArray(value) && value.length > 0 ? value.join(', ') : 'N/A',
            show: true
        },
        {
            key: 'filteredCount',
            label: 'Filtered',
            formatter: (_value, doc) => {
                if (doc.filteredCount !== undefined && doc.filteredCount > 0) {
                    return `${doc.filteredCount} element(s) (${doc.filteredPoints || 0} points) skipped`
                }
                return 'None'
            },
            show: true,
        },
    ],
    showFetchedSection: true,
    showProvidedSection: true,
    showTotalSection: true,
    headerText: 'Annotation Information',
}
