/**
 * Runtime patches for Paper.js + osd-paperjs-annotation to fix _transformBounds errors.
 *
 * Paper View.getBounds() calls `this._matrix.inverted()._transformBounds(...)` — the error
 * "Cannot read properties of null (reading '_transformBounds')" means `_matrix.inverted()`
 * returned null (view torn down during OSD resize/pan), NOT that View lacks `_transformBounds`.
 *
 * osd-paperjs-annotation ships a prebuilt dist/main.js; patch-package only patches src/, so we
 * also wrap PaperOverlay._updatePaperView at runtime.
 */
import * as paper from 'paper'
import { PaperOverlay } from 'osd-paperjs-annotation'

const PATCH_FLAG = '__bdsaPaperViewPatched'
const OVERLAY_PATCH_FLAG = '__bdsaUpdatePaperViewPatched'

/** View is usable when project/matrix still exist (View.remove() clears _project/_element). */
export function isPaperViewReady(view: unknown): boolean {
  if (!view || typeof view !== 'object') return false
  const v = view as {
    _project?: unknown
    _matrix?: { inverted?: () => unknown }
  }
  if (!v._project || !v._matrix) return false
  try {
    const inv = v._matrix.inverted?.()
    return inv != null && typeof (inv as { _transformBounds?: unknown })._transformBounds === 'function'
  } catch {
    return false
  }
}

function patchViewPrototype(ViewProto: Record<string, unknown> | null | undefined): void {
  if (!ViewProto || (ViewProto as { [PATCH_FLAG]?: boolean })[PATCH_FLAG]) return

  const originalGetBounds = ViewProto.getBounds as (...args: unknown[]) => unknown
  if (typeof originalGetBounds === 'function') {
    ViewProto.getBounds = function patchedGetBounds(this: unknown, ...args: unknown[]) {
      if (!isPaperViewReady(this)) return null
      try {
        return originalGetBounds.apply(this, args)
      } catch {
        return null
      }
    }
  }

  const originalGetCenter = ViewProto.getCenter as (...args: unknown[]) => unknown
  if (typeof originalGetCenter === 'function') {
    ViewProto.getCenter = function patchedGetCenter(this: unknown, ...args: unknown[]) {
      if (!isPaperViewReady(this)) return null
      try {
        return originalGetCenter.apply(this, args)
      } catch {
        return null
      }
    }
  }

  const originalSetCenter = ViewProto.setCenter as (...args: unknown[]) => unknown
  if (typeof originalSetCenter === 'function') {
    ViewProto.setCenter = function patchedSetCenter(this: unknown, ...args: unknown[]) {
      if (!isPaperViewReady(this)) return
      try {
        originalSetCenter.apply(this, args)
      } catch {
        /* view destroyed mid-call */
      }
    }
  }

  const originalHandleMouseEvent = ViewProto._handleMouseEvent as (...args: unknown[]) => unknown
  if (typeof originalHandleMouseEvent === 'function') {
    ViewProto._handleMouseEvent = function patchedHandleMouseEvent(this: unknown, ...args: unknown[]) {
      if (!isPaperViewReady(this)) return
      try {
        return originalHandleMouseEvent.apply(this, args)
      } catch {
        /* mouse events after teardown */
      }
    }
  }

  ;(ViewProto as { [PATCH_FLAG]?: boolean })[PATCH_FLAG] = true
}

function resolvePaperLib(candidate: unknown): { View?: { prototype?: Record<string, unknown> } } | null {
  if (!candidate || typeof candidate !== 'object') return null
  const c = candidate as { View?: { prototype?: Record<string, unknown> }; default?: unknown }
  if (c.View?.prototype) return c as { View: { prototype: Record<string, unknown> } }
  if (c.default) return resolvePaperLib(c.default)
  return null
}

