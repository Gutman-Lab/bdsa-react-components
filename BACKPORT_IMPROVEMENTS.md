# Backport Improvements to bdsa-react-components

This document tracks improvements, patterns, and features discovered during integration that should be ported back to the `bdsa-react-components` library to simplify future integrations.

## Table of Contents
1. [FolderBrowser Improvements](#folderbrowser-improvements)
2. [Authentication Integration](#authentication-integration)
3. [Thumbnail Browser Patterns](#thumbnail-browser-patterns)
4. [Image Detection & Filtering](#image-detection--filtering)
5. [Pagination Patterns](#pagination-patterns)
6. [CSS & Styling Improvements](#css--styling-improvements)

---

## FolderBrowser Improvements

### 1. Single-Click Folder Selection

**Current Issue:**
- `onResourceSelect` only fires on double-click
- When using `renderFolder` to customize, it breaks subfolder rendering (no access to subfolders data)
- Need single-click selection while preserving default subfolder rendering

**Proposed Library Enhancement:**
- Add `onFolderClick?: (folder: Folder) => void` callback that fires on single-click
- Or enhance `renderFolder` to receive subfolders: `renderFolder?: (folder: Folder, depth: number, isExpanded: boolean, onToggle: () => void, subfolders: Folder[], renderSubfolder: (subfolder: Folder) => React.ReactNode) => React.ReactNode`
- Or add `selectOnClick?: boolean` prop that makes single-click trigger `onResourceSelect`

**File to Update:**
- `/Users/dagutman/devel/bdsa-react-components/src/components/FolderBrowser/FolderBrowser.tsx`

### 2. Persist Selected Folder/Item Across Browser Refresh

**Current Issue:**
- When testing, selected folder/item state is lost on page refresh
- Users have to re-navigate and re-select folders/items every time

**Proposed Library Enhancement:**
- Add `persistSelection?: boolean` prop to `FolderBrowser`
- When enabled, save selected folder/item ID to `localStorage` (e.g., `bdsa_folder_browser_selection`)
- On mount, restore selection from `localStorage` and auto-expand/select if folder still exists
- Add `persistSelectionKey?: string` prop to allow custom storage key per instance

**Implementation Pattern:**
```typescript
// In FolderBrowser component
useEffect(() => {
  if (persistSelection && !selectedResource) {
    const saved = localStorage.getItem(persistSelectionKey || 'bdsa_folder_browser_selection');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Restore selection and expand parent folders
      handleResourceSelect(parsed.resource);
      expandPathToFolder(parsed.resource._id);
    }
  }
}, []);

// Save on selection change
useEffect(() => {
  if (persistSelection && selectedResource) {
    localStorage.setItem(
      persistSelectionKey || 'bdsa_folder_browser_selection',
      JSON.stringify({ resource: selectedResource, timestamp: Date.now() })
    );
  }
}, [selectedResource, persistSelection, persistSelectionKey]);
```

**File to Update:**
- `/Users/dagutman/devel/bdsa-react-components/src/components/FolderBrowser/FolderBrowser.tsx`

**Benefits:**
- Better UX during development/testing
- Preserves user's navigation context
- Can be optionally enabled per instance

### 3. Load Items Without Displaying Them

**Current Issue:**
- Setting `showItems={false}` prevents items from loading entirely
- When you need items for thumbnail generation but don't want them in the FolderBrowser UI

**Solution Implemented:**
```javascript
// Enable item loading but hide them with CSS
<FolderBrowser
  showItems={true}  // Load items
  // ... other props
/>
<style>{`
  .bdsa-folder-browser__item {
    display: none !important;
  }
`}</style>
```

**Proposed Library Enhancement:**
- Add `loadItems={true}` prop (separate from `showItems`)
- Or add `hideItems={true}` prop that loads but doesn't render
- This would be cleaner than requiring CSS workarounds

**File to Update:**
- `/Users/dagutman/devel/bdsa-react-components/src/components/FolderBrowser/FolderBrowser.tsx`

---

## Authentication Integration

### 1. Token in Query String for DZI Tile Requests

**Current Issue:**
- DZI tile requests (from OpenSeadragon) require authentication token in query string
- Some DSA servers require `?token=<token>` parameter, not just headers
- `apiHeaders` alone doesn't work for tile requests - need both headers AND query string

**Solution Implemented:**
```javascript
// Custom fetchFn that adds token to query string
fetchFn={(url, options = {}) => {
    // Extract token from authToken prop or from headers
    let token = authToken;
    if (!token && apiHeaders) {
        if (apiHeaders['Authorization']) {
            const authHeader = apiHeaders['Authorization'];
            token = authHeader.startsWith('Bearer ') 
                ? authHeader.substring(7) 
                : authHeader;
        } else if (apiHeaders['Girder-Token']) {
            token = apiHeaders['Girder-Token'];
        }
    }
    
    // Append token to query string
    let finalUrl = url;
    if (token) {
        const separator = url.includes('?') ? '&' : '?';
        finalUrl = `${url}${separator}token=${encodeURIComponent(token)}`;
    }
    
    return fetch(finalUrl, {
        ...options,
        headers: {
            ...options.headers,
            ...(apiHeaders || {}),
        },
    });
}}
```

**Proposed Library Enhancement:**
- Add `tokenQueryParam?: boolean` prop to `SlideViewer` (default: `false`)
- When enabled, automatically extract token from `apiHeaders` or `authToken` prop
- Append `?token=<token>` or `&token=<token>` to all fetch requests (DZI XML and tiles)
- Also add token to the initial `dziUrl` if provided in `imageInfo.dziUrl`

**Files to Update:**
- `/Users/dagutman/devel/bdsa-react-components/src/components/SlideViewer/SlideViewer.tsx`

**Alternative Approach:**
- Enhance `fetchFn` prop to automatically handle token extraction if not provided
- Or add `authToken?: string` prop that can be passed directly (cleaner API)

### 2. Default Server URL Configuration

**Current Pattern:**
```javascript
// Set default DSA server URL if not already configured
React.useEffect(() => {
    const config = dsaAuthStore.getConfig();
    if (!config.baseUrl) {
        dsaAuthStore.updateConfig({ baseUrl: 'http://bdsa.pathology.emory.edu:8080' });
    }
}, []);
```

**Proposed Library Enhancement:**
- Add `defaultBaseUrl` prop to `DsaAuthManager`
- Or add initialization method: `dsaAuthStore.initialize({ defaultBaseUrl: '...' })`
- This would eliminate the need for manual `useEffect` hooks in every app

**File to Update:**
- `/Users/dagutman/devel/bdsa-react-components/src/auth/DsaAuthStore.ts`
- `/Users/dagutman/devel/bdsa-react-components/src/components/DsaAuthManager/DsaAuthManager.tsx`

---

## Thumbnail Browser Patterns

### 1. Folder-to-Thumbnail Browser Integration

**Pattern:**
```javascript
const [selectedFolderId, setSelectedFolderId] = useState(null);

const handleFolderSelect = useCallback((resource) => {
    if (resource.type === 'folder') {
        setSelectedFolderId(resource._id);
    }
}, []);

// Side-by-side layout
<FolderBrowser onResourceSelect={handleFolderSelect} />
{selectedFolderId && <ThumbnailBrowser folderId={selectedFolderId} />}
```

**Proposed Library Enhancement:**
- Create a `FolderBrowserWithThumbnails` composite component
- Or add example/story showing this pattern
- Could include built-in thumbnail viewer using SlideViewer

**Files to Create:**
- `/Users/dagutman/devel/bdsa-react-components/src/components/FolderBrowserWithThumbnails/FolderBrowserWithThumbnails.tsx`
- `/Users/dagutman/devel/bdsa-react-components/src/components/FolderBrowserWithThumbnails/FolderBrowserWithThumbnails.stories.tsx`

---

## Image Detection & Filtering

### 1. LargeImage Flag Detection

**Current Pattern:**
```javascript
// Filter items that have largeImage flag
// IMPORTANT: largeImage can be at ROOT level OR in meta.largeImage
const imageItems = data.filter(item => {
    // Check root level first (most common location)
    const rootLargeImage = item.largeImage;
    const rootHasLargeImage = rootLargeImage === true || 
                              rootLargeImage === 'true' || 
                              (typeof rootLargeImage === 'object' && rootLargeImage !== null);
    
    // Also check meta.largeImage as fallback
    const meta = item.meta || {};
    const metaLargeImage = meta.largeImage;
    const metaHasLargeImage = metaLargeImage === true || 
                             metaLargeImage === 'true' || 
                             (typeof metaLargeImage === 'object' && metaLargeImage !== null);
    
    return rootHasLargeImage || metaHasLargeImage;
});
```

**Proposed Library Enhancement:**
- Add utility function: `hasLargeImage(item: Item): boolean` that checks BOTH root and meta
- Add `filterByLargeImage` prop to FolderBrowser
- Or add `itemFilter` prop that accepts a function: `(item: Item) => boolean`

**Files to Create/Update:**
- `/Users/dagutman/devel/bdsa-react-components/src/utils/itemUtils.ts`
- `/Users/dagutman/devel/bdsa-react-components/src/components/FolderBrowser/FolderBrowser.tsx`

**Example:**
```typescript
export function hasLargeImage(item: Item): boolean {
    // Check root level first (most common location based on actual DSA data)
    const rootLargeImage = item.largeImage;
    const rootHasLargeImage = rootLargeImage === true || 
                             rootLargeImage === 'true' || 
                             (typeof rootLargeImage === 'object' && rootLargeImage !== null);
    
    // Also check meta.largeImage as fallback
    const meta = item.meta || {};
    const metaLargeImage = meta.largeImage;
    const metaHasLargeImage = metaLargeImage === true || 
                             metaLargeImage === 'true' || 
                             (typeof metaLargeImage === 'object' && metaLargeImage !== null);
    
    return rootHasLargeImage || metaHasLargeImage;
}
```

---

## Pagination Patterns

### 1. Thumbnail Grid Pagination

**Current Implementation:**
- Configurable items per page (default: 12, but often set to 5 for performance)
- Bootstrap Pagination component
- Page number calculation
- **Pagination at TOP of list** (better UX - users see controls before scrolling)

**Proposed Library Enhancement:**
- Create `ThumbnailGrid` component with built-in pagination
- Configurable items per page (default: 12)
- Pagination position prop: `paginationPosition?: 'top' | 'bottom' | 'both'` (default: 'top')
- Virtual scrolling for large datasets (optional, for performance)

**Files to Create:**
- `/Users/dagutman/devel/bdsa-react-components/src/components/ThumbnailGrid/ThumbnailGrid.tsx`

**Props:**
```typescript
interface ThumbnailGridProps {
    items: Item[];
    itemsPerPage?: number;  // Default: 12
    thumbnailSize?: number;  // Default: 512
    paginationPosition?: 'top' | 'bottom' | 'both';  // Default: 'top'
    onItemSelect?: (item: Item) => void;
    renderThumbnail?: (item: Item) => React.ReactNode;
}
```

**Implementation Notes:**
- Place pagination controls at top by default (better UX)
- Show page count and navigation controls
- Support ellipsis for large page counts

---

## CSS & Styling Improvements

### 1. Item Hiding CSS Class

**Current Workaround:**
```css
.bdsa-folder-browser__item {
    display: none !important;
}
```

**Proposed Library Enhancement:**
- Add `.bdsa-folder-browser__item--hidden` class
- Or add `hidden` prop to FolderBrowser that applies the class automatically

**File to Update:**
- `/Users/dagutman/devel/bdsa-react-components/src/components/FolderBrowser/FolderBrowser.css`
- `/Users/dagutman/devel/bdsa-react-components/src/components/FolderBrowser/FolderBrowser.tsx`

---

## Integration Best Practices

### 1. Consistent API URL Handling

**Pattern:**
```javascript
const { getAuthHeaders, getConfig } = useDsaAuth();
const authConfig = getConfig();
const defaultApiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1';
const apiBaseUrl = authConfig.baseUrl 
    ? `${authConfig.baseUrl}/api/v1` 
    : defaultApiBaseUrl;
```

**Proposed Library Enhancement:**
- Add `useDsaApiUrl()` hook that handles this automatically
- Returns formatted API URL with `/api/v1` suffix

**File to Create:**
- `/Users/dagutman/devel/bdsa-react-components/src/auth/useDsaApiUrl.ts`

---

### 2. Auth Headers Memoization

**Current Pattern:**
```javascript
const apiHeaders = useMemo(() => {
    const headers = getAuthHeaders();
    return headers || {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [authStatus.isAuthenticated, authStatus.token]);
```

**Proposed Library Enhancement:**
- Add `useDsaAuthHeaders()` hook that handles memoization internally
- Automatically updates when auth status changes

**File to Create:**
- `/Users/dagutman/devel/bdsa-react-components/src/auth/useDsaAuthHeaders.ts`

---

## Component Composition Patterns

### 1. FolderBrowser + ThumbnailBrowser Pattern

**Documentation Needed:**
- Story showing side-by-side layout
- Example code for folder selection -> thumbnail display
- Best practices for state management

**File to Create:**
- `/Users/dagutman/devel/bdsa-react-components/docs/INTEGRATION_PATTERNS.md`
- Add to existing stories or create new story file

---

## Testing Improvements

### 1. Item Filtering Tests

**Add Tests For:**
- `hasLargeImage()` utility function
- FolderBrowser with `itemFilter` prop
- Pagination with filtered items

**File to Update:**
- `/Users/dagutman/devel/bdsa-react-components/src/components/FolderBrowser/FolderBrowser.test.tsx`
- `/Users/dagutman/devel/bdsa-react-components/src/utils/itemUtils.test.ts` (new)

---

## Documentation Updates

### 1. Update CURSOR_INTEGRATION.md

**Add Sections:**
- FolderBrowser + ThumbnailBrowser integration pattern
- Item filtering with largeImage flag
- Authentication initialization patterns
- CSS customization examples

**File to Update:**
- `/Users/dagutman/devel/bdsa-react-components/CURSOR_INTEGRATION.md`

---

## Priority Order

1. **Critical Priority (Do First):**
   - ✅ **Token in query string for DZI requests** - Required for authenticated tile loading
   - ✅ **`hasLargeImage()` utility function** - Checks both root and meta levels
   - ✅ **Selection persistence** - Better UX during testing/development

2. **High Priority:**
   - `loadItems` vs `showItems` distinction
   - `useDsaApiUrl()` hook
   - Default server URL configuration
   - Single-click folder selection (or `onFolderClick` callback)

3. **Medium Priority:**
   - `ThumbnailGrid` component with top pagination
   - `FolderBrowserWithThumbnails` composite component
   - `useDsaAuthHeaders()` hook

4. **Low Priority:**
   - CSS class improvements
   - Additional documentation
   - Story examples

---

## Implementation Checklist

### Critical (Do First) ✅ COMPLETED
- [x] Add token query string support to SlideViewer (`tokenQueryParam` prop or auto-extract from headers)
- [x] Add `hasLargeImage()` utility function (checks root AND meta levels)
- [x] Add selection persistence to FolderBrowser (`persistSelection` prop)

### High Priority
- [ ] Add `loadItems` prop to FolderBrowser (separate from `showItems`)
- [ ] Add `useDsaApiUrl()` hook
- [ ] Add `useDsaAuthHeaders()` hook
- [ ] Add default server URL configuration to DsaAuthManager
- [ ] Add single-click folder selection (`onFolderClick` callback or `selectOnClick` prop)

### Medium Priority
- [ ] Create `ThumbnailGrid` component with top pagination
- [ ] Create `FolderBrowserWithThumbnails` composite component
- [ ] Add item filtering props to FolderBrowser (`itemFilter` or `filterByLargeImage`)

### Low Priority
- [ ] Update CSS classes for item hiding
- [ ] Update documentation with new patterns
- [ ] Add integration examples to Storybook
- [ ] Add tests for new utilities and components

---

## Notes

- All improvements should maintain backward compatibility
- Consider adding feature flags for new functionality
- Update TypeScript types as needed
- Add JSDoc comments for all new functions/components
- Update CHANGELOG.md when features are added

