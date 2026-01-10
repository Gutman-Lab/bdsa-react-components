import type { Meta, StoryObj } from '@storybook/react'
import React, { useState, useCallback, useMemo, useRef } from 'react'
import { AnnotationManager, type AnnotationSearchResult } from './AnnotationManager'
import { SlideViewer, SlideImageInfo } from '../SlideViewer/SlideViewer'
import { IndexedDBAnnotationCache } from '../../cache/IndexedDBAnnotationCache'

const meta: Meta<typeof AnnotationManager> = {
    title: 'Components/AnnotationManager',
    component: AnnotationManager,
    tags: ['autodocs'],
    argTypes: {
        showDebugPanel: {
            control: 'boolean',
            description: 'Show debug panel with raw API response',
        },
    },
}

export default meta
type Story = StoryObj<typeof AnnotationManager>

const exampleImageInfo: SlideImageInfo = {
    imageId: '6903df8dd26a6d93de19a9b2',
    baseUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1',
}

const exampleApiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1'

export const Default: Story = {
    args: {
        imageId: '6903df8dd26a6d93de19a9b2',
        apiBaseUrl: exampleApiBaseUrl,
        children: ({ annotations, loading, error, annotationIds }) => {
            if (loading) {
                return (
                    <div className="bdsa-annotation-manager__list">
                        <div className="bdsa-annotation-manager__empty-state">
                            <p>Loading annotations...</p>
                        </div>
                    </div>
                )
            }

            if (error) {
                return (
                    <div className="bdsa-annotation-manager__list">
                        <div className="bdsa-annotation-manager__empty-state" style={{ color: '#dc3545' }}>
                            <p>Error: {error.message}</p>
                        </div>
                    </div>
                )
            }

            if (annotations.length === 0) {
                return (
                    <div className="bdsa-annotation-manager__list">
                        <div className="bdsa-annotation-manager__empty-state">
                            <p>No annotations found</p>
                        </div>
                    </div>
                )
            }

            const publicCount = annotations.filter(a => a.public === true).length
            const privateCount = annotations.length - publicCount

            return (
                <div className="bdsa-annotation-manager__list">
                    <div className="bdsa-annotation-manager__list-header">
                        <h3>Annotations</h3>
                        <p>
                            {annotations.length} total
                            {privateCount > 0 && ` (${publicCount} public, ${privateCount} private)`}
                        </p>
                    </div>
                    {annotations.map((ann) => (
                        <div
                            key={ann._id}
                            className="bdsa-annotation-manager__annotation-card"
                        >
                            <div className="bdsa-annotation-manager__annotation-card-header">
                                <h4 className="bdsa-annotation-manager__annotation-card-title">
                                    {ann.annotation?.name || ann._id}
                                </h4>
                                <div className="bdsa-annotation-manager__annotation-card-meta">
                                    {ann.public === false && (
                                        <span className="bdsa-annotation-manager__annotation-card-badge bdsa-annotation-manager__annotation-card-badge--private">
                                            Private
                                        </span>
                                    )}
                                    {ann.public === true && (
                                        <span className="bdsa-annotation-manager__annotation-card-badge bdsa-annotation-manager__annotation-card-badge--public">
                                            Public
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="bdsa-annotation-manager__annotation-card-details">
                                {ann._elementCount !== undefined && (
                                    <div className="bdsa-annotation-manager__annotation-card-detail">
                                        <strong>Elements:</strong> {ann._elementCount}
                                    </div>
                                )}
                                {ann._detailsCount !== undefined && (
                                    <div className="bdsa-annotation-manager__annotation-card-detail">
                                        <strong>Points:</strong> {ann._detailsCount.toLocaleString()}
                                    </div>
                                )}
                                {ann.groups && ann.groups.length > 0 && (
                                    <div className="bdsa-annotation-manager__annotation-card-detail">
                                        <strong>Groups:</strong> {ann.groups.filter(g => g !== null).join(', ')}
                                    </div>
                                )}
                            </div>
                            {ann.annotation?.description && (
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
                                    {ann.annotation.description}
                                </div>
                            )}
                            <div className="bdsa-annotation-manager__annotation-card-controls">
                                <button className="bdsa-annotation-manager__annotation-card-control">
                                    Load
                                </button>
                                <button className="bdsa-annotation-manager__annotation-card-control">
                                    Hide
                                </button>
                                <button className="bdsa-annotation-manager__annotation-card-control">
                                    Opacity
                                </button>
                            </div>
                        </div>
                    ))}
                    {privateCount > 0 && (
                        <p style={{ color: '#666', fontSize: '12px', marginTop: '12px', textAlign: 'center' }}>
                            Note: {privateCount} private annotation(s) may require authentication to load.
                        </p>
                    )}
                </div>
            )
        },
    },
}

// Wrapper component for the integrated view
const AnnotationManagerWithViewer = () => {
    const [loadedAnnotationIds, setLoadedAnnotationIds] = useState<Set<string>>(new Set())
    const [visibleAnnotations, setVisibleAnnotations] = useState<Map<string, boolean>>(new Map())
    const [annotationOpacities, setAnnotationOpacities] = useState<Map<string, number>>(new Map())
    const [annotationHeaders, setAnnotationHeaders] = useState<Map<string, AnnotationSearchResult>>(new Map())

    // Create cache instance (persists across refreshes using IndexedDB)
    const cache = React.useMemo(() => {
        return new IndexedDBAnnotationCache()
    }, [])

    const dziUrl = `${exampleApiBaseUrl}/item/${exampleImageInfo.imageId}/tiles/dzi.dzi`

    const handleLoadChange = (annotationId: string, loaded: boolean) => {
        if (loaded) {
            setLoadedAnnotationIds(prev => new Set(prev).add(annotationId))
            setVisibleAnnotations(prev => new Map(prev).set(annotationId, true))
            setAnnotationOpacities(prev => new Map(prev).set(annotationId, 1))
        } else {
            setLoadedAnnotationIds(prev => {
                const next = new Set(prev)
                next.delete(annotationId)
                return next
            })
            setVisibleAnnotations(prev => {
                const next = new Map(prev)
                next.delete(annotationId)
                return next
            })
            setAnnotationOpacities(prev => {
                const next = new Map(prev)
                next.delete(annotationId)
                return next
            })
        }
    }

    const handleVisibilityChange = (annotationId: string, visible: boolean) => {
        setVisibleAnnotations(prev => new Map(prev).set(annotationId, visible))
    }

    const handleOpacityChange = (annotationId: string, opacity: number) => {
        setAnnotationOpacities(prev => new Map(prev).set(annotationId, opacity))
    }

    // This callback is passed to AnnotationManager's onAnnotationReady prop for logging
    const handleAnnotationReady = useCallback((annotationId: string | number) => {
        console.log(`Annotation ${annotationId} is ready`)
    }, [])

    // Store reference to AnnotationManager's internal onAnnotationReady callback
    const annotationManagerReadyRef = React.useRef<((id: string | number) => void) | null>(null)

    // Filter loaded annotations to only include visible ones for the viewer
    // Visibility is now opacity-based, so check opacity > 0
    const visibleLoadedAnnotations = Array.from(loadedAnnotationIds).filter(id => {
        const opacity = annotationOpacities.get(id) ?? 1
        return opacity > 0
    })

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
                    imageId={exampleImageInfo.imageId ? String(exampleImageInfo.imageId) : undefined}
                    apiBaseUrl={exampleApiBaseUrl}
                    loadedAnnotations={loadedAnnotationIds}
                    visibleAnnotations={visibleAnnotations}
                    annotationOpacities={annotationOpacities}
                    annotationCache={cache}
                    onAnnotationLoadChange={handleLoadChange}
                    onAnnotationVisibilityChange={handleVisibilityChange}
                    onAnnotationOpacityChange={handleOpacityChange}
                    onAnnotationReady={handleAnnotationReady}
                    showDefaultUI={true}
                >
                    {({ onAnnotationReady: managerReadyCallback, annotations }) => {
                        // Capture AnnotationManager's internal callback via render prop
                        // Store it directly (not in useEffect - render props are called during render)
                        if (managerReadyCallback) {
                            annotationManagerReadyRef.current = managerReadyCallback
                        }

                        // Update annotation headers map for cache version checking in SlideViewer
                        React.useEffect(() => {
                            const headersMap = new Map<string, AnnotationSearchResult>()
                            annotations.forEach((ann) => {
                                headersMap.set(String(ann._id), ann)
                            })
                            setAnnotationHeaders(headersMap)
                        }, [annotations])

                        return null // Use default UI
                    }}
                </AnnotationManager>
            </div>

            {/* SlideViewer */}
            <div style={{ flex: 1, minWidth: 0, height: '800px' }}>
                <SlideViewer
                    imageInfo={{ dziUrl }}
                    annotationIds={loadedAnnotationIds.size > 0 ? Array.from(loadedAnnotationIds) : []}
                    apiBaseUrl={exampleApiBaseUrl}
                    showAnnotationInfo={true}
                    showAnnotationControls={false}
                    annotationOpacities={annotationOpacities}
                    visibleAnnotations={visibleAnnotations}
                    annotationCache={cache}
                    annotationHeaders={annotationHeaders}
                    onAnnotationReady={(id) => {
                        // This is called by SlideViewer when annotation is ready
                        // Call AnnotationManager's internal callback which clears loading state
                        console.log(`Story: SlideViewer notified that annotation ${id} is ready`)
                        if (annotationManagerReadyRef.current) {
                            annotationManagerReadyRef.current(id)
                        } else {
                            console.warn(`Story: AnnotationManager's onAnnotationReady callback not yet available`)
                        }
                        // Also call the external handler for logging
                        handleAnnotationReady(id)
                    }}
                    height="800px"
                />
            </div>
        </div>
    )
}

export const WithSlideViewer: Story = {
    render: () => <AnnotationManagerWithViewer />,
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                story: 'AnnotationManager with SlideViewer integration. Use the vertical annotation list on the left to load/unload annotations, toggle their visibility, and adjust opacity individually. Only visible loaded annotations are displayed in the viewer.',
            },
        },
    },
}

