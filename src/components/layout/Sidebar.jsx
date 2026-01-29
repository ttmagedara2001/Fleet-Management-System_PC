import React, { useState } from 'react';
import {
    LayoutDashboard,
    BarChart3,
    Settings,
    User,
    StopCircle,
    RefreshCw,
    AlertTriangle,
    Eye,
    EyeOff
} from 'lucide-react';
import { useDevice } from '../../contexts/DeviceContext';
import { useApi } from '../../hooks/useApi';

function Sidebar({ activeTab, setActiveTab, isOpen, onClose }) {
    const { selectedDeviceId } = useDevice();
    const { emergencyStop, emergencyClear } = useApi();
    const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);
    const [isStopped, setIsStopped] = useState(false);
    const [hideContent, setHideContent] = useState(() => {
        try {
            const raw = localStorage.getItem('sidebar_hide_content');
            return raw === 'true';
        } catch (e) { return false; }
    });

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
            // Flip to stopped state so the UI shows a Restart action
            setIsStopped(true);
        } catch (error) {
            console.error('[UI] ❌ Emergency stop failed:', error);
        } finally {
            setIsEmergencyLoading(false);
        }
    };

    const handleRestart = () => {
        console.log('[UI] 🔁 Restart requested, clearing emergency and reloading app');
        setIsEmergencyLoading(true);
        // Try to clear emergency on the server, then reload.
        emergencyClear(selectedDeviceId)
            .then(() => {
                console.log('[UI] ✅ Emergency cleared on server');
            })
            .catch((err) => {
                console.error('[UI] ❌ Failed to clear emergency on server:', err);
            })
            .finally(() => {
                setIsEmergencyLoading(false);
                // Reload to re-init app state and re-sync
                window.location.reload();
            });
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
                        opacity: isOpen ? 1 : 0,
                        transition: 'opacity 0.3s ease',
                        pointerEvents: isOpen ? 'auto' : 'none'
                    }}
                />
            )}

            <aside className={`sidebar ${isOpen ? 'open' : ''} ${hideContent ? 'collapsed' : ''}`}>
                {/* User Profile */}
                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">
                        <User size={20} />
                    </div>
                    <div className="sidebar-user-info">
                        <h4>WELCOME!</h4>
                        <p>USER1233</p>
                    </div>
                    <button
                        className="sidebar-hide-toggle"
                        onClick={() => {
                            const next = !hideContent;
                            setHideContent(next);
                            try { localStorage.setItem('sidebar_hide_content', String(next)); } catch (e) {}
                        }}
                        title={hideContent ? 'Show sidebar content' : 'Hide sidebar content'}
                    >
                        {hideContent ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
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
                        onClick={isStopped ? handleRestart : handleEmergencyStop}
                        disabled={isEmergencyLoading}
                        className={`emergency-btn ${isStopped ? 'restart' : ''}`}
                    >
                        {isStopped ? <RefreshCw size={18} /> : <StopCircle size={18} />}
                        {isEmergencyLoading ? 'PROCESSING...' : (isStopped ? 'RESTART' : 'EMERGENCY STOP')}
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
