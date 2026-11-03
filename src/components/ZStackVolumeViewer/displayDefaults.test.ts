import { describe, expect, it } from 'vitest'
import { DEFAULT_BRIGHTNESS, DEFAULT_CONTRAST } from './ZStackVolumeViewer'

describe('ZStackVolumeViewer display defaults', () => {
  it('matches the 2D viewer defaults for dim stains', () => {
    expect(DEFAULT_BRIGHTNESS).toBe(0.75)
    expect(DEFAULT_CONTRAST).toBe(0.75)
  })
})
