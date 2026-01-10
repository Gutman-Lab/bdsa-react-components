# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.23] - 2026-01-10

### Fixed

#### SlideViewer: Overlay Tile Source Positioning
- **Fixed overlay positioning issues** - Overlays now correctly position at specified coordinates
- Improved base bounds calculation to use `getBounds()` for accurate world coordinates
- Added explicit position setting after image loads using `OpenSeadragon.Point`
- Added fallback positioning in case success callback doesn't fire
- Fixed issue where SimpleImage tile sources (base64 images) weren't respecting initial x/y coordinates

#### Paper.js Patch Application
- **Fixed "Paper.js View not found" warning** - Patch application now retries when Paper.js loads asynchronously
- Added retry mechanism (up to 10 attempts with 100ms intervals) to handle async Paper.js loading
- Patches now apply correctly even when Paper.js is loaded after the component module

#### OpenSeadragon TiledImage Configuration
- **Fixed width/height warning** - Only sets one dimension (prefers width) to avoid OpenSeadragon warning
- OpenSeadragon doesn't support specifying both width and height simultaneously
- When both are provided, only width is used and aspect ratio is maintained

#### Canvas Performance Warning
- Added `willReadFrequently: true` to canvas context creation in stories
- Reduces performance warnings for frequent `getImageData` operations

### Technical Details
- Updated `useOverlayTileSources.ts` with improved coordinate calculation and positioning logic
- Enhanced `patchOsdPaperjs.ts` with retry mechanism for async Paper.js loading
- Improved base bounds calculation to prioritize `getBounds()` over `getContentSize()`
- Added explicit position setting in both success callback and setTimeout fallback

## [0.1.20] - 2025-11-12

### Added - Debug Mode for Clean Console Output 🔇

#### Debug Logging System
- **New `debug` prop** added to all major components:
  - `FolderBrowser` - `debug?: boolean` (default: `false`)
  - `SlideViewer` - `debug?: boolean` (default: `false`)
  - `AnnotationManager` - `debug?: boolean` (default: `false`)
- **All `console.log()` calls now respect debug flag** - no console spam in production
- **`console.error()` always logs** - important errors still visible
- **New utility**: `createDebugLogger(componentName, debug)` for custom debug logging
- **Exported types**: `DebugLogger` interface for TypeScript support

#### Benefits
- ✅ **Clean console by default** - No more debug log spam in production apps
- ✅ **Opt-in debugging** - Enable `debug={true}` when troubleshooting
- ✅ **Backward compatible** - Existing code works unchanged (just cleaner output)
- ✅ **Prefixed logs** - Easy to identify which component logged what

#### Usage
```typescript
// Production (no console spam)
<FolderBrowser apiBaseUrl="..." />

// Development/debugging
<FolderBrowser apiBaseUrl="..." debug={true} />
```

### Changed
- **Default behavior**: Console logs are now suppressed by default (was always on)
- This is a **non-breaking change** - existing code works the same, just cleaner

## [0.1.19] - 2025-11-10

### Added - Major UX Improvements and AI Model Detection 🚀

#### FolderBrowser: Item Count Display 📊
- **New prop**: `showItemCount?: boolean` - Display total item counts next to folder names
- Item count appears immediately after folder name: `myFolder (150)...`
- Shows `...` indicator when more items are available for pagination
- **Double-click the `...`** to automatically load ALL remaining items in background
- Shows ⏳ (hourglass) with pulse animation while loading all items
- Clickable indicator styled with blue color and hover underline
- Works with `showItems={false}` if `fetchItems={true}` is enabled

#### FolderBrowser: AI Model Detection 🤖
- **Automatic item classification** based on metadata:
  - 🤖 **AI Model** - Items with `meta.dataset_args` AND `meta.train_args`
  - 🖼️ **Image** - Items with `largeImage` flag
  - 📄 **Item** - Regular items
- Type labels update dynamically: "AI Model", "Image", or "Item"
- **New utility functions**:
  - `isAIModel(item: Item): boolean` - Check if item has AI model metadata
  - `filterAIModels(items: Item[]): Item[]` - Filter array to only AI models
- Updated `Item` type interface with AI model metadata fields:
  - `meta.dataset_args?: unknown`
  - `meta.train_args?: unknown`
  - `meta.results?: unknown`

#### FolderBrowser: Scroll Stability 🎯
- **Fixed scroll jumping** when expanding/collapsing folders
- Clicked folder stays in exact same position on screen
- Calculates position before DOM changes and compensates after
- No more losing track of which folder you just clicked
- Works for both expand and collapse operations

