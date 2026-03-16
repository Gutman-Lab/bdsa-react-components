# Critical Features - Integration Improvements

This document covers the three critical features added to simplify integration with DSA servers and improve user experience.

---

## 1. Token Query String Support for SlideViewer

### Problem
Some DSA servers require authentication tokens to be passed as query parameters (e.g., `?token=...`) for DZI and tile requests, not just in HTTP headers. This is especially common when OpenSeadragon makes direct tile requests that bypass custom fetch functions.

### Solution
Added `authToken` and `tokenQueryParam` props to `SlideViewer` that automatically append the authentication token to:
- DZI descriptor URLs
- Tile image URLs (both DZI and manual tile sources)
- Annotation API requests

### Usage

#### Basic Example with Token Query Parameter

```typescript
import { SlideViewer, useDsaAuth } from 'bdsa-react-components'

function MyViewer() {
    const { getAuthHeaders, authStatus } = useDsaAuth()
    
    return (
        <SlideViewer
            imageInfo={{
                dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/123/tiles/dzi.dzi'
            }}
            apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
            apiHeaders={getAuthHeaders()}
            // Enable token query parameter appending
            tokenQueryParam={true}
            // Token will be automatically extracted from apiHeaders
            height="600px"
        />
    )
}
```

#### Explicit Token Passing

```typescript
<SlideViewer
    imageInfo={{
        dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/123/tiles/dzi.dzi'
    }}
    apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
    // Explicitly provide the token
    authToken="your-auth-token-here"
    // Enable token query parameter appending
    tokenQueryParam={true}
    height="600px"
/>
```

#### Manual Tile Source with Token

```typescript
<SlideViewer
    imageInfo={{
        imageId: '123',
        width: 50000,
        height: 40000,
        tileWidth: 256,
        levels: 8,
        baseUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1'
    }}
    authToken={authStatus.token}
    tokenQueryParam={true}
    height="600px"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `authToken` | `string \| undefined` | `undefined` | Authentication token to use for requests. If not provided, will be extracted from `apiHeaders` |
| `tokenQueryParam` | `boolean` | `false` | If true, appends the token as a query parameter (`?token=...`) to all requests (DZI, tiles, annotations) |

### How it Works

1. **Token Extraction**: The component automatically extracts the token from:
   - The `authToken` prop (highest priority)
   - `Authorization` header (Bearer token)
   - `Girder-Token` header

2. **URL Modification**: When `tokenQueryParam={true}`:
   - DZI URL: `dzi.dzi` → `dzi.dzi?token=...`
   - Tile URL: `/tiles/0/0/0` → `/tiles/0/0/0?token=...`
   - Annotation URL: `/annotation/123` → `/annotation/123?token=...`

3. **Header Passthrough**: The `apiHeaders` are still sent with all requests, so servers that check headers will continue to work.

---

## 2. Large Image Detection Utility

### Problem
DSA items can have the `largeImage` flag stored in different locations:
- Root level: `item.largeImage`
- Metadata level: `item.meta.largeImage`

The flag can also have different types:
- Boolean: `true`
- String: `'true'`
- Object: `{ width: 1024, height: 768 }`

Manually checking all these cases is error-prone and repetitive.

### Solution
Added `hasLargeImage()` and `filterLargeImages()` utility functions that check BOTH locations and handle all flag types.

### Usage

#### Basic Filtering

```typescript
import { filterLargeImages, type Item } from 'bdsa-react-components'

function MyComponent({ items }: { items: Item[] }) {
    // Filter to only include items with largeImage flag
    const imageItems = filterLargeImages(items)
    
    return (
        <div>
            <h3>Found {imageItems.length} large images</h3>
            {imageItems.map(item => (
                <div key={item._id}>{item.name}</div>
            ))}
        </div>
    )
}
```

#### Individual Item Check

```typescript
import { hasLargeImage, type Item } from 'bdsa-react-components'

