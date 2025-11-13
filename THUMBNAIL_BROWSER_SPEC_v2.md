# Thumbnail Browser Component Specification

**Date:** 2025-01-XX  
**Purpose:** Documentation for extracting thumbnail browser functionality into `bdsa-react-components` library  
**Components:** `FolderThumbnailBrowser`, `ThumbnailViewer`, `ThumbnailsTab` (Simple Thumbnail Browser)

---

## Overview

There are **two different thumbnail browser implementations** for different use cases:

### 1. FolderThumbnailBrowser (Full-Featured / OpenSeadragon-Based)

The full-featured thumbnail browser provides a paginated, responsive grid view of DSA items (whole slide images) with optional annotation overlays using OpenSeadragon and SlideViewer. This is the "smart" version that supports:
- DZI tile-based viewing
- Annotation overlays
- Zoom and pan capabilities
- Full OpenSeadragon integration

**Components:** `FolderThumbnailBrowser`, `ThumbnailViewer`

### 2. ThumbnailsTab (Simple / Static Image-Based)

A lightweight thumbnail browser that displays static thumbnail images using simple `<img>` tags. This is the "simple" version that:
- Does NOT require OpenSeadragon
- Uses pre-generated thumbnail images
- Shows metadata (Region, Stain, etc.)
- Much lighter weight and faster for simple use cases

**Component:** `ThumbnailsTab`

---

## FolderThumbnailBrowser (Full-Featured)

### Key Features

- **Responsive Grid Layout**: Automatically calculates items per page based on container size and viewer dimensions
- **Pagination**: Full pagination controls with ellipsis for large page counts
- **Annotation Overlays**: Displays annotations on thumbnails using `SlideViewer` from `bdsa-react-components`
- **Opacity Control**: Shared opacity management across all thumbnails without re-renders
- **Size Presets**: User-configurable thumbnail sizes (S, M, L, XL) with localStorage persistence
- **Filtering**: Filter items by annotation name
- **Model Item Support**: Special handling for AI model items (displays metadata instead of images)
- **Dataset Type Indicators**: Visual indicators for train/val/test dataset splits
- **Visibility Handling**: IntersectionObserver-based visibility detection for performance
- **Backend Caching**: Routes annotation requests through backend cache for faster loading

---

## Component Architecture

### 1. FolderThumbnailBrowser (Main Container)

**Location:** `model-browser-v2/frontend/src/components/FolderThumbnailBrowser.js`

**Purpose:** Main container component that manages pagination, filtering, and layout.

#### Key Responsibilities

- Fetch items from folder or imageIds list
- Filter items by annotation name
- Calculate responsive items per page
- Manage pagination state
- Handle viewer size preferences
- Coordinate annotation opacity across thumbnails
- Render grid of `ThumbnailViewer` components

#### Props

```typescript
interface FolderThumbnailBrowserProps {
  // Data Sources (mutually exclusive)
  folderId?: string;                    // DSA folder ID to fetch items from
  imageIds?: string[];                   // Array of specific image IDs to display
  items?: Item[];                        // Pre-loaded items array (takes precedence)
  
  // API Configuration
  apiBaseUrl: string;                    // DSA API base URL (e.g., "http://bdsa.pathology.emory.edu:8080/api/v1")
  backendApiBaseUrl?: string;            // Backend API base URL for annotation caching (default: "http://localhost:8000")
  apiHeaders?: HeadersInit;              // Headers for API requests (auth, etc.)
  
  // Display Configuration
  itemsPerPage?: number;                 // Initial items per page estimate (default: 12)
  viewerSize?: 's' | 'm' | 'l' | 'xl';  // Thumbnail size preset (default: 'l')
  
  // Annotation Configuration
  selectedAnnotationName?: string;       // Name of currently selected annotation to display
  annotationNameToIds?: Map<string, string> | Record<string, string>;  // Map of itemId -> annotationId
  annotationOpacity?: number;             // Opacity for annotations (0-1, default: 0.7)
  onAnnotationOpacityChange?: (opacity: number) => void;  // Callback when opacity changes
  
  // Model Support
  modelName?: string;                     // Display name for model (if viewing model training images)
  selectedModelId?: string;               // Currently selected model ID
  modelDatasetInfo?: {                    // Dataset split information
    train: string[];
    val: string[];
    test: string[];
  };
  onModelDoubleClick?: (item: Item, imageIds: string[]) => void;  // Callback when model item clicked
  
  // Callbacks
  onItemsLoaded?: (itemIds: string[]) => void;  // Called when items are loaded/filtered
  getDatasetType?: (itemId: string) => 'train' | 'val' | 'test' | null;  // Function to determine dataset type
}
```

