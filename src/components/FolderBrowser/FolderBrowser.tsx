import { useState, useEffect, useCallback, useRef } from 'react'
import { Network, Folder, FolderLock, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { dsaAuthStore } from '../../auth/DsaAuthStore'
import { useResizablePanel } from '../../hooks/useResizablePanel'
import { TreeNode } from './TreeNode'
import type {
  Collection,
  FolderBrowserRenderCollection,
  FolderBrowserRenderFolder,
  FolderBrowserRenderItem,
  FolderBrowserResource,
  FolderBrowserVisualStyle,
  FolderItem,
  Item,
  NodeChildren,
} from './types'
import '../../styles/browserPanel.css'

export type { FolderBrowserVisualStyle }

const DEFAULT_PERSIST_EXPANSION_KEY = 'bdsa-react-components.folder-browser.expanded'
const DEFAULT_PERSIST_SELECTION_KEY = 'bdsa-react-components.folder-browser.selection'

function loadPersistedExpandedIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const ids = JSON.parse(raw) as unknown
    if (!Array.isArray(ids)) return new Set()
    return new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

function loadPersistedSelection(key: string): FolderBrowserResource | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { resource?: FolderBrowserResource }
    const r = parsed.resource
    if (!r || typeof r !== 'object' || !('_id' in r) || !('type' in r)) return null
    if (r.type !== 'collection' && r.type !== 'folder' && r.type !== 'item') return null
    return r
  } catch {
    return null
  }
}

/**
 * Bypass API calls and drive the component with static data (for tests / Storybook).
 * When set, `persistExpansion` / `persistSelection` do not read or write `localStorage`.
 */
export interface FolderBrowserSyntheticData {
  collections: Collection[]
  /** Return children synchronously for a given node. */
  getChildren: (id: string, parentType: 'collection' | 'folder') => NodeChildren
}

interface FolderBrowserProps {
  onItemSelect?: (item: Item) => void
  selectedItemId?: string
  /** Fired when a collection or folder is activated (single click). Items also fire this (and `onSelectionChange`) in addition to `onItemSelect`. */
  onResourceSelect?: (resource: FolderBrowserResource) => void
  /** Same payload as `onResourceSelect`; use one or both depending on app style. */
  onSelectionChange?: (resource: FolderBrowserResource) => void
  /**
   * Show only this Girder collection or folder subtree (fetches `GET /collection/:id` or `/folder/:id`).
   * Avoids listing every collection when you already know the target id (deep link).
   */
  rootId?: string
  /** Required with `rootId`. */
  rootType?: 'collection' | 'folder'
  /** When browsing all collections, auto-expand this collection id (e.g. after navigation). */
  startCollectionId?: string
  /** After `startCollectionId` is expanded and folders load, auto-expand this folder id. */
  startFolderId?: string
  /** Only show items whose filename extension matches this list. Empty array shows all items. */
  allowedExtensions?: string[]
  /** When set, only items passing this predicate are shown (after `allowedExtensions`). */
  itemFilter?: (item: Item) => boolean
  /** Fired when a folder is expanded (chevron or double-click row). Does not fire on single-click select alone. */
  onFolderOpen?: (folder: FolderItem) => void
  className?: string
  style?: React.CSSProperties
  defaultWidth?: number
  /** Skip API calls and render static data (for tests / Storybook). */
  syntheticData?: FolderBrowserSyntheticData
  /** Panel look: modern (default) or legacy (matches pre-refactor FolderBrowser styling). */
  visualStyle?: FolderBrowserVisualStyle
  /** When the user picks a style via `showVisualStyleToggle`. */
  onVisualStyleChange?: (style: FolderBrowserVisualStyle) => void
  /** Show Modern / Classic controls in the header (uses internal state if `visualStyle` is omitted). */
  showVisualStyleToggle?: boolean
  /**
   * Custom collection row only. The library still loads children when expanded;
   * call `onToggle` to expand/collapse; single/double-click on the outer row still selects / toggles when using the default shell.
   */
  renderCollection?: FolderBrowserRenderCollection
  /** Custom folder row only; nested content still expands normally. */
  renderFolder?: FolderBrowserRenderFolder
  /** Custom item row, or omit to use default metadata-based icons (`largeImage` / AI model meta via `itemUtils`). */
  renderItem?: FolderBrowserRenderItem
  /** Persist expanded node ids to `localStorage` so the tree stays open across refresh. */
  persistExpansion?: boolean
  /** Storage key for expansion (JSON array of Girder ids). */
  persistExpansionKey?: string
  /**
   * Persist last selected resource (collection, folder, or item) across refresh.
   * For items, enable **`persistExpansion`** too so parent folders reopen and the row exists (scroll-into-view works).
   */
  persistSelection?: boolean
  /** Storage key for selection (`{ resource, timestamp }` JSON, compatible with legacy shape). */
  persistSelectionKey?: string
  /**
   * After selection changes (and when the row mounts), scroll that row into view inside the panel.
   * @default true
   */
  scrollSelectedIntoView?: boolean
}

