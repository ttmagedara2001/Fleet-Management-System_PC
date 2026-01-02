/**
 * Simple Authentication Context
 * 
 * Auto-login on app mount, provides token to children.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { login, getToken, clearTokens } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => getToken());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Auto-login on mount
    useEffect(() => {
        async function autoLogin() {
            console.log('🚀 APP STARTED - Initiating auto-login...');

            // Check for existing token
            const existingToken = getToken();
            if (existingToken) {
                console.log('✅ Using existing token from storage');
                setToken(existingToken);
                setIsLoading(false);
                return;
            }

            // Call /get-token API
            try {
                const result = await login();
                setToken(result.jwtToken);
                setError(null);
            } catch (err) {
                console.error('❌ Auto-login failed:', err.message);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }

        autoLogin();
    }, []);

    const logout = () => {
        clearTokens();
        setToken(null);
        console.log('👋 Logged out');
    };

    const value = {
        token,
        isAuthenticated: !!token,
        isLoading,
        error,
        logout
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
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

export default AuthContext;
