# LLM integration — `bdsa-react-components`

Copy this file into consuming repos (for example `.cursor/rules/`, `AGENTS.md` append, or internal docs). It summarizes **how the package is structured** and **which exports belong to each logical submodule**.

---

## Package surface

Everything ship from the **single public entry**:

```tsx
import { /* see sections below */ } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'
```

`package.json` only exposes `.` (main bundle) and `./styles.css`. There are **no separate npm subpaths** (e.g. `bdsa-react-components/auth`) — submodule boundaries are organizational, not separate install targets.

---

## Peer dependencies

Install these in the host app alongside the library:

- `react` / `react-dom` (18+)
- `openseadragon` (^5)
- `paper` (^0.12) — annotations / viewer stack

Tiles and overlays under `SlideViewer` depend on **OpenSeadragon + Paper.js** peers being present.

---

## 1. Auth (`src/auth`)

**Role:** Shared Girder-style DSA session: server URL, token, user info, localStorage persistence.

| Export | Use |
|--------|-----|
| `dsaAuthStore` | Imperative singleton: `getStatus()`, `subscribe`, login helpers (used by browsers and UI). |
| `useDsaAuth()` | React hook for auth/config from the store. |
| `useDsaResolvedApi({ apiBaseUrl, apiHeaders, authToken })` | Resolves effective API base URL, headers, and token (merges props with store when appropriate). |
| `mergeHeadersInit`, `headersInitToRecord` | Header merging helpers for `fetch`-style APIs. |
| **Types:** `DsaAuthConfig`, `DsaUserInfo`, `DsaAuthStatus`, `UseDsaResolvedApiOptions` | Typings for integrations and props. |

**Typical wiring:** Folder/manifest/thumbnail browsers read `dsaAuthStore` (or hooks) so the app does **not** pass API URLs everywhere if the user configured them in `DsaAuthManager`.

---

## 2. Auth UI (`DsaAuthManager`)

**Role:** Full login/logout UX, compact toolbar mode, persists via the same store as §1.

```tsx
import { DsaAuthManager } from 'bdsa-react-components'
```

Prefer placing it once near the app shell; other components consume `dsaAuthStore` / `useDsaResolvedApi` for authenticated API calls.

---

## 3. Folder & manifest browsing

### `FolderBrowser`

**Role:** Tree of DSA **collections ↔ folders ↔ items**, expansion/selection callbacks, optional persistence and synthetic data for demos. Uses store-backed server URL / headers.

**Types:** `FolderBrowserResource`, `FolderBrowserRenderCollection`, etc. (exported from package).

### `ManifestBrowser`

**Role:** Side panel that loads **`manifestUrl`** (default `/manifest.json`) mapping labels → DSA **item IDs** and resolves items through the authenticated API. Depends on authenticated `dsaAuthStore` state.

---

## 4. Thumbnails (`ThumbnailGrid`, `OSDThumbnailBrowser`, `ThumbnailViewer`)

| Component | Role |
|-----------|------|
| `ThumbnailGrid` | Grid of thumbnails for a list of DSA items. |
| `OSDThumbnailBrowser` | OSD-based tile thumbnails for navigating folder/collection hierarchies (**alias exported as deprecated:** `FolderThumbnailBrowser`). |
| `ThumbnailViewer` | Large preview with **`updateThumbnailOpacity` / `getThumbnailOpacity` / `clearThumbnailOpacities`** for coordinated opacity UX. |

All assume DSA item metadata/tiles APIs and styling from the bundled CSS.

---

## 5. Slide viewing (`SlideViewer`)

**Role:** OpenSeadragon + Paper overlays for whole-slide imaging; loads **inline annotations**, **GeoJSON**, and/or **`annotationIds`** fetched from DSA **`apiBaseUrl`** (with **`fetchFn` / `apiHeaders`**, **`tokenQueryParam`** for tokenized tiles, annotation opacity/visibility hooks).

**Exports:** Component + **`SlideViewerProps`** and related types from `SlideViewer.types`.

**Hooks:** Under `src/components/SlideViewer/hooks/` (used internally); not separately exported from the package entry — extend behavior via **`SlideViewer` props**, not deep hook imports.

**Annotation cache (`src/cache`):** The repo implements `MemoryAnnotationCache`, `IndexedDBAnnotationCache`, and helpers (`computeHash`, `CacheSizeTester`, IndexedDB quota utilities). **`SlideViewer`** defaults to an internal **`IndexedDBAnnotationCache`** when `disableCache` is false and no custom cache is supplied. Implementations live under **`src/cache`** but are **not** re-exported from `src/index.ts`, so **`annotationCache`** on **`SlideViewerProps`** is primarily for typed extension inside this repo until optional public exports are added. Use **`disableCache`**, **`annotationHeaders`**, etc. from the documented props for normal integrations.

---

## 6. Annotations (`AnnotationBrowser`, `AnnotationEditor`, GeoJSON helpers)

### `AnnotationBrowser`

**Role:** Browse/select annotation layers/documents tied to DSA workflows (paired with viewer patterns in docs/Storybook).

### `AnnotationEditor`

**Role:** Drawing/editing toolkit with toolbar, modes, and hotkeys — types: `AnnotationEditorProps`, `AnnotationEditorConfig`, `AnnotationType`, `RoiSettings`, `HotkeySettings`, `EditorMode`.

