import { describe, expect, it } from 'vitest'
import { buildOverlayGeometry } from './overlayGeometry'

describe('buildOverlayGeometry', () => {
  it('scales slide pixels to the loaded volume and centers them', () => {
    const geometry = buildOverlayGeometry(
      [{ points: [[0, 0], [100, 0], [100, 100]], z: 4 }],
      50,
      50,
      100,
      100,
    )

    expect(geometry.polygonCount).toBe(1)
    expect(Array.from(geometry.points)).toEqual([
      -25, -25, 4,
      25, -25, 4,
      25, 25, 4,
    ])
  })

  it('drops a repeated closing point and keeps the polygon cell closed', () => {
    const geometry = buildOverlayGeometry(
      [{ points: [[0, 0], [10, 0], [10, 10], [0, 0]], z: 2 }],
      10,
      10,
    )

    expect(geometry.polygonCount).toBe(1)
    expect(Array.from(geometry.polygons)).toEqual([3, 0, 1, 2])
    expect(Array.from(geometry.lines)).toEqual([4, 0, 1, 2, 0])
    expect(geometry.points.length).toBe(9)
  })

  it('scales x and y independently when the volume is not square', () => {
    const geometry = buildOverlayGeometry([{ points: [[0, 0], [100, 50], [100, 0]], z: 0 }], 40, 20, 100, 50)

    expect(Array.from(geometry.points)).toEqual([
      -20, -10, 0,
      20, 10, 0,
      20, -10, 0,
    ])
  })

  it('skips degenerate polygons', () => {
    const geometry = buildOverlayGeometry(
      [
        { points: [[0, 0], [1, 1]], z: 0 },
        { points: [[0, 0], [10, 0], [10, 10]], z: 1 },
      ],
      10,
      10,
    )

    expect(geometry.polygonCount).toBe(1)
    expect(geometry.points.length).toBe(9)
  })

  it('returns empty arrays for no polygons', () => {
    const geometry = buildOverlayGeometry([], 10, 10)

    expect(geometry.polygonCount).toBe(0)
    expect(geometry.points.length).toBe(0)
    expect(geometry.polygons.length).toBe(0)
    expect(geometry.lines.length).toBe(0)
  })
})
