/**
 * ULTRA-MINIMAL Inline Example (no wrapper component)
 * 
 * Paste this directly into your React component file.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { 
  AnnotationManager, 
  SlideViewer, 
  IndexedDBAnnotationCache
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

  // Unified state object
  const [state, setState] = useState({
    loadedIds: [] as string[],
    opacities: new Map<string, number>(),
    visibility: new Map<string, boolean>(),
  })

  // SIMPLIFIED: Shared ready handler - no refs needed!
  const handleReady = useCallback((id: string | number) => {
    console.log('Annotation ready:', id)
  }, [])

  return (
    <div style={{ display: 'flex', height: '800px', width: '100%' }}>
      {/* Left: Annotation Panel */}
      <div style={{ width: '350px', borderRight: '2px solid #ddd', overflowY: 'auto' }}>
        <AnnotationManager
          imageId={IMAGE_ID}
          apiBaseUrl={API_BASE_URL}
          annotationCache={cache}
          slideViewerOnAnnotationReady={handleReady}  // ← NEW: Simple prop!
          onAnnotationStateChange={(newState) => {
            setState({
              loadedIds: newState.loadedAnnotationIds,
              opacities: newState.opacities,
              visibility: newState.visibility,
            })
          }}
          onAnnotationHeadersChange={setAnnotationHeaders}  // ← Automatic headers!
          showDefaultUI={true}
        />
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

