import { describe, expect, it } from 'vitest'
import { parseAnnotationDocument } from './SlideViewer.utils'

const MAX_POINTS = 10000

function elementsDoc(elements: unknown[]) {
    return { annotation: { name: 'test annotations', elements } }
}

describe('parseAnnotationDocument', () => {
    it('parses legacy top-left rectangles', () => {
        const result = parseAnnotationDocument(
            elementsDoc([
                {
                    type: 'rectangle',
                    x: 10,
                    y: 20,
                    width: 30,
                    height: 40,
                    lineColor: '#ff0000',
                    group: 'legacy',
                },
            ]),
            'annotation-1',
            '#00ff00',
            MAX_POINTS
        )

        expect(result.features).toHaveLength(1)
        expect(result.features[0]).toMatchObject({
            left: 10,
            top: 20,
            width: 30,
            height: 40,
            color: '#ff0000',
            annotationType: 'rectangle',
            documentId: 'annotation-1',
        })
    })

    it('converts Girder center-based rectangles to bounding boxes', () => {
        const result = parseAnnotationDocument(
            elementsDoc([
                {
                    type: 'rectangle',
                    center: [225, 198, 0],
                    width: 206,
                    height: 288,
                    rotation: 0,
                    lineColor: '#f97316',
                    group: 'artseg_wall',
                },
            ]),
            'annotation-2',
            '#00ff00',
            MAX_POINTS
        )

        expect(result.features).toHaveLength(1)
        expect(result.features[0]).toMatchObject({
            left: 225 - 206 / 2,
            top: 198 - 288 / 2,
            width: 206,
            height: 288,
            color: '#f97316',
            annotationType: 'rectangle',
            documentId: 'annotation-2',
        })
        expect(result.docInfo.types).toContain('rectangle')
    })

    it('accepts string coordinates in center-based rectangles', () => {
        const result = parseAnnotationDocument(
            elementsDoc([
                {
                    type: 'rectangle',
                    center: ['100', '50'],
                    width: '20',
                    height: '10',
                },
            ]),
            'annotation-3',
            '#00ff00',
            MAX_POINTS
        )

        expect(result.features).toHaveLength(1)
        expect(result.features[0]).toMatchObject({ left: 90, top: 45, width: 20, height: 10 })
    })

    it('still skips center-based rectangles with rotation', () => {
        const result = parseAnnotationDocument(
            elementsDoc([
                {
                    type: 'rectangle',
                    center: [100, 100, 0],
                    width: 20,
                    height: 10,
                    rotation: 45,
                },
            ]),
            'annotation-4',
            '#00ff00',
            MAX_POINTS
        )

        expect(result.features).toHaveLength(0)
    })

    it('leaves non-rectangle elements unchanged', () => {
        const result = parseAnnotationDocument(
            elementsDoc([
                {
                    type: 'polyline',
                    points: [
                        [0, 0],
                        [10, 20],
                    ],
                    lineColor: '#123456',
                    group: 'outline',
                },
            ]),
            'annotation-6',
            '#00ff00',
            MAX_POINTS
        )

        expect(result.features).toHaveLength(1)
        expect(result.features[0]).toMatchObject({
            left: 0,
            top: 0,
            width: 10,
            height: 20,
            color: '#123456',
            annotationType: 'polyline',
            documentId: 'annotation-6',
        })
        expect(result.features[0].points).toEqual([
            [0, 0],
            [10, 20],
        ])
    })

    it('drops rectangles without usable geometry', () => {
        const result = parseAnnotationDocument(
            elementsDoc([
                { type: 'rectangle', width: 20, height: 10 },
                { type: 'rectangle', center: [50], width: 20, height: 10 },
                { type: 'rectangle', center: [50, 50], width: 0, height: 10 },
            ]),
            'annotation-5',
            '#00ff00',
            MAX_POINTS
        )

        expect(result.features).toHaveLength(0)
    })
})
