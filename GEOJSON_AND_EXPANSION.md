# GeoJSON Format Support & FolderBrowser Expansion Persistence

**Version:** 0.1.16  
**Date:** 2025-11-06

## Overview

This document details two major improvements added in v0.1.16:

1. **GeoJSON Format Auto-Detection**: SlideViewer now automatically detects and handles both GeoJSON FeatureCollection and DSA annotation formats
2. **FolderBrowser Expansion Persistence**: FolderBrowser can now remember which folders are expanded across page refreshes

Both features are **backward compatible** and require minimal changes to existing code.

---

## Part 1: GeoJSON Format Auto-Detection

### The Problem

Previously, `SlideViewer` only supported the DSA annotation format with an `elements` array. If your backend returned GeoJSON FeatureCollection format, you had to:
- Transform it to DSA format in your backend
- Or manually convert it in your frontend
- This added complexity, latency, and maintenance burden

### The Solution

`SlideViewer` now automatically:
1. Detects the annotation format (GeoJSON or DSA)
2. Transforms GeoJSON to DSA format internally
3. Renders annotations the same way regardless of source format

### Supported Formats

#### Format 1: GeoJSON FeatureCollection
```json
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]
            },
            "properties": {
                "lineColor": "#ff0000",
                "fillColor": "rgba(255,0,0,0.3)",
                "lineWidth": 2,
                "group": "region-1",
                "label": "Tumor Region"
            }
        }
    ]
}
```

#### Format 2: DSA Format (Original)
```json
{
    "annotation": {
        "elements": [
            {
                "type": "polyline",
                "points": [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]],
                "closed": true,
                "lineColor": "#ff0000",
                "fillColor": "rgba(255,0,0,0.3)",
                "lineWidth": 2,
                "group": "region-1",
                "label": "Tumor Region"
            }
        ]
    }
}
```

### Supported GeoJSON Geometry Types

| Geometry Type | Support | Conversion |
|--------------|---------|-----------|
| `Polygon` | ✅ Full | Exterior ring → closed polyline |
| `LineString` | ✅ Full | Coordinates → open polyline |
| `Point` | ✅ Full | Point → 8-point circle approximation |
| `MultiPolygon` | ⚠️ Planned | Not yet supported (warning logged) |
| `MultiLineString` | ⚠️ Planned | Not yet supported (warning logged) |
| `MultiPoint` | ⚠️ Planned | Not yet supported (warning logged) |

### Property Name Mapping

The library handles both GeoJSON and DSA property naming conventions:

| DSA Property | GeoJSON Alternative | Fallback Default |
|-------------|-------------------|------------------|
| `lineColor` | `stroke` | `#ff0000` |
| `fillColor` | `fill` | `rgba(255,0,0,0.3)` |
| `lineWidth` | `stroke-width` | `1` |
| `group` | `id` | `undefined` |
| `label` | `name` | `undefined` |

**Priority:** DSA-style names take precedence over GeoJSON-style names.

### Usage Examples

#### Example 1: Backend Returns GeoJSON (No Frontend Changes)

```typescript
import { SlideViewer } from 'bdsa-react-components'

// Your backend returns GeoJSON - no changes needed!
function MyViewer() {
    return (
        <SlideViewer
            imageInfo={{
                imageId: '123',
                annotationId: 'abc456', // Returns GeoJSON
                dziUrl: 'http://dsa.example.com/api/v1/item/123/tiles/dzi.dzi'
            }}
            apiBaseUrl="http://dsa.example.com/api/v1"
            height="600px"
        />
    )
}
```

The library automatically:
1. Fetches annotation from `/api/v1/annotation/abc456`
2. Detects it's GeoJSON FeatureCollection
3. Transforms to DSA format
4. Renders normally

#### Example 2: Using Utility Functions Directly

