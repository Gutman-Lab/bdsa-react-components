import { default as React } from 'react';
import { Collection, Folder, Item, Resource, FolderBrowserProps } from './FolderBrowser.types';

export type { Collection, Folder, Item, Resource, FolderBrowserProps };
/**
 * FolderBrowser component for browsing DSA collections and folders.
 *
 * This component provides a tree view of collections and folders in the DSA.
 * It supports:
 * - Listing collections at the root
 * - Expanding collections to show folders
 * - Expanding folders to show subfolders recursively
 * - Selecting collections and folders
 * - Optionally showing items (files) within folders and collections when `showItems={true}`
 *
 * API Endpoints:
 * - Collections: GET /api/v1/collection
 * - Folders in collection: GET /api/v1/folder?parentType=collection&parentId={collectionId}
 * - Subfolders: GET /api/v1/folder?parentType=folder&parentId={folderId}
 * - Items in folder: GET /api/v1/item?folderId={folderId} (note: only subfolders can have items, not root folders or collections)
 */
export declare const FolderBrowser: React.ForwardRefExoticComponent<FolderBrowserProps & React.RefAttributes<HTMLDivElement>>;
//# sourceMappingURL=FolderBrowser.d.ts.map