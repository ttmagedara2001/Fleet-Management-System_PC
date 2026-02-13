/**
 * Authentication Context (JWT + HTTP-only Cookie)
 *
 * Auto-login on app mount.
 * The JWT is stored in localStorage (via authService) and exposed
 * through this context so components / DeviceContext can read it.
 * HTTP-only cookies (refresh token) are managed by the browser.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { login, getToken, clearTokens } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
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

            // Always do a fresh login to get a fresh JWT + cookies
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
        // Expose the actual JWT (or cookie flag) so consumers can use it
        token: getToken(),
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
