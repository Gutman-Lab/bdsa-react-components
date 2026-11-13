import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DsaThumbnailBrowser } from './DsaThumbnailBrowser'
import type { Item } from '../../utils/itemUtils'

const osdPropsRef = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))

vi.mock('../OSDThumbnailBrowser/OSDThumbnailBrowser', async () => {
    const ReactModule = await import('react')
    return {
        OSDThumbnailBrowser: (props: Record<string, unknown>) => {
            osdPropsRef.current = props
            return ReactModule.createElement('div', { 'data-testid': 'osd-browser' })
        },
    }
})

const apiBaseUrl = 'https://dsa.example.test/api/v1'

function item(id: string, name: string, largeImage = true): Item {
    return { _id: id, name, largeImage }
}

const requiredProps = {
    imageSource: 'tiles' as const,
    requireLargeImage: true,
    thumbnailImageSize: 256,
    apiBaseUrl,
}

beforeEach(() => {
    osdPropsRef.current = null
})

describe('DsaThumbnailBrowser viewer mode', () => {
    it('renders the static ThumbnailGrid and uses download image URLs', async () => {
        const onClick = vi.fn()
        render(
            <DsaThumbnailBrowser
                {...requiredProps}
                viewerMode="static"
                imageSource="download"
                items={[item('1', 'Alpha')]}
                viewerSize="s"
                itemsPerPage={2}
                onThumbnailClick={onClick}
            />
        )

        await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument())
        expect(screen.queryByTestId('osd-browser')).not.toBeInTheDocument()

        const image = screen.getByRole('img', { name: 'Alpha' })
        expect(image.getAttribute('src')).toBe(
            `${apiBaseUrl}/item/1/download?contentDisposition=inline`
        )

        fireEvent.click(screen.getByText('Alpha'))
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ _id: '1' }))
    })

    it('renders the OpenSeadragon browser and forwards viewer/annotation props', () => {
        const annotationNameToIds = new Map([['2', 'annotation-2']])

        render(
            <DsaThumbnailBrowser
                {...requiredProps}
                viewerMode="openseadragon"
                items={[item('2', 'Bravo')]}
                viewerSize="l"
                itemsPerPage={7}
                showViewerControls={false}
                requireLargeImage={false}
                selectedAnnotationName="Tumor"
                annotationNameToIds={annotationNameToIds}
            />
        )

        expect(screen.getByTestId('osd-browser')).toBeInTheDocument()
        expect(osdPropsRef.current).toMatchObject({
            itemsPerPage: 7,
            viewerSize: 'l',
            showViewerControls: false,
            requireLargeImage: false,
            selectedAnnotationName: 'Tumor',
        })
        expect(osdPropsRef.current?.annotationNameToIds).toBe(annotationNameToIds)
    })
})

describe('DsaThumbnailBrowser static image forwarding', () => {
    it('forwards thumbnailImageSize to the tiles thumbnail URL', async () => {
        render(
            <DsaThumbnailBrowser
                {...requiredProps}
                viewerMode="static"
                thumbnailImageSize={320}
                items={[item('3', 'Charlie')]}
            />
        )

        await waitFor(() => expect(screen.getByText('Charlie')).toBeInTheDocument())
        expect(screen.getByRole('img', { name: 'Charlie' }).getAttribute('src')).toBe(
            `${apiBaseUrl}/item/3/tiles/thumbnail?width=320`
        )
    })

    it('keeps items without a largeImage flag when requireLargeImage is false', async () => {
        const items = [item('4', 'Large image', true), item('5', 'Download only', false)]

        render(
            <DsaThumbnailBrowser
                {...requiredProps}
                viewerMode="static"
                requireLargeImage={false}
                items={items}
            />
        )

        await waitFor(() => expect(screen.getByText('Download only')).toBeInTheDocument())
        expect(screen.getByText('Large image')).toBeInTheDocument()
    })

    it('still filters out non-large images when requireLargeImage is true', async () => {
        const items = [item('4', 'Large image', true), item('5', 'Download only', false)]

        render(
            <DsaThumbnailBrowser
                {...requiredProps}
                viewerMode="static"
                requireLargeImage
                items={items}
            />
        )

        await waitFor(() => expect(screen.getByText('Large image')).toBeInTheDocument())
        expect(screen.queryByText('Download only')).not.toBeInTheDocument()
    })

    it('filters visible items through annotationNameToIds', async () => {
        const items = [
            item('6', 'Alpha slide'),
            item('7', 'Bravo slide'),
            item('8', 'Charlie slide'),
        ]

        render(
            <DsaThumbnailBrowser
                {...requiredProps}
                viewerMode="static"
                items={items}
                selectedAnnotationName="Tumor"
                annotationNameToIds={new Map([['7', 'annotation-7']])}
            />
        )

        await waitFor(() => expect(screen.getByText('Bravo slide')).toBeInTheDocument())
        expect(screen.queryByText('Alpha slide')).not.toBeInTheDocument()
        expect(screen.queryByText('Charlie slide')).not.toBeInTheDocument()
    })
})

describe('DsaThumbnailBrowser static page size', () => {
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
    const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')

    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            get() {
                return this.classList?.contains('bdsa-thumbnail-grid__grid') ? 500 : 0
            },
        })
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
            configurable: true,
            get() {
                return this.classList?.contains('bdsa-thumbnail-grid__grid') ? 260 : 0
            },
        })
    })

    afterAll(() => {
        if (originalOffsetWidth != null) {
            Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth)
        } else {
            delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth
        }
        if (originalClientHeight != null) {
            Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight)
        } else {
            delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
        }
    })

    it('uses the measured ResizeObserver page size instead of the supplied itemsPerPage', async () => {
        const items = [
            item('9', 'One'),
            item('10', 'Two'),
            item('11', 'Three'),
            item('12', 'Four'),
        ]

        render(
            <DsaThumbnailBrowser
                {...requiredProps}
                viewerMode="static"
                requireLargeImage={false}
                viewerSize="s"
                itemsPerPage={1}
                items={items}
            />
        )

        // The live grid box fits three columns by two rows, so all four items
        // are visible even though the caller asked for one item per page.
        await waitFor(() => expect(screen.getByText('Four')).toBeInTheDocument())
        expect(screen.getByText('One')).toBeInTheDocument()
        expect(screen.getByText('Two')).toBeInTheDocument()
        expect(screen.getByText('Three')).toBeInTheDocument()
    })
})
