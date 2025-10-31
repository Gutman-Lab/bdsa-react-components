import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
    it('renders children', () => {
        render(<Card>Card content</Card>)
        expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('renders header when provided', () => {
        render(<Card header="Card Header">Content</Card>)
        expect(screen.getByText('Card Header')).toBeInTheDocument()
    })

    it('renders footer when provided', () => {
        render(<Card footer="Card Footer">Content</Card>)
        expect(screen.getByText('Card Footer')).toBeInTheDocument()
    })

    it('applies shadow classes', () => {
        const { container, rerender } = render(<Card shadow="medium">Content</Card>)
        expect(container.firstChild).toHaveClass('bdsa-card--shadow-medium')

        rerender(<Card shadow="large">Content</Card>)
        expect(container.firstChild).toHaveClass('bdsa-card--shadow-large')
    })

    it('applies bordered class', () => {
        const { container } = render(<Card bordered>Content</Card>)
        expect(container.firstChild).toHaveClass('bdsa-card--bordered')
    })

    it('applies hoverable class', () => {
        const { container } = render(<Card hoverable>Content</Card>)
        expect(container.firstChild).toHaveClass('bdsa-card--hoverable')
    })

    it('applies padding classes to content', () => {
        const { container, rerender } = render(<Card padding="small">Content</Card>)
        const contentDiv = container.querySelector('.bdsa-card__content')
        expect(contentDiv).toHaveClass('bdsa-card__content--padding-small')

        rerender(<Card padding="large">Content</Card>)
        expect(contentDiv).toHaveClass('bdsa-card__content--padding-large')
    })

    it('forwards ref to div element', () => {
        const ref = { current: null as HTMLDivElement | null }
        render(<Card ref={ref}>Card</Card>)
        expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('passes through additional props', () => {
        const { container } = render(
            <Card data-testid="custom-card">Content</Card>
        )
        expect(container.firstChild).toHaveAttribute('data-testid', 'custom-card')
    })
})

