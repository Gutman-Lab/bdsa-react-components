# bdsa-react-components v0.1.16 - Integration Update

## 🎯 What's New

Five powerful features added to simplify your integration work:

### Version 0.1.16 (Latest)
1. **GeoJSON Format Auto-Detection** - Seamless annotation format support
2. **Expansion State Persistence** - Remember which folders are expanded
3. **Auto-Scroll to Selection** - Enhanced navigation UX

### Version 0.1.14
4. **Token Query String Support** - Fix authenticated tile loading
5. **Large Image Filtering** - Easy DSA item filtering
6. **Selection Persistence** - Better development UX

---

## 📦 Installation

Update your package:

```bash
npm install bdsa-react-components@latest
# or
npm install bdsa-react-components@0.1.16
```

---

## NEW in v0.1.16 🎉

### 1. GeoJSON Format Auto-Detection

**What It Does:**  
SlideViewer now automatically detects and handles both GeoJSON FeatureCollection and DSA annotation formats - no code changes needed!

**The Problem:**  
Your backend returns GeoJSON, but SlideViewer expected DSA format. You had to transform in backend or frontend.

**The Solution:**  
```typescript
// Your backend returns GeoJSON? Just use it!
<SlideViewer
    imageInfo={{ annotationId: '123' }}
    apiBaseUrl="..."
/>
// That's it! Auto-detects GeoJSON and transforms internally
```

**Supported Formats:**
- ✅ GeoJSON FeatureCollection (Polygon, LineString, Point)
- ✅ DSA format (elements array)
- ✅ Both root-level and nested elements
- ✅ Property name mapping (stroke→lineColor, fill→fillColor, etc.)

**Benefits:**
- Remove backend transformation code
- Standard GeoJSON format
- Backward compatible
- Faster API responses

**See:** `GEOJSON_AND_EXPANSION.md` for complete documentation

---

### 2. FolderBrowser Expansion Persistence

**What It Does:**  
Remember which folders/collections are expanded across page refreshes.

**The Problem:**  
Every time you refresh during dev/testing, all folders collapse. You have to re-expand everything.

**The Solution:**  
```typescript
<FolderBrowser
    persistExpansion={true}  // That's it!
    // ... other props
/>
```

**What Happens:**
1. Expand folders → saved to localStorage
2. Refresh page → folders still expanded
3. Navigate faster during development

**Pro Tip - Use Both:**
```typescript
<FolderBrowser
    persistExpansion={true}   // Remember expanded state
    persistSelection={true}    // Remember selected item
    // Auto-scroll to selection happens automatically!
/>
```

---

### 3. Auto-Scroll to Selection

**What It Does:**  
Automatically scrolls to selected resource (folder/collection/item).

**No Configuration Needed:**  
This feature is always active - when a resource is selected, the component:
1. Waits for DOM to update (100ms)
2. Finds the selected element
3. Smoothly scrolls it into view
4. Centers it in the viewport

**Works With:**
- Manual selection (clicking)
- Programmatic selection (`setSelectedResource`)
- Restored selection (from `persistSelection`)

---

## Version 0.1.14 Features

### 4. Fix Authenticated Tile Loading

### Problem You Had
Tiles fail to load with 401/403 errors because DSA servers need `?token=...` in the URL, not just headers.

### Solution

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
            // 🆕 NEW: Enable token query parameter
            tokenQueryParam={true}
            // 🆕 NEW: Token automatically extracted from apiHeaders
            height="600px"
        />
    )
}
```

**Before vs After:**
- ❌ Before: `/tiles/0/0/0` → 401 Unauthorized
- ✅ After: `/tiles/0/0/0?token=abc123` → Success

---

## 2. Filter Items by Large Image Flag

### Problem You Had
Manual filtering with messy checks for `item.largeImage` at root AND `item.meta.largeImage`.

### Solution

```typescript
import { filterLargeImages, type Item } from 'bdsa-react-components'

// Before (messy manual filtering):
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

// 🆕 After (clean one-liner):
const imageItems = filterLargeImages(allItems)
```

**Integration Example:**

```typescript
const handleFolderSelect = async (resource: Resource) => {
    if (resource.type === 'folder') {
        const response = await fetch(
            `${apiBaseUrl}/item?folderId=${resource._id}`,
            { headers: getAuthHeaders() }
        )
        const allItems = await response.json()
        
        // 🆕 Filter to only viewable images
        const images = filterLargeImages(allItems)
        setImageItems(images)
    }
}
```

---

## 3. Persist Folder Selection Across Refreshes

### Problem You Had
Lose selected folder/item on page refresh, have to re-navigate every time during testing.

### Solution

```typescript
import { FolderBrowser, useDsaAuth } from 'bdsa-react-components'

function MyFolderBrowser() {
    const { getAuthHeaders } = useDsaAuth()
    
    return (
        <FolderBrowser
            apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"
            apiHeaders={getAuthHeaders()}
            // 🆕 NEW: Enable selection persistence
            persistSelection={true}
            // 🆕 Optional: Custom storage key if you have multiple browsers
            persistSelectionKey="my_app_folder_selection"
            onResourceSelect={(resource) => {
                console.log('Selected:', resource)
            }}
        />
    )
}
```

**What It Does:**
- ✅ Saves selected folder/item to localStorage on selection
- ✅ Restores selection on page refresh
- ✅ Auto-expands the selected resource
- ✅ Better UX during development/testing

---

## Complete Integration Example

Here's how to use all three features together:

```typescript
import {
    FolderBrowser,
    SlideViewer,
    filterLargeImages,
    useDsaAuth,
    type Item,
    type Resource
} from 'bdsa-react-components'
import { useState } from 'react'