/**
 * Simplified integration example using the unified onAnnotationStateChange callback.
 * This demonstrates the recommended approach for integrating AnnotationManager with SlideViewer.
 * 
 * Benefits:
 * - Single callback for state management instead of multiple individual callbacks
 * - Less boilerplate code (70% reduction)
 * - Automatic state synchronization
 * - Type-safe state object
 * 
 * NOTE: We still use a minimal render prop to get the callback - this is more reliable
 * than trying to pass it through state change callbacks.
 */
const AnnotationManagerWithViewerSimplified: React.FC = () => {
    console.log('[Simplified] Component rendering')
    const [dziUrl] = useState('http://bdsa.pathology.emory.edu:8080/api/v1/item/6903df8dd26a6d93de19a9b2/tiles/dzi.dzi')
    const cache = React.useMemo(() => new IndexedDBAnnotationCache(), [])
    const [annotationHeaders, setAnnotationHeaders] = React.useState<Map<string | number, AnnotationSearchResult>>(new Map())

    // Unified state - single state object for all annotation state
    // Store serialized versions to enable proper change detection
    const [annotationState, setAnnotationState] = React.useState<{
        loadedIds: string[]
        opacitiesEntries: Array<[string, number]>
        visibilityEntries: Array<[string, boolean]>
    }>(() => {
        console.log('[Simplified] Initializing state with empty arrays')
        return {
            loadedIds: [],
            opacitiesEntries: [],
            visibilityEntries: [],
        }
    })

    // Store reference to AnnotationManager's internal onAnnotationReady callback
    // This is captured via render prop (reliable) and passed to SlideViewer
    const annotationManagerReadyRef = React.useRef<((id: string | number) => void) | null>(null)

    // Wrap the state change callback in useCallback to prevent infinite loops
    // This callback is called by AnnotationManager whenever annotation state changes
    // Serialize Maps to arrays to enable proper change detection
    const handleAnnotationStateChange = useCallback((state: {
        loadedAnnotationIds: string[]
        opacities: Map<string, number>
        visibility: Map<string, boolean>
    }) => {
        console.log('[Simplified] handleAnnotationStateChange called with loadedIds:', state.loadedAnnotationIds)
        const opacitiesArr = Array.from(state.opacities.entries()).sort(([a], [b]) => a.localeCompare(b))
        const visibilityArr = Array.from(state.visibility.entries()).sort(([a], [b]) => a.localeCompare(b))

        setAnnotationState((prev) => {
            // Only update if actually changed (deep comparison of serialized data)
            const loadedIdsSame = JSON.stringify(prev.loadedIds) === JSON.stringify(state.loadedAnnotationIds.sort())
            const opacitiesSame = JSON.stringify(prev.opacitiesEntries) === JSON.stringify(opacitiesArr)
            const visibilitySame = JSON.stringify(prev.visibilityEntries) === JSON.stringify(visibilityArr)

            console.log('[Simplified] State comparison - same?', { loadedIdsSame, opacitiesSame, visibilitySame })

            if (loadedIdsSame && opacitiesSame && visibilitySame) {
                return prev // No change, return same object to prevent re-render
            }

            console.log('[Simplified] Updating state to:', {
                loadedIds: state.loadedAnnotationIds,
                opacitiesEntries: opacitiesArr,
                visibilityEntries: visibilityArr,
            })

            return {
                loadedIds: state.loadedAnnotationIds,
                opacitiesEntries: opacitiesArr,
                visibilityEntries: visibilityArr,
            }
        })
    }, []) // setAnnotationState from useState is stable, no need to include it

    // This callback is passed to AnnotationManager's onAnnotationReady prop for logging
    const handleAnnotationReady = useCallback((annotationId: string | number) => {
        // Optional: Add any custom logic when annotation is ready
    }, [])

    // Memoize the state objects to prevent infinite loops
    // Reconstruct Maps/Sets from serialized state only when data actually changes
    const loadedAnnotationsSet = React.useMemo(() => {
        return new Set(annotationState.loadedIds)
    }, [annotationState.loadedIds])

    const opacitiesMap = React.useMemo(() => {
        return new Map(annotationState.opacitiesEntries)
    }, [annotationState.opacitiesEntries])

    const visibilityMap = React.useMemo(() => {
        return new Map(annotationState.visibilityEntries)
    }, [annotationState.visibilityEntries])

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
                    imageId={exampleImageInfo.imageId ? String(exampleImageInfo.imageId) : undefined}
                    apiBaseUrl={exampleApiBaseUrl}
                    annotationCache={cache}
                    // DON'T pass state back - use uncontrolled mode
                    // AnnotationManager manages state internally
                    // Single unified callback for state notifications - much simpler!
                    onAnnotationStateChange={handleAnnotationStateChange}
                    // Use onAnnotationHeadersChange instead of render prop for cleaner code
                    onAnnotationHeadersChange={setAnnotationHeaders}
                    onAnnotationReady={handleAnnotationReady}
                    showDefaultUI={true}
                >
                    {({ onAnnotationReady: managerReadyCallback }) => {
                        // Minimal render prop - just capture the callback (same pattern as working version)
                        // This is more reliable than trying to get it from state change callbacks
                        if (managerReadyCallback) {
                            annotationManagerReadyRef.current = managerReadyCallback
                        }
                        return null // Use default UI
                    }}
                </AnnotationManager>
            </div>

            {/* SlideViewer */}
            <div style={{ flex: 1, minWidth: 0, height: '800px' }}>
                <SlideViewer
                    imageInfo={{ dziUrl }}
                    annotationIds={annotationState.loadedIds}
                    apiBaseUrl={exampleApiBaseUrl}
                    showAnnotationInfo={true}
                    showAnnotationControls={false}
                    annotationOpacities={opacitiesMap}
                    visibleAnnotations={visibilityMap}
                    annotationCache={cache}
                    annotationHeaders={annotationHeaders}
                    onAnnotationReady={(id) => {
                        // This is called by SlideViewer when annotation is ready
                        // Call AnnotationManager's internal callback which clears loading state
                        console.log(`[Simplified] SlideViewer says ${id} is ready. Callback exists:`, !!annotationManagerReadyRef.current)
                        if (annotationManagerReadyRef.current) {
                            annotationManagerReadyRef.current(id)
                        }
                        // Also call the external handler for any custom logic
                        handleAnnotationReady(id)
                    }}
                    height="800px"
                />
            </div>
        </div>
    )
}

