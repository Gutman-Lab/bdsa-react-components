import type { Collection, FolderItem, Item } from './types'
import type { FolderBrowserSyntheticData } from './FolderBrowser'

export const SYNTHETIC_COLLECTIONS: Collection[] = [
  { _id: 'col-1', name: 'Histology Slides', public: true },
  { _id: 'col-2', name: 'Private Archive', public: false },
]

export const SYNTHETIC_FOLDERS: FolderItem[] = [
  { _id: 'fold-1', name: 'Case 001', public: true },
  { _id: 'fold-2', name: 'Case 002', public: false },
]

/** Mix of image and non-image files to exercise extension filtering. */
export const SYNTHETIC_ITEMS: Item[] = [
  { _id: 'item-1', name: 'slide.svs' },
  { _id: 'item-2', name: 'scan.tif' },
  { _id: 'item-3', name: 'notes.pdf' },
]

/**
 * Ready-to-use syntheticData prop for FolderBrowser.
 * Collections expand to SYNTHETIC_FOLDERS; folders expand to SYNTHETIC_ITEMS.
 */
export const SYNTHETIC_DATA: FolderBrowserSyntheticData = {
  collections: SYNTHETIC_COLLECTIONS,
  getChildren: (_id, parentType) =>
    parentType === 'collection'
      ? { folders: SYNTHETIC_FOLDERS, items: [] }
      : { folders: [], items: SYNTHETIC_ITEMS },
}
