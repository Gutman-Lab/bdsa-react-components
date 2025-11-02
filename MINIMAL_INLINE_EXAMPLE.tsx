/**
 * ULTRA-MINIMAL Inline Example (no wrapper component)
 * 
 * Paste this directly into your React component file.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { 
  AnnotationManager, 
  SlideViewer, 
  IndexedDBAnnotationCache,
  type AnnotationSearchResult 
} from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

// === REPLACE THESE VALUES ===
const IMAGE_ID = '6903df8dd26a6d93de19a9b2'
const API_BASE_URL = 'http://bdsa.pathology.emory.edu:8080/api/v1'
const DZI_URL = `${API_BASE_URL}/item/${IMAGE_ID}/tiles/dzi.dzi`

// === YOUR COMPONENT ===
export const MyAnnotationViewer = () => {
  // Cache (shared between components)
  const cache = useMemo(() => new IndexedDBAnnotationCache(), [])
  
  // Annotation headers for cache versioning
  const [annotationHeaders, setAnnotationHeaders] = useState<Map<string | number, unknown>>(new Map())
  
  // Ref to capture AnnotationManager's internal callback
  const managerReadyRef = useRef<((id: string) => void) | null>(null)

  // Unified state object
  const [state, setState] = useState({
    loadedIds: [] as string[],
    opacities: new Map<string, number>(),
    visibility: new Map<string, boolean>(),
  })

  // Shared ready handler
  const handleReady = useCallback((id: string | number) => {
    if (managerReadyRef.current) {
      managerReadyRef.current(String(id))
    }
  }, [])

  return (
    <div style={{ display: 'flex', height: '800px', width: '100%' }}>
      {/* Left: Annotation Panel */}
      <div style={{ width: '350px', borderRight: '2px solid #ddd', overflowY: 'auto' }}>
        <AnnotationManager
          imageId={IMAGE_ID}
          apiBaseUrl={API_BASE_URL}
          annotationCache={cache}
          onAnnotationReady={handleReady}
          onAnnotationStateChange={(newState) => {
            setState({
              loadedIds: newState.loadedAnnotationIds,
              opacities: newState.opacities,
              visibility: newState.visibility,
            })
          }}
          showDefaultUI={true}
        >
          {({ onAnnotationReady, annotations }) => {
            if (onAnnotationReady) managerReadyRef.current = onAnnotationReady
            useEffect(() => {
              const headers = new Map<string | number, AnnotationSearchResult>()
              annotations.forEach(ann => headers.set(String(ann._id), ann))
              setAnnotationHeaders(headers)
            }, [annotations])
            return null
          }}
        </AnnotationManager>
      </div>

      {/* Right: Image Viewer */}
      <div style={{ flex: 1 }}>
        <SlideViewer
          imageInfo={{ dziUrl: DZI_URL }}
          annotationIds={state.loadedIds}
          apiBaseUrl={API_BASE_URL}
          annotationOpacities={state.opacities}
          visibleAnnotations={state.visibility}
          annotationCache={cache}
          annotationHeaders={annotationHeaders}
          onAnnotationReady={handleReady}
          height="800px"
        />
      </div>
    </div>
  )
}

