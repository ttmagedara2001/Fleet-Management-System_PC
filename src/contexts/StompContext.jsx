/**
 * Simple STOMP/WebSocket Context
 * 
 * Connects WebSocket after authentication, provides subscription methods.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { webSocketClient } from '../services/webSocketClient';

const StompContext = createContext(null);

export function StompProvider({ children }) {
    const { token, isAuthenticated } = useAuth();
    const [isConnected, setIsConnected] = useState(false);

    // Connect WebSocket when authenticated
    useEffect(() => {
        if (isAuthenticated && token) {
            console.log('🔗 Auth detected - Connecting WebSocket...');

            webSocketClient.connect(token)
                .then(() => {
                    // Wait a moment for connection to establish
                    setTimeout(() => {
                        setIsConnected(webSocketClient.connected);
                    }, 1000);
                })
                .catch(err => {
                    console.error('❌ WebSocket connection failed:', err.message);
                });
        }

        return () => {
            if (webSocketClient.connected) {
                webSocketClient.disconnect();
            }
        };
    }, [isAuthenticated, token]);

    // Update connection status periodically
    useEffect(() => {
        const interval = setInterval(() => {
            setIsConnected(webSocketClient.connected);
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    const value = {
        isConnected,
        subscribeToDevice: (deviceId, callback) => {
            webSocketClient.subscribeToDevice(deviceId, callback);
        },
        unsubscribeFromDevice: (deviceId) => {
            webSocketClient.unsubscribeFromDevice(deviceId);
        },
        sendCommand: (deviceId, commandType, payload) => {
            return webSocketClient.sendCommand(deviceId, commandType, payload);
        },
        disconnect: () => {
            webSocketClient.disconnect();
            setIsConnected(false);
        }
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
