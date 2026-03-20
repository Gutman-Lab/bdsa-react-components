import { useEffect, useRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FolderBrowser } from './FolderBrowser'
import type { FolderBrowserSyntheticData } from './FolderBrowser'
import type { Collection, FolderItem, Item } from './types'

// --- Story data ---

const COLLECTIONS: Collection[] = [
  { _id: 'col-1', name: 'Histology Slides', public: true },
  { _id: 'col-2', name: 'Radiology Images', public: true },
  { _id: 'col-3', name: 'Private Archive', public: false },
]

const FOLDERS: FolderItem[] = [
  { _id: 'fold-1', name: 'Case 001 - Patient A', public: true },
  { _id: 'fold-2', name: 'Case 002 - Patient B', public: true },
  { _id: 'fold-3', name: 'Restricted Cases', public: false },
]

const ITEMS: Item[] = [
  { _id: 'item-1', name: 'HE_stain_20x.svs' },
  { _id: 'item-2', name: 'IHC_CD3_40x.tif' },
  { _id: 'item-3', name: 'brightfield_scan.ndpi' },
  { _id: 'item-4', name: 'clinical_notes.pdf' },
]

const storyData: FolderBrowserSyntheticData = {
  collections: COLLECTIONS,
  getChildren: (_id, parentType) =>
    parentType === 'collection'
      ? { folders: FOLDERS, items: [] }
      : { folders: [], items: ITEMS },
}

// --- Meta ---

const meta: Meta<typeof FolderBrowser> = {
  title: 'Components/FolderBrowser',
  component: FolderBrowser,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div style={{ height: '600px', display: 'flex', border: '1px solid #ddd' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    defaultWidth: { control: { type: 'range', min: 150, max: 500, step: 10 } },
    allowedExtensions: { control: 'object' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// --- Stories ---

/**
 * No data provided — shows the empty "No collections found" state.
 */
export const NotAuthenticated: Story = {}

/**
 * Collections are listed. Public collections show a folder icon; private ones show a lock.
 */
export const WithCollections: Story = {
  args: { syntheticData: storyData },
}

/**
 * First collection is expanded to reveal its folders.
 */
export const CollectionExpanded: Story = {
  args: { syntheticData: storyData },
  render: (args) => {
    function AutoExpand() {
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        ref.current?.querySelector<HTMLElement>('.folder-browser__collection')?.click()
      }, [])
      return <div ref={ref} style={{ display: 'contents' }}><FolderBrowser {...args} /></div>
    }
    return <AutoExpand />
  },
}

/**
 * First collection and first folder are both expanded to show items.
 * All file types are visible (no extension filter applied).
 */
export const FolderExpanded: Story = {
  args: { syntheticData: storyData },
  render: (args) => {
    function AutoExpand() {
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        const el = ref.current
        if (!el) return
        el.querySelector<HTMLElement>('.folder-browser__collection')?.click()
        el.querySelector<HTMLElement>('.folder-browser__folder')?.click()
      }, [])
      return <div ref={ref} style={{ display: 'contents' }}><FolderBrowser {...args} /></div>
    }
    return <AutoExpand />
  },
}

/**
 * Extension filter active — only image files (svs, tif, ndpi) are shown.
 * clinical_notes.pdf is hidden.
 */
export const WithExtensionFilter: Story = {
  args: {
    syntheticData: storyData,
    allowedExtensions: ['svs', 'tif', 'ndpi'],
  },
  render: (args) => {
    function AutoExpand() {
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        const el = ref.current
        if (!el) return
        el.querySelector<HTMLElement>('.folder-browser__collection')?.click()
        el.querySelector<HTMLElement>('.folder-browser__folder')?.click()
      }, [])
      return <div ref={ref} style={{ display: 'contents' }}><FolderBrowser {...args} /></div>
    }
    return <AutoExpand />
  },
}

/**
 * Panel collapsed to a narrow strip. Click the strip to expand it again.
 */
export const Collapsed: Story = {
  args: { syntheticData: storyData },
  render: (args) => {
    function AutoCollapse() {
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        const handle = ref.current?.querySelector<HTMLElement>('.folder-browser__resize-handle')
        if (!handle) return
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      }, [])
      return <div ref={ref} style={{ display: 'contents' }}><FolderBrowser {...args} /></div>
    }
    return <AutoCollapse />
  },
}