function ItemCard({ item }: { item: Item }) {
    const isLargeImage = hasLargeImage(item)
    
    return (
        <div className={isLargeImage ? 'large-image' : 'regular-file'}>
            <h4>{item.name}</h4>
            {isLargeImage && <span>🖼️ Viewable Image</span>}
        </div>
    )
}
```

#### Integration with FolderBrowser

```typescript
import { FolderBrowser, filterLargeImages, useDsaAuth } from 'bdsa-react-components'

function ImageBrowser() {
    const { getAuthHeaders, getConfig } = useDsaAuth()
    const [imageItems, setImageItems] = useState<Item[]>([])
    
    const handleFolderSelect = async (resource: Resource) => {
        if (resource.type === 'folder') {
            // Fetch items in the folder
            const response = await fetch(
                `${apiBaseUrl}/item?folderId=${resource._id}`,
                { headers: getAuthHeaders() }
            )
            const allItems = await response.json()
            
            // Filter to only large images
            const images = filterLargeImages(allItems)
            setImageItems(images)
        }
    }
    
    return (
        <>
            <FolderBrowser
                apiBaseUrl={apiBaseUrl}
                apiHeaders={getAuthHeaders()}
                onResourceSelect={handleFolderSelect}
            />
            <div>
                {imageItems.map(item => (
                    <ImageCard key={item._id} item={item} />
                ))}
            </div>
        </>
    )
}
```

### API

#### `hasLargeImage(item: Item): boolean`

Checks if an item has the `largeImage` flag set.

**Returns:** `true` if the item has `largeImage` flag (as `true`, `'true'`, or an object)

**Checks (in order):**
1. `item.largeImage` (root level)
2. `item.meta.largeImage` (metadata level)

**Examples:**

```typescript
// Root level boolean
hasLargeImage({ _id: '1', largeImage: true }) // => true

// Root level object
hasLargeImage({ _id: '2', largeImage: { width: 1024 } }) // => true

// Meta level boolean
hasLargeImage({ _id: '3', meta: { largeImage: true } }) // => true

// No flag
hasLargeImage({ _id: '4', name: 'doc.pdf' }) // => false
```

#### `filterLargeImages(items: Item[]): Item[]`

Filters an array of items to only include those with the `largeImage` flag.

**Returns:** Filtered array containing only items with `largeImage` flag

**Example:**

```typescript
const items = [
    { _id: '1', name: 'slide.svs', largeImage: true },
    { _id: '2', name: 'document.pdf' },
    { _id: '3', name: 'image.tif', meta: { largeImage: true } }
]

filterLargeImages(items) 
// => [{ _id: '1', ... }, { _id: '3', ... }]
```

---

## 3. Selection Persistence for FolderBrowser

### Problem
During development and testing, selected folders/items are lost on page refresh, forcing users to re-navigate the entire folder tree every time.

### Solution
Added `persistSelection` and `persistSelectionKey` props to `FolderBrowser` that automatically save and restore the selected resource using `localStorage`.

### Usage

#### Basic Persistence

```typescript
import { FolderBrowser, useDsaAuth } from 'bdsa-react-components'

