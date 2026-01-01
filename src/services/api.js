/**
 * API Client with Interceptors
 * 
 * Axios-based HTTP client with:
 * - Request interceptor for automatic token attachment
 * - Response interceptor for token refresh on 401
 * - Auto-authentication using environment credentials
 * 
 * @module api
 */

import axios from 'axios';
import { 
    autoAuthenticate, 
    refreshJwtToken, 
    clearAuth,
    getCurrentToken,
    getCurrentRefreshToken 
} from './authService';

// API Configuration
const API_BASE_URL = 'https://api.protonestconnect.co/api/v1';
const REQUEST_TIMEOUT = 15000; // 15 seconds

// Create Axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Flag to prevent infinite refresh loops
let isRefreshing = false;
let failedQueue = [];

/**
 * Process queued requests after token refresh
 */
const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST INTERCEPTOR
// ═══════════════════════════════════════════════════════════════════════════

api.interceptors.request.use(
    async (config) => {
        console.log('[API] 📤 Request:', config.method?.toUpperCase(), config.url);

        // Get token from localStorage
        let token = getCurrentToken();

        // If no token, attempt auto-authentication
        if (!token) {
            console.log('[API] 🔐 No token found, attempting auto-authentication...');
            try {
                const authResult = await autoAuthenticate();
                token = authResult.jwtToken;
                console.log('[API] ✅ Auto-authentication successful');
            } catch (error) {
                console.error('[API] ❌ Auto-authentication failed:', error.message);
                // Continue without token - will likely fail with 401
            }
        }

        // Attach token to request header
        if (token) {
            config.headers['X-Token'] = token;
            console.log('[API] 🎫 Token attached to request');
        } else {
            console.log('[API] ⚠️ No token available for request');
        }

        return config;
    },
    (error) => {
        console.error('[API] ❌ Request interceptor error:', error.message);
        return Promise.reject(error);
    }
);

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE INTERCEPTOR
// ═══════════════════════════════════════════════════════════════════════════

api.interceptors.response.use(
    (response) => {
        console.log('[API] 📥 Response:', response.status, response.config.url);
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        console.error('[API] ❌ Response error:', error.response?.status, error.config?.url);

        // Handle 401 Unauthorized - Token expired or invalid
        if (error.response?.status === 401 && !originalRequest._retry) {
            console.log('[API] 🔄 401 detected, attempting token refresh...');

            if (isRefreshing) {
                // Queue this request while refresh is in progress
                console.log('[API] ⏳ Refresh in progress, queueing request...');
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['X-Token'] = token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = getCurrentRefreshToken();
                
                if (!refreshToken) {
                    console.log('[API] ⚠️ No refresh token, attempting re-authentication...');
                    const authResult = await autoAuthenticate();
                    
                    localStorage.setItem('jwtToken', authResult.jwtToken);
                    if (authResult.refreshToken) {
                        localStorage.setItem('refreshToken', authResult.refreshToken);
                    }
                    
                    processQueue(null, authResult.jwtToken);
                    originalRequest.headers['X-Token'] = authResult.jwtToken;
                    
                    return api(originalRequest);
                }

                // Attempt token refresh
                const tokens = await refreshJwtToken(refreshToken);
                
                // Store new tokens
                localStorage.setItem('jwtToken', tokens.jwtToken);
                if (tokens.refreshToken) {
                    localStorage.setItem('refreshToken', tokens.refreshToken);
                }

                console.log('[API] ✅ Token refresh successful');
                
                // Process queued requests
                processQueue(null, tokens.jwtToken);
                
                // Retry original request with new token
                originalRequest.headers['X-Token'] = tokens.jwtToken;
                return api(originalRequest);

            } catch (refreshError) {
                console.error('[API] ❌ Token refresh failed:', refreshError.message);
                
                // Clear auth and reject all queued requests
                clearAuth();
                processQueue(refreshError, null);
                
                // Redirect to login or trigger logout
                window.dispatchEvent(new CustomEvent('auth:logout'));
                
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // Handle 403 Forbidden
        if (error.response?.status === 403) {
            console.error('[API] 🚫 Access forbidden');
        }

        // Handle network errors
        if (!error.response) {
            console.error('[API] 🌐 Network error:', error.message);
        }

        return Promise.reject(error);
    }
);

// ═══════════════════════════════════════════════════════════════════════════
// API METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get stream data for a device
 * 
 * @param {string} deviceId - Device ID
 * @param {string} topic - Sensor topic (e.g., "temp", "humidity")
 * @param {string} startTime - ISO-8601 start time
 * @param {string} endTime - ISO-8601 end time
 * @param {number} pagination - Page number
 * @param {number} pageSize - Items per page
 * @returns {Promise<Array>}
 */
export const getStreamData = async (deviceId, topic, startTime, endTime, pagination = 0, pageSize = 100) => {
    console.log('[API] 📊 Fetching stream data for:', deviceId, topic);
    
    const response = await api.post('/get-stream-data/device/topic', {
        deviceId,
        topic,
        startTime,
        endTime,
        pagination: String(pagination),
        pageSize: String(pageSize)
    });
    
    return response.data;
};

/**
 * Get current state for a device
 * 
 * @param {string} deviceId - Device ID
 * @returns {Promise<Object>}
 */
export const getStateDetails = async (deviceId) => {
    console.log('[API] 📋 Fetching state details for:', deviceId);
    
    const response = await api.post('/get-state-details/device', {
        deviceId
    });
    
    return response.data;
};

/**
 * Update state for a device (control command)
 * 
 * @param {string} deviceId - Device ID
 * @param {string} topic - Control topic
 * @param {Object} payload - Command payload
 * @returns {Promise<Object>}
 */
export const updateState = async (deviceId, topic, payload) => {
    console.log('[API] 🎛️ Updating state for:', deviceId, topic);
    
    const response = await api.post('/update-state-details', {
        deviceId,
        topic,
        payload
    });
    
    return response.data;
};

// Export the axios instance for custom requests
export default api;
