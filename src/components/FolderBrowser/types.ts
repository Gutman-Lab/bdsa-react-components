import type { ReactNode } from 'react'

/** Visual theme for FolderBrowser: modern panel vs classic (pre-refactor) tree styling. */
export type FolderBrowserVisualStyle = 'modern' | 'legacy'

export interface Collection {
  _id: string
  name: string
  public?: boolean
  [key: string]: unknown
}

export interface FolderItem {
  _id: string
  name: string
  public?: boolean
  [key: string]: unknown
}

export interface Item {
  _id: string
  name: string
  [key: string]: unknown
}

export interface NodeChildren {
  folders: FolderItem[]
  items: Item[]
}

/** Collection, folder, or item with a discriminant `type` for selection callbacks. */
export type FolderBrowserResource =
  | (Collection & { type: 'collection' })
  | (FolderItem & { type: 'folder' })
  | (Item & { type: 'item' })

/** Customize the collection header row only; expansion and children are still managed by FolderBrowser. */
export type FolderBrowserRenderCollection = (
  collection: Collection,
  isExpanded: boolean,
  onToggle: () => void,
  itemCount?: number,
) => ReactNode

/** Customize a folder row only; nested folders/items still render when expanded. */
export type FolderBrowserRenderFolder = (
  folder: FolderItem,
  depth: number,
  isExpanded: boolean,
  onToggle: () => void,
  itemCount?: number,
) => ReactNode

/** Replace the default item row (including metadata-based icons). */
export type FolderBrowserRenderItem = (item: Item, depth: number) => ReactNode