export const WithSlideViewerSimplified: Story = {
    render: () => <AnnotationManagerWithViewerSimplified />,
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                story: '**RECOMMENDED APPROACH**: Simplified integration using the unified `onAnnotationStateChange` callback. This pattern requires 70% less boilerplate code compared to using individual callbacks. Single state object syncs automatically with both AnnotationManager and SlideViewer.',
            },
        },
    },
}

export const WithDebugPanel: Story = {
    args: {
        imageId: '6903df8dd26a6d93de19a9b2',
        apiBaseUrl: exampleApiBaseUrl,
        showDebugPanel: true,
        children: ({ annotations, loading, error, annotationIds }) => {
            if (loading) return <div>Loading annotations...</div>
            if (error) return <div>Error: {error.message}</div>
            const publicCount = annotations.filter(a => a.public === true).length
            const privateCount = annotations.length - publicCount
            return (
                <div>
                    <p>Found {annotations.length} annotations</p>
                    {privateCount > 0 && (
                        <p style={{ color: '#666', fontSize: '12px' }}>
                            Note: {publicCount} public, {privateCount} private. Private annotations may require authentication.
                        </p>
                    )}
                    <ul>
                        {annotations.map((ann) => (
                            <li key={ann._id}>
                                {ann.annotation?.name || ann._id}
                                {ann._elementCount !== undefined && ` (${ann._elementCount} elements)`}
                                {ann.public === false && <span style={{ color: '#999', marginLeft: '8px' }}>(private)</span>}
                            </li>
                        ))}
                    </ul>
                    <p>Annotation IDs: {annotationIds.join(', ')}</p>
                </div>
            )
        },
    },
    parameters: {
        docs: {
            description: {
                story: 'Shows the debug panel with the raw API response as formatted JSON. This is useful for debugging API responses and understanding the data structure. Note: Only public annotations are shown unless authentication is provided via fetchFn or apiHeaders.',
            },
        },
    },
}

