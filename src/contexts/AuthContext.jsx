/**
 * Authentication Context (JWT + HTTP-only Cookie)
 *
 * Auto-login on app mount.
 * The JWT is stored in localStorage (via authService) and exposed
 * through this context so components / DeviceContext can read it.
 * HTTP-only cookies (refresh token) are managed by the browser.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { login, getToken, clearTokens } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    /** Perform login — can be called manually for retry. */
    const performLogin = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const success = await login();
            if (success) {
                setIsAuthenticated(true);
                setError(null);
                return success;
            }
        } catch (err) {
            console.error('[Auth] Login failed:', err.message);
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-login on mount — always fetch a fresh JWT + cookies
    useEffect(() => {
        async function autoLogin() {
            try {
                const success = await login();
                if (success) {
                    setIsAuthenticated(true);
                    setError(null);
                }
            } catch (err) {
                console.error('[Auth] Auto-login failed:', err.message);
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
