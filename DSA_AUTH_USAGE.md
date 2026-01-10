# DSA Authentication Component Usage Guide

## Overview

The `DsaAuthManager` component provides a complete authentication solution for DSA (Digital Slide Archive) servers. It includes:

- **Login/Logout UI** with status indicators
- **Persistent sessions** using localStorage
- **Token management** with validation
- **React hook** for easy integration (`useDsaAuth`)
- **Flexible configuration** options

---

## Installation

If you're using this as an npm package:

```bash
npm install bdsa-react-components
```

Or in your local dev environment, just import from the package.

---

## Basic Usage

### Simple Integration

```tsx
import { DsaAuthManager } from 'bdsa-react-components'

function App() {
  return (
    <div>
      <h1>My BDSA Application</h1>
      <DsaAuthManager />
    </div>
  )
}
```

### With Authentication Callback

```tsx
import { DsaAuthManager } from 'bdsa-react-components'
import { useState } from 'react'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  return (
    <div>
      <DsaAuthManager onAuthChange={setIsAuthenticated} />
      
      {isAuthenticated ? (
        <div>Welcome! You can now access DSA resources.</div>
      ) : (
        <div>Please login to access DSA resources.</div>
      )}
    </div>
  )
}
```

### Compact Version (for toolbars)

```tsx
import { DsaAuthManager } from 'bdsa-react-components'

function Toolbar() {
  return (
    <div className="toolbar">
      <button>Load</button>
      <button>Save</button>
      <DsaAuthManager compact={true} />
    </div>
  )
}
```

### Pre-configured Server

If you want to lock the server URL and only allow username/password input:

```tsx
import { DsaAuthManager, dsaAuthStore } from 'bdsa-react-components'
import { useEffect } from 'react'

function App() {
  useEffect(() => {
    // Set server URL on app initialization
    dsaAuthStore.updateConfig({ 
      baseUrl: 'http://bdsa.pathology.emory.edu:8080' 
    })
  }, [])

  return (
    <DsaAuthManager 
      allowServerConfig={false}  // Users can't change the server
    />
  )
}
```

---

## Using the `useDsaAuth` Hook

For more control, use the `useDsaAuth` hook directly in your components:

```tsx
import { useDsaAuth } from 'bdsa-react-components'

function MyComponent() {
  const { 
    authStatus, 
    login, 
    logout, 
    getAuthHeaders, 
    getApiUrl 
  } = useDsaAuth()

  const fetchData = async () => {
    if (!authStatus.isAuthenticated) {
      alert('Please login first')
      return
    }

    const url = getApiUrl('/api/v1/folder')
    const headers = getAuthHeaders()

    const response = await fetch(url, { headers })
    const data = await response.json()
    console.log(data)
  }

  return (
    <div>
      <p>Status: {authStatus.isAuthenticated ? 'Logged in' : 'Not logged in'}</p>
      {authStatus.user && <p>User: {authStatus.user.name}</p>}
      {authStatus.isAuthenticated && (
        <button onClick={fetchData}>Fetch Data</button>
      )}
    </div>
  )
}
```

---

## Direct Store Access

For advanced use cases, you can interact with the auth store directly:

```tsx
import { dsaAuthStore } from 'bdsa-react-components'

// Configure server
dsaAuthStore.updateConfig({
  baseUrl: 'http://bdsa.pathology.emory.edu:8080',
  resourceId: '507f1f77bcf86cd799439011',
  resourceType: 'folder'
})

// Login
try {
  await dsaAuthStore.authenticate('username', 'password')
  console.log('Login successful!')
} catch (error) {
  console.error('Login failed:', error)
}

// Get auth headers for API requests
const headers = dsaAuthStore.getAuthHeaders()
// Returns: { 'Girder-Token': 'your-token', 'Content-Type': 'application/json' }

// Get full API URL
const url = dsaAuthStore.getApiUrl('/api/v1/folder')
// Returns: 'http://bdsa.pathology.emory.edu:8080/api/v1/folder'

// Check status
const status = dsaAuthStore.getStatus()
console.log('Authenticated:', status.isAuthenticated)
console.log('User:', status.user)
console.log('Token expires:', status.tokenExpiry)

// Logout
dsaAuthStore.logout()
```

---

## Integration with Existing Components

### Example: Using with AnnotationManager

```tsx
import { 
  DsaAuthManager, 
  AnnotationManager, 
  useDsaAuth 
} from 'bdsa-react-components'
import { useState } from 'react'

function AnnotationViewer() {
  const { authStatus, getApiUrl } = useDsaAuth()
  const [imageId, setImageId] = useState('6903df8dd26a6d93de19a9b2')

  const apiBaseUrl = authStatus.isConfigured ? authStatus.serverUrl : ''

  return (
    <div>
      <div className="header">
        <h1>Annotation Viewer</h1>
        <DsaAuthManager compact={true} />
      </div>

      {authStatus.isAuthenticated ? (
        <AnnotationManager
          imageId={imageId}
          apiBaseUrl={apiBaseUrl}
          onAnnotationsLoad={(annotations) => {
            console.log('Loaded annotations:', annotations)
          }}
        />
      ) : (
        <div>Please login to view annotations</div>
      )}
    </div>
  )
}
```

### Example: Using with FolderBrowser

