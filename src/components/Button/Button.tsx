import React from 'react'
import './Button.css'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * The variant style of the button
     */
    variant?: 'primary' | 'secondary' | 'danger' | 'success'
    /**
     * The size of the button
     */
    size?: 'small' | 'medium' | 'large'
    /**
     * Whether the button should take the full width of its container
     */
    fullWidth?: boolean
    /**
     * Whether the button is in a loading state
     */
    loading?: boolean
}

/**
 * A versatile button component for the BDSA project
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'medium',
            fullWidth = false,
            loading = false,
            className = '',
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        const classes = [
            'bdsa-button',
            `bdsa-button--${variant}`,
            `bdsa-button--${size}`,
            fullWidth ? 'bdsa-button--full-width' : '',
            loading ? 'bdsa-button--loading' : '',
            className,
        ]
            .filter(Boolean)
            .join(' ')

        return (
            <button
                ref={ref}
                className={classes}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? (
                    <>
                        <span className="bdsa-button__spinner" />
                        <span className="bdsa-button__text">{children}</span>
                    </>
                ) : (
                    children
                )}
            </button>
        )
    }
)

Button.displayName = 'Button'