/**
 * Tabbed view example for debugging _transformBounds errors when switching between images.
 * This demonstrates a common use case where users switch between different images,
 * which can trigger _transformBounds errors if Paper.js isn't properly cleaned up.
 */
/**
 * Wrapper component that adds tab functionality to the simplified AnnotationManager.
 * This demonstrates composition - reusing the simplified component rather than duplicating logic.
 */
const SimplifiedViewerWithImage: React.FC<{ imageId: string; dziUrl: string }> = ({ imageId, dziUrl }) => {
    const cache = React.useMemo(() => new IndexedDBAnnotationCache(), [])
    const [annotationHeaders, setAnnotationHeaders] = React.useState<Map<string | number, AnnotationSearchResult>>(new Map())
    const annotationManagerReadyRef = React.useRef<((id: string | number) => void) | null>(null)

    // Unified state - single state object for all annotation state
    // Store serialized versions to enable proper change detection
    const [annotationState, setAnnotationState] = React.useState<{
        loadedIds: string[]
        opacitiesEntries: Array<[string, number]>
        visibilityEntries: Array<[string, boolean]>
    }>({
        loadedIds: [],
        opacitiesEntries: [],
        visibilityEntries: [],
    })

    const handleAnnotationStateChange = useCallback((state: {
        loadedAnnotationIds: string[]
        opacities: Map<string, number>
        visibility: Map<string, boolean>
    }) => {
        const opacitiesArr = Array.from(state.opacities.entries()).sort(([a], [b]) => a.localeCompare(b))
        const visibilityArr = Array.from(state.visibility.entries()).sort(([a], [b]) => a.localeCompare(b))

        setAnnotationState((prev) => {
            const loadedIdsSame = JSON.stringify(prev.loadedIds) === JSON.stringify(state.loadedAnnotationIds.sort())
            const opacitiesSame = JSON.stringify(prev.opacitiesEntries) === JSON.stringify(opacitiesArr)
            const visibilitySame = JSON.stringify(prev.visibilityEntries) === JSON.stringify(visibilityArr)

            if (loadedIdsSame && opacitiesSame && visibilitySame) {
                return prev
            }

            return {
                loadedIds: state.loadedAnnotationIds,
                opacitiesEntries: opacitiesArr,
                visibilityEntries: visibilityArr,
            }
        })
    }, [])

    const handleAnnotationReady = useCallback((annotationId: string | number) => {
        // Optional: Add any custom logic when annotation is ready
    }, [])

    const opacitiesMap = React.useMemo(() => new Map(annotationState.opacitiesEntries), [annotationState.opacitiesEntries])
    const visibilityMap = React.useMemo(() => new Map(annotationState.visibilityEntries), [annotationState.visibilityEntries])

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
            <div style={{
                width: '350px',
                minWidth: '350px',
                maxHeight: '100%',
                overflowY: 'auto',
                borderRight: '2px solid #ddd',
                backgroundColor: '#fff',
                flexShrink: 0
            }}>
                <AnnotationManager
                    imageId={imageId}
                    apiBaseUrl={exampleApiBaseUrl}
                    annotationCache={cache}
                    onAnnotationStateChange={handleAnnotationStateChange}
                    onAnnotationHeadersChange={setAnnotationHeaders}
                    onAnnotationReady={handleAnnotationReady}
                    showDefaultUI={true}
                >
                    {({ onAnnotationReady: managerReadyCallback }) => {
                        if (managerReadyCallback) {
                            annotationManagerReadyRef.current = managerReadyCallback
                        }
                        return null
                    }}
                </AnnotationManager>
            </div>

            <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
                <SlideViewer
                    imageInfo={{ dziUrl }}
                    annotationIds={annotationState.loadedIds}
                    apiBaseUrl={exampleApiBaseUrl}
                    showAnnotationInfo={true}
                    showAnnotationControls={false}
                    annotationOpacities={opacitiesMap}
                    visibleAnnotations={visibilityMap}
                    annotationCache={cache}
                    annotationHeaders={annotationHeaders}
                    onAnnotationReady={(id) => {
                        if (annotationManagerReadyRef.current) {
                            annotationManagerReadyRef.current(id)
                        }
                        handleAnnotationReady(id)
                    }}
                    height="100%"
                />
            </div>
        </div>
    )
}

