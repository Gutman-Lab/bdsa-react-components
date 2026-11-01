import { describe, expect, it } from 'vitest'
import { filterLargeImages, hasLargeImage, isAIModel, type ItemWithMeta } from './itemUtils'

describe('hasLargeImage', () => {
  it('returns true when largeImage is true at root level', () => {
    const item: ItemWithMeta = { _id: '123', name: 'test.svs', largeImage: true }
    expect(hasLargeImage(item)).toBe(true)
  })

  it('returns true when largeImage is "true" (string) at root level', () => {
    const item: ItemWithMeta = { _id: '123', name: 'test.svs', largeImage: 'true' }
    expect(hasLargeImage(item)).toBe(true)
  })

  it('returns true when largeImage is an object at root level', () => {
    const item: ItemWithMeta = { _id: '123', name: 'test.svs', largeImage: { width: 1024, height: 768 } }
    expect(hasLargeImage(item)).toBe(true)
  })

  it('returns true when largeImage is true in meta', () => {
    const item: ItemWithMeta = { _id: '123', name: 'test.svs', meta: { largeImage: true } }
    expect(hasLargeImage(item)).toBe(true)
  })

  it('returns false when largeImage is undefined', () => {
    const item: ItemWithMeta = { _id: '123', name: 'test.pdf' }
    expect(hasLargeImage(item)).toBe(false)
  })

  it('prioritizes root level over meta level', () => {
    const item: ItemWithMeta = {
      _id: '123',
      name: 'test.svs',
      largeImage: true,
      meta: { largeImage: false },
    }
    expect(hasLargeImage(item)).toBe(true)
  })

  it('falls back to meta level when root level is false', () => {
    const item: ItemWithMeta = {
      _id: '123',
      name: 'test.svs',
      largeImage: false,
      meta: { largeImage: true },
    }
    expect(hasLargeImage(item)).toBe(true)
  })
})

describe('filterLargeImages', () => {
  it('filters items to only include those with largeImage flag', () => {
    const items: ItemWithMeta[] = [
      { _id: '1', name: 'image1.svs', largeImage: true },
      { _id: '2', name: 'document.pdf' },
      { _id: '3', name: 'image2.tif', meta: { largeImage: true } },
    ]
    const filtered = filterLargeImages(items)
    expect(filtered).toHaveLength(2)
    expect(filtered.map(i => i._id)).toEqual(['1', '3'])
  })
})

describe('isAIModel', () => {
  it('returns true when dataset_args and train_args are present in meta', () => {
    const item: ItemWithMeta = {
      _id: '1',
      meta: { dataset_args: {}, train_args: {} },
    }
    expect(isAIModel(item)).toBe(true)
  })

  it('returns false when meta is missing', () => {
    expect(isAIModel({ _id: '1' })).toBe(false)
  })
})
