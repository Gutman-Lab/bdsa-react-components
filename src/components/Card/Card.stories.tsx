import type { Meta, StoryObj } from '@storybook/react'
import { Card } from './Card'
import { Button } from '../Button/Button'

const meta = {
    title: 'Components/Card',
    component: Card,
    parameters: {
        layout: 'padded',
    },
    tags: ['autodocs'],
    argTypes: {
        shadow: {
            control: 'select',
            options: ['none', 'small', 'medium', 'large'],
        },
        padding: {
            control: 'select',
            options: ['none', 'small', 'medium', 'large'],
        },
        bordered: {
            control: 'boolean',
        },
        hoverable: {
            control: 'boolean',
        },
    },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
    args: {
        children: 'This is a basic card with some content.',
    },
}

export const WithHeader: Story = {
    args: {
        header: 'Card Title',
        children: 'This card has a header section.',
    },
}

export const WithFooter: Story = {
    args: {
        children: 'This card has a footer section.',
        footer: 'Last updated: October 30, 2025',
    },
}

export const Complete: Story = {
    args: {
        header: 'Complete Card',
        children: 'This card has both a header and footer.',
        footer: 'Footer information',
    },
}

export const Hoverable: Story = {
    args: {
        header: 'Hoverable Card',
        children: 'Hover over this card to see the effect.',
        hoverable: true,
    },
}

export const WithButton: Story = {
    args: {
        header: 'Digital Slide Information',
        children: (
            <div>
                <p style={{ marginTop: 0 }}>
                    View and analyze pathology slides with advanced imaging tools.
                </p>
                <p>Resolution: 40x magnification</p>
                <p>Format: SVS</p>
            </div>
        ),
        footer: (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="small">
                    Download
                </Button>
                <Button variant="primary" size="small">
                    View Slide
                </Button>
            </div>
        ),
    },
}

export const LargeShadow: Story = {
    args: {
        shadow: 'large',
        header: 'Large Shadow',
        children: 'This card has a prominent shadow.',
    },
}

export const NoBorder: Story = {
    args: {
        bordered: false,
        shadow: 'medium',
        children: 'This card has no border, just a shadow.',
    },
}

export const NoPadding: Story = {
    args: {
        padding: 'none',
        children: (
            <img
                src="https://via.placeholder.com/400x200"
                alt="Placeholder"
                style={{ width: '100%', display: 'block' }}
            />
        ),
    },
}

