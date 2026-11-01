import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResizablePanel } from './useResizablePanel'

function startDrag(clientX: number) {
    return { clientX, preventDefault: () => {} } as React.MouseEvent
}

describe('useResizablePanel', () => {
    it('collapses on press + release with no movement', () => {
        const { result } = renderHook(() => useResizablePanel({ defaultWidth: 250 }))

        act(() => {
            result.current.handleResizeStart(startDrag(100))
        })
        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup'))
        })

        expect(result.current.collapsed).toBe(true)
        expect(result.current.width).toBe(250)
    })

    it('collapses when movement stays within the 3px click threshold', () => {
        const { result } = renderHook(() => useResizablePanel({ defaultWidth: 250 }))

        act(() => {
            result.current.handleResizeStart(startDrag(100))
        })
        act(() => {
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 103 }))
        })
        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup'))
        })

        expect(result.current.width).toBe(250)
        expect(result.current.collapsed).toBe(true)
    })

    it('resizes instead of collapsing when the drag exceeds 3px', () => {
        const { result } = renderHook(() => useResizablePanel({ defaultWidth: 250 }))

        act(() => {
            result.current.handleResizeStart(startDrag(100))
        })
        act(() => {
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 120 }))
        })

        expect(result.current.width).toBe(270)
        expect(result.current.collapsed).toBe(false)

        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup'))
        })

        expect(result.current.width).toBe(270)
        expect(result.current.collapsed).toBe(false)
    })

    it('respects minWidth when dragged inward', () => {
        const { result } = renderHook(() =>
            useResizablePanel({ defaultWidth: 250, minWidth: 150 })
        )

        act(() => {
            result.current.handleResizeStart(startDrag(100))
        })
        act(() => {
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }))
        })
        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup'))
        })

        expect(result.current.width).toBe(150)
        expect(result.current.collapsed).toBe(false)
    })
})