#### FolderBrowser: Visual Feedback 👁️
- **Last-clicked folder** gets prominent dark blue highlight
- Helps track which folder you're currently interacting with
- New CSS class: `.bdsa-folder-browser__folder-header.last-clicked`
  - Darker blue background (#bbdefb)
  - Thicker 3px left border (#1976d2)
- Persists until you click a different folder
- Follows standard UX patterns for active/selected states

#### FolderBrowser: Authentication Integration 🔐
- Fixed authentication state detection in Storybook examples
- Added "With Authentication" story showing proper integration with `DsaAuthManager`
- Added "With Item Filtering" story demonstrating item count and filtering
- Shows "Browsing public resources" indicator when not authenticated
- Automatic token passing via `apiHeaders` when authenticated
- Component re-mounts on auth state change using `key` prop pattern
- Works for both public and private resources

### Changed - Layout and Styling

#### FolderBrowser: Item Count Layout
- Item count appears left-justified immediately after folder name
- Changed `.bdsa-folder-browser__folder-name` from `flex: 1` to `flex: 0 1 auto`
- Added `max-width: 60%` to folder name to prevent excessive expansion
- Changed `.bdsa-folder-browser__folder-type` to use `margin-left: auto` (pushed to right)
- Prevents wide layouts from creating large gaps between name and count

#### New CSS Classes
- `.bdsa-folder-browser__item-count` - Item count display styling
- `.bdsa-folder-browser__load-all-indicator` - Clickable "..." indicator
- `.bdsa-folder-browser__load-all-indicator:hover` - Hover state with underline
- `.bdsa-folder-browser__load-all-indicator.loading` - Loading state with pulse animation
- `@keyframes pulse` - Animation for loading indicator

### Fixed

#### FolderBrowser: Item Count Display
- Fixed item count not appearing for array-based API responses
- Now correctly handles both array and paginated response formats
- Calculates `totalCount` from array length when API doesn't provide it
- Shows count even when `itemsPerPage` is default (50)

#### FolderBrowser: Storybook Auth Integration
- Fixed incorrect destructuring of `useDsaAuth()` return value
- Corrected from `{ isAuthenticated, token, userInfo }` to `{ authStatus, getToken }`
- Added proper derived values: `token = getToken()`, `isAuthenticated = authStatus.isAuthenticated`
- Added debug logging to help troubleshoot auth state issues

#### FolderBrowser: Scroll Behavior
- Replaced `scrollIntoView` with position-based scroll compensation
- Captures element position relative to scroll container before changes
- Adjusts scroll position after DOM updates to keep element stable
- Works with nested scroll containers (e.g., Storybook panels)

### Technical Details

#### Load All Items Implementation
- New `loadAllItems` callback function handles bulk loading
- Uses while loop to paginate through all items until `hasMore` is false
- Properly stops propagation to prevent folder collapse/expand
- Updates loading state to show visual feedback
- Console logging tracks progress for debugging

#### Item Classification Logic
Priority order for icon selection:
1. Check `isAIModel(item)` - requires BOTH `dataset_args` AND `train_args`
2. Check `hasLargeImage(item)` - checks root and meta levels
3. Default to generic item icon

#### Scroll Position Calculation
```typescript
// Before DOM changes
const initialTop = rect.top - containerRect.top

// After DOM changes
const newTop = newRect.top - containerRect.top
const diff = newTop - initialTop
scrollContainer.scrollTop -= diff  // Compensate
```

### Documentation

- Added `V0.1.19_UPDATE_NOTES.md` - Comprehensive update guide for downstream applications
- Includes migration guide, API changes, testing recommendations
- Documents breaking changes in auth hook usage
- Provides code examples for all new features

### Breaking Changes

⚠️ **None** - All changes are backwards compatible

**Note**: The `useDsaAuth()` hook was already returning `{ authStatus, getToken, ... }`. If you were incorrectly destructuring as `{ isAuthenticated, token, userInfo }`, you need to update your code. This is a fix, not a breaking change.

## [0.1.18] - 2025-11-10

### Added - Major Performance and Feature Improvements

#### SlideViewer: Optimized Annotation Opacity Updates 🔥
- **Performance**: Eliminated unnecessary re-renders when annotation opacity changes
- Opacity changes now update existing Paper.js layers directly instead of re-fetching and re-rendering
- Smooth 60fps slider updates when dragging opacity controls
- Removed `annotationOpacity` and `annotationOpacities` from main render effect dependencies
- Separate effect handles opacity updates without triggering full component re-renders
- **Impact**: Significantly better UX when adjusting annotation visibility

#### FolderBrowser: Advanced Item Filtering and Fetching 🔥
- **Separate fetch from display**: New `fetchItems` prop decouples fetching from rendering
  - `showItems={false}` + `fetchItems={true}` = fetch items without displaying them in tree
  - Useful for getting item counts, filtering, or custom rendering
  - Prevents duplicate API calls when you need item data but not the default UI
  
- **Flexible item filtering**: New `itemFilter` prop with comprehensive filtering support
  - Filter by file extension: `item.name.endsWith('.jpg')`
  - Filter by metadata properties: `item.meta?.type === 'model'`
  - Combine multiple criteria: `hasValidExtension && hasLargeImage`
  - Receives full `Item` object for maximum flexibility
  - ⚠️ Must be wrapped in `useCallback` to prevent infinite loops
  
- **Item counts display**: New `showItemCount` prop shows total item count next to folder names
  - Shows actual count from API: `(123)`
  - Shows `...(75)` indicator for folders with 50+ items
  - Respects pagination - shows total count, not just loaded count
  - Works even when `showItems={false}` if `fetchItems={true}`
  
- **Enhanced callbacks**: New `onItemsFetched` callback receives all fetched items before filtering
  - Useful for custom processing, analytics, or storing metadata
  - Called with `(folderId, items)` before `itemFilter` is applied
  - Allows parent component to react to data fetches independently of display

#### Type System Improvements
- Updated `FolderBrowserProps` type with new props and better documentation
- Added comprehensive JSDoc examples for `itemFilter` showing all common patterns
- Updated custom render functions to receive `itemCount?: number` parameter
- Exported `FolderBrowserItem` type from main index (alias for `Item`)
- Better TypeScript IntelliSense for all new features

### Changed
- **FolderBrowser**: Default for `showItems` changed from `true` to `false`
  - More sensible default - most use cases browse folders, not files
  - Explicitly set `showItems={true}` if you want the old behavior
  - Breaking change: If you relied on default `showItems` behavior, you need to explicitly set it

### Technical Details
- Updated `SlideViewer.tsx` render effect dependencies (lines 1599-1613)
- Completely rewrote `loadItemsForFolder` with filtering and callback support
- Added `shouldFetchItems` computed value for cleaner logic
- Updated `itemPaginationState` to track `totalCount` from API
- Added comprehensive test suite for all new features:
  - Item filtering by name/extension
  - Item filtering by metadata properties
  - `fetchItems` vs `showItems` behavior
  - Item count display with/without `...` indicator
  - `onItemsFetched` callback timing and parameters
- All tests passing (tests include new FolderBrowser test suite)
- No breaking changes to existing code (except `showItems` default)

### Migration Guide
If you're upgrading from 0.1.17 and using `FolderBrowser`:

```diff
 <FolderBrowser
   apiBaseUrl={apiBaseUrl}
+  showItems={true}  // Add this if you want the old behavior
 />
```

**New filtering patterns:**

```typescript
// Filter by extension
const itemFilter = useCallback((item) => {
  return item.name.endsWith('.tif') || item.name.endsWith('.svs');
}, []);

// Filter by metadata
const itemFilter = useCallback((item) => {
  return item.meta?.type === 'model' && item.largeImage != null;
}, []);

// Fetch items for count, but don't show them
<FolderBrowser
  fetchItems={true}
  showItems={false}
  showItemCount={true}
  onItemsFetched={(folderId, items) => {
    console.log(`Folder ${folderId} has ${items.length} items`);
  }}
/>
```

## [0.1.17] - 2025-11-07

### Changed - UI Improvements
- **SlideViewer**: Reduced `min-height` from 400px to 128px for better flexibility in small layouts and embedded use cases
- **FolderBrowser**: Completely redesigned with compact tree-view pattern
  - Replaced folder emoji icons (📁📂) with CSS triangle indicators (▶/▼) for open/closed state
  - Replaced item emoji icon (📄) with minimal text-based icon for consistency
  - Added hierarchy lines connecting parent/child nodes for better visual structure
  - Optimized indentation: child triangles align with parent text (20px = icon 16px + margin 4px) for cleaner vertical alignment
  - This creates a more compact tree structure where nested items don't progressively shift far to the right
  - Significantly reduced padding and spacing throughout (4px instead of 12px)
  - Smaller font sizes (13px body, 12px/11px for badges)
  - Removed borders around collections and folders for flatter appearance
  - More subtle hover states and selection indicators
  - Cleaner "Load More" button styling
  - Overall space savings: ~60% more compact vertically

### Technical Details
- Updated `SlideViewer.css` with new minimum heights
- Completely rewrote `FolderBrowser.css` with compact tree-view design
- Updated `FolderBrowser.tsx` to use CSS-based triangle icons instead of emoji
- Fixed item rendering to use correct `resource-item` CSS class
- Used CSS `::before` pseudo-elements for hierarchy lines and triangles
- All tests still passing (120/120)

## [0.1.16] - 2025-11-06

### Added
- **GeoJSON Format Auto-Detection in SlideViewer**: Seamless support for multiple annotation formats
  - Automatic detection of GeoJSON FeatureCollection format
  - Automatic detection of DSA format (elements array)
  - Transparent transformation from GeoJSON to DSA format
  - Support for Polygon, LineString, and Point geometries
  - Property mapping for lineColor/stroke, fillColor/fill, lineWidth/stroke-width
  - Backward compatible - existing DSA format still works
  - New utility functions: `extractAnnotationElements()`, `detectAnnotationFormat()`
  - Exported `DSAElement` type for TypeScript users
  - Comprehensive test coverage (24 tests covering all formats and edge cases)
- **Expansion State Persistence for FolderBrowser**: Remember which folders are expanded
  - Added `persistExpansion` prop to enable automatic expansion state persistence
  - Added `persistExpansionKey` prop for custom localStorage keys (default: 'bdsa_folder_browser_expansion')
  - Saves both expanded collections and folders separately
  - Restores expansion state on component mount
  - Works seamlessly with existing `persistSelection` feature
- **Auto-Scroll to Selected Resource**: Enhanced navigation UX
  - Automatically scrolls to selected folder/collection/item
  - Smooth scroll animation with `scrollIntoView`
  - Centers selected item in viewport
  - Added `data-resource-id` attributes for reliable element selection
  - Works with both new selections and restored selections
- **Annotation Format Utilities**: New utility module for format handling
  - `isGeoJSONFeatureCollection()` - Type guard for GeoJSON
  - `isDSAAnnotation()` - Type guard for DSA format
  - `geoJSONFeatureToDSAElement()` - Convert single GeoJSON feature
  - `geoJSONToDSAElements()` - Convert entire FeatureCollection
  - `extractAnnotationElements()` - Auto-detect and extract elements
  - `detectAnnotationFormat()` - Identify format ('geojson', 'dsa', or 'unknown')
  - All utilities properly handle edge cases and invalid input
  - Console logging for debugging format detection

### Changed
- SlideViewer now uses annotation format auto-detection instead of manual parsing
- FolderBrowser expansion logic now persists independently of selection
- Updated exports in `src/index.ts` to include new annotation format utilities
- Improved error messages when annotation format is unexpected

### Technical Details
- **Format Detection**: Uses type checking and property inspection to identify format
- **GeoJSON Support**: Handles standard GeoJSON FeatureCollection with Feature array
- **Coordinate Mapping**: Polygon exterior rings become closed polylines, LineStrings become open polylines
- **Point Rendering**: Points converted to 8-point circle approximations
- **Property Fallbacks**: Supports both DSA-style (lineColor) and GeoJSON-style (stroke) property names
- **LocalStorage Keys**: Expansion state uses `{key}_collections` and `{key}_folders` suffixes
- **Auto-Scroll**: 100ms delay ensures DOM updates complete before scrolling

### Migration Guide

#### For GeoJSON Support:
Your backend can now return GeoJSON directly:
```typescript
// No changes needed in your frontend code!
// SlideViewer automatically detects and transforms GeoJSON
<SlideViewer
    imageInfo={{ annotationId: '123' }}
    apiBaseUrl="..."
/>
```

#### For Expansion Persistence:
```typescript
// Add two props to enable:
<FolderBrowser
    persistExpansion={true}  // Enable expansion persistence
    persistExpansion Key="my_app_folders"  // Optional: custom key
    // ... other props
/>
```

### Breaking Changes
None - all changes are backward compatible.

## [0.1.14] - 2025-11-05

### Added
- **Token Query String Support for SlideViewer**: Critical integration improvement
  - Added `authToken` prop to SlideViewer for explicit token passing
  - Added `tokenQueryParam` prop to enable token appending to all requests (DZI, tiles, annotations)
  - Automatic token extraction from `apiHeaders` (Authorization or Girder-Token)
  - Token automatically appended to DZI URLs, tile URLs, and annotation API calls
  - Enables authentication for DSA servers that require `?token=...` query parameters
- **Large Image Detection Utility**: Simplifies DSA item filtering
  - Added `hasLargeImage(item)` function to check for largeImage flag
  - Checks both root level (`item.largeImage`) and metadata level (`item.meta.largeImage`)
  - Handles boolean, string, and object flag types
  - Added `filterLargeImages(items)` for easy array filtering
  - Exported `Item` type for TypeScript users
- **Selection Persistence for FolderBrowser**: Improves development UX
  - Added `persistSelection` prop to enable automatic selection persistence
  - Added `persistSelectionKey` prop for custom localStorage keys
  - Saves selected resource to localStorage with timestamp
  - Restores selection on component mount
  - Auto-expands selected collection/folder for visibility
- **Comprehensive Documentation**: CRITICAL_FEATURES.md with detailed usage examples
  - Complete API documentation for all three features
  - Migration guides from manual implementations
  - Troubleshooting section
  - Integration examples combining all features
- **Unit Tests**: Full test coverage for new utilities
  - 16 tests for `hasLargeImage` and `filterLargeImages`
  - Tests for all edge cases and data structure variations

### Changed
- Updated BACKPORT_IMPROVEMENTS.md to mark critical items as completed
- Bumped version to 0.1.14

## [0.1.13] - 2025-11-05

### Added
- **DsaAuthManager Component**: Complete authentication solution for DSA servers
  - Login/logout UI with status indicators
  - Persistent sessions using localStorage
  - Token management with automatic validation
  - Support for compact layout mode
  - Optional server configuration in login modal
- **useDsaAuth Hook**: React hook for easy authentication integration
  - Access to auth status and user information
  - Methods for login, logout, token validation
  - Helper methods for API requests (getAuthHeaders, getApiUrl)
- **DSA Authentication Store**: Singleton store for auth state management
  - LocalStorage persistence
  - Event subscription system for UI updates
  - Token expiry tracking (30-day default)
  - Connection testing utilities
- **TypeScript Types**: Complete type definitions for DSA authentication
- **Comprehensive Documentation**: DSA_AUTH_USAGE.md with examples and migration guide
- **Storybook Stories**: Interactive examples for all auth component variations
- **Unit Tests**: Full test coverage for authentication components

### Changed
- Bumped version to 0.1.13

## [0.1.12] - 2025-11-05

### Added
- Paper.js runtime patches for `_transformBounds` errors
- Moved `openseadragon`, `osd-paperjs-annotation`, and `paper` to peerDependencies

### Changed
- Improved SlideViewer component cleanup and error handling
- Enhanced AnnotationManager state management to prevent infinite loops

### Fixed
- Fixed `_transformBounds` error in consuming applications
- Fixed race conditions in annotation state updates
- Fixed loading state not clearing properly in AnnotationManager
- Fixed annotation rendering issues when toggling visibility

## [0.1.11] - 2025-11-04

### Added
- SlideViewer component with OpenSeadragon integration
- AnnotationManager component for DSA annotations
- FolderBrowser component for navigating DSA resources
- Annotation caching system (Memory and IndexedDB)
- Button and Card components

### Changed
- Initial component library setup
- Added TypeScript support
- Configured Vite build system
- Set up Storybook for component documentation

## [0.1.0] - 2025-11-01

### Added
- Initial project setup
- Basic project structure
- Build configuration


### Changed
- Improved SlideViewer component cleanup and error handling
- Enhanced AnnotationManager state management to prevent infinite loops

### Fixed
- Fixed `_transformBounds` error in consuming applications
- Fixed race conditions in annotation state updates
- Fixed loading state not clearing properly in AnnotationManager
- Fixed annotation rendering issues when toggling visibility

## [0.1.11] - 2025-11-04

### Added
- SlideViewer component with OpenSeadragon integration
- AnnotationManager component for DSA annotations
- FolderBrowser component for navigating DSA resources
- Annotation caching system (Memory and IndexedDB)
- Button and Card components

### Changed
- Initial component library setup
- Added TypeScript support
- Configured Vite build system
- Set up Storybook for component documentation

## [0.1.0] - 2025-11-01

### Added
- Initial project setup
- Basic project structure
- Build configuration