#### State Management

- `items`: Array of displayable items (filtered from fetched items)
- `loading`: Loading state
- `error`: Error state
- `currentPage`: Current pagination page (1-indexed)
- `totalItems`: Total number of items (before filtering)
- `viewerSize`: Current viewer size preset ('s', 'm', 'l', 'xl')
- `containerWidth/Height`: Measured container dimensions for responsive calculation
- `calculatedItemsPerPage`: Dynamically calculated items per page based on container size

#### Key Functions

**`fetchItems()`**: Fetches items from folder or imageIds list
- Routes through backend API for annotation caching
- Handles batch fetching for large imageIds arrays
- Calls `processItems()` to filter and process results

**`processItems(data)`**: Processes fetched items
- Filters to only items with `largeImage` flag
- Excludes model items (items with `results`, `train_args`, `dataset_args` in meta)
- Sets up item type indicators
- Notifies parent via `onItemsLoaded` callback

**`proxyFetchFn(url, options)`**: Custom fetch function for annotation requests
- Routes annotation requests through backend cache
- Handles both annotation search (`/annotation?itemId=...`) and individual annotation fetch (`/annotation/{id}`)
- Preserves query parameters for coordinate transforms

**`calculatedItemsPerPage`**: Computed value
- Calculates how many thumbnails fit per row based on container width and viewer size
- Calculates rows per page based on viewport height
- Returns `itemsPerPage` prop value if container not yet measured

#### Rendering

- **Header Section** (sticky): Title, viewer size controls, pagination, opacity slider
- **Grid Section** (scrollable): Flexbox grid of `ThumbnailViewer` components
- **Model Item Support**: Renders `ModelItemViewer` for model items (special card with metadata)

---

### 2. ThumbnailViewer (Individual Thumbnail)

**Location:** `model-browser-v2/frontend/src/components/ThumbnailViewer.js`

**Purpose:** Individual thumbnail component that wraps `SlideViewer` for displaying a single DSA item with optional annotation overlay.

#### Key Responsibilities

- Render single thumbnail using `SlideViewer`
- Handle annotation overlay display
- Manage opacity via shared module-level Map
- Handle visibility detection for performance
- Sync OpenSeadragon and Paper.js canvas sizes
- Display dataset type indicators
- Show annotation metadata

#### Props

```typescript
interface ThumbnailViewerProps {
  item: Item;                             // DSA item object with _id, name, meta, etc.
  viewerWidth: number;                    // Width of thumbnail in pixels
  apiBaseUrl: string;                     // DSA API base URL
  backendApiBaseUrl?: string;             // Backend API base URL for annotation caching
  apiHeaders?: HeadersInit;               // Headers for API requests
  selectedAnnotationName?: string;        // Name of currently selected annotation
  annotationNameToIds?: Map<string, string> | Record<string, string>;  // Map of itemId -> annotationId
  getDatasetType?: (itemId: string) => 'train' | 'val' | 'test' | null;  // Dataset type function
}
```

#### Module-Level State

**`sharedOpacityMap`**: `Map<annotationId, opacity>` - Shared across all thumbnails
- Updated via `updateThumbnailOpacity()` function
- Accessed directly by all `ThumbnailViewer` instances
- Prevents re-renders when opacity changes

**`opacityVersion`**: Counter that increments when opacity changes
- Used to trigger `SlideViewer` updates without `ThumbnailViewer` re-renders
- Watched via `requestAnimationFrame` polling

#### Exported Functions

```typescript
// Update opacity for a specific annotation across all thumbnails
updateThumbnailOpacity(annotationId: string, opacity: number): void

// Get current opacity for an annotation
getThumbnailOpacity(annotationId: string): number

// Clear all opacity settings
clearThumbnailOpacities(): void
```

#### Key Features

