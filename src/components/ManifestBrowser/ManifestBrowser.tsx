import { useState, useEffect } from 'react'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { dsaAuthStore } from '../../auth/DsaAuthStore'
import { useResizablePanel } from '../../hooks/useResizablePanel'
import { ItemRow, fetchDsaItem } from '../../utils/dsaBrowserUtils'
import type { Item } from '../../utils/dsaBrowserUtils'
import '../../styles/browserPanel.css'

/** Shape of the manifest.json file served from public/. */
type Manifest = Record<string, string[]>

interface ManifestBrowserProps {
  onItemSelect?: (item: Item) => void
  selectedItemId?: string
  className?: string
  style?: React.CSSProperties
  defaultWidth?: number
  /** URL of the manifest file. Defaults to '/manifest.json'. */
  manifestUrl?: string
}

export function ManifestBrowser({
  onItemSelect,
  selectedItemId,
  className = '',
  style,
  defaultWidth = 250,
  manifestUrl = '/manifest.json',
}: ManifestBrowserProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { width, collapsed, setCollapsed, handleResizeStart } = useResizablePanel({ defaultWidth })

  useEffect(() => {
    async function load() {
      const { serverUrl, isAuthenticated, user } = dsaAuthStore.getStatus()

      if (!serverUrl || !isAuthenticated || !user?.login) {
        setItems([])
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const manifestRes = await fetch(manifestUrl)
        if (!manifestRes.ok) throw new Error(`Failed to fetch manifest: ${manifestRes.status}`)
        const manifest: Manifest = await manifestRes.json()

        const itemIds: string[] = manifest[user.login] ?? []
        if (itemIds.length === 0) {
          setItems([])
          return
        }

        const headers = dsaAuthStore.getAuthHeaders()
        const fetched = await Promise.all(
          itemIds.map(id => fetchDsaItem(serverUrl, id, headers))
        )
        setItems(fetched)
      } catch (err) {
        setError((err as Error).message)
        setItems([])
      } finally {
        setLoading(false)
      }
    }

    load()
    return dsaAuthStore.subscribe(load)
  }, [manifestUrl])

  if (collapsed) {
    return (
      <div
        className={`folder-browser folder-browser--collapsed ${className}`}
        style={{ ...style, width: '36px', minWidth: '36px' }}
      >
        <button className="folder-browser__collapse-btn" onClick={() => setCollapsed(false)} title="Expand panel">
          <ChevronRight size={22} />
        </button>
        <span className="folder-browser__collapsed-label">Manifest Browser</span>
      </div>
    )
  }

  return (
    <div
      className={`folder-browser ${className}`}
      style={{ ...style, width: `${width}px`, minWidth: `${width}px` }}
    >
      <div className="folder-browser__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <BookOpen size={16} />
          Images
        </div>
        <button className="folder-browser__collapse-btn" onClick={() => setCollapsed(true)} title="Collapse panel">
          <ChevronLeft size={22} />
        </button>
      </div>
      <div className="folder-browser__scroll">
        {loading && <div className="folder-browser__empty">Loading...</div>}
        {error && <div className="folder-browser__empty">Error: {error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="folder-browser__empty">No images available</div>
        )}
        {items.map(item => (
          <ItemRow
            key={item._id}
            item={item}
            selectedItemId={selectedItemId}
            onItemSelect={onItemSelect}
            style={{ paddingLeft: '1rem' }}
          />
        ))}
      </div>
      <div className="folder-browser__resize-handle" onMouseDown={handleResizeStart} />
    </div>
  )
}

export default ManifestBrowser
