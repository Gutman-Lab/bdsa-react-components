import { parseImageHistogram, type ChannelHistogram } from './histogramBins'

/**
 * Pixel histogram for one large_image frame. Same endpoint the MXIF color
 * picker uses: `/item/{id}/tiles/histogram`.
 */
export async function fetchImageHistogram(
  apiBaseUrl: string,
  itemId: string,
  frame: number,
  headers: HeadersInit,
  signal?: AbortSignal,
  range: { min: number; max: number } = { min: 0, max: 255 },
): Promise<ChannelHistogram> {
  const params = new URLSearchParams({
    frame: String(frame),
    bins: '256',
    rangeMin: String(range.min),
    rangeMax: String(range.max),
  })
  const response = await fetch(
    `${apiBaseUrl}/item/${encodeURIComponent(itemId)}/tiles/histogram?${params}`,
    { headers, signal },
  )
  if (!response.ok) {
    throw new Error(`Histogram failed (${response.status})`)
  }
  const histogram = parseImageHistogram(await response.json())
  if (!histogram) throw new Error('Histogram response was empty')
  return histogram
}
