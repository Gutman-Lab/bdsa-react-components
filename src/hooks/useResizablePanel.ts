import { useState, useRef } from 'react'

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

/**
 * Manages the width and collapsed state of a resizable side panel.
 * Attach `handleResizeStart` to the onMouseDown of a drag handle element.
 * A click on the drag handle (no movement) collapses the panel.
 */
export function useResizablePanel({
  defaultWidth = 250,
  minWidth = 150,
  side = 'left',
}: UseResizablePanelOptions = {}): UseResizablePanelResult {
  const [width, setWidth] = useState(defaultWidth)
  const [collapsed, setCollapsed] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number; moved: boolean } | null>(null)

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startWidth: width, moved: false }

    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      const rawDelta = e.clientX - dragRef.current.startX
      const delta = side === 'right' ? -rawDelta : rawDelta
      // Only count as a drag after 3px of movement to distinguish from a click
      if (Math.abs(delta) > 3) dragRef.current.moved = true
      setWidth(Math.max(minWidth, dragRef.current.startWidth + delta))
    }

    function onMouseUp() {
      dragRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return { width, collapsed, setCollapsed, handleResizeStart }
}
