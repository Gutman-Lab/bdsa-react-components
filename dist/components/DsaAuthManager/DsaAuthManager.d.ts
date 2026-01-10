import { default as React } from 'react';

export interface DsaAuthManagerProps {
    /**
     * Callback function that fires whenever the authentication status changes.
     *
     * @param isAuthenticated - `true` if user is logged in, `false` otherwise
     *
     * @example
     * ```tsx
     * <DsaAuthManager
     *   onAuthChange={(isAuthenticated) => {
     *     console.log('Auth status:', isAuthenticated)
     *     // Update your app state, redirect, etc.
     *   }}
     * />
     * ```
     */
    onAuthChange?: (isAuthenticated: boolean) => void;
    /**
     * Whether to show server URL configuration in the login modal.
     *
     * - `true` (default): Users can enter/change the DSA server URL
     * - `false`: Server URL is locked (must be configured programmatically via `dsaAuthStore`)
     *
     * @default true
     *
     * @example
     * ```tsx
     * // Allow users to configure server
     * <DsaAuthManager allowServerConfig={true} />
     *
     * // Lock server URL (pre-configured)
     * <DsaAuthManager allowServerConfig={false} />
     * ```
     */
    allowServerConfig?: boolean;
    /**
     * Custom CSS class name to apply to the component container.
     * Useful for styling integration with your application.
     *
     * @example
     * ```tsx
     * <DsaAuthManager className="my-custom-auth-manager" />
     * ```
     */
    className?: string;
    /**
     * Show compact version of the component (minimal UI).
     * Ideal for toolbars, headers, or space-constrained layouts.
     *
     * Compact mode shows:
     * - Status indicator icon
     * - User name (if authenticated)
     * - Login/Logout button
     *
     * @default false
     *
     * @example
     * ```tsx
     * <DsaAuthManager compact={true} />
     * ```
     */
    compact?: boolean;
}
export declare const DsaAuthManager: React.FC<DsaAuthManagerProps>;
export default DsaAuthManager;
//# sourceMappingURL=DsaAuthManager.d.ts.map