```typescript
import {
    extractAnnotationElements,
    detectAnnotationFormat,
    geoJSONToDSAElements,
    type DSAElement
} from 'bdsa-react-components'

// Example 1: Auto-detect and extract
const annotationDoc = await fetch('/api/annotations/123').then(r => r.json())
const format = detectAnnotationFormat(annotationDoc) // 'geojson' | 'dsa' | 'unknown'
console.log(`Detected format: ${format}`)

const elements: DSAElement[] = extractAnnotationElements(annotationDoc)
console.log(`Extracted ${elements.length} elements`)

// Example 2: Manual GeoJSON conversion
if (annotationDoc.type === 'FeatureCollection') {
    const dsaElements = geoJSONToDSAElements(annotationDoc)
    // Use dsaElements for custom rendering
}
```

#### Example 3: Mixed Format Backend

```typescript
// If your backend sometimes returns GeoJSON, sometimes DSA:
import { extractAnnotationElements, detectAnnotationFormat } from 'bdsa-react-components'

async function loadAnnotations(annotationIds: string[]) {
    const promises = annotationIds.map(id => 
        fetch(`/api/annotation/${id}`).then(r => r.json())
    )
    const docs = await Promise.all(promises)
    
    // Handle both formats seamlessly
    const allElements = docs.flatMap(doc => {
        const format = detectAnnotationFormat(doc)
        console.log(`Annotation format: ${format}`)
        return extractAnnotationElements(doc)
    })
    
    return allElements
}
```

### Console Logging

The library logs format detection for debugging:

```
Detected GeoJSON FeatureCollection format, transforming to DSA elements...
Annotation 6903df8ed26a6d93de19a9b4 format: geojson
```

For unknown formats, it logs helpful diagnostic info:

```
Unknown annotation format, expected GeoJSON FeatureCollection or DSA format. Got: {
    type: undefined,
    hasElements: false,
    hasAnnotation: false,
    keys: ['data', 'metadata', 'type', ...]
}
```

### TypeScript Support

Full TypeScript types are exported:

```typescript
import type { DSAElement } from 'bdsa-react-components'

interface GeoJSONFeature {
    type: 'Feature'
    geometry: {
        type: 'Polygon' | 'LineString' | 'Point' | 'MultiPolygon' | 'MultiLineString' | 'MultiPoint'
        coordinates: number[][] | number[][][] | number[]
    }
    properties?: {
        lineColor?: string
        fillColor?: string
        stroke?: string
        fill?: string
        'stroke-width'?: number
        lineWidth?: number
        group?: string
        id?: string
        label?: string
        name?: string
    }
}

interface GeoJSONFeatureCollection {
    type: 'FeatureCollection'
    features: GeoJSONFeature[]
}

const element: DSAElement = {
    type: 'polyline',
    points: [[0, 0], [100, 100]],
    closed: false,
    lineColor: '#ff0000',
    fillColor: 'rgba(255,0,0,0.3)',
    lineWidth: 2,
    group: 'my-group',
    label: 'My Annotation'
}
```

### Backend Migration Guide

If you were transforming GeoJSON to DSA format in your backend, you can now simplify:

**Before (Backend does transformation):**
```python
# backend/main.py - OLD WAY
@app.get("/annotation/{annotation_id}")
def get_annotation(annotation_id: str):
    # Fetch GeoJSON from database
    geojson = db.get_annotation(annotation_id)
    
    # Transform to DSA format (100+ lines of code)
    dsa_format = transform_geojson_to_dsa(geojson)
    
    return dsa_format
```

**After (Backend returns GeoJSON directly):**
```python
# backend/main.py - NEW WAY
@app.get("/annotation/{annotation_id}")
def get_annotation(annotation_id: str):
    # Just return GeoJSON directly!
    return db.get_annotation(annotation_id)
```

**Benefits:**
- ✅ Remove 100+ lines of transformation code
- ✅ Faster API responses (no transformation overhead)
- ✅ Standard GeoJSON format
- ✅ Frontend handles format transparently

---

## Part 2: FolderBrowser Expansion Persistence

### The Problem

