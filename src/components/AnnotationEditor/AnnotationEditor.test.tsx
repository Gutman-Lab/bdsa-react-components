/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

/** Avoid loading real OpenSeadragon in jsdom (canvas getContext is not implemented). */
vi.mock('openseadragon', () => ({
    default: class {
        static Point = class {
            constructor(public x: number, public y: number) {}
        }
        static Rect = class {
            constructor(
                public x: number,
                public y: number,
                public width: number,
                public height: number,
            ) {}
        }
    },
}))

import { AnnotationEditor } from './AnnotationEditor'
import type { AnnotationEditorConfig } from './AnnotationEditor.types'
import type { SlideImageInfo } from '../SlideViewer/SlideViewer.types'

function createMockToolkit() {
    return {
        addTools: vi.fn(),
        loadGeoJSON: vi.fn(),
        getFeatureCollectionGroups: vi.fn().mockReturnValue([]),
        getTool: vi.fn((name: string) => {
            if (name === 'default' || name === 'rectangle') {
                return {
                    activate: vi.fn(),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                }
            }
            return null
        }),
    }
}

const mockToolkit = createMockToolkit()

vi.mock('../SlideViewer/SlideViewer', () => ({
    SlideViewer: ({ onToolkitReady }: { onToolkitReady?: (t: unknown) => void }) => {
        useEffect(() => {
            onToolkitReady?.(mockToolkit as unknown)
        }, [onToolkitReady])
        return <div data-testid="slide-viewer-mock" />
    },
}))

const exampleImage: SlideImageInfo = {
    dziUrl: 'http://example.com/api/v1/item/abc123/tiles/dzi.dzi',
}

const exampleConfig: AnnotationEditorConfig = {
    annotationDocumentName: 'test-ae',
    annotationTypes: [
        { name: 'A', color: '#c62828', defaultWidth: 32, defaultHeight: 32 },
    ],
    roiSettings: { label: 'roi' },
}

describe('AnnotationEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the toolbar and mocked viewer without DSA or GeoJSON props', () => {
        render(
            <AnnotationEditor
                imageInfo={exampleImage}
                config={exampleConfig}
                skipDsaAnnotationLoad
            />,
        )
        expect(screen.getByTestId('slide-viewer-mock')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Show Info' })).toBeInTheDocument()
    })

    it('hides the Show Info toggle when showInfoControl is false', () => {
        render(
            <AnnotationEditor
                imageInfo={exampleImage}
                config={exampleConfig}
                skipDsaAnnotationLoad
                showInfoControl={false}
            />,
        )
        expect(screen.queryByRole('button', { name: 'Show Info' })).not.toBeInTheDocument()
    })

    it('uses Export GeoJSON label when geoJsonExportMode is on', () => {
        const onExport = vi.fn()
        render(
            <AnnotationEditor
                imageInfo={exampleImage}
                config={exampleConfig}
                skipDsaAnnotationLoad
                geoJsonExportMode
                onGeoJsonExport={onExport}
            />,
        )
        expect(screen.getByRole('button', { name: 'Export GeoJSON' })).toBeInTheDocument()
    })
})
