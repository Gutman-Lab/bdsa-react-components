import type { Meta, StoryObj } from '@storybook/react-vite'
import { ManifestBrowser } from './ManifestBrowser'
import { DsaAuthManager } from '../DsaAuthManager/DsaAuthManager'
import { dsaAuthStore } from '../../auth/DsaAuthStore'

const demoServer = 'http://bdsa.pathology.emory.edu:8080'

const meta = {
  title: 'Components/ManifestBrowser',
  component: ManifestBrowser,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'A slim **left panel** (same shell as FolderBrowser) that lists **DSA items** for the **currently logged-in user**.',
          '',
          'It fetches a JSON **manifest** (default `/manifest.json` from `public/`) shaped as `{ "[girderLogin]": ["itemId", ...], ... }`.',
          'The key must match `user.login` from Girder after you sign in. Each item ID is loaded with `GET /api/v1/item/:id` using `dsaAuthStore` headers.',
          '',
          'Use this when you have a **fixed allowlist of slides per user** (e.g. lab workflow) instead of browsing the full folder tree.',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    manifestUrl: {
      control: 'text',
      description: 'URL of the manifest JSON (served from `public/` in dev / Storybook)',
    },
    defaultWidth: {
      control: { type: 'number', min: 180, max: 480, step: 10 },
    },
    onItemSelect: { action: 'item-selected' },
  },
} satisfies Meta<typeof ManifestBrowser>

export default meta
type Story = StoryObj<typeof meta>

/** Log in with a username that appears as a key in `public/manifest.json` (e.g. `admin`, `demo`, `user` on the sample file). Server URL should match the host where those items exist. */
export const WithAuthentication: Story = {
  args: {
    manifestUrl: '/manifest.json',
    defaultWidth: 280,
  },
  decorators: [
    (Story) => {
      dsaAuthStore.updateConfig({ baseUrl: demoServer })
      return <Story />
    },
  ],
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <DsaAuthManager compact />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', borderTop: '1px solid #e0e0e0' }}>
        <ManifestBrowser {...args} />
        <div
          style={{
            flex: 1,
            padding: '1rem 1.25rem',
            fontSize: '14px',
            lineHeight: 1.55,
            background: '#fafafa',
            overflow: 'auto',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Try it</h3>
          <ol style={{ paddingLeft: '1.25rem', margin: '0 0 1rem' }}>
            <li>
              Sign in above (use a login that matches a key in{' '}
              <code style={{ fontSize: '12px' }}>public/manifest.json</code>).
            </li>
            <li>
              Item rows load from the configured DSA server; the sample manifest uses demo item{' '}
              <code style={{ fontSize: '12px' }}>6903df8dd26a6d93de19a9b2</code>.
            </li>
            <li>Add your own Girder login as a key and your item IDs as needed.</li>
          </ol>
          <p style={{ margin: 0, color: '#555' }}>
            Before login, the panel shows &quot;No images available&quot; — the manifest is only read after authentication.
          </p>
        </div>
      </div>
    </div>
  ),
}

/** Only the resizable panel — still requires an authenticated session (and matching manifest key) to show items. */
export const PanelOnly: Story = {
  args: {
    manifestUrl: '/manifest.json',
    defaultWidth: 300,
  },
  decorators: [
    (Story) => {
      dsaAuthStore.updateConfig({ baseUrl: demoServer })
      return (
        <div style={{ height: '100vh', display: 'flex' }}>
          <Story />
        </div>
      )
    },
  ],
}
