/**
 * Simple STOMP/WebSocket Context
 * 
 * Connects WebSocket after authentication, provides subscription methods.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { webSocketClient } from '../services/webSocketClient';

const StompContext = createContext(null);

export function StompProvider({ children }) {
    const { token, isAuthenticated } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const connectionAttempted = useRef(false);

    // Connect WebSocket when authenticated
    useEffect(() => {
        let mounted = true;

        async function connectWebSocket() {
            if (!isAuthenticated || !token) {
                console.log('🔗 STOMP: Waiting for authentication...');
                return;
            }

            if (connectionAttempted.current && webSocketClient.connected) {
                console.log('✅ STOMP: Already connected');
                setIsConnected(true);
                return;
            }

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔗 STOMP: Auth detected - Connecting WebSocket...');
            console.log('🎫 Token available:', !!token);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            connectionAttempted.current = true;
            setConnectionError(null);

            try {
                await webSocketClient.connect(token);
                
                if (mounted) {
                    setIsConnected(true);
                    setConnectionError(null);
                    console.log('✅ STOMP: WebSocket connection established!');
                }
            } catch (err) {
                console.error('❌ STOMP: WebSocket connection failed:', err.message);
                if (mounted) {
                    setIsConnected(false);
                    setConnectionError(err.message);
                }
            }
        }

        connectWebSocket();

        return () => {
            mounted = false;
        };
    }, [isAuthenticated, token]);

    // Update connection status periodically
    useEffect(() => {
        const interval = setInterval(() => {
            const currentStatus = webSocketClient.connected;
            setIsConnected(currentStatus);
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (webSocketClient.connected) {
                console.log('🔌 STOMP: Cleaning up WebSocket connection');
                webSocketClient.disconnect();
            }
        };
    }, []);

    // Subscribe to a specific topic
    const subscribe = useCallback((topic, callback) => {
        if (!webSocketClient.connected) {
            console.warn('⚠️ STOMP: Cannot subscribe - not connected. Topic:', topic);
            return null;
        }
        console.log('📡 STOMP: Subscribing to topic:', topic);
        return webSocketClient.subscribe(topic, callback);
    }, []);

    // Unsubscribe from a specific topic
    const unsubscribe = useCallback((topic) => {
        console.log('🔕 STOMP: Unsubscribing from topic:', topic);
        webSocketClient.unsubscribe(topic);
    }, []);

    // Subscribe to device topics (convenience method)
    const subscribeToDevice = useCallback((deviceId, callback) => {
        if (!webSocketClient.connected) {
            console.warn('⚠️ STOMP: Cannot subscribe - not connected');
            return null;
        }
        console.log('📡 STOMP: Subscribing to device:', deviceId);
        webSocketClient.subscribeToDevice(deviceId, callback);
        return deviceId;
    }, []);

    // Unsubscribe from device topics (convenience method)
    const unsubscribeFromDevice = useCallback((deviceId) => {
        console.log('🔕 STOMP: Unsubscribing from device:', deviceId);
        webSocketClient.unsubscribeFromDevice(deviceId);
    }, []);

    // Send command to device
    const sendCommand = useCallback((deviceId, commandType, payload) => {
        if (!webSocketClient.connected) {
            console.error('❌ STOMP: Cannot send command - not connected');
            return false;
        }
        return webSocketClient.sendCommand(deviceId, commandType, payload);
    }, []);

    // Disconnect
    const disconnect = useCallback(() => {
        webSocketClient.disconnect();
        setIsConnected(false);
        connectionAttempted.current = false;
    }, []);

    // Reconnect
    const reconnect = useCallback(async () => {
        if (!token) {
            console.error('❌ STOMP: Cannot reconnect - no token');
            return;
        }
        
        console.log('🔄 STOMP: Reconnecting...');
        connectionAttempted.current = false;
        
        if (webSocketClient.connected) {
            webSocketClient.disconnect();
        }
        
        try {
            await webSocketClient.connect(token);
            setIsConnected(true);
            setConnectionError(null);
        } catch (err) {
            console.error('❌ STOMP: Reconnection failed:', err.message);
            setConnectionError(err.message);
        }
    }, [token]);

    const value = {
        isConnected,
        connectionError,
        subscribe,           // Generic topic subscription
        unsubscribe,         // Generic topic unsubscription
        subscribeToDevice,   // Device-level subscription (convenience)
        unsubscribeFromDevice, // Device-level unsubscription (convenience)
        sendCommand,
        disconnect,
        reconnect
    };

    return (
        <StompContext.Provider value={value}>
            {children}
        </StompContext.Provider>
    );
}

export function useStomp() {
    const context = useContext(StompContext);
    if (!context) {
        throw new Error('useStomp must be used within StompProvider');
    }
    return context;
}

export default StompContext;
