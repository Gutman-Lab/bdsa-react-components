# bdsa-react-components Library Backport Updates

**Date:** 2025-01-XX  
**Context:** Improvements identified in model-browser-v2 that should be backported to the bdsa-react-components library.

---

## Priority 1: HIGH - Critical Functionality

### ✅ 1. Annotation Format Auto-Detection (GeoJSON ↔ DSA) - COMPLETED v0.1.16

**Status:** ✅ Implemented in v0.1.16 (2025-11-06)

**Problem:**  
`SlideViewer` currently only supports the old DSA format with `elements` array. It does NOT support GeoJSON FeatureCollection format natively, forcing backends to transform GeoJSON to DSA format.

**Current Workaround:**
- Backend transforms GeoJSON FeatureCollection → DSA format in `model-browser-v2/backend/main.py` (lines 756-991)
- This adds complexity and latency to every annotation fetch

**Proposed Solution:**
1. **Auto-detect format** in `SlideViewer` when parsing annotation documents
2. **Support both formats natively:**
   - GeoJSON FeatureCollection: `{ type: "FeatureCollection", features: [...] }`
   - DSA format: `{ annotation: { elements: [...] } }`
3. **Transform internally** if needed (GeoJSON → elements format for Paper.js)

**Implementation Location:**
- File: `src/components/SlideViewer/SlideViewer.tsx`
- Lines: ~1120-1250 (annotation parsing logic)

**Example Code Pattern:**
```typescript
// In SlideViewer annotation parsing
let elements: unknown[] = []

if (annotationDoc && typeof annotationDoc === 'object') {
  // NEW: Support GeoJSON FeatureCollection format
  if (annotationDoc.type === 'FeatureCollection' && Array.isArray(annotationDoc.features)) {
    // Transform GeoJSON features to DSA elements format
    elements = annotationDoc.features.map((feature: GeoJSON.Feature) => {
      const geom = feature.geometry
      const props = feature.properties || {}
      
      if (geom.type === 'Polygon' && geom.coordinates) {
        // Convert Polygon exterior ring to polyline points
        const coords = geom.coordinates[0] // Exterior ring
        return {
          type: 'polyline',
          points: coords.map((c: number[]) => [c[0], c[1]]),
          closed: true,
          lineColor: props.lineColor || props.stroke || '#ff0000',
          fillColor: props.fillColor || props.fill || 'rgba(255,0,0,0.3)',
          lineWidth: props.lineWidth || props['stroke-width'] || 1,
          group: props.group || props.id,
          label: props.label || props.name
        }
      }
      // Handle LineString, Point, etc.
      // ... (see backend/main.py lines 920-974 for full transformation logic)
    })
  }
  // EXISTING: Support old DSA format
  else if (annotationDoc.annotation?.elements && Array.isArray(annotationDoc.annotation.elements)) {
    elements = annotationDoc.annotation.elements
  } else if (Array.isArray(annotationDoc.elements)) {
    elements = annotationDoc.elements
  }
}
```

**Reference Implementation:**
- See `model-browser-v2/backend/main.py` lines 756-991 for complete GeoJSON → DSA transformation logic
- Handles: Polygon, LineString, Point geometries
- Preserves: colors, labels, groups, lineWidth, etc.

**Benefits:**
- ✅ Backends can return GeoJSON directly (standard format)
- ✅ No transformation overhead
- ✅ Backward compatible (still supports DSA format)
- ✅ Users don't need to know about format differences

---

## Priority 2: MEDIUM - UX Improvements

### 2. FolderBrowser Tree Expansion State Persistence

**Problem:**  
`FolderBrowser` doesn't persist which folders are expanded when:
- User navigates away and comes back
- Component remounts
- Page refreshes

**Current State:**
- `persistSelection` prop exists (saves selected folder/item)
- But expansion state is lost on refresh

**Proposed Solution:**
1. **Add prop:** `persistExpansion?: boolean` (default: `false`)
2. **Use localStorage:** Store expanded folder IDs with key `bdsa-folder-browser-expanded-{rootFolderId}`
3. **Restore on mount:** Read from localStorage and restore expansion state
4. **Auto-expand path:** When restoring selection, auto-expand path to selected item
5. **Scroll to selection:** Scroll to selected item after restoring state

