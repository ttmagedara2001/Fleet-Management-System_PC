/**
 * @module Header
 * @description Top-level application header with device selector, connection
 * status indicators, notification bell, live clock, and mobile menu toggle.
 */
import { useState, useRef, useEffect } from 'react';
import { Wifi, Radio, Server, Bell, Cpu, Menu, X, Check, Trash2, CheckCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDevice } from '../../contexts/DeviceContext';

function Header({ onMenuToggle, sidebarOpen }) {
    const { isAuthenticated } = useAuth();
    const { devices, selectedDeviceId, setSelectedDeviceId, alerts, isConnected, clearAlert, clearAllAlerts, markAlertRead, markAllAlertsRead } = useDevice();

    const unreadAlerts = alerts.filter(a => !a.read).length;
    const [showNotifications, setShowNotifications] = useState(false);
    const notifRef = useRef(null);
    const bellRef = useRef(null);
    const [isMobile, setIsMobile] = useState(false);
    const [now, setNow] = useState(new Date());

    // Clock timer
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Click outside to close notifications (desktop only)
    useEffect(() => {
        function handleClickOutside(e) {
            if (notifRef.current && !notifRef.current.contains(e.target) &&
                bellRef.current && !bellRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
        }
        if (showNotifications && !isMobile) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showNotifications, isMobile]);

    // Responsive detection
    useEffect(() => {
        function onResize() {
            setIsMobile(window.innerWidth <= 768);
        }
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Escape key to close mobile notifications
    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape' && showNotifications) setShowNotifications(false);
        }
        if (showNotifications) document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [showNotifications]);

    // Lock body scroll when mobile notifications are open
    useEffect(() => {
        if (showNotifications && isMobile) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showNotifications, isMobile]);

    // Date/time formatting helpers
    function getOrdinal(n) {
        const v = n % 100;
        if (v >= 11 && v <= 13) return 'th';
        switch (n % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    function formatDatePretty(d) {
        if (!d) return '';
        try {
            const day = d.getDate();
            const ordinal = getOrdinal(day);
            const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
            const month = d.toLocaleDateString(undefined, { month: 'short' });
            const year = d.getFullYear();
            return `${day}${ordinal} ${weekday}, ${month} ${year}`;
        } catch (e) {
            return d.toLocaleDateString();
        }
    }

    function formatTimePretty(d) {
        if (!d) return '';
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function formatAlertTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    }

    function getAlertIcon(type) {
        if (type === 'critical') return '🔴';
        if (type === 'warning') return '🟡';
        return '🟢';
    }

    const toggleNotifications = () => {
        setShowNotifications(s => !s);
    };

    return (
        <header className="header">
            {/* Mobile Menu Button */}
            <button
                className="header-menu-btn"
                onClick={onMenuToggle}
                aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
                {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Logo */}
            <div className="header-logo">
                <div className="header-logo-icon">
                    <Cpu size={22} />
                </div>
                <span className="header-title">Fabrix</span>
            </div>

            {/* Date/Time - Hidden on mobile */}
            <div className="header-datetime">
                <div className="header-date">{formatDatePretty(now)}</div>
                <div className="header-time">{formatTimePretty(now)}</div>
            </div>

            {/* Device Selector */}
            <div className="header-device-wrapper">
                <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="header-device-selector"
                >
                    {devices.map(device => (
                        <option key={device.id} value={device.id}>
                            {device.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Right Icons Section */}
            <div className="header-icons">
                {/* Connection Status Icons - Hidden on small mobile */}
                <div className="header-status-icons">
                    <div className={`header-icon ${isConnected ? 'active' : ''}`} title="WebSocket Status">
                        <Wifi size={16} />
                    </div>
                    <div className="header-icon active" title="HTTP API">
                        <Radio size={16} />
                    </div>
                    <div className={`header-icon ${isAuthenticated ? 'active' : ''}`} title="Server">
                        <Server size={16} />
                    </div>
                </div>

                {/* Notification Bell */}
                <div className="header-notif-wrapper" ref={bellRef}>
                    <button
                        className="header-bell-btn"
                        onClick={toggleNotifications}
                        aria-label="Notifications"
                        aria-expanded={showNotifications}
                    >
                        <Bell size={20} />
                        {unreadAlerts > 0 && (
                            <span className="header-bell-badge">
                                {unreadAlerts > 9 ? '9+' : unreadAlerts}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Desktop Notification Popover */}
            {showNotifications && !isMobile && (
                <div className="notif-popover" ref={notifRef}>
                    <div className="notif-header">
                        <h3>Notifications</h3>
                        <div className="notif-header-actions">
                            <button onClick={() => { markAllAlertsRead(); }} title="Mark all as read">
                                <CheckCheck size={16} />
                            </button>
                            <button onClick={() => { clearAllAlerts(); setShowNotifications(false); }} title="Clear all">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="notif-list">
                        {alerts.length === 0 ? (
                            <div className="notif-empty">
                                <span>🔔</span>
                                <p>No notifications</p>
                            </div>
                        ) : (
                            alerts.slice(0, 10).map(a => (
                                <div key={a.id} className={`notif-item ${!a.read ? 'unread' : ''}`}>
                                    <span className="notif-icon">{getAlertIcon(a.type)}</span>
                                    <div className="notif-content">
                                        <p className="notif-message">{a.message}</p>
                                        <span className="notif-time">{formatAlertTime(a.timestamp)}</span>
                                    </div>
                                    <div className="notif-actions">
                                        {!a.read && (
                                            <button onClick={() => markAlertRead(a.id)} title="Mark as read">
                                                <Check size={14} />
                                            </button>
                                        )}
                                        <button onClick={() => clearAlert(a.id)} title="Remove">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Mobile Full-Screen Notification Panel */}
            {showNotifications && isMobile && (
                <div className="mobile-notif-overlay" onClick={() => setShowNotifications(false)}>
                    <div className="mobile-notif-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="mobile-notif-header">
                            <h3>Notifications</h3>
                            <div className="mobile-notif-header-actions">
                                <button className="mobile-notif-action-btn" onClick={() => markAllAlertsRead()}>
                                    <CheckCheck size={18} />
                                    <span>Mark all read</span>
                                </button>
                                <button className="mobile-notif-action-btn danger" onClick={() => { clearAllAlerts(); setShowNotifications(false); }}>
                                    <Trash2 size={18} />
                                    <span>Clear all</span>
                                </button>
                                <button className="mobile-notif-close" onClick={() => setShowNotifications(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="mobile-notif-count">
                            {unreadAlerts > 0 ? `${unreadAlerts} unread notification${unreadAlerts > 1 ? 's' : ''}` : 'All caught up!'}
                        </div>

                        <div className="mobile-notif-list">
                            {alerts.length === 0 ? (
                                <div className="mobile-notif-empty">
                                    <div className="mobile-notif-empty-icon">🔔</div>
                                    <p>No notifications yet</p>
                                    <span>You're all caught up!</span>
                                </div>
                            ) : (
                                alerts.map(a => (
                                    <div key={a.id} className={`mobile-notif-item ${!a.read ? 'unread' : ''} ${a.type}`}>
                                        <div className="mobile-notif-item-indicator" />
                                        <div className="mobile-notif-item-content">
                                            <p className="mobile-notif-item-message">{a.message}</p>
                                            <span className="mobile-notif-item-time">{formatAlertTime(a.timestamp)}</span>
                                        </div>
                                        <div className="mobile-notif-item-actions">
                                            {!a.read && (
                                                <button onClick={() => markAlertRead(a.id)} className="mobile-notif-item-btn read">
                                                    <Check size={16} />
                                                </button>
                                            )}
                                            <button onClick={() => clearAlert(a.id)} className="mobile-notif-item-btn remove">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

export default Header;