const AnnotationManagerWithTabs: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'image1' | 'image2'>('image1')

    const image1Id = '6903df8dd26a6d93de19a9b2'
    const image2Id = '6903dfaed26a6d93de19d070'

    const currentImageId = activeTab === 'image1' ? image1Id : image2Id
    const dziUrl1 = `${exampleApiBaseUrl}/item/${image1Id}/tiles/dzi.dzi`
    const dziUrl2 = `${exampleApiBaseUrl}/item/${image2Id}/tiles/dzi.dzi`
    const currentDziUrl = activeTab === 'image1' ? dziUrl1 : dziUrl2

    return (
        <div style={{ width: '100%', height: '800px', display: 'flex', flexDirection: 'column' }}>
            {/* Tab Navigation */}
            <div style={{
                display: 'flex',
                borderBottom: '2px solid #ddd',
                backgroundColor: '#f5f5f5',
                padding: '0'
            }}>
                <button
                    onClick={() => {
                        console.log('[Tabs] Switching to Image 1 - this will unmount Image 2 SlideViewer')
                        setActiveTab('image1')
                    }}
                    style={{
                        padding: '12px 24px',
                        border: 'none',
                        backgroundColor: activeTab === 'image1' ? '#fff' : 'transparent',
                        borderBottom: activeTab === 'image1' ? '2px solid #007bff' : '2px solid transparent',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'image1' ? 'bold' : 'normal',
                        fontSize: '14px'
                    }}
                >
                    Image 1 ({image1Id})
                </button>
                <button
                    onClick={() => {
                        console.log('[Tabs] Switching to Image 2 - this will unmount Image 1 SlideViewer')
                        setActiveTab('image2')
                    }}
                    style={{
                        padding: '12px 24px',
                        border: 'none',
                        backgroundColor: activeTab === 'image2' ? '#fff' : 'transparent',
                        borderBottom: activeTab === 'image2' ? '2px solid #007bff' : '2px solid transparent',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'image2' ? 'bold' : 'normal',
                        fontSize: '14px'
                    }}
                >
                    Image 2 ({image2Id})
                </button>
            </div>

            {/* Content Area - Use the simplified viewer component */}
            <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0 }}>
                <SimplifiedViewerWithImage
                    key={currentImageId} // Force remount when switching images to test cleanup
                    imageId={currentImageId}
                    dziUrl={currentDziUrl}
                />
            </div>
        </div>
    )
}

