import { headersInitToRecord } from '../../auth/useDsaResolvedApi'
import {
  channelCount,
  frameFor,
  outputSize,
  zCount,
  type StackTileInfo,
} from './stackGeometry'

export interface StackFrames {
  /** Width of the loaded (possibly downsampled) volume. */
  width: number
  height: number
  depth: number
  channelCount: number
  /** Width/height of the original tile source, for scaling annotation coordinates. */
  sizeX: number
  sizeY: number
  /** planes[channel][z] is row-major luminance, image Y down. */
  planes: Uint8Array[][]
}

export interface LoadStackFramesArgs {
  apiBaseUrl: string
  itemId: string
  headers?: HeadersInit
  signal: AbortSignal
  maxEdge?: number
  onProgress?: (loaded: number, total: number) => void
}

const CACHE_LIMIT = 2
const frameCache = new Map<string, StackFrames>()

function remember(key: string, frames: StackFrames) {
  if (frameCache.has(key)) frameCache.delete(key)
  frameCache.set(key, frames)
  while (frameCache.size > CACHE_LIMIT) {
    const oldest = frameCache.keys().next().value
    if (oldest === undefined) break
    frameCache.delete(oldest)
  }
}

async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next
      next += 1
      await worker(items[index])
    }
  }
  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => run()))
}

async function decodeLuminance(blob: Blob, width: number, height: number): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Could not read frame pixels')
    context.drawImage(bitmap, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    const plane = new Uint8Array(width * height)
    for (let pixel = 0, index = 0; pixel < pixels.length; pixel += 4, index += 1) {
      plane[index] = pixels[pixel]
    }
    return plane
  } finally {
    bitmap.close()
  }
}

/**
 * Download every channel plane for a Girder large_image hyperstack.
 * One region request per frame, resized so the volume stays interactive.
 */
export async function loadStackFrames(args: LoadStackFramesArgs): Promise<StackFrames> {
  const maxEdge = args.maxEdge ?? 512
  const cacheKey = `${args.apiBaseUrl}|${args.itemId}|${maxEdge}`
  const cached = frameCache.get(cacheKey)
  if (cached) {
    args.onProgress?.(1, 1)
    return cached
  }

  const headers = headersInitToRecord(args.headers ?? {})
  const infoResponse = await fetch(`${args.apiBaseUrl}/item/${encodeURIComponent(args.itemId)}/tiles`, {
    headers,
    signal: args.signal,
  })
  if (!infoResponse.ok) {
    throw new Error(`Tile metadata failed (${infoResponse.status})`)
  }
  const tile = (await infoResponse.json()) as StackTileInfo
  const channels = channelCount(tile)
  const depth = zCount(tile)
  const { width, height } = outputSize(tile.sizeX, tile.sizeY, maxEdge)
  const jobs: { channel: number; z: number; frame: number }[] = []
  for (let z = 0; z < depth; z += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      jobs.push({ channel, z, frame: frameFor(tile, channel, z) })
    }
  }

  const planes: Uint8Array[][] = Array.from({ length: channels }, () => new Array<Uint8Array>(depth))
  let loaded = 0
  args.onProgress?.(0, jobs.length)

  await mapPool(jobs, 4, async (job) => {
    if (args.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const params = new URLSearchParams({
      encoding: 'PNG',
      frame: String(job.frame),
      width: String(width),
      height: String(height),
    })
    const response = await fetch(
      `${args.apiBaseUrl}/item/${encodeURIComponent(args.itemId)}/tiles/region?${params}`,
      { headers, signal: args.signal },
    )
    if (!response.ok) {
      throw new Error(`Frame ${job.frame} failed (${response.status})`)
    }
    planes[job.channel][job.z] = await decodeLuminance(await response.blob(), width, height)
    loaded += 1
    args.onProgress?.(loaded, jobs.length)
  })

  const frames: StackFrames = {
    width,
    height,
    depth,
    channelCount: channels,
    sizeX: tile.sizeX,
    sizeY: tile.sizeY,
    planes,
  }
  remember(cacheKey, frames)
  return frames
}