**Visibility Detection**: Uses `IntersectionObserver` to detect when thumbnail becomes visible
- Triggers OpenSeadragon `viewport.resize()` when component becomes visible
- Handles tab switching and scrolling scenarios

**Canvas Synchronization**: Syncs OpenSeadragon and Paper.js canvas sizes
- Removes explicit width/height attributes (uses CSS sizing)
- Matches Paper.js canvas dimensions to OpenSeadragon
- Uses `MutationObserver` to catch dynamically added elements

**Home Bounds Setup**: Configures OpenSeadragon to fit image bounds on load
- Overrides `goHome()` to fit bounds instead of default (0,0)
- Handles both initial load and delayed image opening

**Annotation Display**: 
- Only displays annotation if `selectedAnnotationName` and `annotationNameToIds` are provided
- Uses `annotationIds` prop to pass annotation ID to `SlideViewer`
- `SlideViewer` lazily fetches full annotation document when thumbnail mounts

**Dataset Type Indicators**: 
- Shows colored badge (TRAIN/VAL/TEST) if `getDatasetType` returns a value
- Color-coded borders and badges

#### Performance Optimizations

- **React.memo**: Only re-renders when item, viewerWidth, or annotation selection changes
- **Module-level opacity Map**: Opacity changes don't trigger re-renders
- **Lazy annotation fetching**: `SlideViewer` only fetches annotations for visible thumbnails
- **Stable keys**: Uses `item._id` as key to prevent unnecessary remounts

---

## Dependencies

### External Libraries

- **react**: ^18.0.0
- **react-bootstrap**: For Card, Badge, Pagination, Button, Form components
- **bdsa-react-components**: 
  - `SlideViewer`: Core thumbnail rendering
  - `isAIModel`: Helper to detect model items

### Internal Dependencies

- **Backend API**: Requires backend endpoints for:
  - `/api/v1/item?folderId={id}&includeAnnotations=true` - Fetch folder items
  - `/api/v1/item?itemId={ids}&includeAnnotations=true` - Fetch items by IDs
  - `/api/v1/annotation/{id}` - Fetch annotation documents (cached)

---

## Integration Patterns

### Basic Usage (Folder View)

```tsx
<FolderThumbnailBrowser
  folderId="6903df8dd26a6d93de19a9b2"
  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
  backendApiBaseUrl="http://localhost:8000"
  apiHeaders={{ 'Authorization': 'Bearer token' }}
  onItemsLoaded={(itemIds) => console.log('Loaded:', itemIds)}
/>
```

### With Annotation Filtering

```tsx
const [selectedAnnotation, setSelectedAnnotation] = useState('Gray White Segmentation');
const [annotationMap, setAnnotationMap] = useState(new Map());

<FolderThumbnailBrowser
  folderId="6903df8dd26a6d93de19a9b2"
  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
  selectedAnnotationName={selectedAnnotation}
  annotationNameToIds={annotationMap}
  annotationOpacity={0.7}
  onAnnotationOpacityChange={(opacity) => setAnnotationOpacity(opacity)}
/>
```

### With Pre-loaded Items

```tsx
const [items, setItems] = useState([]);

// Items are loaded elsewhere (e.g., from AnnotationAnalysisPanel)
<FolderThumbnailBrowser
  items={items}
  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
  selectedAnnotationName={selectedAnnotation}
  annotationNameToIds={annotationMap}
/>
```

### Model Training Images View

```tsx
<FolderThumbnailBrowser
  imageIds={modelTrainingImageIds}
  modelName="SegFormer Model v1"
  modelDatasetInfo={{
    train: trainImageIds,
    val: valImageIds,
    test: testImageIds
  }}
  getDatasetType={(itemId) => {
    if (trainImageIds.includes(itemId)) return 'train';
    if (valImageIds.includes(itemId)) return 'val';
    if (testImageIds.includes(itemId)) return 'test';
    return null;
  }}
  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
/>
```

---

## Data Flow

### Item Loading Flow

