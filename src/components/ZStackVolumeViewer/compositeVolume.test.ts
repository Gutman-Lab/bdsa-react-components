import { describe, expect, it } from 'vitest'
import { compositeVolume, stainedRange } from './compositeVolume'
import { frameFor, outputSize } from './stackGeometry'

describe('compositeVolume', () => {
  it('flips image Y and writes the channel color', () => {
    const plane = new Uint8Array([10, 0, 0, 20])
    const rgba = compositeVolume([ [plane] ], 2, 2, 1, [
      { index: 0, color: '#ff0000', visible: true },
    ])
    // Image (x=1, y=1) lands on volume y=0.
    expect(Array.from(rgba.slice(4, 8))).toEqual([20, 0, 0, 20])
    // Image (x=0, y=0) lands on volume y=1.
    expect(Array.from(rgba.slice(8, 12))).toEqual([10, 0, 0, 10])
  })

  it('adds channels and keeps black at zero', () => {
    const blue = [new Uint8Array([100])]
    const red = [new Uint8Array([50])]
    const rgba = compositeVolume([blue, red], 1, 1, 1, [
      { index: 0, color: '#0000ff', visible: true },
      { index: 1, color: '#ff0000', visible: false },
    ])
    expect(Array.from(rgba)).toEqual([0, 0, 100, 100])

    const both = compositeVolume([blue, red], 1, 1, 1, [
      { index: 0, color: '#0000ff', visible: true },
      { index: 1, color: '#ff0000', visible: true },
    ])
    expect(Array.from(both)).toEqual([50, 0, 100, 100])
  })

  it('multiplies stain by the contrast curve and leaves black empty', () => {
    const rgba = compositeVolume([[new Uint8Array([0, 20])]], 2, 1, 1, [
      { index: 0, color: '#ff0000', visible: true },
    ], { contrast: 1 })
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 0])
    expect(Array.from(rgba.slice(4, 8))).toEqual([100, 0, 0, 100])
  })

  it('can leave every plane but one empty', () => {
    const rgba = compositeVolume([[new Uint8Array([10]), new Uint8Array([40])]], 1, 1, 2, [
      { index: 0, color: '#ff0000', visible: true },
    ], { plane: 1 })
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 0])
    expect(Array.from(rgba.slice(4, 8))).toEqual([40, 0, 0, 40])
  })

  it('drops counts at or below the background floor', () => {
    const rgba = compositeVolume([[new Uint8Array([8, 20])]], 2, 1, 1, [
      { index: 0, color: '#ff0000', visible: true },
    ], { floor: 8 })
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 0])
    expect(Array.from(rgba.slice(4, 8))).toEqual([20, 0, 0, 20])
  })
})

describe('stainedRange', () => {
  it('pads the stained voxels and flips Y into volume coordinates', () => {
    const plane = new Uint8Array(10)
    plane[5] = 10
    const wide = stainedRange([[plane]], 10, 1, 1)
    expect(wide.sagittal).toEqual({ min: 4, max: 6 })

    const column = new Uint8Array(10)
    column[0] = 10
    const tall = stainedRange([[column]], 1, 10, 1)
    expect(tall.coronal).toEqual({ min: 8, max: 9 })
  })
})

describe('stack geometry', () => {
  it('addresses channel-fastest hyperstacks', () => {
    const tile = { sizeX: 8, sizeY: 8, IndexRange: { IndexC: 3, IndexZ: 15 }, IndexStride: { IndexC: 1, IndexZ: 3 } }
    expect(frameFor(tile, 2, 1)).toBe(5)
  })

  it('only downsamples images larger than the volume edge', () => {
    expect(outputSize(1024, 1024, 512)).toEqual({ width: 512, height: 512 })
    expect(outputSize(100, 50, 512)).toEqual({ width: 100, height: 50 })
  })
})
