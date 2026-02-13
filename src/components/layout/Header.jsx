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

            <style>{`
                /* Header Base */
                .header {
                    background: linear-gradient(135deg, #6B21A8 0%, #9333EA 100%);
                    height: 64px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 0 24px;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 100;
                    box-shadow: 0 4px 12px rgba(107, 33, 168, 0.3);
                }

                /* Mobile Menu Button */
                .header-menu-btn {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.15);
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    color: white;
                    flex-shrink: 0;
                    transition: background 0.2s;
                }

                .header-menu-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                }

                /* Logo */
                .header-logo {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-shrink: 0;
                }

                .header-logo-icon {
                    width: 36px;
                    height: 36px;
                    background: #7C3AED;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .header-title {
                    font-size: 22px;
                    font-weight: 700;
                    color: white;
                    letter-spacing: -0.5px;
                }

                /* Date/Time */
                .header-datetime {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    margin-left: auto;
                    color: rgba(255, 255, 255, 0.9);
                }

                .header-date {
                    font-size: 12px;
                    font-weight: 500;
                    opacity: 0.85;
                }

                .header-time {
                    font-size: 16px;
                    font-weight: 600;
                    margin-top: 2px;
                }

                /* Device Selector */
                .header-device-wrapper {
                    flex-shrink: 0;
                }

                .header-device-selector {
                    background: white;
                    border: none;
                    padding: 10px 36px 10px 14px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    min-width: 160px;
                    cursor: pointer;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 10px center;
                    transition: box-shadow 0.2s;
                }

                .header-device-selector:focus {
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
                }

                /* Icons Section */
                .header-icons {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .header-status-icons {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .header-icon {
                    width: 34px;
                    height: 34px;
                    background: rgba(255, 255, 255, 0.12);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 255, 255, 0.7);
                    transition: all 0.2s;
                }

                .header-icon.active {
                    background: rgba(34, 197, 94, 0.2);
                    border-color: rgba(34, 197, 94, 0.4);
                    color: #4ade80;
                }

                /* Bell Button */
                .header-notif-wrapper {
                    position: relative;
                }

                .header-bell-btn {
                    width: 40px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    cursor: pointer;
                    position: relative;
                    transition: all 0.2s;
                }

                .header-bell-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                }

                .header-bell-badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    min-width: 18px;
                    height: 18px;
                    background: #EF4444;
                    border-radius: 9px;
                    font-size: 10px;
                    font-weight: 700;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                    border: 2px solid #6B21A8;
                }

                /* Desktop Notification Popover */
                .notif-popover {
                    position: fixed;
                    top: 70px;
                    right: 24px;
                    width: 360px;
                    max-width: calc(100vw - 48px);
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                    z-index: 200;
                    overflow: hidden;
                    animation: slideIn 0.2s ease;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .notif-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid #F3F4F6;
                }

                .notif-header h3 {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1F2937;
                    margin: 0;
                }

                .notif-header-actions {
                    display: flex;
                    gap: 8px;
                }

                .notif-header-actions button {
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: #F3F4F6;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6B7280;
                    transition: all 0.2s;
                }

                .notif-header-actions button:hover {
                    background: #E5E7EB;
                    color: #374151;
                }

                .notif-list {
                    max-height: 400px;
                    overflow-y: auto;
                }

                .notif-empty {
                    padding: 48px 24px;
                    text-align: center;
                    color: #9CA3AF;
                }

                .notif-empty span {
                    font-size: 32px;
                    display: block;
                    margin-bottom: 12px;
                }

                .notif-empty p {
                    margin: 0;
                    font-size: 14px;
                }

                .notif-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 14px 20px;
                    border-bottom: 1px solid #F9FAFB;
                    transition: background 0.2s;
                }

                .notif-item:hover {
                    background: #F9FAFB;
                }

                .notif-item.unread {
                    background: #F0F9FF;
                }

                .notif-icon {
                    font-size: 16px;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .notif-content {
                    flex: 1;
                    min-width: 0;
                }

                .notif-message {
                    font-size: 13px;
                    color: #374151;
                    margin: 0 0 4px 0;
                    line-height: 1.4;
                }

                .notif-time {
                    font-size: 11px;
                    color: #9CA3AF;
                }

                .notif-actions {
                    display: flex;
                    gap: 4px;
                    flex-shrink: 0;
                }

                .notif-actions button {
                    width: 28px;
                    height: 28px;
                    border: none;
                    background: transparent;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #9CA3AF;
                    transition: all 0.2s;
                }

                .notif-actions button:hover {
                    background: #E5E7EB;
                    color: #374151;
                }

                /* Mobile Notification Overlay */
                .mobile-notif-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: 1000;
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    animation: fadeIn 0.2s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .mobile-notif-panel {
                    width: 100%;
                    max-height: 85vh;
                    background: white;
                    border-radius: 24px 24px 0 0;
                    display: flex;
                    flex-direction: column;
                    animation: slideUp 0.3s ease;
                    overflow: hidden;
                }

                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }

                .mobile-notif-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 20px 16px;
                    border-bottom: 1px solid #F3F4F6;
                    flex-shrink: 0;
                }

                .mobile-notif-header h3 {
                    font-size: 20px;
                    font-weight: 700;
                    color: #1F2937;
                    margin: 0;
                }

                .mobile-notif-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .mobile-notif-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    background: #F3F4F6;
                    border: none;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 500;
                    color: #374151;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .mobile-notif-action-btn:hover {
                    background: #E5E7EB;
                }

                .mobile-notif-action-btn.danger {
                    background: #FEE2E2;
                    color: #DC2626;
                }

                .mobile-notif-action-btn.danger:hover {
                    background: #FECACA;
                }

                .mobile-notif-close {
                    width: 40px;
                    height: 40px;
                    background: #F3F4F6;
                    border: none;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6B7280;
                    cursor: pointer;
                    margin-left: 8px;
                    transition: all 0.2s;
                }

                .mobile-notif-close:hover {
                    background: #E5E7EB;
                }

                .mobile-notif-count {
                    padding: 12px 20px;
                    font-size: 13px;
                    color: #6B7280;
                    background: #F9FAFB;
                    flex-shrink: 0;
                }

                .mobile-notif-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 8px 0;
                    -webkit-overflow-scrolling: touch;
                }

                .mobile-notif-empty {
                    padding: 60px 24px;
                    text-align: center;
                }

                .mobile-notif-empty-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                }

                .mobile-notif-empty p {
                    font-size: 16px;
                    font-weight: 600;
                    color: #374151;
                    margin: 0 0 8px 0;
                }

                .mobile-notif-empty span {
                    font-size: 14px;
                    color: #9CA3AF;
                }

                .mobile-notif-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 16px 20px;
                    border-bottom: 1px solid #F3F4F6;
                    transition: background 0.2s;
                }

                .mobile-notif-item.unread {
                    background: #F0F9FF;
                }

                .mobile-notif-item-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    flex-shrink: 0;
                    margin-top: 6px;
                    background: #9CA3AF;
                }

                .mobile-notif-item.critical .mobile-notif-item-indicator {
                    background: #EF4444;
                }

                .mobile-notif-item.warning .mobile-notif-item-indicator {
                    background: #F59E0B;
                }

                .mobile-notif-item-content {
                    flex: 1;
                    min-width: 0;
                }

                .mobile-notif-item-message {
                    font-size: 14px;
                    color: #1F2937;
                    margin: 0 0 6px 0;
                    line-height: 1.4;
                }

                .mobile-notif-item-time {
                    font-size: 12px;
                    color: #9CA3AF;
                }

                .mobile-notif-item-actions {
                    display: flex;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .mobile-notif-item-btn {
                    width: 36px;
                    height: 36px;
                    border: none;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .mobile-notif-item-btn.read {
                    background: #D1FAE5;
                    color: #059669;
                }

                .mobile-notif-item-btn.read:hover {
                    background: #A7F3D0;
                }

                .mobile-notif-item-btn.remove {
                    background: #F3F4F6;
                    color: #6B7280;
                }

                .mobile-notif-item-btn.remove:hover {
                    background: #FEE2E2;
                    color: #DC2626;
                }

                /* Responsive Breakpoints */
                @media (max-width: 1024px) {
                    .header-menu-btn {
                        display: flex;
                    }
                    
                    .header-datetime {
                        display: none;
                    }
                }

                @media (max-width: 768px) {
                    .header {
                        height: 60px;
                        padding: 0 16px;
                        gap: 12px;
                    }

                    .header-logo {
                        display: none;
                    }

                    .header-device-selector {
                        min-width: 120px;
                        font-size: 13px;
                        padding: 8px 32px 8px 12px;
                    }

                    .header-status-icons {
                        display: none;
                    }

                    .header-icon {
                        width: 32px;
                        height: 32px;
                    }

                    .header-bell-btn {
                        width: 38px;
                        height: 38px;
                    }

                    /* Mobile action buttons - hide text on very small screens */
                    .mobile-notif-action-btn span {
                        display: none;
                    }
                }

                @media (max-width: 480px) {
                    .header {
                        height: 56px;
                        padding: 0 12px;
                        gap: 8px;
                    }

                    .header-menu-btn {
                        width: 36px;
                        height: 36px;
                    }

                    .header-device-selector {
                        min-width: 100px;
                        max-width: 140px;
                        font-size: 12px;
                        padding: 6px 28px 6px 10px;
                    }

                    .header-bell-btn {
                        width: 36px;
                        height: 36px;
                    }

                    .mobile-notif-panel {
                        max-height: 90vh;
                        border-radius: 20px 20px 0 0;
                    }

                    .mobile-notif-header {
                        padding: 16px;
                    }

                    .mobile-notif-header h3 {
                        font-size: 18px;
                    }

                    .mobile-notif-action-btn {
                        padding: 8px;
                    }
                }

                /* Portrait-specific adjustments */
                @media (orientation: portrait) and (max-width: 768px) {
                    .mobile-notif-overlay {
                        padding-top: 60px;
                    }

                    .mobile-notif-panel {
                        border-radius: 20px 20px 0 0;
                    }
                }
            `}</style>
        </header>
    );
}

export default Header;
