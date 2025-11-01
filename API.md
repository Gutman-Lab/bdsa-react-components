# BDSA React Components - API Reference

This document provides a comprehensive API reference for all components, types, and exports in the `bdsa-react-components` library.

## Table of Contents

- [Installation](#installation)
- [Exports](#exports)
- [Components](#components)
  - [Button](#button)
  - [Card](#card)
  - [SlideViewer](#slideviewer)
  - [AnnotationManager](#annotationmanager)
  - [FolderBrowser](#folderbrowser)
- [Types](#types)
- [Dependencies](#dependencies)

## Installation

```bash
npm install bdsa-react-components
# or
yarn add bdsa-react-components
```

## Exports

All components and types are exported from the main package entry point:

```tsx
import { 
  Button, 
  Card, 
  SlideViewer, 
  AnnotationManager,
  FolderBrowser 
} from 'bdsa-react-components'

import 'bdsa-react-components/styles.css'
```

## Components

### Button

A versatile button component with multiple variants and states.

**Export:** `Button`  
**Type:** `ButtonProps`

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'success'` | `'primary'` | No | Button style variant |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | No | Button size |
| `fullWidth` | `boolean` | `false` | No | Whether button takes full width |
| `loading` | `boolean` | `false` | No | Whether button is in loading state |
| `className` | `string` | `''` | No | Custom CSS class |
| `disabled` | `boolean` | - | No | Whether button is disabled |
| `onClick` | `(event: React.MouseEvent<HTMLButtonElement>) => void` | - | No | Click handler |
| `children` | `React.ReactNode` | - | Yes | Button content |

**Extends:** All standard HTML button attributes (`React.ButtonHTMLAttributes<HTMLButtonElement>`)

**Usage:**

```tsx
<Button variant="primary" size="large" loading={false} onClick={() => {}}>
  Click Me
</Button>
```

---

### Card

A flexible card component for displaying content in a contained format.

**Export:** `Card`  
**Type:** `CardProps`

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `header` | `React.ReactNode` | - | No | Header content |
| `footer` | `React.ReactNode` | - | No | Footer content |
| `shadow` | `'none' \| 'small' \| 'medium' \| 'large'` | `'small'` | No | Shadow size |
| `bordered` | `boolean` | `true` | No | Whether card has border |
| `hoverable` | `boolean` | `false` | No | Whether card shows hover effect |
| `padding` | `'none' \| 'small' \| 'medium' \| 'large'` | `'medium'` | No | Content padding size |
| `className` | `string` | `''` | No | Custom CSS class |
| `children` | `React.ReactNode` | - | Yes | Card content |

**Extends:** All standard HTML div attributes (`React.HTMLAttributes<HTMLDivElement>`)

**Usage:**

```tsx
<Card header="Title" footer="Footer" shadow="medium" hoverable>
  Content here
</Card>
```

---

### SlideViewer

A powerful slide viewer component that integrates OpenSeadragon with Paper.js annotations for viewing Digital Slide Archive images with annotation overlays.

**Export:** `SlideViewer`  
**Type:** `SlideViewerProps`

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `imageInfo` | `SlideImageInfo` | - | **Yes** | Image information for the slide |
| `annotations` | `AnnotationFeature[] \| FeatureCollection` | `[]` | No | Annotations to render |
| `annotationIds` | `(string \| number)[]` | `[]` | No | Annotation IDs to fetch from DSA API |
| `apiBaseUrl` | `string` | - | No | Base URL for DSA API (e.g., `'http://bdsa.pathology.emory.edu:8080/api/v1'`) |
| `onViewerReady` | `(viewer: OpenSeadragonViewer) => void` | - | No | Callback when OpenSeadragon viewer is ready |
| `onAnnotationClick` | `(annotation: AnnotationFeature) => void` | - | No | Callback when annotation is clicked |
| `defaultAnnotationColor` | `string` | `'#ff0000'` | No | Default stroke color for annotations |
| `strokeWidth` | `number` | `2` | No | Stroke width for annotations |
| `osdOptions` | `OpenSeadragonOptions` | `{}` | No | Additional OpenSeadragon configuration options |
| `className` | `string` | `''` | No | Custom CSS class name |
| `height` | `string \| number` | `'600px'` | No | Height for viewer container (required for OpenSeadragon) |
| `width` | `string \| number` | `'100%'` | No | Width for viewer container |
| `showAnnotationInfo` | `boolean` | `false` | No | Display information about loaded annotation documents |
| `annotationInfoConfig` | `AnnotationInfoConfig` | - | No | Configuration for customizing annotation info panel |
| `maxPointsPerAnnotation` | `number` | `10000` | No | Maximum points allowed per annotation element |
| `maxTotalPoints` | `number` | `100000` | No | Maximum total points across all annotations |
| `fetchFn` | `(url: string, options?: RequestInit) => Promise<Response>` | - | No | Custom fetch function for API requests (useful for authentication) |
| `apiHeaders` | `HeadersInit` | - | No | Custom headers to add to all API requests |
| `showAnnotationControls` | `boolean` | `false` | No | Show annotation controls panel in sidebar |
| `defaultAnnotationOpacity` | `number` | `1` | No | Default opacity for all annotations (0-1) |

**SlideImageInfo Type:**

```typescript
interface SlideImageInfo {
  /** Image ID from DSA (used if dziUrl is not provided) */
  imageId?: string | number
  /** Image width in pixels (used if dziUrl is not provided) */
  width?: number
  /** Image height in pixels (used if dziUrl is not provided) */
  height?: number
  /** Tile width (used if dziUrl is not provided) */
  tileWidth?: number
  /** Number of zoom levels (used if dziUrl is not provided) */
  levels?: number
  /** Base URL for DSA tile server (used if dziUrl is not provided) */
  baseUrl?: string
  /** DZI descriptor URL (e.g., 'http://bdsa.pathology.emory.edu:8080/api/v1/item/{itemId}/tiles/dzi.dzi') */
  dziUrl?: string
}
```

**AnnotationFeature Type:**

```typescript
interface AnnotationFeature {
  /** Unique identifier for the annotation */
  id?: string | number
  /** Left coordinate in pixels */
  left: number
  /** Top coordinate in pixels */
  top: number
  /** Width in pixels */
  width: number
  /** Height in pixels */
  height: number
  /** Optional color for the annotation stroke */
  color?: string
  /** Optional group identifier */
  group?: string | number
  /** Optional label */
  label?: string
  /** Type of annotation (rectangle, polyline, etc.) */
  annotationType?: 'rectangle' | 'polyline'
  /** Points array for polyline annotations */
  points?: Array<[number, number]>
  /** Whether polyline is closed */
  closed?: boolean
  /** Fill color for polyline */
  fillColor?: string
  [key: string]: unknown
}
```

**Usage:**

```tsx
<SlideViewer
  imageInfo={{
    dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/6903df8dd26a6d93de19a9b2/tiles/dzi.dzi'
  }}
  annotations={[]}
  annotationIds={['ann-1', 'ann-2']}
  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
  height="800px"
  onAnnotationClick={(annotation) => console.log(annotation)}
  fetchFn={async (url, options) => {
    // Add authentication headers
    return fetch(url, { ...options, headers: { ...options?.headers, 'Authorization': 'Bearer token' } })
  }}
/>
```

**Note:** If `dziUrl` is not provided, all manual fields (`imageId`, `width`, `height`, `tileWidth`, `levels`, `baseUrl`) are required.

---

### AnnotationManager

Component for managing annotation loading, visibility, and state. Handles fetching annotations by itemId using the DSA API search endpoint.

**Export:** `AnnotationManager`  
**Type:** `AnnotationManagerProps`

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `imageId` | `string` | - | No | Image/Item ID to search annotations for |
| `apiBaseUrl` | `string` | - | No | Base URL for DSA API |
| `limit` | `number` | `50` | No | Maximum number of annotations to fetch per request |
| `fetchFn` | `(url: string, options?: RequestInit) => Promise<Response>` | - | No | Custom fetch function for API requests |
| `apiHeaders` | `HeadersInit` | - | No | Custom headers to add to all API requests |
| `onAnnotationsLoaded` | `(annotations: AnnotationSearchResult[]) => void` | - | No | Callback when annotations are loaded |
| `onError` | `(error: Error) => void` | - | No | Callback when annotation loading fails |
| `showDebugPanel` | `boolean` | `false` | No | Show debug panel with raw API response |
| `className` | `string` | `''` | No | Custom CSS class |
| `children` | `React.ReactNode` | - | No | Child components |

**AnnotationSearchResult Type:**

```typescript
interface AnnotationSearchResult {
  _id: string
  _modelType: string
  _elementCount?: number
  _detailsCount?: number
  _version?: number
  _accessLevel?: number
  itemId?: string
  public?: boolean
  created?: string
  updated?: string
  creatorId?: string
  updatedId?: string
  groups?: (string | null)[]
  annotation?: {
    name?: string
    description?: string
    attributes?: Record<string, unknown>
    display?: Record<string, unknown>
  }
  [key: string]: unknown
}
```

**Usage:**

```tsx
<AnnotationManager
  imageId="6903df8dd26a6d93de19a9b2"
  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
  limit={100}
  onAnnotationsLoaded={(annotations) => {
    console.log('Loaded:', annotations)
  }}
  onError={(error) => {
    console.error('Error:', error)
  }}
/>
```

**API Endpoint:** `GET /api/v1/annotation?itemId={imageId}&limit={limit}&offset=0&sort=lowerName&sortdir=1`

---

### FolderBrowser

Component for browsing DSA collections and folders. Provides a tree view with support for expanding collections and folders recursively.

**Export:** `FolderBrowser`  
**Type:** `FolderBrowserProps`

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `apiBaseUrl` | `string` | - | No | Base URL for DSA API |
| `fetchFn` | `(url: string, options?: RequestInit) => Promise<Response>` | - | No | Custom fetch function for API requests |
| `apiHeaders` | `HeadersInit` | - | No | Custom headers to add to all API requests |
| `onResourceSelect` | `(resource: Resource) => void` | - | No | Callback when a resource is selected |
| `onSelectionChange` | `(resource: Resource \| null) => void` | - | No | Callback when selection changes |
| `showCollections` | `boolean` | `true` | No | Show collections at root level (ignored if rootId provided) |
| `rootId` | `string` | - | No | Root directory ID to start from |
| `rootType` | `'collection' \| 'folder'` | - | No | Type of root directory (required if rootId provided) |
| `foldersPerPage` | `number` | `50` | No | Number of folders to load per page (0 = load all) |
| `startCollectionId` | `string` | - | No | Start at specific collection ID (deprecated: use rootId) |
| `startFolderId` | `string` | - | No | Start at specific folder ID (deprecated: use rootId) |
| `parentFolderId` | `string` | - | No | Start at folder's subfolder (deprecated: use rootId) |
| `className` | `string` | `''` | No | Custom CSS class |
| `renderCollection` | `(collection: Collection, isExpanded: boolean, onToggle: () => void) => React.ReactNode` | - | No | Custom render for collections |
| `renderFolder` | `(folder: Folder, depth: number, isExpanded: boolean, onToggle: () => void) => React.ReactNode` | - | No | Custom render for folders |

**Collection Type:**

```typescript
interface Collection {
  _id: string
  name: string
  description?: string
  public?: boolean
  created?: string
  updated?: string
  [key: string]: unknown
}
```

**Folder Type:**

```typescript
interface Folder {
  _id: string
  name: string
  description?: string
  public?: boolean
  created?: string
  updated?: string
  parentId?: string
  parentType?: 'collection' | 'folder'
  [key: string]: unknown
}
```

**Resource Type:**

```typescript
type Resource = (Collection | Folder) & { type: 'collection' | 'folder' }
```

**Usage:**

```tsx
<FolderBrowser
  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
  showCollections={true}
  onResourceSelect={(resource) => {
    console.log('Selected:', resource)
  }}
  foldersPerPage={50}
/>
```

**API Endpoints:**
- Collections: `GET /api/v1/collection`
- Folders in collection: `GET /api/v1/folder?parentType=collection&parentId={collectionId}`
- Subfolders: `GET /api/v1/folder?parentType=folder&parentId={folderId}`

---

## Types

All TypeScript types and interfaces are exported and can be imported:

```tsx
import type {
  ButtonProps,
  CardProps,
  SlideViewerProps,
  SlideImageInfo,
  AnnotationFeature,
  AnnotationInfoConfig,
  AnnotationInfoProperty,
  AnnotationManagerProps,
  AnnotationSearchResult,
  FolderBrowserProps,
  Collection,
  Folder,
  Resource,
} from 'bdsa-react-components'
```

---

## Dependencies

### Peer Dependencies

- `react`: `^18.0.0`
- `react-dom`: `^18.0.0`

### Direct Dependencies

- `openseadragon`: `^5.0.1` - For slide viewer functionality
- `osd-paperjs-annotation`: GitHub package for annotation overlay
- `paper`: `^0.12.18` - For annotation rendering

---

## Styling

Import the CSS file to get default styling:

```tsx
import 'bdsa-react-components/styles.css'
```

Components use BEM-like naming with `bdsa-` prefix:
- Block: `.bdsa-component`
- Element: `.bdsa-component__element`
- Modifier: `.bdsa-component--modifier`

---

## Authentication

All components that make API requests (`SlideViewer`, `AnnotationManager`, `FolderBrowser`) support authentication via:

1. **Custom fetch function** (`fetchFn` prop) - Useful for adding authentication headers or interceptors
2. **Custom headers** (`apiHeaders` prop) - Direct way to add headers to requests

Example with authentication:

```tsx
const fetchWithAuth = async (url: string, options?: RequestInit) => {
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
}

<SlideViewer
  imageInfo={imageInfo}
  fetchFn={fetchWithAuth}
  // or alternatively:
  apiHeaders={{ 'Authorization': `Bearer ${token}` }}
/>
```

---

## Common Patterns

### Combining AnnotationManager and SlideViewer

```tsx
function SlideApp() {
  const [annotationIds, setAnnotationIds] = useState<string[]>([])
  const imageId = '6903df8dd26a6d93de19a9b2'

  return (
    <>
      <AnnotationManager
        imageId={imageId}
        apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
        onAnnotationsLoaded={(annotations) => {
          setAnnotationIds(annotations.map(a => a._id))
        }}
      />
      <SlideViewer
        imageInfo={{ dziUrl: `.../item/${imageId}/tiles/dzi.dzi` }}
        annotationIds={annotationIds}
        apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
        height="800px"
      />
    </>
  )
}
```

### Using FolderBrowser with SlideViewer

```tsx
function BrowseAndView() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex' }}>
      <FolderBrowser
        apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
        onResourceSelect={(resource) => {
          // Handle selection
        }}
      />
      {selectedItemId && (
        <SlideViewer
          imageInfo={{ dziUrl: `.../item/${selectedItemId}/tiles/dzi.dzi` }}
          height="800px"
        />
      )}
    </div>
  )
}
```

---

## Version

Current version: `0.1.0`

---

## License

Apache-2.0


