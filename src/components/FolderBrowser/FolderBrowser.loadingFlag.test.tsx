import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FolderBrowser } from './FolderBrowser'
import { TreeNode } from './TreeNode'
import { dsaAuthStore } from '../../auth/DsaAuthStore'

const ROOT_ID = '6afb70c82d4ebb5675ca269d'
const EXPANSION_KEY = 'folder-browser-loading-flag:expand'
const FOLDERS = [
  { _id: 'folder-annotator', name: 'Annotator Test Folders' },
  { _id: 'folder-tau', name: 'Tau Annotation' },
  { _id: 'folder-temp', name: 'temp' },
]

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response
}

function installFetch(handler: (url: string) => Response | Promise<Response>) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/v1/user/authentication')) {
      return jsonResponse({ authToken: { token: 'token' }, user: { login: 'user' } })
    }
    return handler(url)
  }) as unknown as typeof fetch
}

async function signIn() {
  dsaAuthStore.updateConfig({ baseUrl: 'http://dsa.test' })
  await dsaAuthStore.authenticate('user', 'password')
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('FolderBrowser loading flag', () => {
  beforeEach(async () => {
    localStorage.clear()
    dsaAuthStore.logout()
    installFetch(() => jsonResponse({}, 404))
    await signIn()
  })

  it('clears the root loading flag after a deep-linked collection resolves', async () => {
    localStorage.setItem(EXPANSION_KEY, JSON.stringify([ROOT_ID]))
    installFetch((url) => {
      if (url.includes(`/api/v1/collection/${ROOT_ID}`)) {
        return jsonResponse({ _id: ROOT_ID, name: 'DuggerLab Collaboration' })
      }
      if (url.includes('/api/v1/folder')) {
        return jsonResponse(FOLDERS)
      }
      return jsonResponse({}, 404)
    })

    render(
      <FolderBrowser
        rootId={ROOT_ID}
        rootType="collection"
        persistExpansion
        persistExpansionKey={EXPANSION_KEY}
        scrollSelectedIntoView={false}
      />,
    )

    expect(await screen.findByText('Annotator Test Folders')).toBeInTheDocument()
    expect(screen.getByText('Tau Annotation')).toBeInTheDocument()
    expect(screen.getByText('temp')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
  })

  it('clears the loading flag when a folder fetch rejects', async () => {
    installFetch((url) => {
      if (url.includes('/api/v1/collection?limit=')) {
        return jsonResponse([{ _id: 'collection-1', name: 'DuggerLab Collaboration' }])
      }
      if (url.includes('/api/v1/folder')) {
        return jsonResponse({ message: 'boom' }, 500)
      }
      return jsonResponse({}, 404)
    })

    render(<FolderBrowser scrollSelectedIntoView={false} />)

    const collection = await screen.findByText('DuggerLab Collaboration')
    fireEvent.doubleClick(collection)
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
  })

  it('renders loaded children even if a stale loading flag remains', () => {
    render(
      <TreeNode
        parentId="root"
        depth={1}
        expanded={new Set()}
        childrenMap={new Map([['root', { folders: [{ _id: 'loaded', name: 'Loaded folder' }], items: [] }]])}
        loadingIds={new Set(['root'])}
        onFolderToggle={() => {}}
        onFolderSelect={() => {}}
      />,
    )

    expect(screen.getByText('Loaded folder')).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })
})
