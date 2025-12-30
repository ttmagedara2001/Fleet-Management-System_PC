import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// Enable demo mode to bypass API calls during development
// Set to false for production use with actual API
const DEMO_MODE = false;

const AUTH_CONFIG = {
    API_URL: 'https://api.protonestconnect.co/api/v1/user/get-token',
    USER_EMAIL: 'ratnaabinayansn@gmail.com',
    USER_SECRET: '6M3@pwYvBGRVJLN'
};

export function AuthProvider({ children }) {
    const [token, setToken] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [authTimestamp, setAuthTimestamp] = useState(null);

    const performLogin = useCallback(async () => {
        console.log('[Auth] 🔐 Initiating automatic login...');
        console.log('[Auth] 📧 User:', AUTH_CONFIG.USER_EMAIL);
        console.log('[Auth] 🎮 Demo Mode:', DEMO_MODE ? 'ENABLED' : 'DISABLED');

        setIsLoading(true);
        setError(null);

        // Demo mode - bypass actual API for development
        if (DEMO_MODE) {
            console.log('[Auth] 🎮 Using demo mode - bypassing API');

            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            const mockToken = 'demo-token-' + Date.now();
            setToken(mockToken);
            setIsAuthenticated(true);
            setAuthTimestamp(Date.now());

            console.log('[Auth] ✅ Demo authentication successful');
            console.log('[Auth] 🎫 Mock token generated');
            setIsLoading(false);
            return;
        }

        try {
            console.log('[Auth] 📡 Sending authentication request to:', AUTH_CONFIG.API_URL);

            const response = await fetch(AUTH_CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: AUTH_CONFIG.USER_EMAIL,
                    secretKey: AUTH_CONFIG.USER_SECRET
                })
            });

            console.log('[Auth] 📨 Response status:', response.status);

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[Auth] ✅ Authentication successful');
            console.log('[Auth] 🎫 Token received (length):', data.token?.length || 0);

            if (!data.token) {
                throw new Error('No token received from server');
            }

            setToken(data.token);
            setIsAuthenticated(true);
            setAuthTimestamp(Date.now());

            console.log('[Auth] 💾 Token stored securely in memory');
            console.log('[Auth] ⏰ Auth timestamp:', new Date().toISOString());

        } catch (err) {
            console.error('[Auth] ❌ Authentication error:', err.message);
            setError(err.message);
            setIsAuthenticated(false);
            setToken(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Perform auto-login on mount
    useEffect(() => {
        console.log('[Auth] 🚀 AuthProvider mounted - initiating auto-login');
        performLogin();
    }, [performLogin]);

    // Token refresh logic (refresh every 50 minutes to be safe)
    useEffect(() => {
        if (!isAuthenticated || !authTimestamp) return;

        const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes

        const checkAndRefresh = () => {
            const elapsed = Date.now() - authTimestamp;
            if (elapsed >= REFRESH_INTERVAL) {
                console.log('[Auth] 🔄 Token refresh interval reached, re-authenticating...');
                performLogin();
            }
        };

        const interval = setInterval(checkAndRefresh, 60000); // Check every minute

        return () => clearInterval(interval);
    }, [isAuthenticated, authTimestamp, performLogin]);

    const logout = useCallback(() => {
        console.log('[Auth] 🚪 Logging out...');
        setToken(null);
        setIsAuthenticated(false);
        setAuthTimestamp(null);
        console.log('[Auth] ✅ Logout complete');
    }, []);

    const getAuthHeader = useCallback(() => {
        if (!token) return {};
        return { 'X-Token': token };
    }, [token]);

    const getWebSocketUrl = useCallback((baseUrl) => {
        if (!token) return null;
        // WebSocket uses query param for auth, NOT headers
        const encodedToken = encodeURIComponent(token);
        return `${baseUrl}?token=${encodedToken}`;
    }, [token]);

    const value = {
        token,
        isAuthenticated,
        isLoading,
        error,
        logout,
        performLogin,
        getAuthHeader,
        getWebSocketUrl
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