When using `FolderBrowser` during development or testing:
- You expand folders to navigate to a specific location
- Page refresh → all folders collapse
- You have to re-expand everything to get back to where you were
- This is tedious and wastes time

### The Solution

FolderBrowser can now persist which folders and collections are expanded to `localStorage` and restore them on page refresh.

### Usage

#### Basic Usage

```typescript
import { FolderBrowser } from 'bdsa-react-components'

function MyApp() {
    return (
        <FolderBrowser
            apiBaseUrl="http://dsa.example.com/api/v1"
            apiHeaders={getAuthHeaders()}
            // Enable expansion persistence
            persistExpansion={true}
            // ... other props
        />
    )
}
```

#### Custom Storage Key

If you have multiple `FolderBrowser` instances and want separate persistence:

```typescript
<FolderBrowser
    persistExpansion={true}
    persistExpansionKey="my_app_main_browser"  // Custom key
    // ... other props
/>
```

#### Combined with Selection Persistence

Both features work seamlessly together:

```typescript
<FolderBrowser
    // Persist which folders are expanded
    persistExpansion={true}
    persistExpansionKey="my_app_expansion"
    
    // Persist which resource is selected
    persistSelection={true}
    persistSelectionKey="my_app_selection"
    
    // Auto-scroll to selected resource
    // (This happens automatically - no prop needed!)
    
    // ... other props
/>
```

### How It Works

#### Storage Format

Expansion state is stored in two `localStorage` keys:

1. **Collections**: `${persistExpansionKey}_collections`
   ```json
   ["collection-id-1", "collection-id-2"]
   ```

2. **Folders**: `${persistExpansionKey}_folders`
   ```json
   ["folder-id-1", "folder-id-2", "folder-id-3"]
   ```

#### Auto-Scroll Feature

When a resource is selected (either programmatically or restored from persistence), the component automatically:

1. Waits 100ms for DOM to update
2. Finds the element with `data-resource-id` matching the selected resource
3. Scrolls it into view with smooth animation
4. Centers it in the viewport

**This works automatically** - no additional props needed!

### Examples

#### Example 1: Development Workflow

```typescript
function DevWorkflow() {
    const [selectedFolder, setSelectedFolder] = useState(null)
    
    return (
        <div style={{ display: 'flex' }}>
            <FolderBrowser
                apiBaseUrl="http://dsa.example.com/api/v1"
                persistExpansion={true}    // Remember expanded folders
                persistSelection={true}     // Remember selected folder
                onResourceSelect={setSelectedFolder}
            />
            
            {selectedFolder && (
                <div>
                    <h3>{selectedFolder.name}</h3>
                    {/* Your content here */}
                </div>
            )}
        </div>
    )
}
```

**User Experience:**
1. User expands "Projects" → "2024" → "November"
2. User selects "Experiment-A" folder
3. User refreshes page
4. ✅ "Projects", "2024", "November" are still expanded
5. ✅ "Experiment-A" is still selected
6. ✅ Page auto-scrolls to "Experiment-A"

#### Example 2: Multiple Browsers

If you have multiple `FolderBrowser` components in different parts of your app:

```typescript
// Main browser in sidebar
<FolderBrowser
    persistExpansion={true}
    persistExpansionKey="sidebar_browser"
    persistSelection={true}
    persistSelectionKey="sidebar_selection"
/>

// Secondary browser in modal
<FolderBrowser
    persistExpansion={true}
    persistExpansionKey="modal_browser"
    persistSelection={true}
    persistSelectionKey="modal_selection"
/>
```

Each maintains its own independent state.

#### Example 3: Clear Persisted State

To programmatically clear persisted state:

```typescript
function clearFolderBrowserState() {
    // Clear expansion state
    localStorage.removeItem('bdsa_folder_browser_expansion_collections')
    localStorage.removeItem('bdsa_folder_browser_expansion_folders')
    
    // Clear selection state
    localStorage.removeItem('bdsa_folder_browser_selection')
    
    // Then refresh page
    window.location.reload()
}

// Add a button for this in your dev tools
<button onClick={clearFolderBrowserState}>
    Reset Folder Browser State
</button>
```

### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `persistExpansion` | `boolean` | `false` | Enable expansion state persistence |
| `persistExpansionKey` | `string` | `'bdsa_folder_browser_expansion'` | localStorage key prefix |
| `persistSelection` | `boolean` | `false` | Enable selection persistence (existing) |
| `persistSelectionKey` | `string` | `'bdsa_folder_browser_selection'` | localStorage key for selection |

### Implementation Details

#### Interaction with `persistSelection`

When `persistSelection` is enabled without `persistExpansion`:
- Selection is restored
- Parent folder/collection is auto-expanded (original behavior)

When both are enabled:
- Expansion state is restored from localStorage
- Selection is restored from localStorage
- Auto-scroll to selected item
- More granular control over UI state

#### Data Attributes

All rendered collections, folders, and items now have a `data-resource-id` attribute:

```html
<div class="bdsa-folder-browser__collection">
    <div class="bdsa-folder-browser__folder-header" data-resource-id="collection-123">
        📂 My Collection
    </div>
</div>
```

This enables:
- Auto-scroll functionality
- Easier E2E testing
- Custom UI enhancements

---

## API Reference

### Annotation Format Utilities

#### `extractAnnotationElements(annotationDoc: unknown): DSAElement[]`

Auto-detects format and extracts elements array. Returns empty array for invalid input.

**Example:**
```typescript
const elements = extractAnnotationElements(fetchedAnnotation)
```

#### `detectAnnotationFormat(annotationDoc: unknown): 'geojson' | 'dsa' | 'unknown'`

Identifies annotation format without transformation.

**Example:**
```typescript
const format = detectAnnotationFormat(fetchedAnnotation)
if (format === 'geojson') {
    console.log('GeoJSON detected')
}
```

#### `geoJSONToDSAElements(featureCollection: GeoJSONFeatureCollection): DSAElement[]`

Converts GeoJSON FeatureCollection to DSA elements array. Filters out invalid features.

**Example:**
```typescript
const dsaElements = geoJSONToDSAElements(geoJSONDoc)
```

#### `geoJSONFeatureToDSAElement(feature: GeoJSONFeature): DSAElement | null`

Converts a single GeoJSON Feature to DSA element. Returns `null` for unsupported or invalid features.

**Example:**
```typescript
const element = geoJSONFeatureToDSAElement(feature)
if (element) {
    renderElement(element)
}
```

#### `isGeoJSONFeatureCollection(obj: unknown): obj is GeoJSONFeatureCollection`

Type guard for GeoJSON FeatureCollection.

**Example:**
```typescript
if (isGeoJSONFeatureCollection(data)) {
    // TypeScript knows data is GeoJSONFeatureCollection
    console.log(`Found ${data.features.length} features`)
}
```

#### `isDSAAnnotation(obj: unknown): boolean`

Type guard for DSA annotation format.

**Example:**
```typescript
if (isDSAAnnotation(data)) {
    console.log('DSA format detected')
}
```

---

## Troubleshooting

### GeoJSON Not Detected

**Symptoms:**
- No annotations render
- Console shows "Unknown annotation format"

**Check:**
1. Verify your GeoJSON structure:
   ```typescript
   console.log('Annotation doc:', annotationDoc)
   console.log('Has type?', annotationDoc.type)
   console.log('Has features?', Array.isArray(annotationDoc.features))
   ```

2. Ensure `type: "FeatureCollection"` is present at root level
3. Ensure `features` is an array

**Fix:**
```typescript
// Bad - missing type field
{ features: [...] }

// Good - has type field
{ type: "FeatureCollection", features: [...] }
```

### Expansion State Not Persisting

**Symptoms:**
- Folders collapse on page refresh
- No localStorage entries created

