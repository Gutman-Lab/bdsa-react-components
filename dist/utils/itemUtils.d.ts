/**
 * Utility functions for working with DSA items
 */
/**
 * Item interface representing a DSA item (file or folder)
 */
export interface Item {
    /** Item ID */
    _id: string;
    /** Item name */
    name?: string;
    /** Item type (e.g., 'file', 'folder') */
    _modelType?: string;
    /** Large image flag (can be at root level or in meta) */
    largeImage?: boolean | string | object;
    /** Metadata object */
    meta?: {
        /** Large image flag in metadata */
        largeImage?: boolean | string | object;
        /** AI model dataset arguments */
        dataset_args?: unknown;
        /** AI model training arguments */
        train_args?: unknown;
        /** AI model results */
        results?: unknown;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
/**
 * Check if an item has the largeImage flag set
 *
 * This function checks BOTH the root level and meta.largeImage locations,
 * as different DSA servers and configurations store this flag in different places.
 *
 * Based on actual DSA data, the largeImage flag is most commonly found at the root level,
 * but this function checks both locations for maximum compatibility.
 *
 * @param item - The DSA item to check
 * @returns true if the item has largeImage flag set (as true, 'true', or an object)
 *
 * @example
 * ```typescript
 * // Root level largeImage (most common)
 * const item1 = { _id: '123', largeImage: true }
 * hasLargeImage(item1) // => true
 *
 * // Object type largeImage (contains image metadata)
 * const item2 = { _id: '456', largeImage: { width: 1024, height: 768 } }
 * hasLargeImage(item2) // => true
 *
 * // Meta level largeImage (fallback location)
 * const item3 = { _id: '789', meta: { largeImage: true } }
 * hasLargeImage(item3) // => true
 *
 * // No largeImage flag
 * const item4 = { _id: '000' }
 * hasLargeImage(item4) // => false
 * ```
 */
export declare function hasLargeImage(item: Item): boolean;
/**
 * Filter an array of items to only include those with largeImage flag
 *
 * @param items - Array of DSA items to filter
 * @returns Filtered array containing only items with largeImage flag
 *
 * @example
 * ```typescript
 * const items = [
 *     { _id: '1', name: 'image.svs', largeImage: true },
 *     { _id: '2', name: 'document.pdf' },
 *     { _id: '3', name: 'slide.tif', meta: { largeImage: true } }
 * ]
 *
 * const imageItems = filterLargeImages(items)
 * // => [{ _id: '1', ... }, { _id: '3', ... }]
 * ```
 */
export declare function filterLargeImages(items: Item[]): Item[];
/**
 * Check if an item is an AI model based on metadata
 *
 * An item is considered an AI model if it has both dataset_args and train_args in its metadata.
 * These fields indicate the item contains trained model artifacts and configuration.
 *
 * @param item - The DSA item to check
 * @returns true if the item has AI model metadata (dataset_args and train_args)
 *
 * @example
 * ```typescript
 * const modelItem = {
 *     _id: '123',
 *     name: 'my_model.pth',
 *     meta: {
 *         dataset_args: { batch_size: 32 },
 *         train_args: { epochs: 100 },
 *         results: { accuracy: 0.95 }
 *     }
 * }
 * isAIModel(modelItem) // => true
 *
 * const regularItem = {
 *     _id: '456',
 *     name: 'data.csv'
 * }
 * isAIModel(regularItem) // => false
 * ```
 */
export declare function isAIModel(item: Item): boolean;
/**
 * Filter an array of items to only include AI models
 *
 * @param items - Array of DSA items to filter
 * @returns Filtered array containing only AI model items
 *
 * @example
 * ```typescript
 * const items = [
 *     { _id: '1', name: 'model.pth', meta: { dataset_args: {}, train_args: {} } },
 *     { _id: '2', name: 'image.jpg', largeImage: true },
 *     { _id: '3', name: 'another_model.pkl', meta: { dataset_args: {}, train_args: {} } }
 * ]
 *
 * const modelItems = filterAIModels(items)
 * // => [{ _id: '1', ... }, { _id: '3', ... }]
 * ```
 */
export declare function filterAIModels(items: Item[]): Item[];
//# sourceMappingURL=itemUtils.d.ts.map