function MyFolderBrowser() {
    const { getAuthHeaders } = useDsaAuth()
    
    return (
        <FolderBrowser
            apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
            apiHeaders={getAuthHeaders()}
            // Enable selection persistence
            persistSelection={true}
            onResourceSelect={(resource) => {
                console.log('Selected:', resource)
            }}
        />
    )
}
```

#### Custom Storage Key (Multiple Browsers)

If you have multiple `FolderBrowser` instances in your app, use different storage keys:

```typescript
function DataBrowser() {
    return (
        <div>
            {/* Main data browser */}
            <FolderBrowser
                persistSelection={true}
                persistSelectionKey="main_browser_selection"
                // ... other props
            />
            
            {/* Reference data browser */}
            <FolderBrowser
                persistSelection={true}
                persistSelectionKey="reference_browser_selection"
                // ... other props
            />
        </div>
    )
}
```

#### Reading Persisted Selection

The persisted selection is stored in `localStorage` and can be accessed programmatically:

```typescript
function getPersistedSelection() {
    try {
        const saved = localStorage.getItem('bdsa_folder_browser_selection')
        if (saved) {
            const parsed = JSON.parse(saved)
            console.log('Last selected:', parsed.resource)
            console.log('Selected at:', new Date(parsed.timestamp))
            return parsed.resource
        }
    } catch (error) {
        console.warn('Failed to read persisted selection:', error)
    }
    return null
}
```

#### Clearing Persisted Selection

```typescript
function clearPersistedSelection() {
    localStorage.removeItem('bdsa_folder_browser_selection')
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `persistSelection` | `boolean` | `false` | If true, persists the selected resource to `localStorage` and restores it on mount |
| `persistSelectionKey` | `string` | `'bdsa_folder_browser_selection'` | Custom key for `localStorage` persistence. Use different keys for multiple browser instances |

### How it Works

1. **Save on Selection**: When a resource (collection, folder, or item) is selected, it's saved to `localStorage` with a timestamp.

2. **Restore on Mount**: On component mount, if `persistSelection={true}`:
   - Reads from `localStorage` using the `persistSelectionKey`
   - Restores the `selectedResource` state
   - Auto-expands the selected collection/folder

3. **Data Format**: The persisted data structure:
   ```typescript
   {
       resource: {
           _id: "...",
           name: "...",
           type: "collection" | "folder" | "item",
           // ... other resource fields
       },
       timestamp: 1699999999999
   }
   ```

4. **Graceful Degradation**: If the resource no longer exists (e.g., deleted), the selection will be highlighted but the resource won't be visible. This is a best-effort restoration.

### Benefits

- **Better UX**: Users don't lose their place when refreshing the page
- **Faster Testing**: Developers can test deep folder structures without re-navigating
- **Context Preservation**: Maintains user's browsing context across sessions
- **Minimal Configuration**: Works out of the box with a single prop

---

## Integration Examples

### Complete Authentication + Persistence + Image Filtering

```typescript
import {
    FolderBrowser,
    SlideViewer,
    filterLargeImages,
    useDsaAuth,
    type Item,
    type Resource
} from 'bdsa-react-components'

function CompleteExample() {
    const { getAuthHeaders, authStatus } = useDsaAuth()
    const [selectedFolder, setSelectedFolder] = useState<Resource | null>(null)
    const [imageItems, setImageItems] = useState<Item[]>([])
    const [selectedImage, setSelectedImage] = useState<Item | null>(null)
    
    const apiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1'
    
    const handleFolderSelect = async (resource: Resource) => {
        setSelectedFolder(resource)
        
        if (resource.type === 'folder') {
            // Fetch items in the folder
            const response = await fetch(
                `${apiBaseUrl}/item?folderId=${resource._id}`,
                { headers: getAuthHeaders() }
            )
            const allItems = await response.json()
            
            // Filter to only large images
            const images = filterLargeImages(allItems)
            setImageItems(images)
        }
    }
    
    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            {/* Left: Folder Browser with persistence */}
            <div style={{ width: '300px', overflow: 'auto' }}>
                <FolderBrowser
                    apiBaseUrl={apiBaseUrl}
                    apiHeaders={getAuthHeaders()}
                    persistSelection={true}
                    onResourceSelect={handleFolderSelect}
                />
            </div>
            
            {/* Middle: Image List */}
            <div style={{ width: '200px', overflow: 'auto' }}>
                <h3>Images ({imageItems.length})</h3>
                {imageItems.map(item => (
                    <div
                        key={item._id}
                        onClick={() => setSelectedImage(item)}
                        style={{
                            padding: '8px',
                            cursor: 'pointer',
                            background: selectedImage?._id === item._id ? '#e0e0e0' : 'white'
                        }}
                    >
                        {item.name}
                    </div>
                ))}
            </div>
            
            {/* Right: Slide Viewer with token support */}
            <div style={{ flex: 1 }}>
                {selectedImage && (
                    <SlideViewer
                        imageInfo={{
                            imageId: selectedImage._id,
                            dziUrl: `${apiBaseUrl}/item/${selectedImage._id}/tiles/dzi.dzi`
                        }}
                        apiBaseUrl={apiBaseUrl}
                        apiHeaders={getAuthHeaders()}
                        authToken={authStatus.token}
                        tokenQueryParam={true}
                        height="100%"
                    />
                )}
            </div>
        </div>
    )
}
```

---

## Migration Guide

### From Manual Token Handling

**Before:**
```typescript
const fetchFn = (url: string, options = {}) => {
    const token = authStatus.token
    const separator = url.includes('?') ? '&' : '?'
    const urlWithToken = token ? `${url}${separator}token=${token}` : url
    return fetch(urlWithToken, {
        ...options,
        headers: { ...options.headers, ...getAuthHeaders() }
    })
}

<SlideViewer fetchFn={fetchFn} ... />
```

**After:**
```typescript
<SlideViewer
    authToken={authStatus.token}
    tokenQueryParam={true}
    apiHeaders={getAuthHeaders()}
    ...
/>
```

### From Manual Image Filtering

**Before:**
```typescript
const imageItems = allItems.filter(item => {
    const rootLargeImage = item.largeImage
    const metaLargeImage = item.meta?.largeImage
    return rootLargeImage === true || 
           rootLargeImage === 'true' || 
           (typeof rootLargeImage === 'object' && rootLargeImage !== null) ||
           metaLargeImage === true ||
           metaLargeImage === 'true' ||
           (typeof metaLargeImage === 'object' && metaLargeImage !== null)
})
```

**After:**
```typescript
import { filterLargeImages } from 'bdsa-react-components'

const imageItems = filterLargeImages(allItems)
```

### From Manual Selection Persistence

**Before:**
```typescript
const [selectedFolder, setSelectedFolder] = useState<Resource | null>(() => {
    const saved = localStorage.getItem('folder_selection')
    return saved ? JSON.parse(saved) : null
})

useEffect(() => {
    if (selectedFolder) {
        localStorage.setItem('folder_selection', JSON.stringify(selectedFolder))
    }
}, [selectedFolder])

<FolderBrowser onResourceSelect={setSelectedFolder} ... />
```

**After:**
```typescript
<FolderBrowser
    persistSelection={true}
    onResourceSelect={(resource) => {
        // Your selection logic here
    }}
    ...
/>
```

---

## Troubleshooting

### Token Query Parameter Not Working

**Problem:** Tiles fail to load with 401/403 errors even with `tokenQueryParam={true}`

**Solutions:**
1. Verify token is being extracted: check `authStatus.token` or `apiHeaders`
2. Check browser DevTools Network tab to confirm `?token=...` is in the URL
3. Verify your DSA server accepts tokens in query parameters
4. Ensure `apiHeaders` are also set (some endpoints may check both)

### hasLargeImage Not Detecting Images

**Problem:** `hasLargeImage()` returns false for items that are actually images

**Solutions:**
1. Check the actual data structure: `console.log(item)`
2. Verify `largeImage` field exists at root or in `meta`
3. Check if the field value is truthy (not `false`, `null`, or missing)

### Selection Not Persisting

**Problem:** Selected resource is lost on page refresh even with `persistSelection={true}`

**Solutions:**
1. Check browser console for localStorage errors
2. Verify localStorage is enabled in the browser
3. Check if multiple components are using the same `persistSelectionKey`
4. Clear localStorage: `localStorage.removeItem('bdsa_folder_browser_selection')`

---

## Performance Considerations

### Token Query Parameters
- Minimal performance impact - only modifies URLs before requests
- Token is extracted once per component mount and memoized
- No additional API calls

### Image Filtering
- O(n) operation - filters once per item list
- Consider memoization for large lists:
  ```typescript
  const imageItems = useMemo(
      () => filterLargeImages(allItems),
      [allItems]
  )
  ```

### Selection Persistence
- localStorage writes are synchronous but fast (< 1ms typically)
- Only saves on selection change (not on every render)
- Consider debouncing for very frequent selection changes

---

## Browser Compatibility

All features are compatible with modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requirements:
- localStorage support (all modern browsers)
- ES6+ JavaScript support