**Check:**
1. Is `persistExpansion={true}` set?
2. Is localStorage enabled in your browser?
3. Check browser console for errors
4. Inspect localStorage:
   ```javascript
   console.log(localStorage.getItem('bdsa_folder_browser_expansion_collections'))
   console.log(localStorage.getItem('bdsa_folder_browser_expansion_folders'))
   ```

**Fix:**
- Enable cookies/localStorage in browser settings
- Check for private browsing mode (blocks localStorage)
- Verify no CSP policies blocking localStorage

### Auto-Scroll Not Working

**Symptoms:**
- Selected item not scrolled into view

**Check:**
1. Does the element have `data-resource-id` attribute?
   ```javascript
   document.querySelector('[data-resource-id="folder-123"]')
   ```

2. Is the element rendered? (May not be if parent is collapsed)

**Fix:**
- Ensure `persistExpansion` is enabled to expand parents
- Check that selected resource exists in current view

### GeoJSON Properties Not Mapping

**Symptoms:**
- Annotations render with default colors instead of specified colors

**Check:**
```typescript
// Your GeoJSON feature properties
{
    properties: {
        stroke: "#00ff00",  // Should map to lineColor
        fill: "rgba(0,255,0,0.5)",  // Should map to fillColor
        "stroke-width": 3  // Should map to lineWidth
    }
}
```

**Fix:**
The library handles this automatically. If not working:
1. Check property names are exactly as shown
2. Try using DSA-style names (`lineColor`, `fillColor`, `lineWidth`)
3. Check console for transformation warnings

---

## Testing

### Unit Tests

Run annotation format tests:
```bash
npm test -- annotationFormats
```

Tests cover:
- ✅ Format detection (GeoJSON, DSA, unknown)
- ✅ Polygon → polyline conversion
- ✅ LineString → polyline conversion
- ✅ Point → circle conversion
- ✅ Property name mapping
- ✅ Edge cases and invalid input
- ✅ Empty FeatureCollections
- ✅ Mixed format documents

### Manual Testing

#### Test GeoJSON Support:
1. Create endpoint returning GeoJSON
2. View in SlideViewer
3. Check console: "Detected GeoJSON FeatureCollection format"
4. Verify annotations render correctly

#### Test Expansion Persistence:
1. Open FolderBrowser with `persistExpansion={true}`
2. Expand several folders
3. Select a deeply nested folder
4. Refresh page
5. Verify folders remain expanded
6. Verify selection is restored
7. Verify page auto-scrolls to selection

---

## Migration Checklist

### For GeoJSON Support:

- [x] Update to `bdsa-react-components@0.1.15` or later
- [x] Test with existing DSA format annotations (should still work)
- [ ] If backend returns GeoJSON, verify it renders correctly
- [ ] Remove backend transformation code (optional)
- [ ] Update tests to handle both formats

### For Expansion Persistence:

- [ ] Add `persistExpansion={true}` to FolderBrowser
- [ ] Test expansion persists across refreshes
- [ ] Optionally customize `persistExpansionKey`
- [ ] Add "Clear State" button for development (optional)
- [ ] Update documentation for your users

---

## Performance Considerations

### GeoJSON Transformation
- Transformation happens once per annotation document
- O(n) where n = number of features
- Negligible overhead for typical annotation sizes (< 1000 features)
- For very large annotations (> 10000 features), consider pagination

### Expansion Persistence
- localStorage writes are synchronous but fast (< 1ms)
- Expansion state size: ~100 bytes per 10 expanded folders
- No performance impact on rendering or interaction

---

## Summary

### GeoJSON Support
✅ Automatic format detection  
✅ Transparent transformation  
✅ Backward compatible  
✅ No frontend changes required  
✅ Comprehensive test coverage

### Expansion Persistence
✅ Remember expanded folders  
✅ Auto-scroll to selection  
✅ Works with selection persistence  
✅ Customizable storage keys  
✅ Better development UX

**Both features require zero breaking changes and minimal integration effort!**

