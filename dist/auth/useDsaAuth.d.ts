import { DsaAuthStatus, DsaAuthConfig } from './types';

export interface UseDsaAuthReturn {
    authStatus: DsaAuthStatus;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    updateConfig: (config: Partial<DsaAuthConfig>) => void;
    validateToken: () => Promise<boolean>;
    testConnection: () => Promise<{
        success: boolean;
        version?: any;
        message: string;
    }>;
    getAuthHeaders: () => Record<string, string>;
    getApiUrl: (endpoint: string) => string;
    getToken: () => string;
    getConfig: () => DsaAuthConfig;
}
export declare function useDsaAuth(): UseDsaAuthReturn;
//# sourceMappingURL=useDsaAuth.d.ts.map