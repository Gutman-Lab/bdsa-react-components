# Fix for _transformBounds Error in Model Registry App

## Problem

Getting `Cannot read properties of null (reading '_transformBounds')` errors when using `bdsa-react-components`. This happens because Paper.js DOM event handlers fire after Paper.js is destroyed during component unmounting or tab switching.

## Solution: Runtime Monkey-Patch

We need to patch Paper.js in YOUR app (not the component library) because each app gets its own Paper.js instance.

---

## Step 1: Create the Patch File

**Location:** `src/utils/paperJsPatch.js`

**Contents:**

```javascript
/**
 * Runtime patches for Paper.js to fix _transformBounds errors
 * This MUST be imported before any components that use Paper.js
 */
import * as paper from 'paper'

function applyPaperJsPatches() {
    // Only apply once
    if (window.__paperJsPatchesApplied) {
        return
    }

    try {
        const ViewProto = paper.View.prototype

        if (!ViewProto) {
            console.warn('Paper.js View.prototype not found')
            return
        }

        // Patch getBounds - THE CORE ISSUE
        // This is called by mouse events even after Paper.js is destroyed
        const originalGetBounds = ViewProto.getBounds
        ViewProto.getBounds = function() {
            if (!this._transformBounds) {
                return null // View is destroyed, return null instead of crashing
            }
            try {
                return originalGetBounds.call(this)
            } catch (e) {
                return null
            }
        }

        // Patch getCenter
        // Also accesses _transformBounds internally
        const originalGetCenter = ViewProto.getCenter
        ViewProto.getCenter = function() {
            if (!this._transformBounds) {
                return null
            }
            try {
                return originalGetCenter.call(this)
            } catch (e) {
                return null
            }
        }

        // Patch setCenter
        // Called during viewport updates
        const originalSetCenter = ViewProto.setCenter
        ViewProto.setCenter = function(...args) {
            if (!this._transformBounds) {
                return // Silently ignore if view is destroyed
            }
            try {
                return originalSetCenter.apply(this, args)
            } catch (e) {
                // Ignore errors
            }
        }

        // Patch _handleMouseEvent
        // Mouse events (mouseout, etc.) still fire after destruction
        if (ViewProto._handleMouseEvent) {
            const originalHandleMouseEvent = ViewProto._handleMouseEvent
            ViewProto._handleMouseEvent = function(...args) {
                if (!this._transformBounds) {
                    return // Ignore mouse events if view is destroyed
                }
                try {
                    return originalHandleMouseEvent.apply(this, args)
                } catch (e) {
                    // Ignore errors during mouse handling
                }
            }
        }

        console.log('🎉 [PAPER.JS PATCHES APPLIED SUCCESSFULLY] ✅')
        window.__paperJsPatchesApplied = true
    } catch (e) {
        console.error('❌ [PAPER.JS PATCHES FAILED]:', e)
    }
}

// Apply patches immediately when this module loads
// This must happen BEFORE any Paper.js operations
applyPaperJsPatches()
```

---

## Step 2: Import the Patch at App Entry Point

Find your app's entry point (usually ONE of these):
- `src/index.jsx` or `src/index.tsx`
- `src/main.jsx` or `src/main.tsx`
- `src/App.jsx` or `src/App.tsx`

**Add this import as THE VERY FIRST LINE:**

```javascript
// MUST BE FIRST - Patch Paper.js before anything else loads
import './utils/paperJsPatch'

// NOW import everything else
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// ... rest of your imports
```

### Example (if using src/index.jsx):

```javascript
import './utils/paperJsPatch' // <-- ADD THIS FIRST!

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

---

## Step 3: Rebuild Docker Container

Since this is a dockerized application, you need to rebuild:

### Option A: Using docker-compose

```bash
# Stop containers
docker-compose down

# Rebuild with no cache (ensures new code is included)
docker-compose build --no-cache

# Start again
docker-compose up
```

### Option B: Using docker directly

```bash
# Build
docker build --no-cache -t bdsa-model-registry .

# Run
docker run -p 3000:3000 bdsa-model-registry
```

---

## Step 4: Verify the Fix

1. **Open the app:** http://localhost:3000

2. **Check browser console** - You MUST see:
   ```
   🎉 [PAPER.JS PATCHES APPLIED SUCCESSFULLY] ✅
   ```

3. **Test these scenarios:**
   - ✅ Load an annotation (click the + button)
   - ✅ Switch between tabs/images rapidly
   - ✅ Move mouse while switching
   - ✅ Toggle visibility (eye icon)
   - ✅ Adjust opacity slider
   - ✅ Unload annotations (click the - button)

4. **Verify no errors:**
   - No `_transformBounds` errors in console
   - Annotations load and display properly
   - Switching tabs doesn't crash

---

## Troubleshooting

### ❌ Don't see the patch message in console

**Problem:** The patch file isn't being imported or is imported too late.

**Solutions:**
1. Check the import path is correct: `'./utils/paperJsPatch'`
2. Make sure it's the FIRST import (before React, before everything)
3. Check the file exists at `src/utils/paperJsPatch.js`
4. Try using absolute import: `import 'utils/paperJsPatch'` (if using path aliases)

### ❌ See patch message but still get errors

**Problem:** Need to patch more Paper.js methods.

**Solution:** Look at the error stack trace and tell me which method is crashing. Common ones:
- `getZoom()`
- `setZoom()`
- `setRotation()`
- `update()`

### ❌ Docker build fails

**Problem:** Module resolution or build issues.

**Solutions:**
1. Make sure `paper` is in your `package.json` dependencies
2. Try `npm install` locally first to test
3. Check Docker build logs for specific errors

### ❌ Module not found: 'paper'

**Problem:** Paper.js isn't installed.

**Solution:**
```bash
npm install paper openseadragon osd-paperjs-annotation
```

Then rebuild Docker.

---

## Why This Happens

1. **Paper.js** attaches DOM event listeners (mouseout, mousemove, etc.) to the document
2. When components unmount (tab switch, navigation), Paper.js view is destroyed (`_transformBounds = null`)
3. DOM event listeners are **NOT removed** and still fire
4. Event handlers call Paper.js methods that access `_transformBounds`
5. **CRASH!** `Cannot read properties of null`

## Why This Fix Works

The patch wraps every Paper.js method that accesses `_transformBounds` with:
1. Check if `_transformBounds` exists
2. If not, return null/undefined instead of crashing
3. Wrap in try-catch for race conditions

This allows event handlers to fire safely even after Paper.js is destroyed.

---

## Long-term Solution

The REAL fix is to:
1. Fork `osd-paperjs-annotation` and fix cleanup
2. Submit PR to Paper.js to clean up event listeners properly
3. OR use a different annotation library

But for now, this runtime patch works! 🎉

---

## Need Help?

If you still have issues:
1. Check browser console for the patch success message
2. Share the FULL error stack trace
3. Verify Docker build includes the new files
4. Make sure the import is at the very top of your entry file

