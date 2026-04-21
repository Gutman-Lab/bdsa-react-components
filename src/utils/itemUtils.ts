/**
 * Helpers for interpreting DSA item documents (largeImage, AI model metadata).
 * Ported from the pre-refactor library for FolderBrowser default item icons.
 */

export interface ItemWithMeta {
  _id: string
  name?: string
  _modelType?: string
  largeImage?: boolean | string | object
  meta?: {
    largeImage?: boolean | string | object
    dataset_args?: unknown
    train_args?: unknown
    results?: unknown
    [key: string]: unknown
  }
  [key: string]: unknown
}

export function hasLargeImage(item: ItemWithMeta): boolean {
  const rootLargeImage = item.largeImage
  const rootHasLargeImage =
    rootLargeImage === true ||
    rootLargeImage === 'true' ||
    (typeof rootLargeImage === 'object' && rootLargeImage !== null)

  if (rootHasLargeImage) {
    return true
  }

  const meta = item.meta || {}
  const metaLargeImage = meta.largeImage
  const metaHasLargeImage =
    metaLargeImage === true ||
    metaLargeImage === 'true' ||
    (typeof metaLargeImage === 'object' && metaLargeImage !== null)

  return metaHasLargeImage
}

export function filterLargeImages<T extends ItemWithMeta>(items: T[]): T[] {
  return items.filter(hasLargeImage)
}

export function isAIModel(item: ItemWithMeta): boolean {
  const meta = item.meta || {}
  return !!(meta.dataset_args && meta.train_args)
}

export function filterAIModels<T extends ItemWithMeta>(items: T[]): T[] {
  return items.filter(isAIModel)
}
