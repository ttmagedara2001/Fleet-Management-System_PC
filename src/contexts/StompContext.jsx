import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuth } from './AuthContext';

const StompContext = createContext(null);

const STOMP_CONFIG = {
    BROKER_URL: 'wss://api.protonestconnect.co/ws',
    RECONNECT_DELAY: 5000,
    HEARTBEAT_INCOMING: 10000,
    HEARTBEAT_OUTGOING: 10000
};

export function StompProvider({ children }) {
    const { token, isAuthenticated } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const [lastMessageTime, setLastMessageTime] = useState(null);

    const clientRef = useRef(null);
    const subscriptionsRef = useRef(new Map());
    const pendingSubscriptionsRef = useRef([]);

    const connect = useCallback(() => {
        if (!token || !isAuthenticated) {
            console.log('[STOMP] ⚠️ Cannot connect - not authenticated');
            return;
        }

        if (clientRef.current?.active) {
            console.log('[STOMP] ⚠️ Client already connected');
            return;
        }

        console.log('[STOMP] 🔌 Initiating WebSocket connection...');
        setIsConnecting(true);
        setConnectionError(null);

        // Build WebSocket URL with token as query param (NOT in headers)
        const wsUrl = `${STOMP_CONFIG.BROKER_URL}?token=${encodeURIComponent(token)}`;
        console.log('[STOMP] 📡 Broker URL configured (token in query param)');

        const client = new Client({
            brokerURL: wsUrl,
            // CRITICAL: No connectHeaders for authentication
            // Token is passed via query parameter only
            connectHeaders: {},
            reconnectDelay: STOMP_CONFIG.RECONNECT_DELAY,
            heartbeatIncoming: STOMP_CONFIG.HEARTBEAT_INCOMING,
            heartbeatOutgoing: STOMP_CONFIG.HEARTBEAT_OUTGOING,

            debug: (str) => {
                // Filter out heartbeat messages for cleaner logs
                if (!str.includes('PING') && !str.includes('PONG')) {
                    console.log('[STOMP] 🐛 Debug:', str);
                }
            },

            onConnect: (frame) => {
                console.log('[STOMP] ✅ Connected successfully');
                console.log('[STOMP] 📋 Server:', frame.headers?.server || 'Unknown');
                console.log('[STOMP] 🆔 Session:', frame.headers?.session || 'Unknown');

                setIsConnected(true);
                setIsConnecting(false);
                setConnectionError(null);

                // Process any pending subscriptions
                console.log('[STOMP] 📬 Processing pending subscriptions:', pendingSubscriptionsRef.current.length);
                pendingSubscriptionsRef.current.forEach(({ topic, callback, id }) => {
                    subscribeInternal(topic, callback, id);
                });
                pendingSubscriptionsRef.current = [];
            },

            onDisconnect: (frame) => {
                console.log('[STOMP] 🔌 Disconnected');
                console.log('[STOMP] 📋 Frame:', frame);
                setIsConnected(false);
                setIsConnecting(false);
            },

            onStompError: (frame) => {
                console.error('[STOMP] ❌ Protocol error:', frame.headers?.message || 'Unknown error');
                console.error('[STOMP] 📋 Error body:', frame.body);
                setConnectionError(frame.headers?.message || 'STOMP protocol error');
                setIsConnecting(false);
            },

            onWebSocketError: (event) => {
                console.error('[STOMP] ❌ WebSocket error:', event);
                setConnectionError('WebSocket connection error');
                setIsConnecting(false);
            },

            onWebSocketClose: (event) => {
                console.log('[STOMP] 🔒 WebSocket closed:', event.code, event.reason);
                setIsConnected(false);
                setIsConnecting(false);
            }
        });

        clientRef.current = client;

        try {
            client.activate();
            console.log('[STOMP] 🚀 Client activation initiated');
        } catch (err) {
            console.error('[STOMP] ❌ Activation error:', err);
            setConnectionError(err.message);
            setIsConnecting(false);
        }
    }, [token, isAuthenticated]);

    const disconnect = useCallback(() => {
        console.log('[STOMP] 🔌 Disconnecting...');

        // Unsubscribe all
        subscriptionsRef.current.forEach((sub, topic) => {
            console.log('[STOMP] 📴 Unsubscribing from:', topic);
            sub.unsubscribe();
        });
        subscriptionsRef.current.clear();

        if (clientRef.current) {
            clientRef.current.deactivate();
            clientRef.current = null;
        }

        setIsConnected(false);
        console.log('[STOMP] ✅ Disconnected');
    }, []);

    // Internal subscribe function (called when connected)
    const subscribeInternal = useCallback((topic, callback, subscriptionId) => {
        if (!clientRef.current?.active) {
            console.warn('[STOMP] ⚠️ Cannot subscribe - not connected');
            return null;
        }

        // Validate topic format
        if (!topic.startsWith('/topic/')) {
            console.error('[STOMP] ❌ Invalid topic format. Must start with /topic/:', topic);
            return null;
        }

        console.log('[STOMP] 📬 Subscribing to:', topic);
        console.log('[STOMP] 🆔 Subscription ID:', subscriptionId);

        try {
            const subscription = clientRef.current.subscribe(topic, (message) => {
                setLastMessageTime(Date.now());

                try {
                    const payload = JSON.parse(message.body);
                    console.log('[STOMP] 📩 Message received on:', topic);
                    console.log('[STOMP] 📦 Payload:', JSON.stringify(payload).substring(0, 200));
                    callback(payload, message);
                } catch (parseError) {
                    console.error('[STOMP] ❌ Payload parse error on', topic, ':', parseError);
                    // Still call callback with raw body if JSON parse fails
                    callback(message.body, message);
                }
            }, { id: subscriptionId });

            subscriptionsRef.current.set(topic, subscription);
            console.log('[STOMP] ✅ Subscribed successfully to:', topic);

            return subscription;
        } catch (err) {
            console.error('[STOMP] ❌ Subscription error:', err);
            return null;
        }
    }, []);

    // Public subscribe function (handles pending if not connected)
    const subscribe = useCallback((topic, callback, subscriptionId = null) => {
        const id = subscriptionId || `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        if (!clientRef.current?.active) {
            console.log('[STOMP] ⏳ Queuing subscription (not connected):', topic);
            pendingSubscriptionsRef.current.push({ topic, callback, id });
            return { id, pending: true };
        }

        return subscribeInternal(topic, callback, id);
    }, [subscribeInternal]);

    const unsubscribe = useCallback((topic) => {
        const subscription = subscriptionsRef.current.get(topic);
        if (subscription) {
            console.log('[STOMP] 📴 Unsubscribing from:', topic);
            subscription.unsubscribe();
            subscriptionsRef.current.delete(topic);
            console.log('[STOMP] ✅ Unsubscribed from:', topic);
        } else {
            // Check pending subscriptions
            pendingSubscriptionsRef.current = pendingSubscriptionsRef.current.filter(
                (sub) => sub.topic !== topic
            );
        }
    }, []);

    const publish = useCallback((destination, body) => {
        if (!clientRef.current?.active) {
            console.warn('[STOMP] ⚠️ Cannot publish - not connected');
            return false;
        }

        console.log('[STOMP] 📤 Publishing to:', destination);
        console.log('[STOMP] 📦 Body:', JSON.stringify(body));

        try {
            clientRef.current.publish({
                destination,
                body: JSON.stringify(body)
            });
            console.log('[STOMP] ✅ Published successfully');
            return true;
        } catch (err) {
            console.error('[STOMP] ❌ Publish error:', err);
            return false;
        }
    }, []);

    // Auto-connect when authenticated
    useEffect(() => {
        if (isAuthenticated && token) {
            console.log('[STOMP] 🔑 Auth token available, connecting...');
            connect();
        }

        return () => {
            disconnect();
        };
    }, [isAuthenticated, token, connect, disconnect]);

    const value = {
        isConnected,
        isConnecting,
        connectionError,
        lastMessageTime,
        connect,
        disconnect,
        subscribe,
        unsubscribe,
        publish,
        // Expose active subscriptions count for debugging
        activeSubscriptions: subscriptionsRef.current.size
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
        throw new Error('useStomp must be used within a StompProvider');
    }
    return context;
}

export default StompContext;
