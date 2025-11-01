import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
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
const AnnotationManagerWithViewer = ({ annotations, loading, error }: { annotations: AnnotationSearchResult[], loading: boolean, error: Error | null }) => {
    const [loadedAnnotationIds, setLoadedAnnotationIds] = useState<Set<string>>(new Set())
    const dziUrl = `${exampleApiBaseUrl}/item/${exampleImageInfo.imageId}/tiles/dzi.dzi`
    
    const toggleAnnotation = (annotationId: string) => {
        setLoadedAnnotationIds(prev => {
            const next = new Set(prev)
            if (next.has(annotationId)) {
                next.delete(annotationId)
            } else {
                next.add(annotationId)
            }
            return next
        })
    }
    
    // Convert Set to array for SlideViewer
    const activeAnnotationIds = Array.from(loadedAnnotationIds)
            
    if (loading) {
        return (
            <div style={{ width: '100%', height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>Loading annotations...</div>
            </div>
        )
    }
    
    if (error) {
        return (
            <div style={{ width: '100%', height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#dc3545' }}>Error: {error.message}</div>
            </div>
        )
    }
    
    return (
        <div style={{ width: '100%', height: '800px', display: 'flex', flexDirection: 'column' }}>
            {/* Annotation List Sidebar */}
            <div style={{ width: '100%', maxHeight: '200px', overflowY: 'auto', borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa', flexShrink: 0 }}>
                <div className="bdsa-annotation-manager__list" style={{ padding: '12px' }}>
                    <div className="bdsa-annotation-manager__list-header" style={{ marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '14px', margin: 0 }}>Annotations ({annotations.length} total)</h3>
                        <p style={{ fontSize: '12px', margin: '4px 0 0 0', color: '#666' }}>
                            {activeAnnotationIds.length} loaded in viewer
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {annotations.map((ann) => {
                            const isLoaded = loadedAnnotationIds.has(ann._id)
                            return (
                                <div
                                    key={ann._id}
                                    className={`bdsa-annotation-manager__annotation-card ${isLoaded ? 'bdsa-annotation-manager__annotation-card--selected' : ''}`}
                                    style={{ 
                                        minWidth: '200px', 
                                        flex: '1 1 auto',
                                        marginBottom: '8px'
                                    }}
                                    onClick={() => toggleAnnotation(ann._id)}
                                >
                                    <div className="bdsa-annotation-manager__annotation-card-header">
                                        <h4 className="bdsa-annotation-manager__annotation-card-title" style={{ fontSize: '13px' }}>
                                            {ann.annotation?.name || ann._id}
                                        </h4>
                                        {ann.public === false && (
                                            <span className="bdsa-annotation-manager__annotation-card-badge bdsa-annotation-manager__annotation-card-badge--private">
                                                Private
                                            </span>
                                        )}
                                    </div>
                                    <div className="bdsa-annotation-manager__annotation-card-details" style={{ fontSize: '11px' }}>
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
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '11px', color: isLoaded ? '#28a745' : '#666' }}>
                                        {isLoaded ? '✓ Loaded' : 'Click to load'}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
            
            {/* SlideViewer */}
            <div style={{ flex: 1, minHeight: 0, height: '600px' }}>
                <SlideViewer
                    imageInfo={{ dziUrl }}
                    annotationIds={activeAnnotationIds.length > 0 ? activeAnnotationIds : []}
                    apiBaseUrl={exampleApiBaseUrl}
                    showAnnotationInfo={true}
                    showAnnotationControls={true}
                    height="600px"
                />
            </div>
        </div>
    )
}

export const WithSlideViewer: Story = {
    args: {
        imageId: '6903df8dd26a6d93de19a9b2',
        apiBaseUrl: exampleApiBaseUrl,
        children: ({ annotations, loading, error }) => (
            <AnnotationManagerWithViewer annotations={annotations} loading={loading} error={error} />
        ),
    },
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                story: 'AnnotationManager with SlideViewer integration. Click annotation cards to selectively load them into the viewer. This prevents loading all annotations at once, which can be slow with large annotation sets.',
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

