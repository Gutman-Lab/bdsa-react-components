# Backlog / follow-ups

Internal notes for features to revisit. Not a public roadmap.

## FolderBrowser (vs. pre-refactor `bdsa-react-components-old`)

### Pagination and large lists (**to add when needed**)

The current `FolderBrowser` loads collections, child folders, and folder items with **`limit=0`** on each request and does **not** paginate or merge paged responses. That matches a “fetch everything the server returns in one shot” approach, but:

- If the API caps page size regardless of `limit`, lists can be **incomplete**.
- Large folders can mean **heavy payloads** and slow UI.

**TODO:** Consider restoring **paged fetching** for folders and/or items (offsets, “load more”, optional auto-load), similar to the old `foldersPerPage`, `itemsPerPage`, and `itemPaginationMode` (`manual` / `auto` / `button`).

---

### Other significant behavior in the **old** implementation (not fully replicated today)

The rewrite intentionally simplified integration around **`dsaAuthStore`** and always shows **items** when a folder expands (with optional `allowedExtensions`). The previous component also exposed:

| Area | Old behavior | Current rewrite (short note) |
|------|----------------|------------------------------|
| **API wiring** | `apiBaseUrl`, optional `fetchFn`, `apiHeaders` | Uses store `serverUrl` + `getAuthHeaders()` |
| **Resource selection** | `onResourceSelect`, `onSelectionChange` with typed `Resource` (collection \| folder \| item) | **Done in rewrite:** `FolderBrowserResource` + `onResourceSelect` / `onSelectionChange`; single-click row selects, double-click row or single-click chevron expands/collapses |
| **Root / deep link** | `rootId` + `rootType`, `startCollectionId`, `startFolderId` | **Done in rewrite:** same props; `rootId`/`rootType` uses `GET /collection/:id` or `/folder/:id` (collection fallback: list + find). Auto-expand helpers for `startCollectionId` / `startFolderId` when listing all collections |
| **Items visibility** | `showItems`, `fetchItems` (e.g. counts without listing) | Items load whenever a folder expands |
| **Item filtering** | `itemFilter`, `onItemsFetched` | `allowedExtensions` only (by filename extension) |
| **Folder UI** | `showItemCount`, item-count / “+N” / load-more UX | Not present |
| **Persistence** | `persistExpansion`, `persistSelection` + storage keys | **Done in rewrite:** `persistExpansion` / `persistExpansionKey`, `persistSelection` / `persistSelectionKey` (JSON array of expanded ids; selection uses `{ resource, timestamp }`). Disabled when `syntheticData` is set. |
| **Scroll selected into view** | Auto-scroll to `data-resource-id` | **Done:** `scrollSelectedIntoView` (default `true`); rows expose `data-resource-id` for collections, folders, and items |
| **Errors** | `onApiError` with retry callback | Errors mostly logged or shown as inline message; no structured retry hook |
| **Debugging** | `debug` flag → structured logging | Not present |
| **Custom row rendering** | `renderCollection` / `renderFolder` could replace the **entire** node (easy to break subtrees) | Row-only custom render; tree expansion/children stay internal |

When product requirements match any row above, treat it as a candidate to **reintroduce or redesign** (possibly with clearer APIs than the old full-node `renderFolder` pattern).

---

## How to use this file

- Link from PRs or issues when deferring FolderBrowser parity work.
- Prefer **small, targeted** additions (e.g. item pagination first) over re-copying the old monolithic component wholesale.
