import { describe, expect, it } from 'vitest'
import { histogramBins, histogramFraction, histogramMax, parseImageHistogram } from './histogramBins'

describe('histogramBins', () => {
  it('counts stored values and ignores anything outside 0–255', () => {
    const histogram = histogramBins([Uint8Array.of(8, 20, 8), Uint8Array.of(20)])
    expect(histogram.counts[8]).toBe(2)
    expect(histogram.counts[20]).toBe(2)
    expect(histogram.counts[0]).toBe(0)
    expect(histogramMax(histogram)).toBe(20)
  })

  it('places a floor on the same axis as the bins', () => {
    const histogram = histogramBins([Uint8Array.of(0)])
    expect(histogramFraction(histogram, 8)).toBeCloseTo(8 / 256)
    expect(histogramFraction(histogram, -4)).toBe(0)
    expect(histogramFraction(histogram, 400)).toBe(1)
  })
})

describe('parseImageHistogram', () => {
  it('reads a large_image histogram object', () => {
    const histogram = parseImageHistogram({
      hist: [0, 4, 1],
      bin_edges: [0, 1, 2, 3],
    })
    expect(histogram?.counts).toEqual([0, 4, 1])
    expect(histogramMax(histogram!)).toBe(2)
  })

  it('reads the first entry when the server returns a list', () => {
    const histogram = parseImageHistogram([{ hist: [3], bin_edges: [0, 10] }])
    expect(histogram?.counts).toEqual([3])
    expect(histogram?.edges).toEqual([0, 10])
  })
})
