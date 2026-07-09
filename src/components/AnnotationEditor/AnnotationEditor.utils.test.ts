import { describe, expect, it } from 'vitest'
import {
    findAnnotationTypeIndexForKey,
    formatTypeHotkeyHint,
    formatRoiDropdownLabel,
    effectiveRoiFillOpacity,
    shouldBlockOpenSeadragonKey,
    isFinishShapeEditKey,
    documentElementsSnapshot,
    resolveAutoSaveSettings,
    centerViewerOnElement,
    clampRoiTopLeft,
    findTopmostLabelItemIdxAtImagePoint,
    wouldRegressServerAnnotation,
} from './AnnotationEditor.utils'
import type { AnnotationType } from './AnnotationEditor.types'

const tauTypes: AnnotationType[] = [
    { name: 'PreTangle', color: '#f00', key: 'D', defaultWidth: 1, defaultHeight: 1 },
    { name: 'MatureTangle', color: '#00f', key: 'F', defaultWidth: 1, defaultHeight: 1 },
]

describe('annotation editor hotkeys', () => {
    it('findAnnotationTypeIndexForKey matches config keys case-insensitively', () => {
        expect(findAnnotationTypeIndexForKey(tauTypes, 'd')).toBe(0)
        expect(findAnnotationTypeIndexForKey(tauTypes, 'F')).toBe(1)
        expect(findAnnotationTypeIndexForKey(tauTypes, 'x')).toBeNull()
    })

    it('shouldBlockOpenSeadragonKey blocks WASD-class keys and review nav', () => {
        expect(shouldBlockOpenSeadragonKey('w', 'add-labels', tauTypes)).toBe(false)
        expect(shouldBlockOpenSeadragonKey('w', 'edit-rois', tauTypes)).toBe(true)
        expect(shouldBlockOpenSeadragonKey('D', 'review', tauTypes)).toBe(true)
        expect(shouldBlockOpenSeadragonKey('ArrowRight', 'review', tauTypes)).toBe(true)
        expect(shouldBlockOpenSeadragonKey('s', 'edit-rois', tauTypes)).toBe(false)
    })

    it('shouldBlockOpenSeadragonKey blocks bracket cycle in add-labels draw mode', () => {
        expect(shouldBlockOpenSeadragonKey('[', 'add-labels', tauTypes)).toBe(true)
        expect(shouldBlockOpenSeadragonKey(']', 'add-labels', tauTypes)).toBe(true)
        expect(shouldBlockOpenSeadragonKey('w', 'add-labels', tauTypes, undefined, false)).toBe(false)
    })

    it('shouldBlockOpenSeadragonKey releases pan keys in add-labels pan mode', () => {
        expect(shouldBlockOpenSeadragonKey('w', 'add-labels', tauTypes, undefined, false)).toBe(false)
        expect(shouldBlockOpenSeadragonKey('s', 'add-labels', tauTypes, undefined, false)).toBe(false)
        expect(shouldBlockOpenSeadragonKey('t', 'add-labels', tauTypes, undefined, false)).toBe(true)
        expect(shouldBlockOpenSeadragonKey('d', 'add-labels', tauTypes, undefined, false)).toBe(true)
    })

    it('shouldBlockOpenSeadragonKey blocks finish keys while shape editing', () => {
        expect(shouldBlockOpenSeadragonKey('f', 'add-labels', tauTypes, undefined, true, true)).toBe(true)
        expect(shouldBlockOpenSeadragonKey('Enter', 'edit-rois', tauTypes, undefined, true, true)).toBe(true)
        expect(shouldBlockOpenSeadragonKey('Escape', 'review', tauTypes, undefined, true, true)).toBe(true)
        expect(shouldBlockOpenSeadragonKey('x', 'add-labels', tauTypes, { finishShapeEdit: 'x' }, true, false)).toBe(false)
    })

    it('isFinishShapeEditKey accepts Enter and configured finish key', () => {
        expect(isFinishShapeEditKey('Enter')).toBe(true)
        expect(isFinishShapeEditKey('f')).toBe(true)
        expect(isFinishShapeEditKey('g', { finishShapeEdit: 'g' })).toBe(true)
        expect(isFinishShapeEditKey('x')).toBe(false)
    })

    it('resolveAutoSaveSettings applies defaults', () => {
        expect(resolveAutoSaveSettings(false)).toEqual({
            enabled: false,
            debounceMs: 2500,
            saveOnUnmount: true,
        })
        expect(resolveAutoSaveSettings(true)).toEqual({
            enabled: true,
            debounceMs: 2500,
            saveOnUnmount: true,
        })
        expect(resolveAutoSaveSettings({ debounceMs: 1000, saveOnUnmount: false })).toEqual({
            enabled: true,
            debounceMs: 1000,
            saveOnUnmount: false,
        })
    })

    it('documentElementsSnapshot serializes elements only', () => {
        const snap = documentElementsSnapshot({
            name: 'a',
            description: '',
            elements: [{
                type: 'rectangle',
                group: 'ROI',
                label: { value: 'r1' },
                center: [0, 0, 0],
                width: 1,
                height: 1,
                rotation: 0,
                lineColor: '#000',
                lineWidth: 1,
                fillColor: '#000',
            }],
        })
        expect(JSON.parse(snap)).toHaveLength(1)
    })

    it('formatTypeHotkeyHint lists assign keys and Q/W cycle', () => {
        expect(formatTypeHotkeyHint(tauTypes)).toBe('D F assign · Q/W cycle')
    })

    it('formatTypeHotkeyHint uses bracket cycle in add-labels mode', () => {
        expect(formatTypeHotkeyHint(tauTypes, 'add-labels')).toBe('D F assign · [ ] cycle · WASD pan')
    })

    it('findTopmostLabelItemIdxAtImagePoint returns topmost hit', () => {
        const items = [
            { bounds: { contains: (p: { x: number; y: number }) => p.x === 1 && p.y === 1 } },
            { bounds: { contains: (p: { x: number; y: number }) => p.x >= 0 && p.x <= 10 && p.y >= 0 && p.y <= 10 } },
        ]
        expect(findTopmostLabelItemIdxAtImagePoint(items, { x: 1, y: 1 })).toBe(1)
        expect(findTopmostLabelItemIdxAtImagePoint(items, { x: 50, y: 50 })).toBe(-1)
    })

    it('clampRoiTopLeft keeps ROI inside the image', () => {
        expect(clampRoiTopLeft(-10, 5, 100, 80, 1000, 800)).toEqual({ left: 0, top: 5 })
        expect(clampRoiTopLeft(950, 750, 100, 80, 1000, 800)).toEqual({ left: 900, top: 720 })
    })

    it('centerViewerOnElement pans without changing zoom', () => {
        const panTo = vi.fn()
        const viewer = {
            viewport: {
                imageToViewportCoordinates: (pt: { x: number; y: number }) => ({ x: pt.x / 1000, y: pt.y / 1000 }),
                panTo,
            },
        }
        const ok = centerViewerOnElement(
            viewer,
            {
                type: 'rectangle',
                group: 'Tumor',
                label: { value: 'a' },
                center: [2000, 1500, 0],
                width: 100,
                height: 100,
                rotation: 0,
                lineColor: '#000',
                lineWidth: 2,
                fillColor: 'rgba(0,0,0,0.1)',
            },
            { Point: class { constructor(public x: number, public y: number) {} } },
        )
        expect(ok).toBe(true)
        expect(panTo).toHaveBeenCalledWith({ x: 2, y: 1.5 }, true)
    })
})

