# Annotation Cache Module

This module provides a pluggable caching system for annotation documents with automatic version-based invalidation.

## Architecture

The cache is a **separate module** (not part of AnnotationManager or SlideViewer) that implements a common interface. This allows you to:

1. **Switch cache implementations** based on your needs:
   - `MemoryAnnotationCache` - Fast, in-memory (cleared on refresh)
   - `IndexedDBAnnotationCache` - Persistent across refreshes, handles large documents (50MB+)
   - Future: `RedisAnnotationCache` - Server-side Redis cache
   - Future: `PostgresAnnotationCache` - Server-side PostgreSQL with pgvector

2. **Use it with any component** that needs annotation caching - currently `SlideViewer`, but could be extended to other components.

## Usage

```typescript
import { IndexedDBAnnotationCache, SlideViewer } from 'bdsa-react-components'

// Create cache instance (no configuration needed - handles large documents automatically)
const cache = new IndexedDBAnnotationCache()

// Get annotation headers from AnnotationManager
const headers = annotations.reduce((map, ann) => {
    map.set(ann._id, ann)  // Store header metadata
    return map
}, new Map())

// Pass to SlideViewer
<SlideViewer
    annotationCache={cache}
    annotationHeaders={headers}  // For version-based invalidation
    annotationIds={[...]}
/>
```

## How Version Hashing Works

1. **AnnotationManager** fetches headers from `/annotation?itemId=...` (lightweight metadata)
2. **Headers passed to SlideViewer** via `annotationHeaders` prop
3. **SlideViewer computes hash** from header fields (`_id`, `_version`, `updated`, `modified`, etc.)
4. **Cache lookup** uses hash to verify validity:
   - Hash matches → Cache hit (use cached data)
   - Hash differs → Cache miss (fetch fresh data, update cache)

## Downsides & Limitations

### Current Approach

1. **IndexedDB Storage Limits**: 
   - Initial quota: Typically 50MB+ (varies by browser and available disk space)
   - Browser automatically prompts user for quota expansion when needed
   - Can request persistent storage to prevent automatic cleanup
   - Mitigation: Use `checkIndexedDBQuota()` and `requestPersistentStorage()` utilities

2. **Header Dependency**:
   - Requires passing headers from AnnotationManager → SlideViewer
   - If headers aren't provided, version checking is skipped (cache still works, just no invalidation)
   - Headers must be kept in sync with annotation documents

3. **Hash Field Sensitivity**:
   - Only invalidates if header fields change (`_version`, `updated`, etc.)
   - If server changes annotation but doesn't update version fields, cache won't invalidate
   - Mitigation: Server should update version/timestamp fields when annotations change

4. **Client-Side Only**:
   - Current implementations are browser-only
   - Can't share cache across users/devices
   - Future Redis/Postgres implementations will solve this

### Switching Cache Implementations

Yes! You can easily switch:

```typescript
// Development - fast, no persistence
const cache = new MemoryAnnotationCache()

// Production - persistent, survives refreshes, handles large documents
const cache = new IndexedDBAnnotationCache()

// Future - server-side, shared across users
const cache = new RedisAnnotationCache({ 
    host: 'redis.example.com',
    port: 6379 
})
```

The interface is the same, so switching is just changing the constructor call.

## IndexedDB Quota Management

IndexedDB storage limits are automatically managed by the browser:

- **Initial quota**: Typically 50MB+ (varies by browser and available disk space)
- **Automatic expansion**: Browser prompts user when quota is exceeded (no code changes needed)
- **Persistent storage**: Can request persistent storage to prevent browser cleanup

```typescript
import { checkIndexedDBQuota, requestPersistentStorage, logQuotaInfo } from 'bdsa-react-components'

// Check current quota status
const quotaInfo = await checkIndexedDBQuota()
if (quotaInfo) {
    console.log(`Usage: ${quotaInfo.usagePercent.toFixed(1)}%`)
    console.log(`Available: ${quotaInfo.available} bytes`)
}

// Request persistent storage (prevents automatic cleanup)
const granted = await requestPersistentStorage()

// Log quota info in readable format
await logQuotaInfo()
```

**Note**: The browser automatically handles quota expansion - you don't need to do anything special in your code. When storage exceeds the quota, the browser will prompt the user for permission to increase it.

## Future Improvements

1. **Redis Cache**: Server-side, shared across users, better for production
2. **PostgreSQL Cache**: With pgvector for similarity search
3. **Cache Warming**: Pre-load annotations based on usage patterns
4. **Compression**: Compress large annotation documents before caching (browser native CompressionStream API available)