export function FolderBrowser({
  onItemSelect,
  selectedItemId,
  onResourceSelect,
  onSelectionChange,
  rootId,
  rootType,
  startCollectionId,
  startFolderId,
  allowedExtensions = [],
  itemFilter,
  onFolderOpen,
  className = '',
  style,
  defaultWidth = 250,
  syntheticData,
  visualStyle: visualStyleProp,
  onVisualStyleChange,
  showVisualStyleToggle = false,
  renderCollection,
  renderFolder,
  renderItem,
  persistExpansion = false,
  persistExpansionKey = DEFAULT_PERSIST_EXPANSION_KEY,
  persistSelection = false,
  persistSelectionKey = DEFAULT_PERSIST_SELECTION_KEY,
  scrollSelectedIntoView = true,
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
  const [rootFolder, setRootFolder] = useState<FolderItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { width, collapsed, setCollapsed, handleResizeStart } = useResizablePanel({ defaultWidth })

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    persistExpansion && !syntheticData ? loadPersistedExpandedIds(persistExpansionKey) : new Set(),
  )
  const [childrenMap, setChildrenMap] = useState<Map<string, NodeChildren>>(new Map())
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [selectedResource, setSelectedResource] = useState<FolderBrowserResource | null>(() =>
    persistSelection && !syntheticData ? loadPersistedSelection(persistSelectionKey) : null,
  )

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const emitResource = useCallback(
    (resource: FolderBrowserResource) => {
      setSelectedResource(resource)
      onResourceSelect?.(resource)
      onSelectionChange?.(resource)
    },
    [onResourceSelect, onSelectionChange],
  )

  const handleItemSelect = useCallback(
    (item: Item) => {
      emitResource({ ...item, type: 'item' })
      onItemSelect?.(item)
    },
    [emitResource, onItemSelect],
  )

  const fetchChildren = useCallback(
    async (id: string, parentType: 'collection' | 'folder'): Promise<NodeChildren> => {
      if (syntheticData) {
        return syntheticData.getChildren(id, parentType)
      }
      const { serverUrl } = dsaAuthStore.getStatus()
      if (!serverUrl) {
        return { folders: [], items: [] }
      }

      const foldersRes = await fetch(
        `${serverUrl}/api/v1/folder?parentType=${parentType}&parentId=${id}&limit=10000`,
        { headers: dsaAuthStore.getAuthHeaders() },
      )
      if (!foldersRes.ok) {
        throw new Error(`Failed to fetch folders: ${foldersRes.status}`)
      }
      const foldersData = await foldersRes.json()
      const folders: FolderItem[] = Array.isArray(foldersData) ? foldersData : foldersData.items ?? []

      let items: Item[] = []
      if (parentType === 'folder') {
        const itemsRes = await fetch(
          `${serverUrl}/api/v1/item?folderId=${id}&limit=10000`,
          { headers: dsaAuthStore.getAuthHeaders() },
        )
        if (!itemsRes.ok) {
          throw new Error(`Failed to fetch items: ${itemsRes.status}`)
        }
        const itemsData = await itemsRes.json()
        items = Array.isArray(itemsData) ? itemsData : itemsData.items ?? []
      }

      return { folders, items }
    },
    [syntheticData],
  )

  function findFolderById(folderId: string): FolderItem | undefined {
    if (rootFolder?._id === folderId) return rootFolder
    for (const children of childrenMap.values()) {
      const match = children.folders.find(f => f._id === folderId)
      if (match) return match
    }
    return undefined
  }

  function toggleNode(id: string, parentType: 'collection' | 'folder') {
    if (expanded.has(id)) {
      setExpanded(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      return
    }

    setExpanded(prev => new Set(prev).add(id))

    if (parentType === 'folder') {
      const folder = findFolderById(id)
      if (folder) onFolderOpen?.(folder)
    }

    if (childrenMap.has(id)) return

    if (syntheticData) {
      setChildrenMap(prev => new Map(prev).set(id, syntheticData.getChildren(id, parentType)))
      return
    }

    setLoadingIds(prev => new Set(prev).add(id))
    ;(async () => {
      try {
        const children = await fetchChildren(id, parentType)
        setChildrenMap(prev => new Map(prev).set(id, children))
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    })()
  }

  /** Load all collections (skipped when `rootId` + `rootType` or `syntheticData` is set). */
  useEffect(() => {
    if (syntheticData) return
    if (rootId && rootType) return

    function fetchCollections() {
      const { serverUrl, isAuthenticated } = dsaAuthStore.getStatus()

      if (!serverUrl || !isAuthenticated) {
        setCollections([])
        setRootFolder(null)
        setError(null)
        return
      }

      setLoading(true)
      fetch(`${serverUrl}/api/v1/collection?limit=10000`, { headers: dsaAuthStore.getAuthHeaders() })
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`)
          return res.json()
        })
        .then(data => {
          setCollections(Array.isArray(data) ? data : data.items ?? [])
          setRootFolder(null)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }

    fetchCollections()
    return dsaAuthStore.subscribe(fetchCollections)
  }, [syntheticData, rootId, rootType])

  /** Deep link: load a single collection or folder as the tree root. */
  useEffect(() => {
    if (syntheticData || !rootId || !rootType) return

    const rootIdResolved = rootId
    const rootTypeResolved = rootType

    let cancelled = false

    async function loadRoot() {
      const { serverUrl, isAuthenticated } = dsaAuthStore.getStatus()
      if (!serverUrl || !isAuthenticated) {
        setCollections([])
        setRootFolder(null)
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const headers = dsaAuthStore.getAuthHeaders()
        const directUrl = `${serverUrl}/api/v1/${rootTypeResolved}/${rootIdResolved}`
        let res = await fetch(directUrl, { headers })

        if (rootTypeResolved === 'collection' && !res.ok) {
          const listRes = await fetch(`${serverUrl}/api/v1/collection?limit=10000`, { headers })
          if (!listRes.ok) {
            throw new Error(`Failed to fetch collections: ${listRes.status}`)
          }
          const data = await listRes.json()
          const list: Collection[] = Array.isArray(data) ? data : data.items ?? []
          const found = list.find(c => c._id === rootIdResolved)
          if (!found) {
            throw new Error(`Collection ${rootIdResolved} not found`)
          }
          if (cancelled) return
          setCollections([found])
          setRootFolder(null)
          setExpanded(new Set([rootIdResolved]))
          const ch = await fetchChildren(rootIdResolved, 'collection')
          if (cancelled) return
          setChildrenMap(new Map([[rootIdResolved, ch]]))
          return
        }

        if (!res.ok) {
          throw new Error(`Failed to load ${rootTypeResolved}: ${res.status}`)
        }

        const entity = (await res.json()) as Collection | FolderItem
        if (cancelled) return

        if (rootTypeResolved === 'collection') {
          setCollections([entity as Collection])
          setRootFolder(null)
          setExpanded(new Set([rootIdResolved]))
          const ch = await fetchChildren(rootIdResolved, 'collection')
          if (cancelled) return
          setChildrenMap(new Map([[rootIdResolved, ch]]))
        } else {
          setCollections([])
          setRootFolder(entity as FolderItem)
          setExpanded(new Set([rootIdResolved]))
          const ch = await fetchChildren(rootIdResolved, 'folder')
          if (cancelled) return
          setChildrenMap(new Map([[rootIdResolved, ch]]))
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load root')
          setCollections([])
          setRootFolder(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRoot()
    const unsub = dsaAuthStore.subscribe(() => {
      void loadRoot()
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [syntheticData, rootId, rootType, fetchChildren])

  /** Auto-expand a collection when listing all roots. */
  useEffect(() => {
    if (syntheticData || (rootId && rootType) || !startCollectionId || collections.length === 0) return
    if (!collections.some(c => c._id === startCollectionId)) return

    setExpanded(prev => new Set(prev).add(startCollectionId))

    if (childrenMap.has(startCollectionId)) return

    setLoadingIds(prev => new Set(prev).add(startCollectionId))
    ;(async () => {
      try {
        const ch = await fetchChildren(startCollectionId, 'collection')
        setChildrenMap(prev => new Map(prev).set(startCollectionId, ch))
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingIds(prev => {
          const next = new Set(prev)
          next.delete(startCollectionId)
          return next
        })
      }
    })()
  }, [syntheticData, rootId, rootType, startCollectionId, collections, childrenMap, fetchChildren])

  /** Auto-expand a folder under `startCollectionId` once its siblings are loaded. */
  useEffect(() => {
    if (syntheticData || !startFolderId || !startCollectionId) return
    const ch = childrenMap.get(startCollectionId)
    if (!ch?.folders.some(f => f._id === startFolderId)) return

    setExpanded(prev => new Set(prev).add(startFolderId))

    if (childrenMap.has(startFolderId)) return

    setLoadingIds(prev => new Set(prev).add(startFolderId))
    ;(async () => {
      try {
        const ch2 = await fetchChildren(startFolderId, 'folder')
        setChildrenMap(prev => new Map(prev).set(startFolderId, ch2))
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingIds(prev => {
          const next = new Set(prev)
          next.delete(startFolderId)
          return next
        })
      }
    })()
  }, [syntheticData, startFolderId, startCollectionId, childrenMap, fetchChildren])

  /** Re-fetch children for persisted expanded ids (one node per pass; collections first). */
  useEffect(() => {
    if (!persistExpansion || syntheticData) return
    const { serverUrl, isAuthenticated } = dsaAuthStore.getStatus()
    if (!serverUrl || !isAuthenticated) return
    if (collections.length === 0 && !rootFolder) return

    const pending = [...expanded].filter(id => !childrenMap.has(id))
    if (pending.length === 0) return

    pending.sort((a, b) => {
      const aColl = collections.some(c => c._id === a)
      const bColl = collections.some(c => c._id === b)
      if (aColl && !bColl) return -1
      if (!aColl && bColl) return 1
      return 0
    })

    const id = pending[0]
    const isColl = collections.some(c => c._id === id)
    const parentType: 'collection' | 'folder' = isColl ? 'collection' : 'folder'

    let cancelled = false
    setLoadingIds(prev => new Set(prev).add(id))
    ;(async () => {
      try {
        const ch = await fetchChildren(id, parentType)
        if (cancelled) return
        setChildrenMap(prev => new Map(prev).set(id, ch))
      } catch (e) {
        console.warn('FolderBrowser: failed to restore children for expanded node', id, e)
      } finally {
        if (!cancelled) {
          setLoadingIds(prev => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [persistExpansion, syntheticData, expanded, childrenMap, collections, rootFolder, fetchChildren])

  useEffect(() => {
    if (!persistExpansion || syntheticData) return
    try {
      localStorage.setItem(persistExpansionKey, JSON.stringify([...expanded]))
    } catch (e) {
      console.warn('FolderBrowser: persist expansion failed', e)
    }
  }, [expanded, persistExpansion, persistExpansionKey, syntheticData])

  useEffect(() => {
    if (!persistSelection || syntheticData) return
    try {
      if (selectedResource) {
        localStorage.setItem(
          persistSelectionKey,
          JSON.stringify({ resource: selectedResource, timestamp: Date.now() }),
        )
      } else {
        localStorage.removeItem(persistSelectionKey)
      }
    } catch (e) {
      console.warn('FolderBrowser: persist selection failed', e)
    }
  }, [selectedResource, persistSelection, persistSelectionKey, syntheticData])

  useEffect(() => {
    if (!scrollSelectedIntoView || !selectedResource || collapsed) return
    const id = selectedResource._id
    const t = window.setTimeout(() => {
      const root = scrollContainerRef.current
      if (!root) return
      const safe = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id
      const el = root.querySelector(`[data-resource-id="${safe}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
    return () => clearTimeout(t)
  }, [scrollSelectedIntoView, selectedResource, collapsed, expanded, childrenMap, loading])

  const rootMods =
    effectiveVisualStyle === 'legacy' ? 'folder-browser--legacy' : ''

  const selectedCollectionId =
    selectedResource?.type === 'collection' ? selectedResource._id : null
  const selectedFolderId =
    selectedResource?.type === 'folder' ? selectedResource._id : null

  const effectiveSelectedItemId =
    selectedItemId ?? (selectedResource?.type === 'item' ? selectedResource._id : undefined)

  function renderRootFolderRow(folder: FolderItem) {
    const isFolderSelected = selectedFolderId === folder._id
    if (renderFolder) {
      return (
        <div
          className={`folder-browser__folder folder-browser__folder--custom${isFolderSelected ? ' selected' : ''}`}
          style={{ paddingLeft: '0.75rem' }}
          data-resource-id={folder._id}
          onClick={() => emitResource({ ...folder, type: 'folder' })}
          onDoubleClick={() => toggleNode(folder._id, 'folder')}
        >
          {renderFolder(
            folder,
            0,
            expanded.has(folder._id),
            () => toggleNode(folder._id, 'folder'),
            undefined,
          )}
        </div>
      )
    }

    return (
      <div
        className={`folder-browser__folder${isFolderSelected ? ' selected' : ''}`}
        style={{ paddingLeft: '0.75rem' }}
        data-resource-id={folder._id}
        onClick={() => emitResource({ ...folder, type: 'folder' })}
        onDoubleClick={() => toggleNode(folder._id, 'folder')}
      >
        {effectiveVisualStyle === 'modern' ? (
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
                toggleNode(folder._id, 'folder')
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
                toggleNode(folder._id, 'folder')
              }}
            />
            <span className="folder-browser__row-name">{folder.name}</span>
            <span className="folder-browser__type-badge">Folder</span>
          </>
        )}
      </div>
    )
  }

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

  const showEmpty =
    !loading &&
    !error &&
    collections.length === 0 &&
    !rootFolder

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
      <div className="folder-browser__scroll" ref={scrollContainerRef}>
        {loading && <div className="folder-browser__empty">Loading...</div>}
        {error && <div className="folder-browser__empty">Error: {error}</div>}
        {showEmpty && (
          <div className="folder-browser__empty">No collections found</div>
        )}

        {rootFolder && (
          <div key={rootFolder._id}>
            {renderRootFolderRow(rootFolder)}
            {expanded.has(rootFolder._id) && (
              <TreeNode
                parentId={rootFolder._id}
                depth={1}
                expanded={expanded}
                childrenMap={childrenMap}
                loadingIds={loadingIds}
                allowedExtensions={allowedExtensions}
                itemFilter={itemFilter}
                onFolderToggle={id => toggleNode(id, 'folder')}
                onFolderSelect={f => emitResource({ ...f, type: 'folder' })}
                onItemSelect={handleItemSelect}
                selectedItemId={effectiveSelectedItemId}
                selectedFolderId={selectedFolderId}
                visualStyle={effectiveVisualStyle}
                renderFolder={renderFolder}
                renderItem={renderItem}
              />
            )}
          </div>
        )}

        {!rootFolder &&
          collections.map(collection => {
            const isCollectionSelected = selectedCollectionId === collection._id
            return (
              <div key={collection._id}>
                {renderCollection ? (
                  <div
                    className={`folder-browser__collection folder-browser__collection--custom${isCollectionSelected ? ' selected' : ''}`}
                    data-resource-id={collection._id}
                    onClick={() => emitResource({ ...collection, type: 'collection' })}
                    onDoubleClick={() => toggleNode(collection._id, 'collection')}
                  >
                    {renderCollection(
                      collection,
                      expanded.has(collection._id),
                      () => toggleNode(collection._id, 'collection'),
                      undefined,
                    )}
                  </div>
                ) : (
                  <div
                    className={`folder-browser__collection${isCollectionSelected ? ' selected' : ''}`}
                    data-resource-id={collection._id}
                    onClick={() => emitResource({ ...collection, type: 'collection' })}
                    onDoubleClick={() => toggleNode(collection._id, 'collection')}
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
                          onClick={e => {
                            e.stopPropagation()
                            toggleNode(collection._id, 'collection')
                          }}
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
                          onClick={e => {
                            e.stopPropagation()
                            toggleNode(collection._id, 'collection')
                          }}
                        />
                        <span className="folder-browser__row-name">{collection.name}</span>
                        <span className="folder-browser__type-badge">Collection</span>
                      </>
                    )}
                  </div>
                )}
                {expanded.has(collection._id) && (
                  <TreeNode
                    parentId={collection._id}
                    depth={1}
                    expanded={expanded}
                    childrenMap={childrenMap}
                    loadingIds={loadingIds}
                    allowedExtensions={allowedExtensions}
                    itemFilter={itemFilter}
                    onFolderToggle={id => toggleNode(id, 'folder')}
                    onFolderSelect={f => emitResource({ ...f, type: 'folder' })}
                    onItemSelect={handleItemSelect}
                    selectedItemId={effectiveSelectedItemId}
                    selectedFolderId={selectedFolderId}
                    visualStyle={effectiveVisualStyle}
                    renderFolder={renderFolder}
                    renderItem={renderItem}
                  />
                )}
              </div>
            )
          })}
      </div>
      <div className="folder-browser__resize-handle" onMouseDown={handleResizeStart} />
    </div>
  )
}

export default FolderBrowser