```tsx
import { 
  DsaAuthManager, 
  FolderBrowser, 
  useDsaAuth 
} from 'bdsa-react-components'

function ResourceBrowser() {
  const { authStatus } = useDsaAuth()

  return (
    <div>
      <DsaAuthManager />
      
      {authStatus.isAuthenticated && (
        <FolderBrowser
          apiBaseUrl={authStatus.serverUrl}
          onResourceSelect={(resource) => {
            console.log('Selected:', resource)
          }}
        />
      )}
    </div>
  )
}
```

---

## Component Props

### `DsaAuthManager` Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onAuthChange` | `(isAuthenticated: boolean) => void` | `undefined` | Callback fired when authentication status changes |
| `allowServerConfig` | `boolean` | `true` | Allow users to configure server URL in login modal |
| `className` | `string` | `''` | Additional CSS class name for styling |
| `compact` | `boolean` | `false` | Use compact layout for toolbars |

---

## Hook API

### `useDsaAuth()` Returns

```typescript
{
  authStatus: DsaAuthStatus,           // Current authentication status
  login: (username, password) => Promise<void>,
  logout: () => void,
  updateConfig: (config) => void,
  validateToken: () => Promise<boolean>,
  testConnection: () => Promise<{success, version, message}>,
  getAuthHeaders: () => Record<string, string>,
  getApiUrl: (endpoint) => string,
  getToken: () => string,
  getConfig: () => DsaAuthConfig,
}
```

### `DsaAuthStatus` Type

```typescript
{
  isAuthenticated: boolean,
  isConfigured: boolean,
  hasToken: boolean,
  hasConfig: boolean,
  user: DsaUserInfo | null,
  serverUrl: string,
  resourceId?: string,
  resourceType?: 'folder' | 'collection',
  lastLogin?: Date | null,
  tokenExpiry?: Date | null,
}
```

---

## Migrating from Wrangler App

If you're migrating from the BDSA-Schema-Wrangler app, here's the mapping:

### Old Code (Wrangler)
```jsx
import DsaLogin from './components/DsaLogin'
import dsaAuthStore from './utils/dsaAuthStore'

function App() {
  return <DsaLogin />
}
```

### New Code (bdsa-react-components)
```jsx
import { DsaAuthManager, dsaAuthStore } from 'bdsa-react-components'

function App() {
  return <DsaAuthManager />
}
```

The API is almost identical! The main differences:

1. **Component name**: `DsaLogin` → `DsaAuthManager`
2. **Import path**: `'./components/DsaLogin'` → `'bdsa-react-components'`
3. **Store is the same**: The `dsaAuthStore` API is identical

---

## Styling

The component comes with default styles. To customize:

```css
/* Override default styles */
.dsa-auth-manager {
  background: #f0f0f0;
  padding: 12px;
}

.dsa-auth-manager .login-button {
  background: #007bff;
}

.dsa-auth-manager .logout-button {
  background: #dc3545;
}
```

Or use the `className` prop for specific instances:

```tsx
<DsaAuthManager className="my-custom-auth" />
```

---

## Advanced: Subscribe to Auth Changes

```tsx
import { dsaAuthStore } from 'bdsa-react-components'
import { useEffect } from 'react'

function MyComponent() {
  useEffect(() => {
    // Subscribe to all auth changes
    const unsubscribe = dsaAuthStore.subscribe(() => {
      const status = dsaAuthStore.getStatus()
      console.log('Auth changed:', status)
      
      // Do something when auth state changes
      if (status.isAuthenticated) {
        // Fetch data, enable features, etc.
      }
    })

    // Cleanup subscription
    return unsubscribe
  }, [])

  return <div>My Component</div>
}
```

---

## Testing

The component includes comprehensive tests. To test authentication in your app:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { DsaAuthManager, dsaAuthStore } from 'bdsa-react-components'

describe('My App with Auth', () => {
  beforeEach(() => {
    // Clear auth state before each test
    dsaAuthStore.logout()
    localStorage.clear()
  })

  it('renders login button when not authenticated', () => {
    render(<DsaAuthManager />)
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('configures server on mount', () => {
    dsaAuthStore.updateConfig({ 
      baseUrl: 'http://test.example.com' 
    })
    render(<DsaAuthManager />)
    expect(screen.getByText('Not Connected')).toBeInTheDocument()
  })
})
```

---

## Troubleshooting

### "Not Configured" Status
- Make sure you've set the `baseUrl` using `dsaAuthStore.updateConfig()`
- Or allow users to enter it by setting `allowServerConfig={true}`

### Token Expired
- Girder tokens expire after 30 days by default
- The component automatically handles this and prompts for re-login
- Token validation happens on component mount

### CORS Issues
- Make sure your DSA server allows CORS from your app's origin
- Check DSA server configuration for `girder.cors.allow_origin`

### localStorage Not Working
- Check if localStorage is available in your environment
- Private browsing modes may restrict localStorage

---

## Next Steps

1. **Integrate with AnnotationManager** for viewing annotations
2. **Use FolderBrowser** to let users select resources
3. **Build custom UI** using the `useDsaAuth` hook
4. **Add more DSA API calls** using `getAuthHeaders()` and `getApiUrl()`

For more examples, check the Storybook stories:
```bash
npm run storybook
```

---

## Questions?

Check the component's Storybook documentation for interactive examples, or examine the source code in `src/components/DsaAuthManager/`.

