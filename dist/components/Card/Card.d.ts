import { default as React } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Optional header content
     */
    header?: React.ReactNode;
    /**
     * Optional footer content
     */
    footer?: React.ReactNode;
    /**
     * Whether the card has a shadow
     */
    shadow?: 'none' | 'small' | 'medium' | 'large';
    /**
     * Whether the card has a border
     */
    bordered?: boolean;
    /**
     * Whether the card is hoverable (shows hover effect)
     */
    hoverable?: boolean;
    /**
     * Padding size
     */
    padding?: 'none' | 'small' | 'medium' | 'large';
}
/**
 * A flexible card component for the BDSA project
 */
export declare const Card: React.ForwardRefExoticComponent<CardProps & React.RefAttributes<HTMLDivElement>>;
//# sourceMappingURL=Card.d.ts.map