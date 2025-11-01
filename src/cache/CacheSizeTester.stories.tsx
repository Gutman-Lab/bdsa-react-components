import type { Meta, StoryObj } from '@storybook/react'
import { CacheSizeTester } from './CacheSizeTester'

const meta: Meta<typeof CacheSizeTester> = {
    title: 'Utilities/Cache Size Tester',
    component: CacheSizeTester,
    tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof CacheSizeTester>

const exampleApiBaseUrl = 'http://bdsa.pathology.emory.edu:8080/api/v1'
const exampleImageId = '6903df8dd26a6d93de19a9b2'

export const Default: Story = {
    args: {
        apiBaseUrl: exampleApiBaseUrl,
        imageId: exampleImageId,
    },
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                story: 'Test utility to measure annotation document sizes. Click "Measure Annotation Sizes" to fetch all annotations for the image and calculate their storage requirements. This helps determine if IndexedDB caching is feasible for your annotation documents.',
            },
        },
    },
}

