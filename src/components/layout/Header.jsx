import React from 'react';
import { Wifi, Radio, Server, Bell, Cpu, Menu, X } from 'lucide-react';
import { useStomp } from '../../contexts/StompContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDevice } from '../../contexts/DeviceContext';

function Header({ onMenuToggle, sidebarOpen }) {
    const { isConnected: stompConnected } = useStomp();
    const { isAuthenticated } = useAuth();
    const { devices, selectedDeviceId, setSelectedDeviceId, alerts } = useDevice();

    const unreadAlerts = alerts.filter(a => !a.read).length;

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

            {/* Right - Icons */}
            <div className="header-icons">
                <div className={`header-icon ${stompConnected ? 'active' : ''}`} title="WebSocket">
                    <Wifi size={18} />
                </div>
                <div className={`header-icon ${stompConnected ? 'active' : ''}`} title="MQTT">
                    <Radio size={18} />
                </div>
                <div className={`header-icon ${isAuthenticated ? 'active' : ''}`} title="Server">
                    <Server size={18} />
                </div>
                <div className="w-px h-6 bg-white/30 mx-2" />
                <div className="header-icon relative" title="Notifications">
                    <Bell size={18} />
                    {unreadAlerts > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center">
                            {unreadAlerts > 9 ? '9+' : unreadAlerts}
                        </span>
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
            `}</style>
        </header>
    );
}

export default Header;

