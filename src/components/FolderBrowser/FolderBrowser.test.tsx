/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { FolderBrowser } from './FolderBrowser'
import { SYNTHETIC_DATA, SYNTHETIC_ITEMS } from './syntheticData'

// All tests use syntheticData so there are no fetch calls or async auth setup.
// This avoids React 18 "outside act()" warnings and the OOM they cause.

describe('FolderBrowser', () => {
  it('shows empty state when no data is provided', () => {
    render(<FolderBrowser />)
    expect(screen.getByText('No collections found')).toBeInTheDocument()
  })

  it('renders collections from syntheticData', () => {
    render(<FolderBrowser syntheticData={SYNTHETIC_DATA} />)
    expect(screen.getByText('Histology Slides')).toBeInTheDocument()
    expect(screen.getByText('Private Archive')).toBeInTheDocument()
  })

  it('expands a collection to show its folders on click', async () => {
    const user = userEvent.setup()
    render(<FolderBrowser syntheticData={SYNTHETIC_DATA} />)

    await user.click(screen.getByText('Histology Slides'))

    expect(screen.getByText('Case 001')).toBeInTheDocument()
    expect(screen.getByText('Case 002')).toBeInTheDocument()
  })

  it('collapses a collection on a second click', async () => {
    const user = userEvent.setup()
    render(<FolderBrowser syntheticData={SYNTHETIC_DATA} />)

    await user.click(screen.getByText('Histology Slides'))
    expect(screen.getByText('Case 001')).toBeInTheDocument()

    await user.click(screen.getByText('Histology Slides'))
    expect(screen.queryByText('Case 001')).not.toBeInTheDocument()
  })

  it('expands a folder to show its items', async () => {
    const user = userEvent.setup()
    render(<FolderBrowser syntheticData={SYNTHETIC_DATA} />)

    await user.click(screen.getByText('Histology Slides'))
    await user.click(screen.getByText('Case 001'))

    expect(screen.getByText('slide.svs')).toBeInTheDocument()
    expect(screen.getByText('scan.tif')).toBeInTheDocument()
    expect(screen.getByText('notes.pdf')).toBeInTheDocument()
  })

  it('filters items by allowedExtensions', async () => {
    const user = userEvent.setup()
    render(<FolderBrowser syntheticData={SYNTHETIC_DATA} allowedExtensions={['svs', 'tif']} />)

    await user.click(screen.getByText('Histology Slides'))
    await user.click(screen.getByText('Case 001'))

    expect(screen.getByText('slide.svs')).toBeInTheDocument()
    expect(screen.getByText('scan.tif')).toBeInTheDocument()
    expect(screen.queryByText('notes.pdf')).not.toBeInTheDocument()
  })

  it('shows all items when allowedExtensions is empty', async () => {
    const user = userEvent.setup()
    render(<FolderBrowser syntheticData={SYNTHETIC_DATA} allowedExtensions={[]} />)

    await user.click(screen.getByText('Histology Slides'))
    await user.click(screen.getByText('Case 001'))

    for (const item of SYNTHETIC_ITEMS) {
      expect(screen.getByText(item.name)).toBeInTheDocument()
    }
  })

  it('collapses the panel when the resize handle is clicked without dragging', () => {
    render(<FolderBrowser syntheticData={SYNTHETIC_DATA} />)

    const handle = document.querySelector('.folder-browser__resize-handle') as HTMLElement
    fireEvent.mouseDown(handle)
    fireEvent.mouseUp(document)

    expect(document.querySelector('.folder-browser--collapsed')).toBeInTheDocument()
  })

  it('re-expands the panel when the collapsed strip is clicked', async () => {
    const user = userEvent.setup()
    render(<FolderBrowser syntheticData={SYNTHETIC_DATA} />)

    const handle = document.querySelector('.folder-browser__resize-handle') as HTMLElement
    fireEvent.mouseDown(handle)
    fireEvent.mouseUp(document)
    expect(document.querySelector('.folder-browser--collapsed')).toBeInTheDocument()

    await user.click(document.querySelector('.folder-browser--collapsed') as HTMLElement)
    expect(document.querySelector('.folder-browser--collapsed')).not.toBeInTheDocument()
  })

  it('calls onItemSelect when an item is clicked', async () => {
    const user = userEvent.setup()
    const onItemSelect = vi.fn()
    render(<FolderBrowser syntheticData={SYNTHETIC_DATA} onItemSelect={onItemSelect} allowedExtensions={[]} />)

    await user.click(screen.getByText('Histology Slides'))
    await user.click(screen.getByText('Case 001'))
    await user.click(screen.getByText('slide.svs'))

    expect(onItemSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'slide.svs' }))
  })
})
