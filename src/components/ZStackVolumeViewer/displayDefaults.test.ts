import { describe, expect, it } from 'vitest'
import { DEFAULT_BRIGHTNESS, DEFAULT_CONTRAST, DEFAULT_DEPTH } from './ZStackVolumeViewer'

describe('ZStackVolumeViewer display defaults', () => {
  it('matches the 2D viewer defaults for dim stains', () => {
    expect(DEFAULT_BRIGHTNESS).toBe(0.75)
    expect(DEFAULT_CONTRAST).toBe(0.75)
  })

  it('uses a nearly isotropic z spacing for the z-stack', () => {
    expect(DEFAULT_DEPTH).toBe(2)
  })
})
