import React, { useState } from 'react';
import {
    LayoutDashboard,
    BarChart3,
    Settings,
    User,
    StopCircle,
    AlertTriangle
} from 'lucide-react';
import { useDevice } from '../../contexts/DeviceContext';
import { useApi } from '../../hooks/useApi';

function Sidebar({ activeTab, setActiveTab, isOpen, onClose }) {
    const { selectedDeviceId } = useDevice();
    const { emergencyStop } = useApi();
    const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'analysis', label: 'Analysis', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings }
    ];

    const handleEmergencyStop = async () => {
        console.log('[UI] 🚨 Emergency stop initiated for:', selectedDeviceId);
        setIsEmergencyLoading(true);

        try {
            await emergencyStop(selectedDeviceId);
            console.log('[UI] ✅ Emergency stop successful');
        } catch (error) {
            console.error('[UI] ❌ Emergency stop failed:', error);
        } finally {
            setIsEmergencyLoading(false);
        }
    };

    return (
        <>
            {/* Mobile Backdrop Overlay */}
            {isOpen && (
                <div
                    className="sidebar-backdrop"
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 40,
                        display: 'none',
                        opacity: isOpen ? 1 : 0,
                        transition: 'opacity 0.3s ease',
                        pointerEvents: isOpen ? 'auto' : 'none'
                    }}
                />
            )}

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                {/* User Profile */}
                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">
                        <User size={20} />
                    </div>
                    <div className="sidebar-user-info">
                        <h4>WELCOME!</h4>
                        <p>USER1233</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {navItems.map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id);
                                    onClose();
                                }}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                            >
                                <Icon size={20} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Emergency Stop Section */}
                <div className="emergency-section">
                    <p className="emergency-warning">
                        Stops all active machinery immediately. Use only in EMERGENCIES
                    </p>
                    <button
                        onClick={handleEmergencyStop}
                        disabled={isEmergencyLoading}
                        className="emergency-btn"
                    >
                        <StopCircle size={18} />
                        {isEmergencyLoading ? 'STOPPING...' : 'EMERGENCY STOP'}
                    </button>
                </div>
            </aside>

            {/* Mobile backdrop show */}
            <style>{`
                @media (max-width: 1024px) {
                    .sidebar-backdrop {
                        display: block !important;
                    }
                }
            `}</style>
        </>
    );
}

export default Sidebar;
