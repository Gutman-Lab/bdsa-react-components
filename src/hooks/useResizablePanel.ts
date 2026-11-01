import { useState, useRef, useEffect } from 'react'

interface UseResizablePanelOptions {
  defaultWidth?: number
  minWidth?: number
  side?: 'left' | 'right'
}

interface UseResizablePanelResult {
  width: number
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  handleResizeStart: (e: React.MouseEvent) => void
}

/** Movement above this many pixels is a drag; at or below it is a click. */
const CLICK_MOVEMENT_THRESHOLD_PX = 3

/**
 * Manages the width and collapsed state of a resizable side panel.
 * Attach `handleResizeStart` to the onMouseDown of a drag handle element.
 * A click on the drag handle (movement of at most 3px) collapses the panel;
 * dragging further than 3px resizes it instead.
 */
export function useResizablePanel({
  defaultWidth = 250,
  minWidth = 150,
  side = 'left',
}: UseResizablePanelOptions = {}): UseResizablePanelResult {
  const [width, setWidth] = useState(defaultWidth)
  const [collapsed, setCollapsed] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number; moved: boolean } | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startWidth: width, moved: false }

    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      const rawDelta = e.clientX - dragRef.current.startX
      const delta = side === 'right' ? -rawDelta : rawDelta

      // Only count as a drag after the explicit threshold. Small movements are
      // part of a click and must not resize the panel.
      if (Math.abs(delta) > CLICK_MOVEMENT_THRESHOLD_PX) {
        dragRef.current.moved = true
      }

      if (dragRef.current.moved) {
        setWidth(Math.max(minWidth, dragRef.current.startWidth + delta))
      }
    }

    function cleanup() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      cleanupRef.current = null
    }

    function onMouseUp() {
      const wasDragged = dragRef.current?.moved ?? false
      dragRef.current = null
      cleanup()

      if (!wasDragged) {
        setCollapsed(true)
      }
    }

    cleanupRef.current?.()
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    cleanupRef.current = cleanup
  }

  return { width, collapsed, setCollapsed, handleResizeStart }
}
