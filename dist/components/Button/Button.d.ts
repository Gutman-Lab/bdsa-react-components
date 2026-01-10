import { default as React } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * The variant style of the button
     */
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
    /**
     * The size of the button
     */
    size?: 'small' | 'medium' | 'large';
    /**
     * Whether the button should take the full width of its container
     */
    fullWidth?: boolean;
    /**
     * Whether the button is in a loading state
     */
    loading?: boolean;
}
/**
 * A versatile button component for the BDSA project
 */
export declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
//# sourceMappingURL=Button.d.ts.map