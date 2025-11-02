# Troubleshooting: AnnotationManager + SlideViewer Integration

## Common Issues & Solutions

### 1. **"Module not found" or Import Errors**

**Problem:** Can't import from `bdsa-react-components`

**Solutions:**
```bash
# Make sure package is installed
npm install bdsa-react-components

# Or if using local development:
cd bdsa-react-components
npm link

cd ../your-app
npm link bdsa-react-components
```

**Also check:**
- ✅ React 18+ is installed (`npm install react@^18.0.0 react-dom@^18.0.0`)
- ✅ CSS is imported: `import 'bdsa-react-components/styles.css'`

### 2. **Annotations Not Showing**

**Check these:**
- ✅ `annotationIds` prop on SlideViewer matches what AnnotationManager provides
- ✅ `apiBaseUrl` is correct and accessible
- ✅ `dziUrl` is correct and image loads
- ✅ Console for API errors (network tab)
- ✅ Annotations are actually loaded in AnnotationManager (click "Load" button)

**Debug:**
```tsx
// Add this to see what state is being passed
useEffect(() => {
  console.log('Loaded IDs:', state.loadedIds)
  console.log('Opacities:', Array.from(state.opacities.entries()))
}, [state])
```

### 3. **SlideViewer Not Rendering / Black Screen**

**Check:**
- ✅ `height` prop is provided (required!): `height="800px"`
- ✅ `dziUrl` is valid and accessible
- ✅ Browser console for errors
- ✅ OpenSeadragon errors (check network tab)

**Common fixes:**
```tsx
// Make sure height is explicit
<SlideViewer
  height="800px"  // ← REQUIRED
  imageInfo={{ dziUrl }}
  // ...
/>
```

### 4. **"onAnnotationReady is not a function" or Callback Errors**

**Problem:** Callback not wired correctly between AnnotationManager and SlideViewer.

**Fix (SIMPLIFIED - Recommended):** Use the new `slideViewerOnAnnotationReady` prop:
```tsx
// ✅ NEW SIMPLIFIED PATTERN - No render props needed!
const handleReady = useCallback((id) => {
  console.log('Ready:', id)
}, [])

<AnnotationManager
  slideViewerOnAnnotationReady={handleReady}  // ← Just pass the callback
  onAnnotationStateChange={setState}
/>

<SlideViewer
  onAnnotationReady={handleReady}  // ← Same callback
/>
```

**Legacy Pattern (if you must use render props):**
```tsx
// ⚠️ OLD PATTERN - Only use if you need render prop for other reasons
const managerReadyRef = useRef<((id: string) => void) | null>(null)

<AnnotationManager>
  {({ onAnnotationReady }) => {
    if (onAnnotationReady) {
      managerReadyRef.current = onAnnotationReady
    }
    return null
  }}
</AnnotationManager>
```

### 5. **State Not Syncing Between Components**

**Problem:** AnnotationManager state changes but SlideViewer doesn't update.

**Check:**
- ✅ `onAnnotationStateChange` callback is working (add console.log)
- ✅ State is being passed correctly to SlideViewer props
- ✅ Maps are being created correctly (not reusing old references)

**Fix - ensure you create new Maps:**
```tsx
onAnnotationStateChange={(state) => {
  setState({
    loadedIds: state.loadedAnnotationIds,  // Array is fine
    opacities: new Map(state.opacities),   // ← Create new Map
    visibility: new Map(state.visibility), // ← Create new Map
  })
}}
```

### 6. **Loading Spinner Never Goes Away**

**Problem:** Annotation loads but spinner stays visible.

**Check:**
- ✅ `onAnnotationReady` is wired correctly (see issue #4)
- ✅ Both AnnotationManager and SlideViewer receive `onAnnotationReady`
- ✅ Console for "Annotation ready" logs

**Debug:**
```tsx
const handleReady = useCallback((id: string | number) => {
  console.log('Annotation ready:', id)  // ← Should see this
  if (managerReadyRef.current) {
    managerReadyRef.current(String(id))
  }
}, [])
```

### 7. **TypeScript Errors**

**Common errors:**

**"Property 'X' does not exist on type..."**
- Make sure you're using the latest version
- Check import paths match package exports

**"Type 'Map' is not assignable..."**
- Maps need to be explicitly typed: `new Map<string, number>()`
- Make sure you're creating new Map instances (not reusing references)

### 8. **CORS or Authentication Errors**

**Problem:** API calls failing with CORS or 401/403 errors.

**Solutions:**
```tsx
// Option 1: Use fetchFn for authentication
const fetchWithAuth = async (url: string, options?: RequestInit) => {
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'Authorization': `Bearer ${token}`,
      // or 'Girder-Token': token
    },
  })
}

<AnnotationManager
  fetchFn={fetchWithAuth}
  // ...
/>

// Option 2: Use apiHeaders
<AnnotationManager
  apiHeaders={{
    'Authorization': `Bearer ${token}`,
  }}
  // ...
/>
```

### 9. **Performance Issues / Slow Rendering**

**Solutions:**
- ✅ Use caching (IndexedDBAnnotationCache is auto-created by default)
- ✅ Only load annotations you need
- ✅ Check network tab - are annotations huge? Consider server-side filtering

### 10. **Styling Issues / Layout Broken**

**Check:**
- ✅ CSS is imported: `import 'bdsa-react-components/styles.css'`
- ✅ Container has explicit height: `height: '800px'`
- ✅ Flexbox layout is correct (parent: `display: flex`, sidebar: `flex-shrink: 0`)

## Minimal Working Example Checklist

Use this to verify your setup:

```tsx
// ✅ 1. Imports
import { AnnotationManager, SlideViewer, IndexedDBAnnotationCache } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

// ✅ 2. State
const [state, setState] = useState({
  loadedIds: [],
  opacities: new Map(),
  visibility: new Map(),
})

// ✅ 3. Headers (for cache versioning)
const [headers, setHeaders] = useState(new Map())

// ✅ 4. Cache
const cache = useMemo(() => new IndexedDBAnnotationCache(), [])

// ✅ 5. Callbacks (SIMPLIFIED - no refs needed!)
const handleReady = useCallback((id) => {
  console.log('Ready:', id)
}, [])

// ✅ 6. Props match
<AnnotationManager
  imageId="YOUR_ID"
  apiBaseUrl="YOUR_API"
  slideViewerOnAnnotationReady={handleReady}  // ← NEW: Simple prop!
  onAnnotationStateChange={setState}          // ← Fires immediately
  onAnnotationHeadersChange={setHeaders}      // ← Automatic headers sync
/>

<SlideViewer
  imageInfo={{ dziUrl: "YOUR_DZI_URL" }}
  annotationIds={state.loadedIds}
  annotationOpacities={state.opacities}
  visibleAnnotations={state.visibility}
  annotationHeaders={headers}
  onAnnotationReady={handleReady}
  height="800px"  // ← REQUIRED
/>
```

## Still Having Issues?

1. **Check browser console** - look for errors
2. **Check network tab** - are API calls succeeding?
3. **Compare with Storybook** - does the Storybook example work?
4. **Verify props** - use TypeScript autocomplete to ensure prop names are correct
5. **Check React version** - requires React 18+

