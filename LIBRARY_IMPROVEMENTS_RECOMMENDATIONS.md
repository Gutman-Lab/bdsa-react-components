# bdsa-react-components - Recommended Improvements

**Generated from**: bdsa-model-registry project  
**Date**: 2025-11-08  
**Context**: Based on real-world usage and workarounds implemented in the model registry application

---

## 1. FolderBrowser: Separate `fetchItems` from `showItems` 🔥

**Priority**: HIGH - Breaking usability issue

### Current Issue
- `showItems={false}` prevents fetching items entirely (skips API call)
- `showItems={true}` with `itemFilter` can cause infinite render loops
- No way to fetch items without displaying them in the tree

### Use Case
We need to fetch items from folders to:
- Filter them by type (e.g., only show "model" items)
- Extract metadata for other purposes
- Manually render items in custom ways (e.g., as nested children)

### Current Workaround
```javascript
// We manually fetch items in parallel with FolderBrowser
const fetchFolderModels = async (folderId) => {
  const response = await fetch(`${apiBaseUrl}/item?folderId=${folderId}`);
  const items = await response.json();
  const models = items.filter(isModelItem);
  // Manually inject into DOM below folder element
};
```

### Recommended API
```typescript
<FolderBrowser
  showItems={false}       // Don't render items in tree
  fetchItems={true}       // But still fetch them from API
  onItemsFetched={(folderId, items) => {
    // Parent receives items data without automatic rendering
    // Can filter, transform, or render custom UI
    const models = items.filter(isModelItem);
    // Use for custom logic
  }}
/>
```

**Benefits**:
- No breaking changes (new props are optional)
- Decouples fetching from rendering
- Prevents need for duplicate API calls
- More flexible for advanced use cases

---

## 2. SlideViewer: Optimize Annotation Opacity Updates 🔥

**Priority**: HIGH - Performance issue

### Current Issue
Changing annotation opacity causes:
- Full component remount
- Re-fetching of annotation documents
- Re-rendering of all Paper.js annotations
- Poor UX when user drags opacity slider

### Use Case
```javascript
// User drags slider from 50% to 60%
<SlideViewer
  annotationIds={['abc123']}
  annotationOpacities={new Map([['abc123', 0.6]])}  // Changed from 0.5
/>
// Result: Full re-render, re-fetch, re-draw (slow!)
```

### Current Workaround
```javascript
// We use React.memo and stable Map references, but still not smooth
const ThumbnailViewer = React.memo(({ ... }) => {
  const opacityMapRef = React.useRef(new Map());
  // Update in place, but library still re-renders
  opacityMapRef.current.set(annotationId, opacity);
  return <SlideViewer annotationOpacities={opacityMapRef.current} />;
});
```

### Recommended Fix
Internally detect when only opacity changed:
```typescript
// Library internal logic:
componentDidUpdate(prevProps) {
  // Check if annotationIds are the same
  const idsChanged = !arraysEqual(prevProps.annotationIds, this.props.annotationIds);
  
  if (!idsChanged) {
    // Only opacity changed - update Paper.js layer directly
    this.props.annotationOpacities.forEach((opacity, id) => {
      const layer = this.annotationLayers.get(id);
      if (layer) {
        layer.opacity = opacity;  // Instant update
        this.paperScope.view.update();
      }
    });
    return;  // Skip re-render
  }
  
  // IDs changed - full re-render needed
  this.reloadAnnotations();
}
```

**Benefits**:
- Smooth 60fps opacity slider updates
- No re-fetching of annotation data
- Better user experience
- No breaking changes needed

---

## 3. FolderBrowser: Support for Nested/Grouped Items

**Priority**: MEDIUM - Workaround exists but hacky

### Current Issue
Items can only be rendered as flat children of folders. No way to:
- Render items as nested children of their parent folder
- Group items by custom criteria
- Custom render different item types differently

### Use Case
We have "model items" that should appear as children of folders in the tree, but regular image items should be hidden from the tree view.

### Current Workaround
```javascript
// Manually inject DOM elements into FolderBrowser tree
useEffect(() => {
  const folderElement = document.querySelector(`[data-folder-id="${folderId}"]`);
  const modelElement = document.createElement('div');
  modelElement.className = 'injected-model-item';
  modelElement.innerHTML = `<span>📊 ${model.name}</span>`;
  folderElement.appendChild(modelElement);
}, [folderId, models]);
```

### Recommended API
```typescript
<FolderBrowser
  showItems={true}
  renderItemAsChild={true}  // Render items nested under folders
  itemGroupBy={(item) => item.parentFolderId}  // Group by folder
  customItemRenderer={(item, depth, isExpanded) => {
    // Custom render for special types
    if (isModelItem(item)) {
      return <ModelIcon item={item} onClick={...} />;
    }
    return null;  // Hide regular items
  }}
/>
```

**Benefits**:
- Proper React component tree
- No DOM manipulation hacks
- Better performance
- Proper event handling

---

## 4. FolderBrowser: `itemFilter` Stability Guards

**Priority**: MEDIUM - Can cause infinite loops

### Current Issue
Using `itemFilter` prop can cause infinite render loops if:
- Filter function isn't memoized with `useCallback`
- Filter triggers state updates that change props
- FolderBrowser re-fetches items on every render

### Current Workaround
```javascript
// Must carefully memoize filter
const itemFilter = useCallback((item) => {
  return isModelItem(item);
}, []);  // MUST have stable dependencies

<FolderBrowser itemFilter={itemFilter} />
```

