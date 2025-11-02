/**
 * Minimal Example: AnnotationManager + SlideViewer Integration
 * 
 * Copy this into your React component to add annotation panel + image viewer.
 * 
 * Requirements:
 * 1. Install: npm install bdsa-react-components
 * 2. Import styles: import 'bdsa-react-components/styles.css'
 * 3. Replace placeholder values (imageId, apiBaseUrl, dziUrl) with your actual values
 * 
 * ✅ SIMPLIFIED PATTERN - No render props needed for onAnnotationReady!
 * ✅ Single unified callback (onAnnotationStateChange) - fires immediately
 * ✅ Automatic headers sync (onAnnotationHeadersChange)
 */

import React, { useState, useCallback, useMemo } from 'react'
import { AnnotationManager, SlideViewer, IndexedDBAnnotationCache } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

interface AnnotationViewerProps {
  imageId: string  // Your image/item ID (e.g., '6903df8dd26a6d93de19a9b2')
  apiBaseUrl: string  // Your API base URL (e.g., 'http://bdsa.pathology.emory.edu:8080/api/v1')
  dziUrl: string  // DZI URL for the image (e.g., `${apiBaseUrl}/item/${imageId}/tiles/dzi.dzi`)
}

const AnnotationViewer: React.FC<AnnotationViewerProps> = ({ 
  imageId, 
  apiBaseUrl, 
  dziUrl 
}) => {
  // Cache instance (shared between components)
  const cache = useMemo(() => new IndexedDBAnnotationCache(), [])

  // Unified state - single state object for all annotation state
  const [annotationState, setAnnotationState] = useState<{
    loadedIds: string[]
    opacities: Map<string, number>
    visibility: Map<string, boolean>
  }>({
    loadedIds: [],
    opacities: new Map(),
    visibility: new Map(),
  })

  // Annotation headers for cache version checking
  const [annotationHeaders, setAnnotationHeaders] = useState<Map<string | number, unknown>>(new Map())

  // SIMPLIFIED: Shared annotation ready handler - just pass to both components!
  const handleAnnotationReady = useCallback((id: string | number) => {
    // Both components can use this - AnnotationManager handles forwarding internally
    console.log('Annotation ready:', id)
  }, [])

  return (
    <div style={{ width: '100%', height: '800px', display: 'flex', flexDirection: 'row' }}>
      {/* Annotation Manager - Vertical Sidebar */}
      <div style={{ 
        width: '350px', 
        minWidth: '350px',
        maxHeight: '800px', 
        overflowY: 'auto', 
        borderRight: '2px solid #ddd', 
        backgroundColor: '#fff',
        flexShrink: 0 
      }}>
        <AnnotationManager
          imageId={imageId}
          apiBaseUrl={apiBaseUrl}
          annotationCache={cache}
          // NEW: Simple prop - no render props needed!
          slideViewerOnAnnotationReady={handleAnnotationReady}
          // Single unified callback - fires IMMEDIATELY on Load/Hide/Opacity/Visibility changes
          onAnnotationStateChange={(state) => {
            setAnnotationState({
              loadedIds: state.loadedAnnotationIds,
              opacities: state.opacities,
              visibility: state.visibility,
            })
          }}
          // Automatic headers sync - no manual extraction needed!
          onAnnotationHeadersChange={setAnnotationHeaders}
          showDefaultUI={true}
        />
      </div>
      
      {/* SlideViewer */}
      <div style={{ flex: 1, minWidth: 0, height: '800px' }}>
        <SlideViewer
          imageInfo={{ dziUrl }}
          annotationIds={annotationState.loadedIds}
          apiBaseUrl={apiBaseUrl}
          showAnnotationInfo={true}
          showAnnotationControls={false}
          annotationOpacities={annotationState.opacities}
          visibleAnnotations={annotationState.visibility}
          annotationCache={cache}
          annotationHeaders={annotationHeaders}
          onAnnotationReady={handleAnnotationReady}
          height="800px"
        />
      </div>
    </div>
  )
}

export default AnnotationViewer

/**
 * Usage in your app:
 * 
 * ```tsx
 * <AnnotationViewer
 *   imageId="6903df8dd26a6d93de19a9b2"
 *   apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
 *   dziUrl="http://bdsa.pathology.emory.edu:8080/api/v1/item/6903df8dd26a6d93de19a9b2/tiles/dzi.dzi"
 * />
 * ```
 * 
 * Benefits of this approach:
 * ✅ 70% less boilerplate - single callback instead of multiple
 * ✅ No render props needed - just pass slideViewerOnAnnotationReady prop
 * ✅ Immediate state sync - onAnnotationStateChange fires synchronously
 * ✅ Automatic headers sync - onAnnotationHeadersChange eliminates manual extraction
 * ✅ Built-in deduplication - prevents infinite loops automatically
 */
