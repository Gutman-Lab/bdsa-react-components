import React from 'react'
import './Card.css'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Optional header content
     */
    header?: React.ReactNode
    /**
     * Optional footer content
     */
    footer?: React.ReactNode
    /**
     * Whether the card has a shadow
     */
    shadow?: 'none' | 'small' | 'medium' | 'large'
    /**
     * Whether the card has a border
     */
    bordered?: boolean
    /**
     * Whether the card is hoverable (shows hover effect)
     */
    hoverable?: boolean
    /**
     * Padding size
     */
    padding?: 'none' | 'small' | 'medium' | 'large'
}

/**
 * A flexible card component for the BDSA project
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    (
        {
            header,
            footer,
            children,
            shadow = 'small',
            bordered = true,
            hoverable = false,
            padding = 'medium',
            className = '',
            ...props
        },
        ref
    ) => {
        const classes = [
            'bdsa-card',
            `bdsa-card--shadow-${shadow}`,
            bordered ? 'bdsa-card--bordered' : '',
            hoverable ? 'bdsa-card--hoverable' : '',
            className,
        ]
            .filter(Boolean)
            .join(' ')

        const contentClasses = [
            'bdsa-card__content',
            `bdsa-card__content--padding-${padding}`,
        ].join(' ')

        return (
            <div ref={ref} className={classes} {...props}>
                {header && <div className="bdsa-card__header">{header}</div>}
                <div className={contentClasses}>{children}</div>
                {footer && <div className="bdsa-card__footer">{footer}</div>}
            </div>
        )
    }
)

Card.displayName = 'Card'

