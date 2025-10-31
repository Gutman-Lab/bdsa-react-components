import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
    it('renders with children', () => {
        render(<Button>Click me</Button>)
        expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })

    it('applies variant classes', () => {
        const { rerender } = render(<Button variant="primary">Primary</Button>)
        expect(screen.getByRole('button')).toHaveClass('bdsa-button--primary')

        rerender(<Button variant="danger">Danger</Button>)
        expect(screen.getByRole('button')).toHaveClass('bdsa-button--danger')
    })

    it('applies size classes', () => {
        const { rerender } = render(<Button size="small">Small</Button>)
        expect(screen.getByRole('button')).toHaveClass('bdsa-button--small')

        rerender(<Button size="large">Large</Button>)
        expect(screen.getByRole('button')).toHaveClass('bdsa-button--large')
    })

    it('handles click events', async () => {
        const handleClick = vi.fn()
        const user = userEvent.setup()

        render(<Button onClick={handleClick}>Click me</Button>)
        await user.click(screen.getByRole('button'))

        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('disables the button when disabled prop is true', () => {
        render(<Button disabled>Disabled</Button>)
        expect(screen.getByRole('button')).toBeDisabled()
    })

    it('shows loading state', () => {
        render(<Button loading>Loading</Button>)
        expect(screen.getByRole('button')).toBeDisabled()
        expect(screen.getByRole('button')).toHaveClass('bdsa-button--loading')
    })

    it('applies fullWidth class', () => {
        render(<Button fullWidth>Full Width</Button>)
        expect(screen.getByRole('button')).toHaveClass('bdsa-button--full-width')
    })

    it('forwards ref to button element', () => {
        const ref = { current: null as HTMLButtonElement | null }
        render(<Button ref={ref}>Button</Button>)
        expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })
})