1. **Props Change**: `folderId`, `imageIds`, or `items` prop changes
2. **Fetch Items**: `fetchItems()` called (if not using `items` prop)
3. **Backend API**: Requests routed through backend for annotation caching
4. **Process Items**: `processItems()` filters to `largeImage` items, excludes models
5. **State Update**: `items` state updated, `onItemsLoaded` callback fired
6. **Filter**: Items filtered by `selectedAnnotationName` if provided
7. **Pagination**: Items sliced for current page
8. **Render**: `ThumbnailViewer` components rendered for current page items

### Annotation Opacity Flow

1. **User Changes Slider**: `onAnnotationOpacityChange` callback fired
2. **Parent Updates State**: Parent component updates `annotationOpacity` prop
3. **Update Shared Map**: `FolderThumbnailBrowser` calls `updateThumbnailOpacity()` for all annotation IDs
4. **Version Increment**: Module-level `opacityVersion` counter incremented
5. **Polling Detection**: `ThumbnailViewer` detects version change via `requestAnimationFrame`
6. **New Map Reference**: Creates new Map reference from `sharedOpacityMap`
7. **SlideViewer Update**: `SlideViewer` receives new `annotationOpacities` prop and updates

### Annotation Display Flow

1. **Annotation Selected**: `selectedAnnotationName` prop set
2. **Map Lookup**: `ThumbnailViewer` looks up annotation ID from `annotationNameToIds`
3. **Pass to SlideViewer**: Annotation ID passed via `annotationIds` prop
4. **Lazy Fetch**: `SlideViewer` fetches annotation document when thumbnail mounts
5. **Render Overlay**: Paper.js renders annotation overlay on thumbnail

---

## Performance Considerations

### Optimizations Implemented

1. **Responsive Calculation**: Items per page calculated based on actual container size
2. **Pagination**: Only renders items for current page
3. **Lazy Annotation Fetching**: Annotations only fetched when thumbnails mount
4. **Module-Level Opacity**: Opacity changes don't trigger re-renders
5. **React.memo**: `ThumbnailViewer` only re-renders when necessary
6. **Stable Keys**: Uses `item._id` as key to prevent remounts
7. **IntersectionObserver**: Only processes visible thumbnails
8. **Backend Caching**: Annotation requests routed through backend cache

### Known Performance Issues

1. **Container Measurement Delay**: Initial render waits for container measurement (1s timeout fallback)
2. **Canvas Synchronization**: Multiple `MutationObserver` and timeout-based syncs (could be optimized)
3. **Opacity Polling**: Uses `requestAnimationFrame` polling (could use event-based approach)

---

## Future Improvements for Library

### API Improvements

1. **Custom Render Props**: Allow custom rendering of thumbnail cards
2. **Virtual Scrolling**: For very large item lists (1000+ items)
3. **Infinite Scroll**: Alternative to pagination
4. **Thumbnail Caching**: Cache thumbnail images for faster loading
5. **Batch Annotation Fetching**: Fetch all annotations in one request

### Feature Additions

1. **Selection Support**: Multi-select thumbnails
2. **Drag and Drop**: Reorder thumbnails
3. **Thumbnail Actions**: Right-click menu, bulk operations
4. **Custom Filters**: Filter by metadata, date, etc.
5. **Sort Options**: Sort by name, date, annotation count, etc.
6. **Export**: Export thumbnail grid as image

### Code Improvements

1. **TypeScript**: Convert to TypeScript for better type safety
2. **Custom Hooks**: Extract logic into reusable hooks (`useThumbnailPagination`, `useAnnotationOpacity`, etc.)
3. **Error Boundaries**: Add error boundaries for individual thumbnails
4. **Accessibility**: Add ARIA labels, keyboard navigation
5. **Testing**: Add unit tests and integration tests

---

## Migration Checklist

When moving to `bdsa-react-components`:

- [ ] Extract `ThumbnailViewer` component
- [ ] Extract `FolderThumbnailBrowser` component
- [ ] Extract opacity management functions (`updateThumbnailOpacity`, etc.)
- [ ] Extract helper functions (`hasLargeImage`, `filterLargeImages`, `isModelItem`)
- [ ] Convert to TypeScript
- [ ] Add proper JSDoc/TSDoc comments
- [ ] Create Storybook stories
- [ ] Add unit tests
- [ ] Update `.cursorrules` documentation
- [ ] Version bump library
- [ ] Update model-browser-v2 to use library version
- [ ] Remove local components after migration