describe('formatRoiDropdownLabel', () => {
    it('adds numeric suffix when labels are duplicated', () => {
        const labels = ['ROI', 'ROI', 'ROI']
        expect(formatRoiDropdownLabel('ROI', 0, labels)).toBe('ROI 1')
        expect(formatRoiDropdownLabel('ROI', 1, labels)).toBe('ROI 2')
        expect(formatRoiDropdownLabel('ROI', 2, labels)).toBe('ROI 3')
    })

    it('leaves unique labels unchanged', () => {
        const labels = ['roi1', 'roi2', 'roi3']
        expect(formatRoiDropdownLabel('roi1', 0, labels)).toBe('roi1')
        expect(formatRoiDropdownLabel('roi2', 1, labels)).toBe('roi2')
    })
})

describe('wouldRegressServerAnnotation', () => {
    it('blocks fewer ROIs on server', () => {
        expect(wouldRegressServerAnnotation(0, 0, 2, 43)).toBe(true)
        expect(wouldRegressServerAnnotation(1, 10, 2, 43)).toBe(true)
    })

    it('allows equal or greater local ROI counts', () => {
        expect(wouldRegressServerAnnotation(2, 43, 2, 43)).toBe(false)
        expect(wouldRegressServerAnnotation(6, 98, 2, 43)).toBe(false)
    })

    it('blocks empty local doc over non-empty server', () => {
        expect(wouldRegressServerAnnotation(0, 0, 0, 5)).toBe(true)
    })
})

describe('effectiveRoiFillOpacity', () => {
    it('returns 0 when fill is hidden', () => {
        expect(effectiveRoiFillOpacity(false, { fillOpacity: 0.1 })).toBe(0)
    })

    it('uses roiSettings fillOpacity when visible', () => {
        expect(effectiveRoiFillOpacity(true, { fillOpacity: 0.1 })).toBe(0.1)
    })
})
