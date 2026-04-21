// Components
export { DsaAuthManager } from './components/DsaAuthManager/DsaAuthManager'
export type { DsaAuthManagerProps } from './components/DsaAuthManager/DsaAuthManager'
export { dsaAuthStore } from './auth/DsaAuthStore'
export { useDsaAuth, useDsaResolvedApi, mergeHeadersInit, headersInitToRecord } from './auth'
export type { UseDsaResolvedApiOptions } from './auth'
export { FolderBrowser } from './components/FolderBrowser/FolderBrowser'
export type {
  FolderBrowserRenderCollection,
  FolderBrowserRenderFolder,
  FolderBrowserRenderItem,
  FolderBrowserResource,
  FolderBrowserVisualStyle,
} from './components/FolderBrowser/types'
export { hasLargeImage, isAIModel, filterLargeImages, filterAIModels } from './utils/itemUtils'
export type { Item, ItemWithMeta } from './utils/itemUtils'
export { ThumbnailGrid } from './components/ThumbnailGrid/ThumbnailGrid'
export type { ThumbnailGridProps } from './components/ThumbnailGrid/ThumbnailGrid'
export { OSDThumbnailBrowser } from './components/OSDThumbnailBrowser/OSDThumbnailBrowser'
export type { OSDThumbnailBrowserProps } from './components/OSDThumbnailBrowser/OSDThumbnailBrowser'
/** @deprecated Use `OSDThumbnailBrowser` — name reflects OpenSeadragon-based tiles */
export { OSDThumbnailBrowser as FolderThumbnailBrowser } from './components/OSDThumbnailBrowser/OSDThumbnailBrowser'
/** @deprecated Use `OSDThumbnailBrowserProps` */
export type { OSDThumbnailBrowserProps as FolderThumbnailBrowserProps } from './components/OSDThumbnailBrowser/OSDThumbnailBrowser'
export {
    ThumbnailViewer,
    updateThumbnailOpacity,
    getThumbnailOpacity,
    clearThumbnailOpacities,
} from './components/ThumbnailViewer/ThumbnailViewer'
export type { ThumbnailViewerProps } from './components/ThumbnailViewer/ThumbnailViewer'
export { ManifestBrowser } from './components/ManifestBrowser/ManifestBrowser'
export { SlideViewer } from './components/SlideViewer/SlideViewer'
export type { SlideViewerProps } from './components/SlideViewer/SlideViewer.types'
export { AnnotationBrowser } from './components/AnnotationBrowser/AnnotationBrowser'
export { AnnotationEditor } from './components/AnnotationEditor/AnnotationEditor'
export type { AnnotationEditorProps, AnnotationEditorConfig, AnnotationType, RoiSettings, HotkeySettings, EditorMode } from './components/AnnotationEditor/AnnotationEditor.types'
export {
    localDocumentToFeatureCollection,
    featureCollectionToLocalDocument,
    loadLocalElementsOntoAnnotationToolkit,
} from './components/AnnotationEditor/annotationGeoJson'
export type { FeatureCollectionToLocalOptions, LoadLocalElementsOptions } from './components/AnnotationEditor/annotationGeoJson'
export type { DsaAuthStatus, DsaAuthConfig, DsaUserInfo } from './auth/types'
