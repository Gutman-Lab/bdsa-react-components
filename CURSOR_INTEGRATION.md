# bdsa-react-components - CURSOR Integration Guide

**Version:** 0.1.1 | **Generated:** 2025-11-01T19:28:45.900Z

> This document provides everything Cursor needs to integrate and use the bdsa-react-components library.
> Copy this entire document into your project's .cursorrules or docs folder.
> **Auto-generated from source code** - Updated automatically on build.

## Quick Start

### Published Package (when available)

```bash
npm install bdsa-react-components
```

### Local Development (npm link)

If the library is local/unpublished, use npm link:

**Step 1:** In the library directory (`bdsaReactComponents`):
```bash
npm link
```

**Step 2:** In your project directory:
```bash
npm link bdsa-react-components
```

**Step 3:** Install peer dependencies in your project (if not already installed):
```bash
npm install react@^18.0.0 react-dom@^18.0.0
```

**Note:** After making changes to the library, rebuild it:
```bash
# In library directory
npm run build
```

### Import

```tsx
import { AnnotationManager, Button, Card, FolderBrowser, SlideViewer } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'
```

## Components API

### AnnotationManager

AnnotationManager component

**Example:**

```tsx
<AnnotationManager
  imageId="6903df8dd26a6d93de19a9b2"
  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
  onAnnotationsLoaded={(anns) => console.log(anns)}
/>
```

**API Endpoints:**

- `GET /annotation?itemId={id}&limit={limit}&offset=0` - Search annotations by itemId

### Button

A versatile button component for the BDSA project

**Extends:** `React.ButtonHTMLAttributes<HTMLButtonElement>`

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'success'` | `'primary'` | No | The variant style of the button |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | No | The size of the button |
| `fullWidth` | `boolean` | `false` | No | Whether the button should take the full width of its container |
| `loading` | `boolean` | `false` | No | Whether the button is in a loading state |

### Card

A flexible card component for the BDSA project

**Extends:** `React.HTMLAttributes<HTMLDivElement>`

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `header` | `React.ReactNode` | `undefined` | No | Optional header content |
| `footer` | `React.ReactNode` | `undefined` | No | Optional footer content |
| `shadow` | `'none' \| 'small' \| 'medium' \| 'large'` | `'small'` | No | Whether the card has a shadow |
| `bordered` | `boolean` | `true` | No | Whether the card has a border |
| `hoverable` | `boolean` | `false` | No | Whether the card is hoverable (shows hover effect) |
| `padding` | `'none' \| 'small' \| 'medium' \| 'large'` | `'medium'` | No | Padding size |

### FolderBrowser

FolderBrowser component

**Example:**

```tsx
<FolderBrowser
  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
  onResourceSelect={(resource) => console.log(resource)}
/>
```

**API Endpoints:**

- `GET /collection` - List collections
- `GET /folder?parentType={type}&parentId={id}` - List folders

### SlideViewer

A slide viewer component that integrates OpenSeadragon with Paper.js annotations for viewing Digital Slide Archive images with annotation overlays.

**Example:**

```tsx
<SlideViewer
  imageInfo={{
    dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/IMAGE_ID/tiles/dzi.dzi'
  }}
  annotations={[]}
  height="800px"
/>
```

**API Endpoints:**

- `GET /annotation/{id}` - Fetch annotation document by ID

## Type Definitions

Import types:

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

### Key Types

**SlideImageInfo:**
```typescript
interface SlideImageInfo {
  imageId?: string | number
  width?: number
  height?: number
  tileWidth?: number
  levels?: number
  baseUrl?: string
  http: //bdsa.pathology.emory.edu:8080/api/v1/item/{itemId
}
```

## Authentication

Components making API calls (`SlideViewer`, `AnnotationManager`, `FolderBrowser`) support auth via:

1. **`fetchFn` prop:** Custom fetch function `(url: string, options?: RequestInit) => Promise<Response>`
2. **`apiHeaders` prop:** Headers object `HeadersInit`

**Example:**

```tsx
const fetchWithAuth = async (url: string, options?: RequestInit) => {
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'Authorization': `Bearer ${token}`,
    },
  })
}

<SlideViewer
  imageInfo={{ dziUrl: '...' }}
  fetchFn={fetchWithAuth}
  // OR: apiHeaders={{ 'Authorization': `Bearer ${token}` }}
/>
```

## Common Integration Patterns

### 1. SlideViewer with Manual Annotations

```tsx
<SlideViewer
  imageInfo={{
    dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/IMAGE_ID/tiles/dzi.dzi'
  }}
  annotations={[
    { id: 'ann-1', left: 100, top: 200, width: 150, height: 100, color: '#ff0000' }
  ]}
  height="800px"
  onAnnotationClick={(ann) => console.log(ann)}
/>
```

### 2. SlideViewer with API-Fetched Annotations

```tsx
const [annotationIds, setAnnotationIds] = useState<string[]>([])
const imageId = '6903df8dd26a6d93de19a9b2'

<>
  <AnnotationManager
    imageId={imageId}
    apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
    onAnnotationsLoaded={(anns) => setAnnotationIds(anns.map(a => a._id))}
  />
  <SlideViewer
    imageInfo={{ dziUrl: `.../item/${imageId}/tiles/dzi.dzi` }}
    annotationIds={annotationIds}
    apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
    height="800px"
  />
</>
```

### 3. FolderBrowser

```tsx
<FolderBrowser
  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
  showCollections={true}
  onResourceSelect={(resource) => console.log(resource)}
  foldersPerPage={50}
/>
```

## Important Notes

- **SlideViewer height:** Must specify explicit `height` prop (e.g., `"600px"`, `"100vh"`) - OpenSeadragon requirement
- **DZI URL vs Manual:** Provide either `dziUrl` OR all manual fields (`imageId`, `width`, `height`, `tileWidth`, `levels`, `baseUrl`)
- **Annotations format:** Accepts `AnnotationFeature[]` or GeoJSON `FeatureCollection`
- **API Base URL:** Format: `http://bdsa.pathology.emory.edu:8080/api/v1` (no trailing slash)
- **Styles:** Always import `'bdsa-react-components/styles.css'`
- **Peer deps:** Requires React 18+

## Troubleshooting (npm link)

**"Module not found" error:**
- Ensure `npm link` was run in the library directory
- Ensure `npm link bdsa-react-components` was run in your project
- Check that `node_modules/bdsa-react-components` is a symlink (not a regular folder)
- Try removing and re-linking: `npm unlink bdsa-react-components && npm link bdsa-react-components`

**Styles not loading:**
- Ensure you've imported `'bdsa-react-components/styles.css'`
- Check that the CSS file exists at `node_modules/bdsa-react-components/dist/style.css`

**Changes not appearing:**
- Rebuild the library: `cd /path/to/bdsaReactComponents && npm run build`
- Restart your dev server (Vite/CRA/etc) after rebuilding
- For faster iteration, run `npm run build -- --watch` in the library directory

**TypeScript errors:**
- Ensure `dist/index.d.ts` exists in the library
- Restart TypeScript server in your editor (VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server")

## Dependencies

**Peer:** react ^18.0.0, react-dom ^18.0.0

**Direct:** openseadragon ^5.0.1, osd-paperjs-annotation, paper ^0.12.18

---

_Auto-generated from source code - Regenerate with: npm run generate:cursor-doc_
