import type { CSSProperties } from 'react'
import type { FolderBrowserRenderItem, Item } from './types'
import { hasLargeImage, isAIModel } from '../../utils/itemUtils'

interface FolderBrowserItemRowProps {
  item: Item
  depth: number
  selectedItemId?: string
  onItemSelect?: (item: Item) => void
  style?: CSSProperties
  renderItem?: FolderBrowserRenderItem
}

/**
 * Single item row: optional `renderItem` replaces the default;
 * otherwise icon/label follow `largeImage` / AI model metadata like the legacy FolderBrowser.
 */
export function FolderBrowserItemRow({
  item,
  depth,
  selectedItemId,
  onItemSelect,
  style,
  renderItem,
}: FolderBrowserItemRowProps) {
  if (renderItem) {
    return <>{renderItem(item, depth)}</>
  }

  const itemIsAIModel = isAIModel(item)
  const itemHasLargeImage = hasLargeImage(item)
  let icon = '📄'
  let label = 'Item'
  if (itemIsAIModel) {
    icon = '🤖'
    label = 'AI Model'
  } else if (itemHasLargeImage) {
    icon = '🖼️'
    label = 'Image'
  }

  return (
    <div
      className={`folder-browser__item${item._id === selectedItemId ? ' folder-browser__item--selected' : ''}`}
      style={style}
      onClick={() => onItemSelect?.(item)}
      data-resource-id={item._id}
    >
      <span className="folder-browser__resource-icon" aria-hidden>
        {icon}
      </span>
      <span className="folder-browser__row-name">{item.name}</span>
      <span className="folder-browser__resource-type">{label}</span>
    </div>
  )
}
