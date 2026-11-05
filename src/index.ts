// Components
export { DsaAuthManager } from './components/DsaAuthManager/DsaAuthManager'
export type { DsaAuthManagerProps } from './components/DsaAuthManager/DsaAuthManager'
export { dsaAuthStore } from './auth/DsaAuthStore'
export { useDsaAuth, useDsaResolvedApi, mergeHeadersInit, headersInitToRecord } from './auth'
export type { UseDsaResolvedApiOptions } from './auth'

export { FolderBrowser } from './components/FolderBrowser/FolderBrowser'
export type { FolderBrowserProps, FolderBrowserSyntheticData } from './components/FolderBrowser/FolderBrowser'
export type { Collection, FolderItem, NodeChildren } from './components/FolderBrowser/types'
export type { Item as FolderBrowserItem } from './components/FolderBrowser/types'
export type {
  FolderBrowserRenderCollection,
  FolderBrowserRenderFolder,
  FolderBrowserRenderItem,
  FolderBrowserRenderItemBadge,
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
export type { ManifestBrowserProps } from './components/ManifestBrowser/ManifestBrowser'

export { SlideViewer } from './components/SlideViewer/SlideViewer'
export type { SlideViewerProps } from './components/SlideViewer/SlideViewer.types'

export { ZStackVolumeViewer } from './components/ZStackVolumeViewer/ZStackVolumeViewer'
export type {
  ZStackVolumeViewerProps,
  StackAnnotationOverlay,
  StackAnnotationPolygon,
} from './components/ZStackVolumeViewer/ZStackVolumeViewer'
export { compositeVolume, histogramRange, stainedRange } from './components/ZStackVolumeViewer/compositeVolume'
export type { ChannelRange, ChannelRangeOptions, StainedRange, VolumeAdjust, VolumeChannel } from './components/ZStackVolumeViewer/compositeVolume'
export { ChannelHistograms } from './components/ChannelHistograms/ChannelHistograms'
export type { ChannelHistogramSeries, ChannelHistogramsProps } from './components/ChannelHistograms/ChannelHistograms'
export { fetchImageHistogram } from './components/ChannelHistograms/fetchImageHistogram'
export { histogramBins, histogramMax, parseImageHistogram } from './components/ChannelHistograms/histogramBins'
export type { ChannelHistogram } from './components/ChannelHistograms/histogramBins'

export { AnnotationBrowser } from './components/AnnotationBrowser/AnnotationBrowser'
export type { AnnotationBrowserProps } from './components/AnnotationBrowser/AnnotationBrowser'

export { AnnotationEditor } from './components/AnnotationEditor/AnnotationEditor'
export { AnnotationEditorPolygons } from './components/AnnotationEditor/AnnotationEditorPolygons'
export { SingleBoxSlideEditor } from './components/SingleBoxSlideEditor/SingleBoxSlideEditor'
export type { SingleBoxSlideEditorProps, SlideImageBox } from './components/SingleBoxSlideEditor/SingleBoxSlideEditor.types'
export type { AnnotationEditorProps, AnnotationEditorConfig, AnnotationEditorHandle, AnnotationEditorSyncSnapshot, AnnotationSaveConflictDetails, AutoSaveSettings, GroundTruthBox, RoiImageBounds, AnnotationType, RoiSettings, HotkeySettings, EditorMode, LocalAnnotationDocument, LocalAnnotationElement, LocalPolylineElement, RemoveOverlappingLabelsOptions, RemoveOverlappingLabelsResult } from './components/AnnotationEditor/AnnotationEditor.types'
export {
    localDocumentToFeatureCollection,
    featureCollectionToLocalDocument,
    loadLocalElementsOntoAnnotationToolkit,
    applyLocalDocumentToToolkitWhenReady,
    wrapOrphanLabelsInRoi,
    refreshAnnotationToolkitDisplay,
    getToolkitTiledImage,
    loadOverlayFeatureCollectionOntoToolkit,
    removeOverlayFeatureCollection,
    MODEL_PREDICTION_OVERLAY_NAME,
} from './components/AnnotationEditor/annotationGeoJson'
export type { FeatureCollectionToLocalOptions, LoadLocalElementsOptions } from './components/AnnotationEditor/annotationGeoJson'
export {
    buildSimulatedYoloGeoJson,
    buildSimulatedYoloGeoJsonFromConfig,
    paperAnnotatorEditorConfig,
    simulatedYoloPositiveNegative,
    simulatedYoloTauPredictions,
    yoloClassFromPropertiesImportOptions,
    yoloRectFeature,
} from './components/AnnotationEditor/yoloSimulatedGeoJson'
export type { SimulatedYoloOptions } from './components/AnnotationEditor/yoloSimulatedGeoJson'
export type { DsaAuthStatus, DsaAuthConfig, DsaUserInfo } from './auth/types'

// Protocol manager (stain / region protocols, BDSA schema validation)
export { ProtocolsTab as ProtocolManager } from './components/ProtocolManager/ProtocolsTab'
export { ProtocolProvider, useProtocols } from './components/ProtocolManager/ProtocolContext'
export { ProtocolCard } from './components/ProtocolManager/ProtocolCard'
export { ProtocolList } from './components/ProtocolManager/ProtocolList'
export { ProtocolModal } from './components/ProtocolManager/ProtocolModal'
export { ProtocolsTab } from './components/ProtocolManager/ProtocolsTab'
export {
    LocalStorageProtocolStorage,
    InMemoryProtocolStorage,
    defaultStorage,
    generateProtocolId,
} from './components/ProtocolManager/storage/protocolStorage'
export { DsaSyncAdapter, NoOpDsaSyncAdapter } from './components/ProtocolManager/adapters/DsaSyncAdapter'
export {
    SchemaValidator,
    createSchemaValidator,
    BDSA_SCHEMA_DEFAULT_OPTIONS,
    SCHEMA_PATHS,
} from './components/ProtocolManager/utils/schemaValidator'
export type { LoadSchemasOptions } from './components/ProtocolManager/utils/schemaValidator'
export { blockProtocolToBlock2RegionMap } from './components/ProtocolManager/utils/blockProtocol'
export type {
    Protocol,
    ProtocolType,
    BlockProtocolSlot,
    ProtocolStorage,
    DsaSyncAdapter as DsaSyncAdapterType,
    SchemaValidator as SchemaValidatorType,
    ProtocolContextValue,
    ProtocolProviderProps,
    ProtocolCardProps,
    ProtocolListProps,
    ProtocolModalProps,
    ProtocolsTabProps,
} from './components/ProtocolManager/ProtocolManager.types'
