/** Tile metadata needed to address a multichannel z-stack on Girder / large_image. */
export interface StackTileInfo {
  sizeX: number
  sizeY: number
  dtype?: string
  IndexRange?: { IndexC?: number; IndexZ?: number }
  IndexStride?: { IndexC?: number; IndexZ?: number }
}

export function channelCount(tile: StackTileInfo): number {
  const count = tile.IndexRange?.IndexC
  return typeof count === 'number' && count > 0 ? count : 1
}

export function zCount(tile: StackTileInfo): number {
  const count = tile.IndexRange?.IndexZ
  return typeof count === 'number' && count > 0 ? count : 1
}

/** Channel is the fastest index: frame = z * strideZ + c * strideC. */
export function frameFor(tile: StackTileInfo, channel: number, z: number): number {
  const strideC = tile.IndexStride?.IndexC ?? 1
  const strideZ = tile.IndexStride?.IndexZ ?? channelCount(tile)
  return z * strideZ + channel * strideC
}

/** Fit the volume in memory. The source pixels are sampled down to this edge. */
export function outputSize(
  sizeX: number,
  sizeY: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(sizeX, sizeY, 1)
  const scale = Math.min(1, maxEdge / longest)
  return {
    width: Math.max(1, Math.round(sizeX * scale)),
    height: Math.max(1, Math.round(sizeY * scale)),
  }
}
