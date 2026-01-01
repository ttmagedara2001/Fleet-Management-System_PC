/**
 * Authentication Service
 * 
 * Handles all authentication-related API calls including:
 * - Token acquisition via /get-token
 * - Token refresh via /get-new-token
 * - Auto-authentication using environment/hardcoded credentials
 * 
 * @module authService
 */

// API Configuration
const API_BASE_URL = 'https://api.protonestconnect.co/api/v1/user';

// ═══════════════════════════════════════════════════════════════════════════
// DEMO MODE - Set to true to bypass real API calls (for local development)
// ═══════════════════════════════════════════════════════════════════════════
const DEMO_MODE = true;

// Default credentials for auto-authentication
const DEFAULT_CREDENTIALS = {
    email: 'ratnaabinayansn@gmail.com',
    password: '6M3@pwYvBGRVJLN'
};

// Singleton promise to prevent race conditions during concurrent auth requests
let authPromise = null;

/**
 * Acquires JWT token using credentials
 * 
 * @param {string} email - User email
 * @param {string} password - User password/secret key
 * @returns {Promise<{jwtToken: string, refreshToken: string}>}
 */
export const getToken = async (email, password) => {
    console.log('[AuthService] 🔐 Initiating token acquisition...');
    console.log('[AuthService] 📧 Email:', email);
    console.log('[AuthService] 🔑 Password provided:', !!password);

    try {
        const response = await fetch(`${API_BASE_URL}/get-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        console.log('[AuthService] 📨 Response status:', response.status);

        // Handle different HTTP status codes
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AuthService] ❌ Error response:', errorText);

            switch (response.status) {
                case 400:
                    throw new Error('Invalid request. Please check your credentials.');
                case 401:
                    throw new Error('Invalid email or password.');
                case 403:
                    throw new Error('Account not verified or access denied.');
                case 404:
                    throw new Error('User not found.');
                case 500:
                    throw new Error('Server error. Please try again later.');
                default:
                    throw new Error(`Authentication failed: ${response.status}`);
            }
        }

        const data = await response.json();
        console.log('[AuthService] ✅ Token response received');
        console.log('[AuthService] 📊 Response structure:', Object.keys(data));

        // Handle different response structures
        // Some APIs return { jwtToken, refreshToken }
        // Others return { status: "Success", data: { jwtToken, refreshToken } }
        let jwtToken, refreshToken;

        if (data.data && data.data.jwtToken) {
            // Nested response structure
            jwtToken = data.data.jwtToken;
            refreshToken = data.data.refreshToken;
        } else if (data.jwtToken) {
            // Flat response structure
            jwtToken = data.jwtToken;
            refreshToken = data.refreshToken;
        } else if (data.token) {
            // Alternative field name
            jwtToken = data.token;
            refreshToken = data.refreshToken;
        } else {
            console.error('[AuthService] ❌ Unexpected response structure:', data);
            throw new Error('Invalid response structure from server.');
        }

        if (!jwtToken) {
            throw new Error('No JWT token received from server.');
        }

        console.log('[AuthService] ✅ JWT Token acquired (length):', jwtToken.length);
        console.log('[AuthService] 🔄 Refresh Token:', !!refreshToken);

        return { jwtToken, refreshToken };

    } catch (error) {
        console.error('[AuthService] ❌ Token acquisition failed:', error.message);
        throw error;
    }
};

/**
 * Refreshes JWT token using refresh token
 * 
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<{jwtToken: string, refreshToken: string}>}
 */
export const refreshJwtToken = async (refreshToken) => {
    console.log('[AuthService] 🔄 Initiating token refresh...');
    console.log('[AuthService] 🔑 Refresh token provided:', !!refreshToken);

    if (!refreshToken) {
        throw new Error('No refresh token provided.');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/get-new-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Refresh-Token': refreshToken
            }
        });

        console.log('[AuthService] 📨 Refresh response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AuthService] ❌ Refresh error:', errorText);
            throw new Error('Token refresh failed. Please re-authenticate.');
        }

        const data = await response.json();

        // Handle response structure
        const newJwtToken = data.data?.jwtToken || data.jwtToken || data.token;
        const newRefreshToken = data.data?.refreshToken || data.refreshToken;

        if (!newJwtToken) {
            throw new Error('No new JWT token received from refresh.');
        }

        console.log('[AuthService] ✅ Token refreshed successfully');
        console.log('[AuthService] 🎫 New JWT Token (length):', newJwtToken.length);

        return { jwtToken: newJwtToken, refreshToken: newRefreshToken };

    } catch (error) {
        console.error('[AuthService] ❌ Token refresh failed:', error.message);
        throw error;
    }
};

/**
 * Auto-authenticates using default/environment credentials
 * Uses singleton pattern to prevent race conditions
 * 
 * @returns {Promise<{jwtToken: string, refreshToken: string}>}
 */
export const autoAuthenticate = async () => {
    console.log('[AuthService] 🤖 Auto-authentication initiated...');
    console.log('[AuthService] 🎮 Demo Mode:', DEMO_MODE ? 'ENABLED' : 'DISABLED');

    // Check for existing tokens in localStorage
    const existingToken = localStorage.getItem('jwtToken');
    if (existingToken) {
        console.log('[AuthService] ✅ Existing token found in localStorage');
        return {
            jwtToken: existingToken,
            refreshToken: localStorage.getItem('refreshToken')
        };
    }

    // ─── DEMO MODE ───
    // Generate mock tokens for local development without CORS issues
    if (DEMO_MODE) {
        console.log('[AuthService] 🎮 Demo mode - generating mock tokens...');
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockJwtToken = `demo-jwt-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const mockRefreshToken = `demo-refresh-${Date.now()}`;
        
        // Store tokens
        localStorage.setItem('jwtToken', mockJwtToken);
        localStorage.setItem('refreshToken', mockRefreshToken);
        
        console.log('[AuthService] ✅ Demo authentication successful');
        console.log('[AuthService] 🎫 Mock JWT Token generated (length):', mockJwtToken.length);
        
        return { 
            jwtToken: mockJwtToken, 
            refreshToken: mockRefreshToken 
        };
    }

    // ─── PRODUCTION MODE ───
    // Use singleton promise to prevent race conditions
    if (authPromise) {
        console.log('[AuthService] ⏳ Authentication already in progress, waiting...');
        return authPromise;
    }

    authPromise = (async () => {
        try {
            // Use environment variables if available, fallback to defaults
            const email = import.meta.env?.VITE_USER_EMAIL || DEFAULT_CREDENTIALS.email;
            const password = import.meta.env?.VITE_USER_SECRET || DEFAULT_CREDENTIALS.password;

            console.log('[AuthService] 🔐 Using credentials for:', email);

            const tokens = await getToken(email, password);

            // Store tokens in localStorage
            localStorage.setItem('jwtToken', tokens.jwtToken);
            if (tokens.refreshToken) {
                localStorage.setItem('refreshToken', tokens.refreshToken);
            }

            console.log('[AuthService] 💾 Tokens stored in localStorage');

            return tokens;

        } catch (error) {
            console.error('[AuthService] ❌ Auto-authentication failed:', error.message);
            throw error;
        } finally {
            // Clear singleton promise after completion
            authPromise = null;
        }
    })();

    return authPromise;
};

/**
 * Clears all authentication data
 */
export const clearAuth = () => {
    console.log('[AuthService] 🧹 Clearing authentication data...');
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    authPromise = null;
    console.log('[AuthService] ✅ Authentication data cleared');
};

/**
 * Gets the current JWT token from localStorage
 * 
 * @returns {string|null}
 */
export const getCurrentToken = () => {
    return localStorage.getItem('jwtToken');
};

/**
 * Gets the current refresh token from localStorage
 * 
 * @returns {string|null}
 */
export const getCurrentRefreshToken = () => {
    return localStorage.getItem('refreshToken');
};

/**
 * Checks if user is authenticated (has valid token)
 * 
 * @returns {boolean}
 */
export const isAuthenticated = () => {
    return !!getCurrentToken();
};

export default {
    getToken,
    refreshJwtToken,
    autoAuthenticate,
    clearAuth,
    getCurrentToken,
    getCurrentRefreshToken,
    isAuthenticated
};
