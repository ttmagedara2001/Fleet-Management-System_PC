/**
 * Simple API Client
 * 
 * Axios client with automatic token attachment from localStorage.
 */

import axios from 'axios';
import { getToken } from './authService';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Add token to every request
api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers['X-Token'] = token;
    }
    return config;
});

// Log responses
api.interceptors.response.use(
    (response) => {
        console.log('📥 API Response:', response.status, response.config.url);
        return response;
    },
    (error) => {
        console.error('❌ API Error:', error.response?.status, error.config?.url);
        return Promise.reject(error);
    }
);

/**
 * Get stream data for a device
 */
export async function getStreamData(deviceId, topic, startTime, endTime, pagination = 0, pageSize = 100) {
    const response = await api.post('/get-stream-data/device/topic', {
        deviceId,
        topic,
        startTime,
        endTime,
        pagination: String(pagination),
        pageSize: String(pageSize)
    });
    return response.data;
}

/**
 * Get current state for a device
 */
export async function getStateDetails(deviceId) {
    const response = await api.post('/get-state-details/device', { deviceId });
    return response.data;
}

/**
 * Update state for a device
 */
export async function updateState(deviceId, topic, payload) {
    const response = await api.post('/update-state-details', {
        deviceId,
        topic,
        payload
    });
    return response.data;
}

export default api;