---

## Example Usage in Library

```tsx
import { FolderThumbnailBrowser } from 'bdsa-react-components';

function MyApp() {
  return (
    <FolderThumbnailBrowser
      folderId="6903df8dd26a6d93de19a9b2"
      apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
      itemsPerPage={12}
      viewerSize="l"
      onItemsLoaded={(itemIds) => {
        console.log(`Loaded ${itemIds.length} items`);
      }}
    />
  );
}
```

---

## ThumbnailsTab (Simple Thumbnail Browser)

**Location:** `model-browser-v2/frontend/src/components/ThumbnailsTab.js`

**Purpose:** Lightweight thumbnail browser for displaying static thumbnail images without OpenSeadragon overhead.

### When to Use

- Displaying pre-generated thumbnail images (not DZI tiles)
- Simple image browsing without annotation overlays
- Faster loading for large image sets
- When you don't need zoom/pan capabilities
- Displaying metadata (Region, Stain, etc.) alongside images

### Key Features

- **Static Image Display**: Uses simple `<img>` tags (no OpenSeadragon)
- **Thumbnail Queue**: Throttles image loading (3 concurrent, 200ms delay)
- **Size Presets**: Small, Medium, Large with responsive grid
- **Metadata Display**: Shows Region and Stain information
- **Loading States**: Spinner while loading, error state for failed images
- **Dataset Sections**: Separate sections for train/val/test images
- **Pagination** (Recommended for library): Should support pagination like `ThumbnailBrowser`, but simpler (no filtering/annotation features)

### Props

```typescript
interface ThumbnailsTabProps {
  metaData?: any;                        // Optional metadata
  thumbnailConfig: {                      // Required: thumbnail configuration
    all_items?: ThumbnailItem[];         // All items to display
    train_items?: ThumbnailItem[];       // Training images
    val_items?: ThumbnailItem[];        // Validation images
  };
  onImageSelect?: (item: ThumbnailItem) => void;  // Callback when thumbnail clicked
}

interface ThumbnailItem {
  id: string;                            // Item ID
  url: string;                           // Thumbnail image URL
  region?: string;                       // Region metadata (e.g., "Hippocampus")
  stain?: string;                        // Stain metadata (e.g., "H&E")
}
```

### Component Structure

**ThumbnailQueue**: Class that manages concurrent image loading
- Max 3 concurrent requests
- 200ms delay between requests
- Prevents server overload

**ThumbnailItem**: Individual thumbnail component
- Loading spinner while image loads
- Error state for failed images
- Displays Region and Stain metadata
- Click handler for selection

**ThumbnailsTab**: Main container
- Size controls (Small/Medium/Large)
- Separate sections for train/val/all items
- Responsive grid layout

### Size Presets

```typescript
{
  small: { width: 80, height: 80, cols: { xs: "4", sm: "3", md: "2", lg: "1" } },
  medium: { width: 100, height: 100, cols: { xs: "6", sm: "4", md: "3", lg: "2" } },
  large: { width: 150, height: 150, cols: { xs: "12", sm: "6", md: "4", lg: "3" } }
}
```

### Usage Example

```tsx
<ThumbnailsTab
  thumbnailConfig={{
    all_items: [
      { id: 'item1', url: 'https://example.com/thumb1.jpg', region: 'Hippocampus', stain: 'H&E' },
      { id: 'item2', url: 'https://example.com/thumb2.jpg', region: 'Cortex', stain: 'Nissl' }
    ],
    train_items: [...],
    val_items: [...]
  }}
  onImageSelect={(item) => console.log('Selected:', item)}
/>
```

### Differences from FolderThumbnailBrowser

| Feature | FolderThumbnailBrowser | ThumbnailsTab |
|---------|----------------------|---------------|
| **OpenSeadragon** | ✅ Required | ❌ Not used |
| **DZI Tiles** | ✅ Full support | ❌ Static images only |
| **Annotation Overlays** | ✅ Supported | ❌ Not supported |
| **Zoom/Pan** | ✅ Full support | ❌ Not supported |
| **Pagination** | ✅ Full pagination controls | ⚠️ Currently scrollable (should add pagination) |
| **Size Controls** | ✅ S/M/L/XL presets | ✅ S/M/L presets |
| **Filtering** | ✅ By annotation name | ❌ Not supported |
| **Opacity Control** | ✅ Annotation opacity slider | ❌ Not applicable |
| **Performance** | Slower (heavy) | Faster (lightweight) |
| **Use Case** | Full-featured viewing | Simple browsing |
| **Metadata** | Limited | Region, Stain, etc. |
| **Thumbnail Source** | DZI tiles | Pre-generated images |