### Recommended Improvements

**1. Guard against infinite loops:**
```typescript
// Library internal:
const lastFetchRef = useRef({ folderId: null, timestamp: 0 });

const fetchItems = (folderId) => {
  const now = Date.now();
  if (lastFetchRef.current.folderId === folderId && 
      now - lastFetchRef.current.timestamp < 1000) {
    console.warn('[FolderBrowser] Possible infinite loop detected - throttling fetch');
    return;
  }
  lastFetchRef.current = { folderId, timestamp: now };
  // Proceed with fetch
};
```

**2. Document stability requirement:**
```typescript
/**
 * @param itemFilter - Filter function for items
 * ⚠️ IMPORTANT: This function must be stable (wrapped in useCallback)
 * to prevent infinite re-renders.
 * 
 * @example
 * const itemFilter = useCallback((item) => {
 *   return item.type === 'model';
 * }, []); // Empty deps = stable
 */
itemFilter?: (item: Item) => boolean;
```

**Benefits**:
- Prevents accidental infinite loops
- Better developer experience
- Clear documentation

---

## 5. Better TypeScript Types and Documentation

**Priority**: LOW - Nice to have

### Current Issues
- Callback signatures not fully documented
- Unclear when callbacks fire (mount vs. click vs. double-click)
- Missing examples for complex props

### Recommendations

**Add comprehensive JSDoc:**
```typescript
interface FolderBrowserProps {
  /**
   * Called when a resource is single-clicked
   * @param resource - The clicked folder, collection, or item
   * @fires On single-click only (not double-click)
   * @example
   * onResourceSelect={(resource) => {
   *   if (resource.type === 'folder') {
   *     console.log('Folder clicked:', resource._id);
   *   }
   * }}
   */
  onResourceSelect?: (resource: Resource | null) => void;

  /**
   * Called when selection changes (double-click or programmatic)
   * @param resource - The newly selected resource
   * @fires On double-click, or when persistSelection restores selection
   * @example
   * onSelectionChange={(resource) => {
   *   console.log('Selection changed to:', resource?._id);
   * }}
   */
  onSelectionChange?: (resource: Resource | null) => void;
}
```

**Add example documentation:**
```markdown
## Common Patterns

### Pattern 1: Load folder contents on click
### Pattern 2: Show items only of a certain type
### Pattern 3: Persist selection across sessions
```

---

## 6. SlideViewer: Expose Annotation Layer Control

**Priority**: LOW - Advanced use case

### Current Issue
No direct access to Paper.js annotation layers for:
- Immediate opacity updates
- Custom styling
- Animation
- Advanced interaction

### Recommended API
```typescript
<SlideViewer
  annotationLayerRef={(layer, annotationId) => {
    // Direct access to Paper.js layer
    layer.opacity = 0.5;
    layer.blendMode = 'multiply';
  }}
  
  onAnnotationLayerReady={(methods) => {
    // Imperative API for common operations
    methods.setOpacity(annotationId, 0.5);
    methods.setVisible(annotationId, true);
    methods.highlight(annotationId);
    methods.animate(annotationId, { opacity: [0, 1] }, 300);
  }}
/>
```

**Benefits**:
- Advanced users get more control
- No breaking changes (new optional props)
- Better performance for custom use cases

---

## 7. FolderBrowser: Flexible Persistence

**Priority**: LOW - Current implementation works well

### Enhancement Opportunity
```typescript
<FolderBrowser
  persistenceKey="my-app-folder-browser"  // Custom key
  persistenceStrategy="session"           // session | local | custom
  
  // Custom persistence handlers
  onSaveState={(state) => {
    // Save to your own storage
    myStorage.save('folder-state', state);
  }}
  
  onRestoreState={() => {
    // Restore from your own storage
    return myStorage.get('folder-state');
  }}
/>
```

**Benefits**:
- Support for session storage
- Support for server-side storage
- Multiple independent instances on same page

---

## Summary & Priority

### High Priority (Impacting Usability) 🔥
1. **FolderBrowser: `fetchItems` separate from `showItems`**
   - Current workaround requires duplicate API calls
   - Breaks separation of concerns
   
2. **SlideViewer: Annotation opacity optimization**
   - Poor UX when dragging opacity slider
   - Unnecessary re-renders and re-fetches

### Medium Priority (Workarounds Exist) ⚠️
3. **FolderBrowser: Nested item rendering**
   - Current DOM manipulation is fragile
   - Not idiomatic React
   
4. **FolderBrowser: `itemFilter` stability guards**
   - Easy to accidentally create infinite loops
   - Needs better documentation

### Nice to Have ✨
5. Better TypeScript types and JSDoc documentation
6. Advanced annotation layer control API
7. Flexible persistence options

---

## Implementation Notes

### Non-Breaking Changes
All recommendations can be implemented as:
- New optional props (backward compatible)
- Internal optimizations (transparent to users)
- Enhanced documentation (no API changes)

### Testing Considerations
- Test `fetchItems={true}` with `showItems={false}`
- Test opacity updates without re-fetching (performance)
- Test `itemFilter` with rapidly changing props (loop detection)
- Test nested item rendering with various folder structures

---

## Contact & Feedback

This document is based on real-world usage in the `bdsa-model-registry` project. Happy to discuss any of these recommendations in detail or provide code examples for implementation.

**Project**: https://github.com/[your-org]/bdsa-model-registry  
**Library**: https://github.com/[your-org]/bdsa-react-components






