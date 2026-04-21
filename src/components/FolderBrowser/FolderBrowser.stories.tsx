import { useEffect, useRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Star } from 'lucide-react'
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
  { _id: 'item-1', name: 'HE_stain_20x.svs', largeImage: true },
  { _id: 'item-2', name: 'IHC_CD3_40x.tif', meta: { largeImage: true } },
  { _id: 'item-3', name: 'brightfield_scan.ndpi' },
  {
    _id: 'item-4',
    name: 'model_bundle.zip',
    meta: { dataset_args: { batches: 1 }, train_args: { epochs: 1 } },
  },
  { _id: 'item-5', name: 'clinical_notes.pdf' },
]

const storyData: FolderBrowserSyntheticData = {
  collections: COLLECTIONS,
  getChildren: (_id, parentType) =>
    parentType === 'collection'
      ? { folders: FOLDERS, items: [] }
      : { folders: [], items: ITEMS },
}

/** Programmatic expand: chevron uses a single click; the row uses double-click to toggle. */
function clickExpandChevron(container: HTMLElement, selector: string) {
  container.querySelector<HTMLElement>(selector)?.dispatchEvent(
    new MouseEvent('click', { bubbles: true }),
  )
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
    visualStyle: { control: 'inline-radio', options: ['modern', 'legacy'] },
    showVisualStyleToggle: { control: 'boolean' },
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
        const el = ref.current
        if (!el) return
        clickExpandChevron(el, '.folder-browser__collection .folder-browser__expand-chevron')
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
        clickExpandChevron(el, '.folder-browser__collection .folder-browser__expand-chevron')
        clickExpandChevron(el, '.folder-browser__folder .folder-browser__expand-chevron')
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
        clickExpandChevron(el, '.folder-browser__collection .folder-browser__expand-chevron')
        clickExpandChevron(el, '.folder-browser__folder .folder-browser__expand-chevron')
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

/** Classic tree styling (neutral grays, ▶/▼, Collection/Folder badges) like the pre-refactor library. */
export const LegacyVisualStyle: Story = {
  args: {
    syntheticData: storyData,
    visualStyle: 'legacy',
  },
}

/** Header control to switch between Modern and Classic without leaving the story. */
export const WithStyleToggle: Story = {
  args: {
    syntheticData: storyData,
    showVisualStyleToggle: true,
    defaultWidth: 350,
  },
}

/**
 * Default item rows pick icon/label from metadata (slide / AI model / generic file).
 * Expand the first folder to see items.
 */
export const MetadataItemIcons: Story = {
  args: { syntheticData: storyData },
  render: (args) => {
    function AutoExpand() {
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        const el = ref.current
        if (!el) return
        clickExpandChevron(el, '.folder-browser__collection .folder-browser__expand-chevron')
        clickExpandChevron(el, '.folder-browser__folder .folder-browser__expand-chevron')
      }, [])
      return (
        <div ref={ref} style={{ display: 'contents' }}>
          <FolderBrowser {...args} />
        </div>
      )
    }
    return <AutoExpand />
  },
}

/** Fully custom item row (e.g. your own icons and layout). */
export const CustomItemRender: Story = {
  args: {
    syntheticData: storyData,
    renderItem: (item, depth) => (
      <div
        className="folder-browser__item"
        style={{ paddingLeft: `${depth * 1.25 + 0.75}rem`, gap: '0.35rem' }}
      >
        <Star size={14} className="folder-browser__item-icon" aria-hidden />
        <span className="folder-browser__row-name">{item.name}</span>
        <span className="folder-browser__resource-type">Custom</span>
      </div>
    ),
  },
  render: (args) => {
    function AutoExpand() {
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        const el = ref.current
        if (!el) return
        clickExpandChevron(el, '.folder-browser__collection .folder-browser__expand-chevron')
        clickExpandChevron(el, '.folder-browser__folder .folder-browser__expand-chevron')
      }, [])
      return (
        <div ref={ref} style={{ display: 'contents' }}>
          <FolderBrowser {...args} />
        </div>
      )
    }
    return <AutoExpand />
  },
}