function MyApp() {
    const { getAuthHeaders, authStatus } = useDsaAuth()
    const [selectedFolder, setSelectedFolder] = useState<Resource | null>(null)
    const [imageItems, setImageItems] = useState<Item[]>([])
    const [selectedImage, setSelectedImage] = useState<Item | null>(null)
    
    const apiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1'
    
    const handleFolderSelect = async (resource: Resource) => {
        setSelectedFolder(resource)
        
        if (resource.type === 'folder') {
            const response = await fetch(
                `${apiBaseUrl}/item?folderId=${resource._id}`,
                { headers: getAuthHeaders() }
            )
            const allItems = await response.json()
            
            // 🆕 Filter to only large images
            const images = filterLargeImages(allItems)
            setImageItems(images)
        }
    }
    
    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            {/* Folder Browser with persistence */}
            <div style={{ width: '300px' }}>
                <FolderBrowser
                    apiBaseUrl={apiBaseUrl}
                    apiHeaders={getAuthHeaders()}
                    persistSelection={true} // 🆕 Persist selection
                    onResourceSelect={handleFolderSelect}
                />
            </div>
            
            {/* Image List */}
            <div style={{ width: '200px' }}>
                {imageItems.map(item => (
                    <div
                        key={item._id}
                        onClick={() => setSelectedImage(item)}
                    >
                        {item.name}
                    </div>
                ))}
            </div>
            
            {/* Slide Viewer with token support */}
            <div style={{ flex: 1 }}>
                {selectedImage && (
                    <SlideViewer
                        imageInfo={{
                            imageId: selectedImage._id,
                            dziUrl: `${apiBaseUrl}/item/${selectedImage._id}/tiles/dzi.dzi`
                        }}
                        apiBaseUrl={apiBaseUrl}
                        apiHeaders={getAuthHeaders()}
                        tokenQueryParam={true} // 🆕 Enable token in URL
                        height="100%"
                    />
                )}
            </div>
        </div>
    )
}
```

---

## Quick Migration Checklist

### For SlideViewer (fix tile loading):
- [ ] Add `tokenQueryParam={true}` prop
- [ ] Token is auto-extracted from `apiHeaders` - no other changes needed
- [ ] Test that tiles load without 401/403 errors

### For Image Filtering:
- [ ] Import `filterLargeImages` from `bdsa-react-components`
- [ ] Replace manual filtering logic with `filterLargeImages(items)`
- [ ] Remove old filtering code

### For FolderBrowser (optional UX improvement):
- [ ] Add `persistSelection={true}` prop
- [ ] Test that selection persists across page refreshes
- [ ] Consider custom `persistSelectionKey` if you have multiple browsers

---

## Troubleshooting

### Tiles still fail to load with 401/403

**Check:**
1. Is `tokenQueryParam={true}` set?
2. Are `apiHeaders` provided with a valid token?
3. Look at browser DevTools Network tab - do you see `?token=...` in tile URLs?

**Solution:**
```typescript
// Make sure both props are set:
<SlideViewer
    apiHeaders={getAuthHeaders()}  // ✅ Provides headers AND token
    tokenQueryParam={true}          // ✅ Enables token in query string
    ...
/>
```

### hasLargeImage not detecting images

**Check:**
Look at the actual data:
```typescript
console.log('Item data:', item)
console.log('Root largeImage:', item.largeImage)
console.log('Meta largeImage:', item.meta?.largeImage)
```

**Common causes:**
- Item doesn't actually have `largeImage` flag (it's a regular file)
- Flag is `false` or `null`
- Check your DSA server's item structure

### Selection not persisting

**Check:**
1. Is `persistSelection={true}` set?
2. Check browser console for localStorage errors
3. Is localStorage enabled in your browser?

**Clear and retry:**
```javascript
localStorage.removeItem('bdsa_folder_browser_selection')
// Then refresh page
```

---

## API Reference Summary

### SlideViewer New Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `authToken` | `string \| undefined` | `undefined` | Explicit auth token (auto-extracted from apiHeaders if not provided) |
| `tokenQueryParam` | `boolean` | `false` | Append token as query param to all requests |

### Utility Functions

```typescript
// Check if item has largeImage flag
hasLargeImage(item: Item): boolean

// Filter array to only items with largeImage flag  
filterLargeImages(items: Item[]): Item[]
```

### FolderBrowser New Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `persistSelection` | `boolean` | `false` | Enable selection persistence |
| `persistSelectionKey` | `string` | `'bdsa_folder_browser_selection'` | localStorage key for persistence |

---

## Need More Details?

See the full documentation in the library:
- `CRITICAL_FEATURES.md` - Complete guide with examples
- `CHANGELOG.md` - Full release notes
- `BACKPORT_IMPROVEMENTS.md` - Implementation details

---

## Summary

**Three simple changes = Better integration:**

1. ✅ **Add `tokenQueryParam={true}`** to SlideViewer → Fix tile loading
2. ✅ **Use `filterLargeImages(items)`** → Cleaner code
3. ✅ **Add `persistSelection={true}`** to FolderBrowser → Better UX

**All backward compatible** - your existing code still works!