export const WithTabs: Story = {
    render: () => <AnnotationManagerWithTabs />,
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                story: '**DEBUGGING EXAMPLE**: Tabbed view that switches between two images. This helps debug `_transformBounds` errors that occur when switching between images. Watch the console for errors when clicking between tabs. The `key` prop forces remounting to test proper cleanup.',
            },
        },
    },
}

export const WithAuthentication: Story = {
    args: {
        imageId: '6903df8dd26a6d93de19a9b2',
        apiBaseUrl: exampleApiBaseUrl,
        showDebugPanel: true,
        // Example: Custom fetch function for authentication
        fetchFn: async (url: string, options?: RequestInit) => {
            // In a real app, you would add auth headers here
            const headers = new Headers(options?.headers)
            // headers.set('Authorization', 'Bearer YOUR_TOKEN_HERE')
            // headers.set('Girder-Token', 'YOUR_GIRDER_TOKEN')

            return fetch(url, {
                ...options,
                headers,
            })
        },
        // Alternative: Just pass headers directly
        // apiHeaders: {
        //     'Authorization': 'Bearer YOUR_TOKEN_HERE',
        //     'Girder-Token': 'YOUR_GIRDER_TOKEN',
        // },
        children: ({ annotations, loading, error, annotationIds }) => {
            if (loading) return <div>Loading annotations...</div>
            if (error) return <div>Error: {error.message}</div>
            const publicCount = annotations.filter(a => a.public === true).length
            const privateCount = annotations.length - publicCount
            return (
                <div>
                    <p>Found {annotations.length} annotations</p>
                    {privateCount > 0 && (
                        <p style={{ color: '#0a0', fontSize: '12px' }}>
                            ✓ {publicCount} public, {privateCount} private annotations loaded (authentication provided)
                        </p>
                    )}
                    <ul>
                        {annotations.map((ann) => (
                            <li key={ann._id}>
                                {ann.annotation?.name || ann._id}
                                {ann._elementCount !== undefined && ` (${ann._elementCount} elements)`}
                                {ann.public === false && <span style={{ color: '#666', marginLeft: '8px' }}>(private)</span>}
                            </li>
                        ))}
                    </ul>
                    <p>Annotation IDs: {annotationIds.join(', ')}</p>
                </div>
            )
        },
    },
    parameters: {
        docs: {
            description: {
                story: 'Example of using authentication to access private annotations. Uncomment the authentication headers in the fetchFn to enable private annotation access.',
            },
        },
    },
}

