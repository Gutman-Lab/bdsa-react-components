import { useState, useEffect } from 'react'
import type { FeatureCollection } from 'geojson'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dsaAuthStore } from '../../auth/DsaAuthStore'
import { useResizablePanel } from '../../hooks/useResizablePanel'
import './AnnotationBrowser.css'

interface DsaAnnotation {
  _id: string
  _elementCount: number
  annotation: {
    name: string
    description?: string
  }
}

interface AnnotationBrowserProps {
  itemId?: string
  onAnnotationSelect?: (geojson: FeatureCollection) => void
  className?: string
  style?: React.CSSProperties
  defaultWidth?: number
}

export function AnnotationBrowser({ itemId, onAnnotationSelect, className = '', style, defaultWidth = 250 }: AnnotationBrowserProps) {
  const { width, collapsed, setCollapsed, handleResizeStart } = useResizablePanel({ defaultWidth, side: 'right' })
  const [annotations, setAnnotations] = useState<DsaAnnotation[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingGeoJson, setLoadingGeoJson] = useState(false)

  useEffect(() => {
    if (!itemId) { setAnnotations([]); return }

    const { serverUrl } = dsaAuthStore.getStatus()
    setLoading(true)

    fetch(
      `${serverUrl}/api/v1/annotation?itemId=${itemId}&limit=0&offset=0&sort=lowerName&sortdir=1`,
      { headers: dsaAuthStore.getAuthHeaders() }
    )
      .then(res => res.json())
      .then(data => setAnnotations(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to fetch annotations:', err))
      .finally(() => setLoading(false))
  }, [itemId])

  function handleSelect(annotationId: string) {
    if (!annotationId || !onAnnotationSelect) return

    const { serverUrl } = dsaAuthStore.getStatus()
    setLoadingGeoJson(true)

    fetch(
      `${serverUrl}/api/v1/annotation/${annotationId}/geojson`,
      { headers: dsaAuthStore.getAuthHeaders() }
    )
      .then(res => res.json())
      .then(geojson => onAnnotationSelect(geojson))
      .catch(err => console.error('Failed to fetch annotation GeoJSON:', err))
      .finally(() => setLoadingGeoJson(false))
  }

  if (collapsed) {
    return (
      <div
        className={`annotation-browser annotation-browser--collapsed ${className}`}
        style={{ ...style, width: '36px', minWidth: '36px' }}
      >
        <button
          className="annotation-browser__collapse-btn"
          onClick={() => setCollapsed(false)}
          title="Expand annotations"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="annotation-browser__collapsed-label">Annotations</span>
      </div>
    )
  }

  return (
    <div
      className={`annotation-browser ${className}`}
      style={{ ...style, width: `${width}px`, minWidth: `${width}px` }}
    >
      <div className="annotation-browser__resize-handle" onMouseDown={handleResizeStart} />
      <div className="annotation-browser__header">
        <span>Annotations</span>
        <button
          className="annotation-browser__collapse-btn"
          onClick={() => setCollapsed(true)}
          title="Collapse panel"
        >
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="annotation-browser__scroll">
        {loading && <div className="annotation-browser__empty">Loading...</div>}
        {!loading && annotations.length === 0 && (
          <div className="annotation-browser__empty">No annotations found</div>
        )}
        {!loading && annotations.length > 0 && (
          <div className="annotation-browser__section">
            <select
              className="annotation-browser__select"
              defaultValue=""
              onChange={e => handleSelect(e.target.value)}
              disabled={loadingGeoJson}
            >
              <option value="" disabled>Select annotation...</option>
              {annotations.map(ann => (
                <option key={ann._id} value={ann._id}>
                  {ann.annotation.name}
                </option>
              ))}
            </select>
            {loadingGeoJson && <div className="annotation-browser__empty">Loading...</div>}
          </div>
        )}
      </div>
    </div>
  )
}

export default AnnotationBrowser
