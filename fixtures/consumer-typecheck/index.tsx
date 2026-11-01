/**
 * Consumer typecheck fixture.
 *
 * This file is compiled with `tsc --noEmit` against the built package entry
 * point (see tsconfig.json next to it). It imports every public component and
 * every public props type so a packaging/type-export regression fails CI
 * before release.
 */
import {
    AnnotationBrowser,
    AnnotationEditor,
    Button,
    DsaAuthManager,
    FolderBrowser,
    ManifestBrowser,
    SlideViewer,
} from 'bdsa-react-components'
import type {
    AnnotationBrowserProps,
    AnnotationEditorProps,
    ButtonProps,
    Collection,
    DsaAuthManagerProps,
    FolderBrowserProps,
    FolderItem,
    Item,
    ManifestBrowserProps,
    NodeChildren,
    SlideViewerProps,
} from 'bdsa-react-components'

const collection: Collection = { _id: 'collection-1', name: 'Histology' }
const folder: FolderItem = { _id: 'folder-1', name: 'Case 001' }
const item: Item = { _id: 'item-1', name: 'slide.svs' }
const children: NodeChildren = { folders: [folder], items: [item] }

const buttonProps: ButtonProps = { variant: 'primary', size: 'medium' }
const authProps: DsaAuthManagerProps = { compact: true }
const folderBrowserProps: FolderBrowserProps = {
    allowedExtensions: ['svs'],
    onItemSelect: (selected: Item) => selected.name,
    syntheticData: {
        collections: [collection],
        getChildren: () => children,
    },
}
const manifestBrowserProps: ManifestBrowserProps = {
    onItemSelect: (selected) => selected.name,
    defaultWidth: 280,
}
const slideViewerProps: SlideViewerProps = {
    imageInfo: { dziUrl: 'https://example.test/item/1/tiles/dzi.dzi' },
    height: '600px',
}
const annotationBrowserProps: AnnotationBrowserProps = {
    itemId: 'item-1',
    onAnnotationSelect: () => undefined,
}
const annotationEditorProps: AnnotationEditorProps = {
    imageInfo: { dziUrl: 'https://example.test/item/1/tiles/dzi.dzi' },
    config: { annotationDocumentName: 'Case 001', annotationTypes: [] },
}

export const consumerFixture = (
    <>
        <Button {...buttonProps}>Open</Button>
        <DsaAuthManager {...authProps} />
        <FolderBrowser {...folderBrowserProps} />
        <ManifestBrowser {...manifestBrowserProps} />
        <SlideViewer {...slideViewerProps} />
        <AnnotationBrowser {...annotationBrowserProps} />
        <AnnotationEditor {...annotationEditorProps} />
    </>
)
