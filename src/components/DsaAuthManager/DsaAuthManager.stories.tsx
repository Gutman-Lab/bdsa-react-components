import type { Meta, StoryObj } from '@storybook/react'
import { DsaAuthManager } from './DsaAuthManager'
import { dsaAuthStore } from '../../auth/DsaAuthStore'

const meta: Meta<typeof DsaAuthManager> = {
  title: 'Components/DsaAuthManager',
  component: DsaAuthManager,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onAuthChange: { action: 'authChanged' },
    allowServerConfig: {
      control: 'boolean',
      description: 'Allow user to configure server URL in login modal',
    },
    compact: {
      control: 'boolean',
      description: 'Show compact version of the component',
    },
    className: {
      control: 'text',
      description: 'Additional CSS class name',
    },
  },
}

export default meta
type Story = StoryObj<typeof DsaAuthManager>

/**
 * Default authentication manager with all features enabled.
 * Users can configure the server URL and login/logout.
 */
export const Default: Story = {
  args: {
    allowServerConfig: true,
    compact: false,
  },
}

/**
 * Compact version of the auth manager for use in toolbars or headers.
 * Takes up less space while maintaining full functionality.
 */
export const Compact: Story = {
  args: {
    allowServerConfig: true,
    compact: true,
  },
}

/**
 * Auth manager with server URL already configured.
 * Users can only enter username/password, not change the server.
 */
export const PreConfiguredServer: Story = {
  args: {
    allowServerConfig: false,
    compact: false,
  },
  decorators: [
    Story => {
      // Pre-configure server URL
      dsaAuthStore.updateConfig({ baseUrl: 'http://bdsa.pathology.emory.edu:8080' })
      return <Story />
    },
  ],
}

/**
 * Authenticated state - shows logged in user.
 * This demonstrates what the component looks like after successful login.
 */
export const Authenticated: Story = {
  args: {
    allowServerConfig: true,
    compact: false,
  },
  decorators: [
    Story => {
      // Simulate authenticated state (mock for demo purposes)
      // In real usage, this would happen after actual login
      return (
        <div>
          <div
            style={{
              padding: '12px',
              marginBottom: '16px',
              background: '#e3f2fd',
              borderRadius: '6px',
              fontSize: '0.9rem',
            }}
          >
            <strong>Note:</strong> To test authentication, you'll need a real DSA server. Try using:
            <br />
            Server: <code>http://bdsa.pathology.emory.edu:8080</code>
            <br />
            (You'll need valid credentials)
          </div>
          <Story />
        </div>
      )
    },
  ],
}

/**
 * Integration example showing the auth manager in a typical header layout.
 */
export const InHeader: Story = {
  args: {
    allowServerConfig: true,
    compact: false,
  },
  decorators: [
    Story => {
      return (
        <div
          style={{
            width: '100%',
            minWidth: '800px',
            background: '#f5f5f5',
            padding: '16px',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>BDSA App</h1>
              <nav style={{ display: 'flex', gap: '16px' }}>
                <a href="#" style={{ color: '#1976d2', textDecoration: 'none' }}>
                  Data
                </a>
                <a href="#" style={{ color: '#666', textDecoration: 'none' }}>
                  Protocols
                </a>
                <a href="#" style={{ color: '#666', textDecoration: 'none' }}>
                  Cases
                </a>
              </nav>
            </div>
            <Story />
          </div>
        </div>
      )
    },
  ],
}

/**
 * Compact version in a toolbar.
 */
export const CompactInToolbar: Story = {
  args: {
    allowServerConfig: true,
    compact: true,
  },
  decorators: [
    Story => {
      return (
        <div
          style={{
            width: '100%',
            minWidth: '600px',
            background: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={{
                padding: '6px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              Load
            </button>
            <button
              style={{
                padding: '6px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              style={{
                padding: '6px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              Export
            </button>
          </div>
          <Story />
        </div>
      )
    },
  ],
}

/**
 * Example with callback handling
 */
export const WithCallbacks: Story = {
  args: {
    allowServerConfig: true,
    compact: false,
    onAuthChange: isAuthenticated => {
      console.log('Auth status changed:', isAuthenticated)
      // In a real app, you might fetch data, enable features, etc.
    },
  },
  decorators: [
    Story => {
      return (
        <div>
          <div
            style={{
              padding: '12px',
              marginBottom: '16px',
              background: '#fff3e0',
              borderRadius: '6px',
              fontSize: '0.9rem',
            }}
          >
            <strong>Check the console!</strong>
            <br />
            The <code>onAuthChange</code> callback will fire when you login/logout.
          </div>
          <Story />
        </div>
      )
    },
  ],
}

