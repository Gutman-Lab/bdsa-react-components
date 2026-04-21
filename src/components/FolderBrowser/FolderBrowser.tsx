import { useState, useEffect } from 'react'
import { Network, Folder, FolderLock, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { dsaAuthStore } from '../../auth/DsaAuthStore'
import { useResizablePanel } from '../../hooks/useResizablePanel'
import { TreeNode } from './TreeNode'
import type { Collection, FolderItem, FolderBrowserVisualStyle, Item, NodeChildren } from './types'
import '../../styles/browserPanel.css'

export type { FolderBrowserVisualStyle }

/** Bypass API calls and drive the component with static data (for tests / Storybook). */
export interface FolderBrowserSyntheticData {
  collections: Collection[]
  /** Return children synchronously for a given node. */
  getChildren: (id: string, parentType: 'collection' | 'folder') => NodeChildren
}

interface FolderBrowserProps {
  onItemSelect?: (item: Item) => void
  selectedItemId?: string
  /** Only show items whose filename extension matches this list. Empty array shows all items. */
  allowedExtensions?: string[]
  className?: string
  style?: React.CSSProperties
  defaultWidth?: number
  /** Skip API calls and render static data (for tests / Storybook). */
  syntheticData?: FolderBrowserSyntheticData
  /** Panel look: modern (default) or legacy (matches pre-refactor FolderBrowser styling). */
  visualStyle?: FolderBrowserVisualStyle
  /** When the user picks a style via {@link showVisualStyleToggle}. */
  onVisualStyleChange?: (style: FolderBrowserVisualStyle) => void
  /** Show Modern / Classic controls in the header (uses internal state if `visualStyle` is omitted). */
  showVisualStyleToggle?: boolean
}

export function FolderBrowser({
  onItemSelect,
  selectedItemId,
  allowedExtensions = [],
  className = '',
  style,
  defaultWidth = 250,
  syntheticData,
  visualStyle: visualStyleProp,
  onVisualStyleChange,
  showVisualStyleToggle = false,
}: FolderBrowserProps) {
  const [internalVisualStyle, setInternalVisualStyle] = useState<FolderBrowserVisualStyle>(
    () => visualStyleProp ?? 'modern',
  )

  useEffect(() => {
    if (visualStyleProp !== undefined) {
      setInternalVisualStyle(visualStyleProp)
    }
  }, [visualStyleProp])

  const effectiveVisualStyle: FolderBrowserVisualStyle =
    visualStyleProp !== undefined
      ? visualStyleProp
      : showVisualStyleToggle
        ? internalVisualStyle
        : 'modern'

  function handleVisualStyleChange(next: FolderBrowserVisualStyle) {
    if (showVisualStyleToggle && visualStyleProp === undefined) {
      setInternalVisualStyle(next)
    }
    onVisualStyleChange?.(next)
  }

  const [collections, setCollections] = useState<Collection[]>(() => syntheticData?.collections ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { width, collapsed, setCollapsed, handleResizeStart } = useResizablePanel({ defaultWidth })

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [childrenMap, setChildrenMap] = useState<Map<string, NodeChildren>>(new Map())
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (syntheticData) return  // data is injected — skip API entirely

    function fetchCollections() {
      const { serverUrl, isAuthenticated } = dsaAuthStore.getStatus()

      if (!serverUrl || !isAuthenticated) {
        setCollections([])
        setError(null)
        return
      }

      setLoading(true)
      fetch(`${serverUrl}/api/v1/collection?limit=0`, { headers: dsaAuthStore.getAuthHeaders() })
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`)
          return res.json()
        })
        .then(data => setCollections(Array.isArray(data) ? data : data.items ?? []))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }

    fetchCollections()
    return dsaAuthStore.subscribe(fetchCollections)
  }, [syntheticData])

  function toggleNode(id: string, parentType: 'collection' | 'folder') {
    if (expanded.has(id)) {
      setExpanded(prev => { const next = new Set(prev); next.delete(id); return next })
      return
    }

    setExpanded(prev => new Set(prev).add(id))

    if (childrenMap.has(id)) return  // already loaded, just re-expand

    if (syntheticData) {
      setChildrenMap(prev => new Map(prev).set(id, syntheticData.getChildren(id, parentType)))
      return
    }

    const { serverUrl } = dsaAuthStore.getStatus()
    setLoadingIds(prev => new Set(prev).add(id))

    ;(async () => {
      try {
        const foldersRes = await fetch(
          `${serverUrl}/api/v1/folder?parentType=${parentType}&parentId=${id}&limit=0`,
          { headers: dsaAuthStore.getAuthHeaders() }
        )
        if (!foldersRes.ok) throw new Error(`Failed to fetch folders: ${foldersRes.status}`)
        const foldersData = await foldersRes.json()
        const folders: FolderItem[] = Array.isArray(foldersData) ? foldersData : foldersData.items ?? []

        // Items only exist in folders — fetching items on a collection would crash the API
        let items: Item[] = []
        if (parentType === 'folder') {
          const itemsRes = await fetch(
            `${serverUrl}/api/v1/item?folderId=${id}&limit=0`,
            { headers: dsaAuthStore.getAuthHeaders() }
          )
          if (!itemsRes.ok) throw new Error(`Failed to fetch items: ${itemsRes.status}`)
          const itemsData = await itemsRes.json()
          items = Array.isArray(itemsData) ? itemsData : itemsData.items ?? []
        }

        setChildrenMap(prev => new Map(prev).set(id, { folders, items }))
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingIds(prev => { const next = new Set(prev); next.delete(id); return next })
      }
    })()
  }

  const rootMods =
    effectiveVisualStyle === 'legacy' ? 'folder-browser--legacy' : ''

  if (collapsed) {
    return (
      <div
        className={`folder-browser folder-browser--collapsed ${rootMods} ${className}`.trim()}
        style={{ ...style, width: '36px', minWidth: '36px' }}
      >
        <button className="folder-browser__collapse-btn" onClick={() => setCollapsed(false)} title="Expand panel">
          <ChevronRight size={22} />
        </button>
        <span className="folder-browser__collapsed-label">Folder Browser</span>
      </div>
    )
  }

  return (
    <div
      className={`folder-browser ${rootMods} ${className}`.trim()}
      style={{ ...style, width: `${width}px`, minWidth: `${width}px` }}
    >
      <div className="folder-browser__header">
        <div className="folder-browser__header-title">
          {effectiveVisualStyle === 'modern' && <Network size={16} aria-hidden />}
          Collections
        </div>
        <div className="folder-browser__header-actions">
          {showVisualStyleToggle && (
            <div className="folder-browser__style-switch" role="group" aria-label="Folder browser style">
              <button
                type="button"
                className={
                  effectiveVisualStyle === 'modern'
                    ? 'folder-browser__style-switch-btn folder-browser__style-switch-btn--active'
                    : 'folder-browser__style-switch-btn'
                }
                onClick={() => handleVisualStyleChange('modern')}
              >
                Modern
              </button>
              <button
                type="button"
                className={
                  effectiveVisualStyle === 'legacy'
                    ? 'folder-browser__style-switch-btn folder-browser__style-switch-btn--active'
                    : 'folder-browser__style-switch-btn'
                }
                onClick={() => handleVisualStyleChange('legacy')}
              >
                Classic
              </button>
            </div>
          )}
          <button className="folder-browser__collapse-btn" onClick={() => setCollapsed(true)} title="Collapse panel">
            <ChevronLeft size={22} />
          </button>
        </div>
      </div>
      <div className="folder-browser__scroll">
        {loading && <div className="folder-browser__empty">Loading...</div>}
        {error && <div className="folder-browser__empty">Error: {error}</div>}
        {!loading && !error && collections.length === 0 && (
          <div className="folder-browser__empty">No collections found</div>
        )}

        {collections.map(collection => (
          <div key={collection._id}>
            <div
              className="folder-browser__collection"
              onClick={() => toggleNode(collection._id, 'collection')}
            >
              {effectiveVisualStyle === 'modern' ? (
                <>
                  {collection.public === false
                    ? <FolderLock size={15} fill="#3b82f6" strokeWidth={0} className="folder-browser__item-folder-icon" />
                    : <Folder size={15} fill="#3b82f6" strokeWidth={0} className="folder-browser__item-folder-icon" />
                  }
                  <span className="folder-browser__row-name">{collection.name}</span>
                  <span
                    className={
                      expanded.has(collection._id)
                        ? 'folder-browser__expand-chevron folder-browser__expand-chevron--expanded'
                        : 'folder-browser__expand-chevron'
                    }
                    aria-hidden
                  >
                    <Play
                      size={10}
                      fill="#3b82f6"
                      strokeWidth={0}
                      style={{
                        transform: expanded.has(collection._id) ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s',
                      }}
                    />
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={
                      expanded.has(collection._id)
                        ? 'folder-browser__expand-chevron folder-browser__expand-chevron--expanded'
                        : 'folder-browser__expand-chevron'
                    }
                    aria-hidden
                  />
                  <span className="folder-browser__row-name">{collection.name}</span>
                  <span className="folder-browser__type-badge">Collection</span>
                </>
              )}
            </div>
            {expanded.has(collection._id) && (
              <TreeNode
                parentId={collection._id}
                depth={1}
                expanded={expanded}
                childrenMap={childrenMap}
                loadingIds={loadingIds}
                allowedExtensions={allowedExtensions}
                onToggle={id => toggleNode(id, 'folder')}
                onItemSelect={onItemSelect}
                selectedItemId={selectedItemId}
                visualStyle={effectiveVisualStyle}
              />
            )}
          </div>
        ))}
      </div>
      <div className="folder-browser__resize-handle" onMouseDown={handleResizeStart} />
    </div>
  )
}

export default FolderBrowser
