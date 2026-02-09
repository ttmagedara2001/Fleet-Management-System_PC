/**
 * Authentication Context (Cookie-Based)
 * 
 * Auto-login on app mount.
 * The server manages session via HTTP-only cookies.
 * We track "is authenticated" via a localStorage flag.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { login, getToken, clearTokens } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    // getToken() returns the auth flag string, or null
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Perform login function (can be called manually for retry)
    const performLogin = async () => {
        console.log('🔐 Performing login...');
        setIsLoading(true);
        setError(null);

        try {
            const success = await login();
            if (success) {
                setIsAuthenticated(true);
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

            // Always do a fresh login to get a fresh session cookie
            console.log('📭 Performing fresh login...');
            try {
                const success = await login();
                if (success) {
                    setIsAuthenticated(true);
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
        setIsAuthenticated(false);
        setError(null);
        console.log('👋 Logged out');
    };

    const value = {
        token: isAuthenticated ? 'COOKIE_SESSION' : null,
        isAuthenticated,
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
