# Fixing _transformBounds Errors

## The Problem

The `Cannot read properties of null (reading '_transformBounds')` error occurs because:

1. **Storybook works** because patches are applied to `node_modules` during development
2. **Your other app fails** because when you install `bdsa-react-components`, npm installs separate unpatched copies of `osd-paperjs-annotation` and `paper`

## The Solution (v0.1.11+)

We've implemented **runtime monkey-patching** that automatically applies fixes when `SlideViewer` initializes. This happens at runtime, so it works regardless of how the dependencies are installed.

### For Consuming Applications

#### Option 1: Update to v0.1.11+ (Easiest)

```bash
# Update bdsa-react-components
npm install bdsa-react-components@latest

# Install peer dependencies
npm install openseadragon osd-paperjs-annotation paper patch-package postinstall-postinstall
```

The runtime patches will apply automatically when you use `SlideViewer` or `AnnotationManager`.

#### Option 2: Manual Patch Application

If you need to apply patches before components mount:

```typescript
import { applyPaperJsPatches } from 'bdsa-react-components'

// Call this once at app initialization (before any Paper.js usage)
applyPaperJsPatches()
```

### What Changed in v0.1.11

1. **Runtime Monkey-Patching**: `SlideViewer` now automatically patches Paper.js methods (`getBounds`, `getCenter`, `setCenter`, `_handleMouseEvent`) to check if `_transformBounds` exists before accessing it

2. **Peer Dependencies**: Moved `openseadragon`, `osd-paperjs-annotation`, and `paper` to `peerDependencies` to prevent duplicate installations

3. **Exported Patch Function**: `applyPaperJsPatches()` is now exported if you need manual control

### How the Runtime Patches Work

The patches wrap Paper.js View methods with defensive checks:

```javascript
// Before (crashes if view is destroyed):
view.getBounds()

// After (returns null if view is destroyed):
if (!view._transformBounds) return null
try {
    return view.getBounds()
} catch (e) {
    return null
}
```

This prevents crashes when:
- Switching tabs rapidly
- Unmounting components
- Mouse events fire after Paper.js cleanup

### Testing

After updating, test these scenarios:
1. ✅ Load an annotation
2. ✅ Switch between tabs/images rapidly  
3. ✅ Move mouse while switching
4. ✅ Toggle visibility (eye icon)
5. ✅ Adjust opacity
6. ✅ Unload annotations

**No more `_transformBounds` errors!** 🎉

### Why This Approach?

Other approaches we considered:
- ❌ **File patches**: Require consumers to use `patch-package` (configuration burden)
- ❌ **Forking libraries**: Have to maintain forks (maintenance burden)
- ✅ **Runtime patches**: Work automatically, no configuration needed

### Troubleshooting

If you still see errors:

1. **Clear caches**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Verify version**:
   ```bash
   npm list bdsa-react-components
   # Should show 0.1.11 or higher
   ```

3. **Check console**: You should see:
   ```
   [bdsa-react-components] Applied Paper.js runtime patches
   ```

4. **Manual patch**: Call `applyPaperJsPatches()` early in your app:
   ```typescript
   import { applyPaperJsPatches } from 'bdsa-react-components'
   
   // In your App.tsx or main.tsx
   applyPaperJsPatches()
   ```

### For Package Maintainers

If publishing this package:

```bash
npm run build
npm publish
```

The built bundle includes the runtime patching logic, so consumers get it automatically.

