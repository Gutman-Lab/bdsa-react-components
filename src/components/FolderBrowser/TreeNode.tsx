import { Folder, FolderLock, Play } from 'lucide-react'
import type { FolderItem, NodeChildren } from './types'
import { ItemRow } from '../../utils/dsaBrowserUtils'
import type { Item } from '../../utils/dsaBrowserUtils'

interface TreeNodeProps {
  parentId: string
  depth: number
  expanded: Set<string>
  childrenMap: Map<string, NodeChildren>
  loadingIds: Set<string>
  /** Only show items whose filename extension is in this list. Empty array shows all items. */
  allowedExtensions?: string[]
  /** Called when a folder row is clicked to expand/collapse it */
  onToggle: (id: string) => void
  onItemSelect?: (item: Item) => void
  selectedItemId?: string
}

export function TreeNode({
  parentId,
  depth,
  expanded,
  childrenMap,
  loadingIds,
  allowedExtensions = [],
  onToggle,
  onItemSelect,
  selectedItemId,
}: TreeNodeProps) {
  const indentStyle = { paddingLeft: `${depth * 1.25 + 0.75}rem` }

  if (loadingIds.has(parentId)) {
    return (
      <div className="folder-browser__node-loading" style={indentStyle}>
        Loading...
      </div>
    )
  }

  const children = childrenMap.get(parentId)
  if (!children) return null

  const visibleItems = allowedExtensions.length === 0
    ? children.items
    : children.items.filter(item => {
        const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
        return allowedExtensions.map(e => e.toLowerCase()).includes(ext)
      })

  return (
    <>
      {children.folders.map((folder: FolderItem) => (
        <div key={folder._id}>
          <div
            className="folder-browser__folder"
            style={indentStyle}
            onClick={() => onToggle(folder._id)}
          >
            {folder.public === false
              ? <FolderLock size={14} fill="#3b82f6" strokeWidth={0} className="folder-browser__item-folder-icon" />
              : <Folder size={14} fill="#3b82f6" strokeWidth={0} className="folder-browser__item-folder-icon" />
            }
            <span>{folder.name}</span>
            <Play
              size={9}
              fill="#3b82f6"
              strokeWidth={0}
              style={{
                transform: expanded.has(folder._id) ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            />
          </div>
          {expanded.has(folder._id) && (
            <TreeNode
              parentId={folder._id}
              depth={depth + 1}
              expanded={expanded}
              childrenMap={childrenMap}
              loadingIds={loadingIds}
              allowedExtensions={allowedExtensions}
              onToggle={onToggle}
              onItemSelect={onItemSelect}
              selectedItemId={selectedItemId}
            />
          )}
        </div>
      ))}
      {visibleItems.map((item: Item) => (
        <ItemRow
          key={item._id}
          item={item}
          selectedItemId={selectedItemId}
          onItemSelect={onItemSelect}
          style={indentStyle}
        />
      ))}
    </>
  )
}
