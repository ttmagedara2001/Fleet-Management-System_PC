import React, { useState } from 'react';
import {
    LayoutDashboard,
    BarChart3,
    Settings,
    User,
    StopCircle,
    X
} from 'lucide-react';
import { useDevice } from '../../contexts/DeviceContext';
import { useApi } from '../../hooks/useApi';

function Sidebar({ activeTab, setActiveTab, isOpen, onClose }) {
    const { selectedDeviceId } = useDevice();
    const { emergencyStop } = useApi();
    const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);
    const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'analysis', label: 'Analysis', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings }
    ];

    const handleEmergencyStop = async () => {
        if (!showEmergencyConfirm) {
            setShowEmergencyConfirm(true);
            return;
        }

        console.log('[UI] 🚨 Emergency stop initiated for:', selectedDeviceId);
        setIsEmergencyLoading(true);

        try {
            await emergencyStop(selectedDeviceId);
            console.log('[UI] ✅ Emergency stop successful');
        } catch (error) {
            console.error('[UI] ❌ Emergency stop failed:', error);
        } finally {
            setIsEmergencyLoading(false);
            setShowEmergencyConfirm(false);
        }
    };

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={`
        fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 
        flex flex-col z-40 transition-transform duration-300
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                {/* Mobile Close Button */}
                <button
                    onClick={onClose}
                    className="lg:hidden absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg"
                >
                    <X size={20} />
                </button>

                {/* User Profile Section */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center shadow-lg">
                            <User size={24} className="text-white" />
                        </div>
                        <div className="user-info">
                            <p className="font-semibold text-gray-900">Operator</p>
                            <p className="text-sm text-gray-500">Welcome!</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
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
                                className={`nav-item w-full ${isActive ? 'active' : ''}`}
                            >
                                <Icon size={20} />
                                <span className="nav-text">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Emergency Stop Button */}
                <div className="p-4 border-t border-gray-200">
                    {showEmergencyConfirm ? (
                        <div className="space-y-3">
                            <p className="text-sm text-center text-red-600 font-medium">
                                Confirm Emergency Stop?
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowEmergencyConfirm(false)}
                                    className="flex-1 px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleEmergencyStop}
                                    disabled={isEmergencyLoading}
                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                    {isEmergencyLoading ? 'Stopping...' : 'CONFIRM'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleEmergencyStop}
                            className="emergency-btn w-full flex items-center justify-center gap-2"
                        >
                            <StopCircle size={20} />
                            <span>EMERGENCY STOP</span>
                        </button>
                    )}
                </div>

                {/* Device Info Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                        Active Device: <span className="font-medium text-purple-600">{selectedDeviceId}</span>
                    </p>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
