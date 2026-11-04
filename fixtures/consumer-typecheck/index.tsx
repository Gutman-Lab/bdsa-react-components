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
    ChannelHistograms,
    AnnotationEditor,
    AnnotationEditorPolygons,
    DsaAuthManager,
    FolderBrowser,
    ManifestBrowser,
    OSDThumbnailBrowser,
    ProtocolManager,
    SingleBoxSlideEditor,
    SlideViewer,
    ZStackVolumeViewer,
    ThumbnailGrid,
    ThumbnailViewer,
} from 'bdsa-react-components'
import type {
    AnnotationBrowserProps,
    ChannelHistogramsProps,
    AnnotationEditorProps,
    AutoSaveSettings,
    Collection,
    DsaAuthManagerProps,
    FolderBrowserItem,
    FolderBrowserProps,
    FolderItem,
    Item,
    ItemWithMeta,
    LocalPolylineElement,
    ManifestBrowserProps,
    NodeChildren,
    OSDThumbnailBrowserProps,
    ProtocolCardProps,
    ProtocolsTabProps,
    SingleBoxSlideEditorProps,
    SlideImageBox,
    SlideViewerProps,
    ZStackVolumeViewerProps,
    ThumbnailGridProps,
    ThumbnailViewerProps,
} from 'bdsa-react-components'

const collection: Collection = { _id: 'collection-1', name: 'Histology' }
const folder: FolderItem = { _id: 'folder-1', name: 'Case 001' }
const folderItem: FolderBrowserItem = { _id: 'item-1', name: 'slide.svs' }
const item: Item = { _id: 'item-1', name: 'slide.svs' }
const itemWithMeta: ItemWithMeta = { _id: 'item-1', name: 'slide.svs', largeImage: true }
const children: NodeChildren = { folders: [folder], items: [folderItem] }
const autoSave: AutoSaveSettings = { enabled: true, debounceMs: 2500 }
const polygon: LocalPolylineElement = {
    type: 'polyline',
    group: 'Tumor',
    label: { value: 'roi1' },
    points: [[0, 0, 0], [10, 0, 0], [10, 10, 0]],
    closed: true,
    lineColor: '#ff0000',
    lineWidth: 2,
    fillColor: 'rgba(0,0,0,0.05)',
}

const authProps: DsaAuthManagerProps = { compact: true }
const folderBrowserProps: FolderBrowserProps = {
    allowedExtensions: ['svs'],
    onItemSelect: (selected: FolderBrowserItem) => selected.name,
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
const volumeViewerProps: ZStackVolumeViewerProps = { itemId: 'item-1' }
const channelHistogramsProps: ChannelHistogramsProps = {
    series: [{ id: 'dapi', label: 'DAPI', color: '#0000ff', histogram: null }],
}
const annotationBrowserProps: AnnotationBrowserProps = {
    itemId: 'item-1',
    onAnnotationSelect: () => undefined,
}
const annotationEditorProps: AnnotationEditorProps = {
    imageInfo: { dziUrl: 'https://example.test/item/1/tiles/dzi.dzi' },
    config: { annotationDocumentName: 'Case 001', annotationTypes: [] },
    autoSave,
}
const thumbnailGridProps: ThumbnailGridProps = { items: [itemWithMeta] }
const osdThumbnailBrowserProps: OSDThumbnailBrowserProps = { items: [itemWithMeta] }
const thumbnailViewerProps: ThumbnailViewerProps = { item: itemWithMeta, viewerWidth: 200 }
const singleBoxSlideEditorProps: SingleBoxSlideEditorProps = {
    imageInfo: { dziUrl: 'https://example.test/item/1/tiles/dzi.dzi' },
    box: null,
}
const box: SlideImageBox = { left: 0, top: 0, width: 100, height: 100 }
const protocolCardProps: ProtocolCardProps = { protocol: {} as ProtocolCardProps['protocol'] }
const protocolsTabProps: ProtocolsTabProps = { schemaValidator: {} as ProtocolsTabProps['schemaValidator'] }

export const consumerFixture = (
    <>
        <DsaAuthManager {...authProps} />
        <FolderBrowser {...folderBrowserProps} />
        <ManifestBrowser {...manifestBrowserProps} />
        <SlideViewer {...slideViewerProps} />
        <ZStackVolumeViewer {...volumeViewerProps} />
        <ChannelHistograms {...channelHistogramsProps} />
        <AnnotationBrowser {...annotationBrowserProps} />
        <AnnotationEditor {...annotationEditorProps} />
        <AnnotationEditorPolygons {...annotationEditorProps} />
        <ThumbnailGrid {...thumbnailGridProps} />
        <OSDThumbnailBrowser {...osdThumbnailBrowserProps} />
        <ThumbnailViewer {...thumbnailViewerProps} />
        <SingleBoxSlideEditor {...singleBoxSlideEditorProps} />
        <ProtocolManager {...protocolsTabProps} />
    </>
)

void polygon
void box
void protocolCardProps

// Subpath entry points must expose the same public types as the root barrel.
import { FolderBrowser as FolderBrowserSubpath } from 'bdsa-react-components/components/FolderBrowser'
import { ChannelHistograms as ChannelHistogramsSubpath } from 'bdsa-react-components/components/ChannelHistograms'
import { ZStackVolumeViewer as ZStackVolumeViewerSubpath } from 'bdsa-react-components/components/ZStackVolumeViewer'
import type { FolderBrowserItem as FolderBrowserItemSubpath } from 'bdsa-react-components/components/FolderBrowser'
import { dsaAuthStore as dsaAuthStoreSubpath } from 'bdsa-react-components/auth'
import { hasLargeImage as hasLargeImageSubpath } from 'bdsa-react-components/utils'

const subpathItem: FolderBrowserItemSubpath = { _id: 'subpath-item', name: 'slide.svs' }
const subpathChecks = [
    FolderBrowserSubpath,
    ChannelHistogramsSubpath,
    ZStackVolumeViewerSubpath,
    dsaAuthStoreSubpath,
    hasLargeImageSubpath(subpathItem),
]
void subpathChecks