---

## Notes

### FolderThumbnailBrowser Notes

- **Model Items**: Model items (items with `results`, `train_args`, `dataset_args` in meta) are excluded from thumbnail display. They should be handled separately in folder tree views.
- **Large Image Flag**: Only items with `largeImage` flag (at root or in `meta.largeImage`) are displayed.
- **Backend Caching**: Annotation requests are routed through backend cache for performance. Backend must implement `/api/v1/annotation/{id}` endpoint.
- **Responsive Design**: Items per page is calculated dynamically based on container size. Falls back to `itemsPerPage` prop if container not measured.
- **Opacity Management**: Uses module-level Map to avoid re-renders. Changes are detected via version counter polling.

### ThumbnailsTab Notes

- **Thumbnail URLs**: Requires pre-generated thumbnail images (not DZI tiles)
- **Throttling**: Uses queue system to limit concurrent requests (3 max, 200ms delay)
- **Metadata**: Displays Region and Stain fields from item metadata
- **No Zoom**: Static images only - no zoom/pan capabilities
- **Lighter Weight**: Much faster for large image sets compared to OpenSeadragon-based viewer
- **Pagination**: Currently uses scrollable container - should add pagination for library version (simpler than `ThumbnailBrowser` - no filtering/annotation features)

---

## Migration Recommendations

When moving to `bdsa-react-components`:

### Recommended Naming

1. **FolderThumbnailBrowser** → **`ThumbnailBrowser`**
   - Full-featured, OpenSeadragon-based
   - Uses `SlideViewer` for DZI tiles and annotation overlays
   - Primary component for whole slide image thumbnails
   - Matches library naming pattern (e.g., `SlideViewer`, `FolderBrowser`)

2. **ThumbnailsTab** → **`ThumbnailGrid`**
   - Simple, lightweight, static image-based
   - Uses `<img>` tags (no OpenSeadragon)
   - Good for pre-generated thumbnails and metadata display
   - "Grid" emphasizes the simple grid layout vs. full browser functionality

### Rationale

- **`ThumbnailBrowser`**: Follows library pattern (`SlideViewer`, `FolderBrowser`) and clearly indicates it's a full-featured browser component with OpenSeadragon, annotations, filtering, etc.
- **`ThumbnailGrid`**: Shorter, emphasizes the grid layout. Still supports pagination and size controls, but without the "fancy" features (OpenSeadragon, annotation overlays, filtering, opacity controls)
- Both names are clear about their purpose and capabilities
- Easy to import: `import { ThumbnailBrowser, ThumbnailGrid } from 'bdsa-react-components'`

### Feature Comparison

**`ThumbnailBrowser`** (Full-featured):
- ✅ Pagination
- ✅ Size controls (S/M/L/XL)
- ✅ OpenSeadragon/SlideViewer
- ✅ Annotation overlays
- ✅ Annotation filtering
- ✅ Opacity controls
- ✅ Responsive layout calculation

**`ThumbnailGrid`** (Simple):
- ✅ Pagination (should be added)
- ✅ Size controls (S/M/L)
- ❌ OpenSeadragon (uses `<img>` tags)
- ❌ Annotation overlays
- ❌ Annotation filtering
- ❌ Opacity controls
- ✅ Metadata display (Region, Stain, etc.)
- ✅ Thumbnail loading queue

### Alternative Names (if needed)

- `SlideThumbnailBrowser` + `ImageThumbnailGrid` (more explicit about technology)
- `DZIThumbnailBrowser` + `StaticThumbnailGrid` (emphasizes DZI vs static)
- `ThumbnailBrowser` + `SimpleThumbnailGrid` (keeps "simple" qualifier)

---

**Last Updated:** 2025-01-XX  
**Author:** Auto-generated from codebase analysis

