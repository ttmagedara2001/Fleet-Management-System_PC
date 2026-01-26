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

    // Perform login function (can be called manually for retry)
    const performLogin = async () => {
        console.log('🔐 Performing login...');
        setIsLoading(true);
        setError(null);

        try {
            // Clear any existing tokens first
            clearTokens();

            const success = await login();
            if (success) {
                setToken('COOKIE_AUTH_SESSION');
                setError(null);
                console.log('✅ Login successful!');
                return success;
            }
        } catch (err) {
            console.error('❌ Login failed:', err.message);
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-login on mount
    useEffect(() => {
        async function autoLogin() {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🚀 APP STARTED - Initiating auto-login...');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // Check for existing token
            const existingToken = getToken();
            if (existingToken) {
                console.log('✅ Found existing token in storage');
                setToken(existingToken);
                setIsLoading(false);
                return;
            }

            // No existing token - perform fresh login
            console.log('📭 No existing token found, performing fresh login...');
            try {
                const success = await login();
                if (success) {
                    setToken('COOKIE_AUTH_SESSION');
                    setError(null);
                }
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
        setError(null);
        console.log('👋 Logged out');
    };

    const value = {
        token,
        isAuthenticated: !!token,
        isLoading,
        error,
        logout,
        performLogin
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
