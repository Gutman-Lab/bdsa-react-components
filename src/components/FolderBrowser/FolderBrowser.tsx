import { useState, useEffect } from 'react'
import { Network, Folder, FolderLock, Play, ChevronRight } from 'lucide-react'
import { dsaAuthStore } from '../../auth/DsaAuthStore'
import { useResizablePanel } from '../../hooks/useResizablePanel'
import { TreeNode } from './TreeNode'
import type { Collection, FolderItem, Item, NodeChildren } from './types'
import './FolderBrowser.css'

/** Bypass API calls and drive the component with static data (for tests / Storybook). */
export interface FolderBrowserSyntheticData {
  collections: Collection[]
  /** Return children synchronously for a given node. */
  getChildren: (id: string, parentType: 'collection' | 'folder') => NodeChildren
}

interface FolderBrowserProps {
  onItemSelect?: (item: Item) => void
  /** Only show items whose filename extension matches this list. Empty array shows all items. */
  allowedExtensions?: string[]
  className?: string
  style?: React.CSSProperties
  defaultWidth?: number
  /** Skip API calls and render static data (for tests / Storybook). */
  syntheticData?: FolderBrowserSyntheticData
}

export function FolderBrowser({ onItemSelect, allowedExtensions = [], className = '', style, defaultWidth = 250, syntheticData }: FolderBrowserProps) {
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

  if (collapsed) {
    return (
      <div
        className={`folder-browser folder-browser--collapsed ${className}`}
        style={{ ...style, width: '28px', minWidth: '28px' }}
        onClick={() => setCollapsed(false)}
        title="Expand panel"
      >
        <ChevronRight size={16} />
      </div>
    )
  }

  return (
    <div
      className={`folder-browser ${className}`}
      style={{ ...style, width: `${width}px`, minWidth: `${width}px` }}
    >
      <div className="folder-browser__header">
        <Network size={16} />
        Collections
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
              {collection.public === false
                ? <FolderLock size={15} fill="#3b82f6" strokeWidth={0} className="folder-browser__item-folder-icon" />
                : <Folder size={15} fill="#3b82f6" strokeWidth={0} className="folder-browser__item-folder-icon" />
              }
              <span>{collection.name}</span>
              <Play
                size={10}
                fill="#3b82f6"
                strokeWidth={0}
                style={{
                  transform: expanded.has(collection._id) ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s',
                }}
              />
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
