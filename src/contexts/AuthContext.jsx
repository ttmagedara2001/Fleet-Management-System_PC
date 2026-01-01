/**
 * Authentication Context
 * 
 * Provides authentication state and methods to the entire application.
 * Uses authService for token operations and persists state to localStorage.
 * 
 * @module AuthContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    autoAuthenticate,
    clearAuth as clearAuthService,
    getCurrentToken,
    getCurrentRefreshToken
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    // ═══════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════

    const [token, setToken] = useState(() => getCurrentToken());
    const [refreshToken, setRefreshToken] = useState(() => getCurrentRefreshToken());
    const [userId, setUserId] = useState(() => localStorage.getItem('userId'));
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!getCurrentToken());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // ═══════════════════════════════════════════════════════════════════════
    // AUTHENTICATION METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Sets authentication state and persists to localStorage
     */
    const setAuth = useCallback(({ jwtToken, refreshToken: newRefreshToken, userId: newUserId }) => {
        console.log('[Auth] 💾 Setting authentication state...');

        if (jwtToken) {
            localStorage.setItem('jwtToken', jwtToken);
            setToken(jwtToken);
        }

        if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
            setRefreshToken(newRefreshToken);
        }

        if (newUserId) {
            localStorage.setItem('userId', newUserId);
            setUserId(newUserId);
        }

        setIsAuthenticated(true);
        setError(null);

        console.log('[Auth] ✅ Authentication state updated');
    }, []);

    /**
     * Performs initial auto-login on app mount
     */
    const performLogin = useCallback(async () => {
        console.log('[Auth] 🔐 Initiating automatic login...');
        setIsLoading(true);
        setError(null);

        try {
            const tokens = await autoAuthenticate();

            setAuth({
                jwtToken: tokens.jwtToken,
                refreshToken: tokens.refreshToken
            });

            console.log('[Auth] ✅ Auto-login successful');
            console.log('[Auth] 🎫 JWT Token (length):', tokens.jwtToken?.length || 0);
            console.log('[Auth] 🔄 Refresh Token:', !!tokens.refreshToken);
            console.log('[Auth] ⏳ Token valid for 24 hours');

        } catch (err) {
            console.error('[Auth] ❌ Auto-login failed:', err.message);
            setError(err.message);
            setIsAuthenticated(false);
            setToken(null);
            setRefreshToken(null);
        } finally {
            setIsLoading(false);
        }
    }, [setAuth]);

    /**
     * Logs out the user and clears all auth state
     */
    const logout = useCallback(() => {
        console.log('[Auth] 🚪 Logging out...');

        // Clear service state
        clearAuthService();

        // Clear context state
        setToken(null);
        setRefreshToken(null);
        setUserId(null);
        setIsAuthenticated(false);

        console.log('[Auth] ✅ Logout complete');
    }, []);

    /**
     * Returns headers for authenticated HTTP requests
     */
    const getAuthHeader = useCallback(() => {
        const currentToken = token || getCurrentToken();
        if (!currentToken) return {};
        return { 'X-Token': currentToken };
    }, [token]);

    /**
     * Builds WebSocket URL with token as query parameter
     */
    const getWebSocketUrl = useCallback((baseUrl) => {
        const currentToken = token || getCurrentToken();
        if (!currentToken) return null;
        const encodedToken = encodeURIComponent(currentToken);
        return `${baseUrl}?token=${encodedToken}`;
    }, [token]);

    // ═══════════════════════════════════════════════════════════════════════
    // EFFECTS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Auto-login on mount
     */
    useEffect(() => {
        console.log('[Auth] 🚀 AuthProvider mounted - initiating auto-login');
        performLogin();
    }, [performLogin]);

    /**
     * Listen for logout events from API interceptor
     */
    useEffect(() => {
        const handleLogout = () => {
            console.log('[Auth] 📡 Received logout event from API');
            logout();
        };

        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
    }, [logout]);

    /**
     * Token refresh timer - refresh every 23 hours (token valid for 24 hours)
     */
    useEffect(() => {
        if (!isAuthenticated || !token) return;

        const REFRESH_INTERVAL = 23 * 60 * 60 * 1000; // 23 hours

        console.log('[Auth] ⏰ Setting up token refresh timer (23 hours)');

        const timer = setTimeout(() => {
            console.log('[Auth] 🔄 Token refresh timer triggered');
            performLogin();
        }, REFRESH_INTERVAL);

        return () => clearTimeout(timer);
    }, [isAuthenticated, token, performLogin]);

    // ═══════════════════════════════════════════════════════════════════════
    // CONTEXT VALUE
    // ═══════════════════════════════════════════════════════════════════════

    const value = {
        // State
        token,
        refreshToken,
        userId,
        isAuthenticated,
        isLoading,
        error,

        // Methods
        setAuth,
        performLogin,
        logout,
        getAuthHeader,
        getWebSocketUrl
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook to access auth context
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