### GeoJSON ↔ local document helpers (`annotationGeoJson`)

| Export | Role |
|--------|------|
| `localDocumentToFeatureCollection` | Convert internal doc → GeoJSON `FeatureCollection`. |
| `featureCollectionToLocalDocument` | Inverse (options: `FeatureCollectionToLocalOptions`). |
| `loadLocalElementsOntoAnnotationToolkit` | Push local geometry into the osd-paperjs annotation toolkit (`LoadLocalElementsOptions`). |

Use these when backends speak GeoJSON but the editor/viewer expects DSA-style element trees.

---

## 7. Item utilities (`utils/itemUtils`)

**Role:** DSA **`Item`** typing and filters for microscopy workflows.

```tsx
import {
  hasLargeImage,
  isAIModel,
  filterLargeImages,
  filterAIModels,
} from 'bdsa-react-components'
import type { Item, ItemWithMeta } from 'bdsa-react-components'
```

Use when building grids or manifests that must hide non-slide assets or segregate AI-derived items.

---

## 8. Protocol manager (BDSA schema / stain & region protocols)

**Role:** Define and edit **stain** and **region** protocols with options driven by Pitt BDSA JSON schemas (`stain-metadata.json`, `region-metadata.json`; bundled or fetched). Host apps wire persistence and optional **DSA push/pull** via adapters.

| Export | Use |
|--------|-----|
| `ProtocolProvider` | Context provider; optional `storage` (default: `LocalStorageProtocolStorage`). |
| `useProtocols()` | Read/update protocols (`stainProtocols`, `regionProtocols`, CRUD helpers). |
| `ProtocolsTab` | Full tab UI (DSA sync toolbar optional via `dsaSyncAdapter`, **`schemaValidator` required**). Alias export: **`ProtocolManager`**. |
| `ProtocolList`, `ProtocolCard`, `ProtocolModal` | Composable pieces for custom layouts. |
| `SchemaValidator`, `createSchemaValidator`, **`BDSA_SCHEMA_DEFAULT_OPTIONS`**, **`SCHEMA_PATHS`** | Load schemas + validate stain/region payloads; **`await loadSchemas(undefined, undefined, { useDefault: true })`** uses bundled Pitt stain/region JSON from **`dist/schemas/`**. |
| `LocalStorageProtocolStorage`, `InMemoryProtocolStorage`, `defaultStorage`, `generateProtocolId` | Persistence helpers. |
| `DsaSyncAdapter`, `NoOpDsaSyncAdapter` | Pluggable sync; use **`NoOpDsaSyncAdapter`** when sync UI is disabled. |

**Types:** `Protocol`, `ProtocolType`, `SchemaValidatorType`, `ProtocolsTabProps`, `DsaSyncAdapterType`, **`LoadSchemasOptions`**, and related props from **`ProtocolManager.types`** (see `src/components/ProtocolManager/ProtocolManager.types.ts`).

Storybook stories live under **`Components/ProtocolManager/`** (`ProtocolsTab`, `ProtocolList`, `ProtocolCard`, `ProtocolModal`). The published package exposes split schemas under **`node_modules/bdsa-react-components/dist/schemas/`** (e.g. **`bdsa-react-components/schemas/stain-metadata.json`**). **`ProtocolsTab`** defaults to **`useBundledBdsaSchema={true}`** so bundled stain/region JSON is used without HTTP fetch. Set **`useBundledBdsaSchema={false}`** to load from **`SCHEMA_PATHS`** (default **`/schemas/stain-metadata.json`** and **`/schemas/region-metadata.json`** on the host app).

---

## 9. Deprecations / aliases

- `FolderThumbnailBrowser` → use **`OSDThumbnailBrowser`** (same component).
- Matching `FolderThumbnailBrowserProps` → **`OSDThumbnailBrowserProps`**.

---

## Quick dependency map for agents

| Need | Start with |
|------|-------------|
| Login + persisted config | `DsaAuthManager` + `dsaAuthStore` |
| Authenticated REST against DSA | `useDsaResolvedApi`, store `serverUrl`, token headers |
| Browse repos | `FolderBrowser` |
| Curated demo lists via manifest | `ManifestBrowser` + `/manifest.json` |
| Tiles + OSD | `ThumbnailGrid`, `OSDThumbnailBrowser`, `ThumbnailViewer` |
| Whole slide + overlays | `SlideViewer` (+ optional `AnnotationBrowser` / `AnnotationEditor`) |
| GeoJSON interop | `localDocumentToFeatureCollection`, `featureCollectionToLocalDocument`, … |
| Hide non-slide or AI clutter | `hasLargeImage`, `filterLargeImages`, `filterAIModels`, … |
| Schema-driven stain/region protocols | `ProtocolProvider` + `ProtocolsTab` / `ProtocolManager`, `SchemaValidator` |

---

## References in this repo

- Human-oriented setup: [`INTEGRATION.md`](INTEGRATION.md)  
- Detailed API tables (may drift; prefer `src/index.ts` exports): [`API.md`](API.md)  
- Auth behavior: [`DSA_AUTH_USAGE.md`](DSA_AUTH_USAGE.md)  

When in doubt, **`src/index.ts` is the source of truth** for published exports.
