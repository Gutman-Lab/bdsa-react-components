/**
 * SIMPLIFIED Integration Example - RECOMMENDED APPROACH
 * 
 * This demonstrates the new simplified callback pattern:
 * 
 * ✅ Single unified callback (onAnnotationStateChange) - fires immediately
 * ✅ Simple shared callback (slideViewerOnAnnotationReady) - no render props needed
 * ✅ Automatic deduplication - prevents infinite loops
 * ✅ Immediate state sync - no timing issues
 * 
 * Copy this into your React component - much simpler than before!
 */

import React, { useState, useCallback, useMemo } from 'react'
import { 
  AnnotationManager, 
  SlideViewer, 
  IndexedDBAnnotationCache
} from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

interface AnnotationViewerProps {
  imageId: string
  apiBaseUrl: string
  dziUrl: string
}

const SimplifiedAnnotationViewer: React.FC<AnnotationViewerProps> = ({ 
  imageId, 
  apiBaseUrl, 
  dziUrl 
}) => {
  // Cache instance (shared between components)
  const cache = useMemo(() => new IndexedDBAnnotationCache(), [])
  
  // Annotation headers for cache versioning
  const [annotationHeaders, setAnnotationHeaders] = useState<Map<string | number, unknown>>(new Map())

  // Unified state - single state object
  const [state, setState] = useState({
    loadedIds: [] as string[],
    opacities: new Map<string, number>(),
    visibility: new Map<string, boolean>(),
  })

  // SIMPLIFIED: Just pass the same callback to both - no refs, no forwarding!
  const handleReady = useCallback((id: string | number) => {
    // Both components can use this - AnnotationManager handles forwarding internally
    console.log('Annotation ready:', id)
  }, [])

  return (
    <div style={{ display: 'flex', height: '800px', width: '100%' }}>
      {/* Left: Annotation Panel */}
      <div style={{ width: '350px', borderRight: '2px solid #ddd', overflowY: 'auto' }}>
        <AnnotationManager
          imageId={imageId}
          apiBaseUrl={apiBaseUrl}
          annotationCache={cache}
          // NEW: Simple prop - just pass the same callback
          slideViewerOnAnnotationReady={handleReady}
          // Single unified callback - fires IMMEDIATELY on Load/Hide/Opacity/Visibility
          onAnnotationStateChange={(newState) => {
            setState({
              loadedIds: newState.loadedAnnotationIds,
              opacities: newState.opacities,
              visibility: newState.visibility,
            })
          }}
          // Automatic headers sync - no render prop needed!
          onAnnotationHeadersChange={setAnnotationHeaders}
          showDefaultUI={true}
        />
      </div>

      {/* Right: Image Viewer */}
      <div style={{ flex: 1 }}>
        <SlideViewer
          imageInfo={{ dziUrl }}
          annotationIds={state.loadedIds}
          apiBaseUrl={apiBaseUrl}
          annotationOpacities={state.opacities}
          visibleAnnotations={state.visibility}
          annotationCache={cache}
          annotationHeaders={annotationHeaders}
          // Same callback - AnnotationManager handles forwarding
          onAnnotationReady={handleReady}
          height="800px"
        />
      </div>
    </div>
  )
}

export default SimplifiedAnnotationViewer

/**
 * Benefits of this approach:
 * 
 * ✅ 70% less code - single callback instead of multiple
 * ✅ No render props for onAnnotationReady - just pass slideViewerOnAnnotationReady
 * ✅ Immediate state sync - onAnnotationStateChange fires synchronously
 * ✅ No infinite loops - automatic deduplication built-in
 * ✅ Clear, predictable timing - callbacks fire immediately when actions occur
 * 
 * What changed:
 * 
 * BEFORE (Complex):
 * - Multiple callbacks: onLoadedAnnotationIdsChange, onAnnotationOpacityChange, etc.
 * - Render prop pattern to extract onAnnotationReady
 * - Manual ref management and forwarding
 * - Timing issues - callbacks might not fire immediately
 * - Risk of infinite loops
 * 
 * AFTER (Simple):
 * - One callback: onAnnotationStateChange (fires immediately)
 * - One prop: slideViewerOnAnnotationReady (no render props needed)
 * - No refs needed - library handles forwarding
 * - Guaranteed immediate firing - synchronous in action handlers
 * - Built-in deduplication prevents loops
 */

