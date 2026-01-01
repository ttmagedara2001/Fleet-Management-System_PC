/**
 * STOMP WebSocket Context
 * 
 * React Context provider that wraps the WebSocket client service
 * and provides connection state and methods to components.
 * 
 * @module StompContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { webSocketClient } from '../services/webSocketClient';

const StompContext = createContext(null);

// ═══════════════════════════════════════════════════════════════════════════
// STOMP PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export function StompProvider({ children }) {
    const { token, isAuthenticated } = useAuth();

    // ─── State ───
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(null);

    // ─── Refs ───
    const subscriptionsRef = useRef(new Map());
    const hasInitializedRef = useRef(false);

    // ─────────────────────────────────────────────────────────────────────────
    // CONNECTION MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Establishes WebSocket connection
     */
    const connect = useCallback(async () => {
        if (!token || !isAuthenticated) {
            console.log('[Stomp Context] Cannot connect - not authenticated');
            return;
        }

        if (isConnecting || webSocketClient.connected) {
            console.log('[Stomp Context] Connection already in progress or established');
            return;
        }

        console.log('[Stomp Context] Initiating connection...');
        setIsConnecting(true);
        setConnectionError(null);

        try {
            await webSocketClient.connect(token);
            console.log('[Stomp Context] Connection initiated successfully');
        } catch (error) {
            console.error('[Stomp Context] Connection failed:', error.message);
            setConnectionError(error.message);
            setIsConnecting(false);
        }
    }, [token, isAuthenticated, isConnecting]);

    /**
     * Disconnects WebSocket connection
     */
    const disconnect = useCallback(() => {
        console.log('[Stomp Context] Disconnecting...');

        // Clear all subscriptions
        subscriptionsRef.current.clear();

        // Disconnect client
        webSocketClient.disconnect();

        setIsConnected(false);
        setIsConnecting(false);

        console.log('[Stomp Context] Disconnected');
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // SUBSCRIPTION MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Subscribes to a device's topics
     * @param {string} deviceId - Device identifier
     * @param {Function} callback - Data callback
     */
    const subscribeToDevice = useCallback((deviceId, callback) => {
        if (!deviceId) {
            console.warn('[Stomp Context] subscribeToDevice: No deviceId provided');
            return;
        }

        console.log('[Stomp Context] Subscribing to device:', deviceId);

        webSocketClient.subscribeToDevice(deviceId, callback);
        subscriptionsRef.current.set(deviceId, callback);
    }, []);

    /**
     * Unsubscribes from a device
     */
    const unsubscribeFromDevice = useCallback((deviceId) => {
        if (!deviceId) return;

        console.log('[Stomp Context] Unsubscribing from device:', deviceId);
        subscriptionsRef.current.delete(deviceId);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // COMMAND METHODS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Sends a command to a device
     */
    const sendCommand = useCallback((deviceId, commandType, payload) => {
        if (!isConnected) {
            console.warn('[Stomp Context] Cannot send command - not connected');
            return false;
        }

        return webSocketClient.sendCommand(deviceId, commandType, payload);
    }, [isConnected]);

    /**
     * Emergency stop
     */
    const emergencyStop = useCallback((deviceId) => {
        console.log('[Stomp Context] 🚨 EMERGENCY STOP for:', deviceId);
        return webSocketClient.emergencyStop(deviceId);
    }, []);

    /**
     * Control AC
     */
    const controlAC = useCallback((deviceId, state) => {
        return webSocketClient.controlAC(deviceId, state);
    }, []);

    /**
     * Control air purifier
     */
    const controlAirPurifier = useCallback((deviceId, state) => {
        return webSocketClient.controlAirPurifier(deviceId, state);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // LIFECYCLE EFFECTS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Setup connection event listeners
     */
    useEffect(() => {
        const handleConnect = () => {
            console.log('[Stomp Context] ✅ Connected event received');
            setIsConnected(true);
            setIsConnecting(false);
            setConnectionError(null);
        };

        const handleDisconnect = () => {
            console.log('[Stomp Context] ❌ Disconnected event received');
            setIsConnected(false);
        };

        webSocketClient.onConnect(handleConnect);
        webSocketClient.onDisconnect(handleDisconnect);

        return () => {
            webSocketClient.offConnect(handleConnect);
            webSocketClient.offDisconnect(handleDisconnect);
        };
    }, []);

    /**
     * Auto-connect when authenticated
     */
    useEffect(() => {
        if (isAuthenticated && token && !hasInitializedRef.current) {
            console.log('[Stomp Context] Auth detected, auto-connecting...');
            hasInitializedRef.current = true;
            connect();
        }
    }, [isAuthenticated, token, connect]);

    /**
     * Disconnect on auth loss
     */
    useEffect(() => {
        if (!isAuthenticated && hasInitializedRef.current) {
            console.log('[Stomp Context] Auth lost, disconnecting...');
            disconnect();
            hasInitializedRef.current = false;
        }
    }, [isAuthenticated, disconnect]);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        return () => {
            console.log('[Stomp Context] Provider unmounting, cleaning up...');
            disconnect();
        };
    }, [disconnect]);

    // ─────────────────────────────────────────────────────────────────────────
    // CONTEXT VALUE
    // ─────────────────────────────────────────────────────────────────────────

    const value = {
        // State
        isConnected,
        isConnecting,
        connectionError,

        // Connection methods
        connect,
        disconnect,

        // Subscription methods
        subscribeToDevice,
        unsubscribeFromDevice,

        // Command methods
        sendCommand,
        emergencyStop,
        controlAC,
        controlAirPurifier,

        // Utility
        getConnectionInfo: () => webSocketClient.getConnectionInfo()
    };

    return (
        <StompContext.Provider value={value}>
            {children}
        </StompContext.Provider>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook to access STOMP context
 */
export function useStomp() {
    const context = useContext(StompContext);
    if (!context) {
        throw new Error('useStomp must be used within a StompProvider');
    }
    return context;
}

export default StompContext;
