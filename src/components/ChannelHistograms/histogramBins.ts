/** One bin per stored count, 0 through 255. */
export interface ChannelHistogram {
  counts: number[]
  /** Left edge of each bin, plus the right edge of the last bin. */
  edges: number[]
}

export function emptyHistogram(): ChannelHistogram {
  return {
    counts: new Array<number>(256).fill(0),
    edges: Array.from({ length: 257 }, (_, index) => index),
  }
}

/** Count stored pixel values. Values outside 0–255 are ignored. */
export function histogramBins(samples: ArrayLike<number>[]): ChannelHistogram {
  const histogram = emptyHistogram()
  for (const sample of samples) {
    for (let index = 0; index < sample.length; index += 1) {
      const value = sample[index]
      if (value >= 0 && value <= 255) histogram.counts[value] += 1
    }
  }
  return histogram
}

export function histogramMax(histogram: ChannelHistogram): number {
  for (let index = histogram.counts.length - 1; index >= 0; index -= 1) {
    if (histogram.counts[index] > 0) return Math.round(histogram.edges[index] ?? index)
  }
  return 0
}

/** Where a raw count sits across the chart, from 0 at the left edge to 1 at the right. */
export function histogramFraction(histogram: ChannelHistogram, value: number): number {
  const start = histogram.edges[0] ?? 0
  const end = histogram.edges[histogram.edges.length - 1] ?? histogram.counts.length
  if (end === start) return 0
  return Math.min(1, Math.max(0, (value - start) / (end - start)))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

/** large_image returns one histogram or a list with one entry per frame. */
export function parseImageHistogram(body: unknown): ChannelHistogram | null {
  const record = Array.isArray(body) ? asRecord(body[0]) : asRecord(body)
  if (!record || !Array.isArray(record.hist) || record.hist.length === 0) return null
  const counts = record.hist.map((value) => Number(value) || 0)
  const rawEdges = Array.isArray(record.bin_edges) ? record.bin_edges.map((value) => Number(value)) : []
  const edges =
    rawEdges.length === counts.length + 1 && rawEdges.every((value) => Number.isFinite(value))
      ? rawEdges
      : counts.map((_, index) => index).concat(counts.length)
  return { counts, edges }
}
