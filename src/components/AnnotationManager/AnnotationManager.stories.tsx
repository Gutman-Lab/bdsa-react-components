import type { Meta, StoryObj } from '@storybook/react'
import React, { useState, useCallback } from 'react'
import { AnnotationManager, type AnnotationSearchResult } from './AnnotationManager'
import { SlideViewer, SlideImageInfo } from '../SlideViewer/SlideViewer'

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
                    imageId={exampleImageInfo.imageId}
                    apiBaseUrl={exampleApiBaseUrl}
                    loadedAnnotations={loadedAnnotationIds}
                    visibleAnnotations={visibleAnnotations}
                    annotationOpacities={annotationOpacities}
                    onAnnotationLoadChange={handleLoadChange}
                    onAnnotationVisibilityChange={handleVisibilityChange}
                    onAnnotationOpacityChange={handleOpacityChange}
                    onAnnotationReady={handleAnnotationReady}
                    showDefaultUI={true}
                >
                    {({ onAnnotationReady: managerReadyCallback }) => {
                        // Capture AnnotationManager's internal callback via render prop
                        // Store it directly (not in useEffect - render props are called during render)
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
                    annotationIds={loadedAnnotationIds.size > 0 ? Array.from(loadedAnnotationIds) : []}
                    apiBaseUrl={exampleApiBaseUrl}
                    showAnnotationInfo={true}
                    showAnnotationControls={false}
                    annotationOpacities={annotationOpacities}
                    visibleAnnotations={visibleAnnotations}
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

