import { DsaAuthConfig, DsaUserInfo, DsaAuthStatus, DsaAuthListener } from './types';

declare class DsaAuthStore {
    private listeners;
    private config;
    private token;
    private userInfo;
    private lastLogin;
    private tokenExpiry;
    private isAuthenticated;
    constructor();
    subscribe(listener: DsaAuthListener): () => void;
    private notify;
    private loadConfig;
    private loadToken;
    private loadUserInfo;
    private loadLastLogin;
    private loadTokenExpiry;
    private saveConfig;
    private saveToken;
    private saveUserInfo;
    private saveLastLogin;
    private saveTokenExpiry;
    private validateAuthentication;
    authenticate(username: string, password: string): Promise<{
        success: boolean;
        user?: DsaUserInfo;
        error?: string;
    }>;
    logout(): void;
    validateToken(): Promise<boolean>;
    updateConfig(newConfig: Partial<DsaAuthConfig>): void;
    setServerUrl(baseUrl: string): void;
    getAuthHeaders(): Record<string, string>;
    getApiUrl(endpoint: string): string;
    isConfigured(): boolean;
    isDataReady(): boolean;
    getStatus(): DsaAuthStatus;
    getConfig(): DsaAuthConfig;
    getToken(): string;
    /**
     * Set token directly (used for API key → token exchange or backend-provided tokens)
     * This bypasses the normal login flow and sets the token directly.
     */
    setToken(token: string, userInfo?: DsaUserInfo, expiryDays?: number): void;
    testConnection(): Promise<{
        success: boolean;
        version?: any;
        message: string;
    }>;
}
export declare const dsaAuthStore: DsaAuthStore;
export default dsaAuthStore;
//# sourceMappingURL=DsaAuthStore.d.ts.map