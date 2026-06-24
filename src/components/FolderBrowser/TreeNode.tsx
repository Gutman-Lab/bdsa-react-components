import { Folder, FolderLock, Play } from 'lucide-react'
import type {
  FolderBrowserRenderFolder,
  FolderBrowserRenderItem,
  FolderBrowserVisualStyle,
  FolderItem,
  Item,
  NodeChildren,
} from './types'
import { FolderBrowserItemRow } from './FolderBrowserItemRow'

interface TreeNodeProps {
  parentId: string
  depth: number
  expanded: Set<string>
  childrenMap: Map<string, NodeChildren>
  loadingIds: Set<string>
  /** Only show items whose filename extension is in this list. Empty array shows all items. */
  allowedExtensions?: string[]
  /** When set, only items passing this predicate are shown (after `allowedExtensions`). */
  itemFilter?: (item: Item) => boolean
  /** Expand/collapse folder (chevron or double-click row). */
  onFolderToggle: (id: string) => void
  /** Single-click folder row — resource selection. */
  onFolderSelect: (folder: FolderItem) => void
  onItemSelect?: (item: Item) => void
  selectedItemId?: string
  selectedFolderId?: string | null
  visualStyle?: FolderBrowserVisualStyle
  /** Custom folder row; expansion and children are still handled by the tree. */
  renderFolder?: FolderBrowserRenderFolder
  renderItem?: FolderBrowserRenderItem
}

export function TreeNode({
  parentId,
  depth,
  expanded,
  childrenMap,
  loadingIds,
  allowedExtensions = [],
  itemFilter,
  onFolderToggle,
  onFolderSelect,
  onItemSelect,
  selectedItemId,
  selectedFolderId = null,
  visualStyle = 'modern',
  renderFolder,
  renderItem,
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

  const visibleItems = (
    allowedExtensions.length === 0
      ? children.items
      : children.items.filter(item => {
          const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
          return allowedExtensions.map(e => e.toLowerCase()).includes(ext)
        })
  ).filter(item => !itemFilter || itemFilter(item))

  return (
    <>
      {children.folders.map((folder: FolderItem) => {
        const isFolderSelected = selectedFolderId === folder._id
        return (
          <div key={folder._id}>
            {renderFolder ? (
              <div
                className={`folder-browser__folder folder-browser__folder--custom${isFolderSelected ? ' selected' : ''}`}
                style={indentStyle}
                data-resource-id={folder._id}
                onClick={() => onFolderSelect(folder)}
                onDoubleClick={() => onFolderToggle(folder._id)}
              >
                {renderFolder(
                  folder,
                  depth,
                  expanded.has(folder._id),
                  () => onFolderToggle(folder._id),
                  undefined,
                )}
              </div>
            ) : (
              <div
                className={`folder-browser__folder${isFolderSelected ? ' selected' : ''}`}
                style={indentStyle}
                data-resource-id={folder._id}
                onClick={() => onFolderSelect(folder)}
                onDoubleClick={() => onFolderToggle(folder._id)}
              >
                {visualStyle === 'modern' ? (
                  <>
                    {folder.public === false
                      ? <FolderLock size={14} fill="#3b82f6" strokeWidth={0} className="folder-browser__item-folder-icon" />
                      : <Folder size={14} fill="#3b82f6" strokeWidth={0} className="folder-browser__item-folder-icon" />
                    }
                    <span className="folder-browser__row-name">{folder.name}</span>
                    <span
                      className={
                        expanded.has(folder._id)
                          ? 'folder-browser__expand-chevron folder-browser__expand-chevron--expanded'
                          : 'folder-browser__expand-chevron'
                      }
                      aria-hidden
                      onClick={e => {
                        e.stopPropagation()
                        onFolderToggle(folder._id)
                      }}
                    >
                      <Play
                        size={9}
                        fill="#3b82f6"
                        strokeWidth={0}
                        style={{
                          transform: expanded.has(folder._id) ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s',
                        }}
                      />
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className={
                        expanded.has(folder._id)
                          ? 'folder-browser__expand-chevron folder-browser__expand-chevron--expanded'
                          : 'folder-browser__expand-chevron'
                      }
                      aria-hidden
                      onClick={e => {
                        e.stopPropagation()
                        onFolderToggle(folder._id)
                      }}
                    />
                    <span className="folder-browser__row-name">{folder.name}</span>
                    <span className="folder-browser__type-badge">Folder</span>
                  </>
                )}
              </div>
            )}
            {expanded.has(folder._id) && (
              <TreeNode
                parentId={folder._id}
                depth={depth + 1}
                expanded={expanded}
                childrenMap={childrenMap}
                loadingIds={loadingIds}
                allowedExtensions={allowedExtensions}
                itemFilter={itemFilter}
                onFolderToggle={onFolderToggle}
                onFolderSelect={onFolderSelect}
                onItemSelect={onItemSelect}
                selectedItemId={selectedItemId}
                selectedFolderId={selectedFolderId}
                visualStyle={visualStyle}
                renderFolder={renderFolder}
                renderItem={renderItem}
              />
            )}
          </div>
        )
      })}
      {visibleItems.map((item: Item) => (
        <FolderBrowserItemRow
          key={item._id}
          item={item}
          depth={depth}
          selectedItemId={selectedItemId}
          onItemSelect={onItemSelect}
          style={indentStyle}
          renderItem={renderItem}
        />
      ))}
    </>
  )
}