**Implementation Location:**
- File: `src/components/FolderBrowser/FolderBrowser.tsx`
- State: `expandedFolders: Set<string>`

**Example Implementation:**
```typescript
// In FolderBrowser.tsx
const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
  if (persistExpansion && rootFolderId) {
    const key = `bdsa-folder-browser-expanded-${rootFolderId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        return new Set(JSON.parse(saved))
      } catch (e) {
        console.warn('Failed to parse saved expansion state:', e)
      }
    }
  }
  return new Set()
})

// Save expansion state when it changes
useEffect(() => {
  if (persistExpansion && rootFolderId) {
    const key = `bdsa-folder-browser-expanded-${rootFolderId}`
    localStorage.setItem(key, JSON.stringify(Array.from(expandedFolders)))
  }
}, [expandedFolders, persistExpansion, rootFolderId])

// Auto-expand path to selected item
useEffect(() => {
  if (persistSelection && selectedResource) {
    // Expand all parent folders of selected item
    const path = getPathToResource(selectedResource)
    setExpandedFolders(prev => {
      const next = new Set(prev)
      path.forEach(folderId => next.add(folderId))
      return next
    })
    
    // Scroll to selected item after a brief delay
    setTimeout(() => {
      const element = document.querySelector(`[data-folder-id="${selectedResource._id}"]`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }
}, [selectedResource, persistSelection])
```

**Reference:**
- See `docs/FOLDERBROWSER_EXPANSION_PERSISTENCE.md` for detailed requirements

**Benefits:**
- ✅ Better UX - users don't lose their place
- ✅ Faster navigation - don't need to re-expand folders
- ✅ Works with existing `persistSelection` prop

---

### 3. SlideViewer Opacity Map Stability

**Problem:**  
When `annotationOpacities` prop changes (Map reference), `SlideViewer` may trigger a full rerender/reset instead of just updating opacity on the annotation layer.

**Current Issue:**
- Consumers create new Map instances when opacity changes
- Library sees "new" prop and may do unnecessary work
- Can cause viewer to "blacken" or reset during opacity changes

**Proposed Solution:**
1. **Deep comparison:** Compare Map contents, not reference
2. **Update in place:** Only update affected annotation layers, don't rerender viewer
3. **Memoization:** Use `useMemo` to detect actual changes

**Implementation Location:**
- File: `src/components/SlideViewer/SlideViewer.tsx`
- Props: `annotationOpacities?: Map<string, number>`

**Example Pattern (Consumer Side):**
```typescript
// GOOD: Stable Map reference, update in place
const opacityMapRef = useRef(new Map())

useEffect(() => {
  if (annotationId && opacity !== undefined) {
    opacityMapRef.current.set(annotationId, opacity)
  } else {
    opacityMapRef.current.clear()
  }
}, [annotationId, opacity])

const annotationOpacities = opacityMapRef.current // Same reference always

// BAD: New Map on every change
const annotationOpacities = useMemo(() => {
  const map = new Map()
  if (annotationId) map.set(annotationId, opacity)
  return map
}, [annotationId, opacity]) // New Map instance = rerender
```

**Library Side:**
```typescript
// In SlideViewer.tsx
const prevOpacitiesRef = useRef<Map<string, number>>(new Map())

useEffect(() => {
  if (!annotationOpacities) return
  
  // Compare Map contents, not reference
  const hasChanged = 
    prevOpacitiesRef.current.size !== annotationOpacities.size ||
    Array.from(annotationOpacities.entries()).some(([id, opacity]) => 
      prevOpacitiesRef.current.get(id) !== opacity
    )
  
  if (hasChanged) {
    // Update only affected annotation layers (Paper.js paths)
    annotationOpacities.forEach((opacity, annotationId) => {
      const path = annotationPaths.get(annotationId)
      if (path) {
        path.opacity = opacity
        // Don't rerender viewer, just update canvas
      }
    })
    
    prevOpacitiesRef.current = new Map(annotationOpacities)
  }
}, [annotationOpacities])
```

**Reference:**
- See `model-browser-v2/frontend/src/components/FolderThumbnailBrowser.js` lines 400-410 for consumer pattern

**Benefits:**
- ✅ Smooth opacity changes without viewer reset
- ✅ Better performance
- ✅ No "blackening" during opacity slider changes

---

## Priority 3: LOW - Nice to Have

### 4. Better Error Messages for Annotation Format Mismatches

**Problem:**  
When annotation format is unexpected, `SlideViewer` fails silently or with unclear errors.

**Proposed Solution:**
1. **Format detection logging:** Log what format was received vs expected
2. **Try multiple formats:** Attempt to parse as GeoJSON, then DSA format
3. **Clear error messages:** "Expected GeoJSON FeatureCollection or DSA format, got: {actual format}"

**Implementation Location:**
- File: `src/components/SlideViewer/SlideViewer.tsx`
- Lines: ~1030-1090 (annotation fetching)

---

### 5. Coordinate System Documentation

**Problem:**  
Unclear whether SlideViewer expects base image coordinates, normalized (0-1), or DZI tile coordinates.

**Proposed Solution:**
1. **Add JSDoc comments** explaining coordinate system
2. **Add validation warnings** if coordinates seem out of range
3. **Document in README/CURSOR_INTEGRATION.md**

**Implementation Location:**
- Documentation: `CURSOR_INTEGRATION.md`
- Code: `src/components/SlideViewer/SlideViewer.tsx` (JSDoc)

---

## Implementation Checklist

### Phase 1: Critical (Do First)
- [ ] **Annotation Format Auto-Detection**
  - [ ] Add GeoJSON FeatureCollection detection
  - [ ] Add transformation logic (GeoJSON → elements)
  - [ ] Test with both formats
  - [ ] Update TypeScript types
  - [ ] Update documentation

### Phase 2: UX Improvements
- [ ] **FolderBrowser Expansion Persistence**
  - [ ] Add `persistExpansion` prop
  - [ ] Implement localStorage save/restore
  - [ ] Add auto-expand path logic
  - [ ] Add scroll-to-selection
  - [ ] Test with page refresh

- [ ] **SlideViewer Opacity Stability**
  - [ ] Add deep comparison for Map props
  - [ ] Update only affected layers (no rerender)
  - [ ] Test opacity slider smoothness

### Phase 3: Polish
- [ ] Better error messages
- [ ] Coordinate system documentation
- [ ] Add examples to CURSOR_INTEGRATION.md

---

## Testing Strategy

### Annotation Format
1. Test with GeoJSON FeatureCollection from DSA API
2. Test with old DSA format (backward compatibility)
3. Test with mixed formats (some GeoJSON, some DSA)
4. Verify Paper.js rendering works for both

### FolderBrowser Persistence
1. Expand folders, select item, refresh page
2. Verify folders remain expanded
3. Verify selected item is highlighted
4. Verify scroll position is restored

### Opacity Stability
1. Change opacity slider rapidly
2. Verify no viewer reset/blackening
3. Verify smooth opacity transitions
4. Verify multiple annotations can have different opacities

---

## Notes

- **Backward Compatibility:** All changes should maintain backward compatibility
- **Breaking Changes:** None expected - all additions are opt-in or default behavior
- **Performance:** Opacity changes should be O(1) per annotation, not O(n) rerender
- **Documentation:** Update CURSOR_INTEGRATION.md with new features

---

## References

- Backend transformation logic: `model-browser-v2/backend/main.py` lines 756-991
- Consumer opacity pattern: `model-browser-v2/frontend/src/components/FolderThumbnailBrowser.js` lines 400-410
- Expansion persistence requirements: `docs/FOLDERBROWSER_EXPANSION_PERSISTENCE.md`
- Existing improvements doc: `docs/LIBRARY_IMPROVEMENTS_NEEDED.md` (outdated, see this doc instead)