/** Patch View.prototype on every Paper.js instance we can reach. */
export function applyPaperJsPatches(): void {
  if (typeof window !== 'undefined' && (window as { __paperJsPatchesApplied?: boolean }).__paperJsPatchesApplied) {
    return
  }

  const tryApply = (): boolean => {
    let patched = false
    const paperLib = resolvePaperLib((paper as { default?: unknown }).default ?? paper)
    if (paperLib?.View?.prototype) {
      patchViewPrototype(paperLib.View.prototype)
      patched = true
    }
    if (typeof window !== 'undefined') {
      const globalPaper = resolvePaperLib((window as { paper?: unknown }).paper)
      if (globalPaper?.View?.prototype) {
        patchViewPrototype(globalPaper.View.prototype)
        patched = true
      }
    }
    if (patched && typeof window !== 'undefined') {
      console.log('[bdsa-react-components] Applied Paper.js runtime patches')
      ;(window as { __paperJsPatchesApplied?: boolean }).__paperJsPatchesApplied = true
    }
    return patched
  }

  if (tryApply()) return

  let retries = 0
  const timer = setInterval(() => {
    retries += 1
    if (tryApply() || retries >= 10) clearInterval(timer)
  }, 100)
}

/** Patch View on the PaperScope instance osd-paperjs-annotation actually uses (bundled copy). */
export function ensurePaperJsPatchesForScope(paperScope: { view?: unknown } | null | undefined): void {
  if (!paperScope?.view || typeof paperScope.view !== 'object') return
  const ViewProto = Object.getPrototypeOf(paperScope.view) as Record<string, unknown> | null
  patchViewPrototype(ViewProto)
}

/** Wrap PaperOverlay._updatePaperView from the prebuilt osd-paperjs bundle. */
export function applyOsdPaperJsAnnotationPatches(): void {
  if (typeof window !== 'undefined' && (window as { __osdPaperOverlayPatchesApplied?: boolean }).__osdPaperOverlayPatchesApplied) {
    return
  }

  const proto = PaperOverlay.prototype as {
    _updatePaperView?: (...args: unknown[]) => unknown
    [OVERLAY_PATCH_FLAG]?: boolean
  }

  const original = proto._updatePaperView
  if (typeof original !== 'function' || proto[OVERLAY_PATCH_FLAG]) return

  proto._updatePaperView = function patchedUpdatePaperView(this: {
    overlayType?: string
    destroyed?: boolean
    paperScope?: { view?: unknown }
  }) {
    if (this.overlayType === 'viewer') return
    if (this.destroyed) return
    if (!isPaperViewReady(this.paperScope?.view)) return
    try {
      return original.call(this)
    } catch {
      /* OSD resize/viewport events after overlay teardown */
    }
  }
  proto[OVERLAY_PATCH_FLAG] = true

  if (typeof window !== 'undefined') {
    ;(window as { __osdPaperOverlayPatchesApplied?: boolean }).__osdPaperOverlayPatchesApplied = true
  }
}

/**
 * Call once overlay exists: patch the bundled Paper scope + harden resize handler on this instance.
 */
export function hardenPaperOverlayInstance(overlay: InstanceType<typeof PaperOverlay>): void {
  ensurePaperJsPatchesForScope((overlay as { paperScope?: { view?: unknown } }).paperScope)

  const o = overlay as {
    destroyed?: boolean
    onViewerResize?: (...args: unknown[]) => unknown
    __bdsaViewerResizePatched?: boolean
  }
  const origResize = o.onViewerResize
  if (typeof origResize === 'function' && !o.__bdsaViewerResizePatched) {
    o.onViewerResize = function (...args: unknown[]) {
      if (o.destroyed) return
      try {
        return origResize.apply(overlay, args)
      } catch {
        /* ignore */
      }
    }
    o.__bdsaViewerResizePatched = true
  }
}

/**
 * Safer wrapper for Paper.js view operations.
 */
export function safelyCallPaperMethod<T>(
  view: unknown,
  methodName: string,
  ...args: unknown[]
): T | null {
  if (!isPaperViewReady(view)) return null
  try {
    return (view as Record<string, ( ...a: unknown[]) => T>)[methodName](...args)
  } catch {
    return null
  }
}
