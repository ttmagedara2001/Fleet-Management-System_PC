import React, { useState, useRef, useEffect } from 'react';
import { Wifi, Radio, Server, Bell, Cpu, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDevice } from '../../contexts/DeviceContext';

function Header({ onMenuToggle, sidebarOpen }) {
    const { isAuthenticated } = useAuth();
    const { devices, selectedDeviceId, setSelectedDeviceId, alerts, isConnected, clearAlert, clearAllAlerts, markAlertRead, markAllAlertsRead } = useDevice();

    const unreadAlerts = alerts.filter(a => !a.read).length;
    const [showNotifications, setShowNotifications] = useState(false);
    const notifRef = useRef(null);
    const [isMobile, setIsMobile] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        function handleClickOutside(e) {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
        }
        if (showNotifications) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showNotifications]);

    useEffect(() => {
        function onResize() {
            setIsMobile(window.innerWidth <= 480);
        }
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape' && showNotifications) setShowNotifications(false);
        }
        if (showNotifications && isMobile) document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [showNotifications, isMobile]);
    
    useEffect(() => {
        function onResize() {
            setIsMobile(window.innerWidth <= 480);
            setIsPortrait(window.innerHeight >= window.innerWidth);
        }
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Helpers for pretty date/time formatting
    function getOrdinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
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

    // Mobile notification modal CSS classes (computed here so JSX is simple)
    // Always center the mobile modal so it appears in the middle of the screen
    const mobileNotifCentered = true;
    const mobileBackdropCls = `mobile-notif-backdrop ${mobileNotifCentered ? 'centered' : ''}`;
    const mobileCardCls = `mobile-notif-card ${mobileNotifCentered ? 'mobile-notif-card-centered' : ''}`;
    return (
        <header className="header">
            {/* Mobile Menu Button - Hamburger/Close icon */}
            <button
                className="header-menu-btn"
                onClick={onMenuToggle}
                aria-label={sidebarOpen ? "Close menu" : "Open menu"}
                style={{
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'white',
                    marginRight: '8px',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                    padding: 0
                }}
            >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Left - Logo */}
            <div className="header-logo">
                <div className="header-logo-icon">
                    <Cpu size={24} className="text-white" />
                </div>
                <span className="header-title">Fabrix</span>
            </div>

            {/* Date / Time */}
            <div className="header-datetime hidden md:flex items-center text-white/80 mr-4">
                <div className="flex flex-col items-end">
                    <div className="header-date font-medium text-sm" style={{ lineHeight: 1 }}>{/* e.g. 27th Tue, Jan 2026 */}
                        {formatDatePretty(now)}
                    </div>
                    <div className="header-time text-white/90" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, marginTop: 8 }}>{formatTimePretty(now)}</div>
                </div>
            </div>

            {/* Center - Device Selector */}
            <div className="flex items-center flex-1 md:flex-none">
                <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="header-device-selector"
                    style={{
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: '40px'
                    }}
                >
                    {devices.map(device => (
                        <option key={device.id} value={device.id}>
                            {device.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Right - Connection Status & Icons */}
            <div className="header-icons">
                <div className={`header-icon ${isConnected ? 'active' : ''}`} title="Live Data (WebSocket)">
                    <Wifi size={18} />
                </div>
                <div className="header-icon active" title="HTTP API Connected">
                    <Radio size={18} />
                </div>
                <div className={`header-icon ${isAuthenticated ? 'active' : ''}`} title="Server Status">
                    <Server size={18} />
                </div>
                <div className="w-px h-6 bg-white/30 mx-2" />
                <div className="header-icon relative" title="Notifications" ref={notifRef}>
                    <div
                        role="button"
                        tabIndex={0}
                        className="flex items-center"
                        onClick={() => setShowNotifications(s => !s)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setShowNotifications(s => !s); }}
                    >
                        <Bell size={18} />
                        {unreadAlerts > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center">
                                {unreadAlerts > 9 ? '9+' : unreadAlerts}
                            </span>
                        )}
                    </div>

                    {showNotifications && !isMobile && (
                        <div className="notification-popover" role="dialog" aria-label="Notifications">
                            <div className="bg-white text-gray-900 shadow-lg rounded-md w-80 max-w-xs overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b">
                                    <div className="font-semibold text-sm">Notifications</div>
                                    <div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button
                                                className="text-xs text-blue-600 hover:underline"
                                                onClick={() => { markAllAlertsRead(); setShowNotifications(false); }}
                                            >
                                                Mark all read
                                            </button>
                                            <button
                                                className="text-xs text-blue-600 hover:underline"
                                                onClick={() => { clearAllAlerts(); setShowNotifications(false); }}
                                            >
                                                Clear all
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-auto">
                                    {alerts.length === 0 ? (
                                        <div className="p-3 text-sm text-gray-600">No notifications</div>
                                    ) : (
                                        alerts.map(a => (
                                            <div key={a.id} className="p-3 border-b last:border-b-0 flex items-start gap-2">
                                                    <div className={`w-2 h-2 rounded-full mt-1 ${a.type === 'critical' ? 'bg-red-500' : a.type === 'warning' ? 'bg-green-400' : 'bg-green-400'}`} />
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium">{a.message}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{new Date(a.timestamp).toLocaleString()}</div>
                                                </div>
                                                <div className="ml-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    <button className="text-xs text-blue-600" onClick={() => { markAlertRead(a.id); }}>
                                                        Mark read
                                                    </button>
                                                    <button className="text-xs text-blue-600" onClick={() => { clearAlert(a.id); }}>
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mobile full-screen notifications modal */}
                    {showNotifications && isMobile && (
                        <div className={mobileBackdropCls} role="dialog" aria-modal="true" aria-label="Notifications" onClick={() => setShowNotifications(false)}>
                            <div className={mobileCardCls} onClick={(e) => e.stopPropagation()} ref={notifRef}>
                                <div className="flex items-center justify-between px-4 py-3 border-b">
                                    <div className="font-semibold">Notifications</div>
                                    <div className="flex items-center gap-2">
                                        <button className="text-sm text-blue-600" onClick={() => { markAllAlertsRead(); setShowNotifications(false); }}>Mark all read</button>
                                        <button className="text-sm text-blue-600" onClick={() => { clearAllAlerts(); setShowNotifications(false); }}>Clear all</button>
                                        <button className="text-lg text-gray-600 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center" aria-label="Close" onClick={() => setShowNotifications(false)}>×</button>
                                    </div>
                                </div>
                                <div className="overflow-auto py-3 px-2" style={{ maxHeight: '70vh' }}>
                                    {alerts.length === 0 ? (
                                        <div className="p-6 text-center text-sm text-gray-600">No notifications</div>
                                    ) : (
                                        alerts.map(a => (
                                            <div key={a.id} className="p-3 border-b last:border-b-0 flex items-start gap-3">
                                                <div className={`w-3 h-3 rounded-full mt-1 ${a.type === 'critical' ? 'bg-red-500' : a.type === 'warning' ? 'bg-green-400' : 'bg-green-400'}`} />
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium">{a.message}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{new Date(a.timestamp).toLocaleString()}</div>
                                                </div>
                                                <div className="ml-2">
                                                    <button className="text-xs text-blue-600" onClick={() => { clearAlert(a.id); }}>
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile styles */}
            <style>{`
                @media (max-width: 1024px) {
                    .header-menu-btn {
                        display: flex !important;
                    }
                }
                
                @media (max-width: 768px) {
                    .header-logo {
                        display: none;
                    }
                    
                    .header-device-selector {
                        max-width: 150px;
                        font-size: 14px;
                    }
                    
                    .header-icons .header-icon:nth-child(1),
                    .header-icons .header-icon:nth-child(2) {
                        display: none;
                    }
                    
                    .header-icons .w-px {
                        display: none;
                    }
                }
                
                @media (max-width: 480px) {
                    .header-device-selector {
                        max-width: 100px;
                        font-size: 12px;
                    }
                    
                    .header-icons .header-icon:nth-child(3) {
                        display: none;
                    }
                }
                /* Notification popover positioning and styling */
                .notification-popover {
                    position: absolute;
                    right: 24px; /* increased margin from right edge */
                    top: calc(100% + 22px); /* increased gap from icon */
                    z-index: 60;
                    display: flex;
                    align-items: flex-start;
                    pointer-events: auto;
                    margin-right: 12px; /* extra outer spacing */
                }

                .notification-popover .bg-white {
                    min-width: 300px;
                    max-width: 420px;
                    border-radius: 12px;
                    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.20);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    margin: 10px; /* inner margin around card for extra breathing room */
                    padding: 8px; /* increased padding inside outer container */
                }

                .notification-popover .header {
                    padding: 12px 14px;
                }

                .notification-popover .max-h-64 {
                    padding: 6px 0;
                }

                .notification-item {
                    padding: 12px 14px;
                    display: flex;
                    gap: 10px;
                    align-items: flex-start;
                }

                .notification-item .dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 99px;
                    margin-top: 4px;
                    flex-shrink: 0;
                }

                .notification-item .message {
                    flex: 1 1 auto;
                    font-size: 13px;
                    line-height: 1.2;
                    color: #0f172a;
                }

                .notification-item .meta {
                    font-size: 11px;
                    color: #6b7280;
                    margin-top: 6px;
                }

                .notification-item button {
                    background: transparent;
                    border: none;
                    color: #2563eb;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 6px;
                    align-self: start;
                    font-size: 12px;
                }

                .notification-item button:hover {
                    background: rgba(37,99,235,0.06);
                }

                .notification-empty {
                    padding: 18px;
                    text-align: center;
                    color: #6b7280;
                    font-size: 13px;
                }
                /* Mobile notifications modal */
                .mobile-notif-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.45);
                    z-index: 80;
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    padding: 12px;
                }

                .mobile-notif-card {
                    width: 100%;
                    max-width: 720px;
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 18px 40px rgba(2,6,23,0.2);
                }
                .mobile-notif-card-centered { max-width: 640px; width: 92%; border-radius: 14px; }
                .mobile-notif-backdrop.centered { align-items: center; padding: 24px; }
                .mobile-notif-card .border-b { border-bottom: 1px solid #EEF2FF; }
                /* Date/time styles */
                .header-datetime { 
                    min-width: 120px;
                }
            `}</style>
        </header>
    );
}

export default Header;

