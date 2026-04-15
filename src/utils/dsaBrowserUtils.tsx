import { FileText } from 'lucide-react'
import type { Item } from '../components/FolderBrowser/types'

export type { Item }

interface ItemRowProps {
  item: Item
  selectedItemId?: string
  onItemSelect?: (item: Item) => void
  style?: React.CSSProperties
}

/** Shared item row used by FolderBrowser (via TreeNode) and ManifestBrowser. */
export function ItemRow({ item, selectedItemId, onItemSelect, style }: ItemRowProps) {
  return (
    <div
      className={`folder-browser__item${item._id === selectedItemId ? ' folder-browser__item--selected' : ''}`}
      style={style}
      onClick={() => onItemSelect?.(item)}
    >
      <FileText size={14} className="folder-browser__item-icon" />
      <span>{item.name}</span>
    </div>
  )
}

/** Fetch a single DSA item by ID. Throws if the request fails. */
export async function fetchDsaItem(
  serverUrl: string,
  itemId: string,
  headers: Record<string, string>,
): Promise<Item> {
  const res = await fetch(`${serverUrl}/api/v1/item/${itemId}`, { headers })
  if (!res.ok) throw new Error(`Failed to fetch item ${itemId}: ${res.status}`)
  return res.json()
}
