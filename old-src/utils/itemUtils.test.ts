import { describe, it, expect } from 'vitest'
import { hasLargeImage, filterLargeImages, type Item } from './itemUtils'

describe('hasLargeImage', () => {
    it('returns true when largeImage is true at root level', () => {
        const item: Item = {
            _id: '123',
            name: 'test.svs',
            largeImage: true,
        }
        expect(hasLargeImage(item)).toBe(true)
    })

    it('returns true when largeImage is "true" (string) at root level', () => {
        const item: Item = {
            _id: '123',
            name: 'test.svs',
            largeImage: 'true',
        }
        expect(hasLargeImage(item)).toBe(true)
    })

    it('returns true when largeImage is an object at root level', () => {
        const item: Item = {
            _id: '123',
            name: 'test.svs',
            largeImage: { width: 1024, height: 768 },
        }
        expect(hasLargeImage(item)).toBe(true)
    })

    it('returns true when largeImage is true in meta', () => {
        const item: Item = {
            _id: '123',
            name: 'test.svs',
            meta: {
                largeImage: true,
            },
        }
        expect(hasLargeImage(item)).toBe(true)
    })

    it('returns true when largeImage is "true" (string) in meta', () => {
        const item: Item = {
            _id: '123',
            name: 'test.svs',
            meta: {
                largeImage: 'true',
            },
        }
        expect(hasLargeImage(item)).toBe(true)
    })

    it('returns true when largeImage is an object in meta', () => {
        const item: Item = {
            _id: '123',
            name: 'test.svs',
            meta: {
                largeImage: { width: 2048, height: 1536 },
            },
        }
        expect(hasLargeImage(item)).toBe(true)
    })

    it('returns false when largeImage is false at root level', () => {
        const item: Item = {
            _id: '123',
            name: 'test.pdf',
            largeImage: false,
        }
        expect(hasLargeImage(item)).toBe(false)
    })

    it('returns false when largeImage is undefined', () => {
        const item: Item = {
            _id: '123',
            name: 'test.pdf',
        }
        expect(hasLargeImage(item)).toBe(false)
    })

    it('returns false when meta exists but largeImage is not set', () => {
        const item: Item = {
            _id: '123',
            name: 'test.pdf',
            meta: {
                someOtherProperty: 'value',
            },
        }
        expect(hasLargeImage(item)).toBe(false)
    })

    it('returns false when largeImage is null', () => {
        const item: Item = {
            _id: '123',
            name: 'test.pdf',
            largeImage: null,
        }
        expect(hasLargeImage(item)).toBe(false)
    })

    it('prioritizes root level over meta level', () => {
        const item: Item = {
            _id: '123',
            name: 'test.svs',
            largeImage: true,
            meta: {
                largeImage: false,
            },
        }
        // Root level takes precedence
        expect(hasLargeImage(item)).toBe(true)
    })

    it('falls back to meta level when root level is false', () => {
        const item: Item = {
            _id: '123',
            name: 'test.svs',
            largeImage: false,
            meta: {
                largeImage: true,
            },
        }
        // Meta level is checked as fallback
        expect(hasLargeImage(item)).toBe(true)
    })
})

describe('filterLargeImages', () => {
    it('filters items to only include those with largeImage flag', () => {
        const items: Item[] = [
            { _id: '1', name: 'image1.svs', largeImage: true },
            { _id: '2', name: 'document.pdf' },
            { _id: '3', name: 'image2.tif', meta: { largeImage: true } },
            { _id: '4', name: 'text.txt', largeImage: false },
            { _id: '5', name: 'image3.ndpi', largeImage: { width: 1024, height: 768 } },
        ]

        const filtered = filterLargeImages(items)

        expect(filtered).toHaveLength(3)
        expect(filtered.map(item => item._id)).toEqual(['1', '3', '5'])
    })

    it('returns empty array when no items have largeImage flag', () => {
        const items: Item[] = [
            { _id: '1', name: 'document.pdf' },
            { _id: '2', name: 'text.txt' },
        ]

        const filtered = filterLargeImages(items)

        expect(filtered).toHaveLength(0)
    })

    it('returns all items when all have largeImage flag', () => {
        const items: Item[] = [
            { _id: '1', name: 'image1.svs', largeImage: true },
            { _id: '2', name: 'image2.tif', meta: { largeImage: true } },
        ]

        const filtered = filterLargeImages(items)

        expect(filtered).toHaveLength(2)
    })

    it('returns empty array when input is empty', () => {
        const filtered = filterLargeImages([])

        expect(filtered).toHaveLength(0)
    })
})







