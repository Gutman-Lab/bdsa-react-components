/** A closed polygon on one z plane, in slide base pixels. */
export interface OverlayPolygon {
  points: Array<[number, number]>
  /** 0-based z plane. */
  z: number
}

export interface OverlayGeometry {
  /** xyz triplets, centered on the volume in x/y and indexed by plane in z. */
  points: Float32Array
  /** Triangle-list cells, filled by `vtkTriangleFilter`. */
  polygons: Uint32Array
  /** Closed polyline cells for the outlines. */
  lines: Uint32Array
  polygonCount: number
}

/**
 * Convert slide-space annotation polygons into one mesh. X/Y are scaled to the
 * loaded volume and centered, which is the same frame `createVolumeRenderer`
 * uses for the volume image.
 */
export function buildOverlayGeometry(
  polygons: OverlayPolygon[],
  width: number,
  height: number,
  sourceWidth: number = width,
  sourceHeight: number = height,
): OverlayGeometry {
  const points: number[] = []
  const polygonCells: number[] = []
  const lineCells: number[] = []
  const scaleX = width / Math.max(1, sourceWidth)
  const scaleY = height / Math.max(1, sourceHeight)
  let polygonCount = 0

  for (const polygon of polygons) {
    const coords = polygon.points
    let count = coords.length
    if (count < 3) continue
    // Contours from the segmentation close by repeating the first point.
    // TriangleFilter also handles that, but dropping it here keeps cells tidy.
    const first = coords[0]
    const last = coords[count - 1]
    if (first[0] === last[0] && first[1] === last[1]) count -= 1
    if (count < 3) continue

    const start = points.length / 3
    for (let index = 0; index < count; index += 1) {
      const [x, y] = coords[index]
      points.push(x * scaleX - width / 2, y * scaleY - height / 2, polygon.z)
    }
    polygonCells.push(count)
    for (let index = 0; index < count; index += 1) polygonCells.push(start + index)
    lineCells.push(count + 1)
    for (let index = 0; index < count; index += 1) lineCells.push(start + index)
    lineCells.push(start)
    polygonCount += 1
  }

  return {
    points: Float32Array.from(points),
    polygons: Uint32Array.from(polygonCells),
    lines: Uint32Array.from(lineCells),
    polygonCount,
  }
}
