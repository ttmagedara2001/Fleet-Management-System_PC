import React from 'react';
import { Bell, Wifi, Server, Radio, ChevronDown, Menu } from 'lucide-react';
import { useStomp } from '../../contexts/StompContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDevice } from '../../contexts/DeviceContext';

function Header({ onMenuToggle }) {
    const { isConnected: stompConnected, isConnecting: stompConnecting } = useStomp();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const { devices, selectedDeviceId, setSelectedDeviceId, alerts } = useDevice();

    const unreadAlerts = alerts.filter(a => !a.read).length;
    const criticalAlerts = alerts.filter(a => a.type === 'critical').length;

    const getConnectionStatus = (connected, connecting) => {
        if (connecting) return 'connecting';
        if (connected) return 'connected';
        return 'disconnected';
    };

    const ConnectionIcon = ({ connected, connecting, icon: Icon, label }) => {
        const status = getConnectionStatus(connected, connecting);
        return (
            <div
                className={`connection-icon ${status}`}
                title={`${label}: ${status.charAt(0).toUpperCase() + status.slice(1)}`}
            >
                <Icon size={16} />
            </div>
        );
    };

    return (
        <header className="h-16 bg-white border-b border-gray-200 px-4 flex items-center justify-between shadow-sm fixed top-0 left-0 right-0 z-50">
            {/* Left Section */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuToggle}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <Menu size={20} />
                </button>

                <div className="flex items-center gap-3">
                    {/* Logo */}
                    <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-lg">
                        <svg
                            viewBox="0 0 24 24"
                            className="w-6 h-6 text-white"
                            fill="currentColor"
                        >
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                            <circle cx="12" cy="12" r="3" fill="currentColor" />
                            <path d="M12 6v2M12 16v2M6 12h2M16 12h2M7.76 7.76l1.41 1.41M14.83 14.83l1.41 1.41M7.76 16.24l1.41-1.41M14.83 9.17l1.41-1.41" stroke="currentColor" strokeWidth="1" fill="none" />
                        </svg>
                    </div>

                    {/* App Title */}
                    <div>
                        <h1 className="text-xl font-bold gradient-text">Fabrix</h1>
                        <p className="text-xs text-gray-500 -mt-1">Semiconductor Fab Monitor</p>
                    </div>
                </div>
            </div>

            {/* Center Section - Device Selector */}
            <div className="hidden md:flex items-center">
                <div className="relative">
                    <select
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                        className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer hover:bg-gray-100 transition-colors min-w-[180px]"
                    >
                        {devices.map(device => (
                            <option key={device.id} value={device.id}>
                                {device.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                    />
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-3">
                {/* Connection Status Indicators */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                    <ConnectionIcon
                        connected={stompConnected}
                        connecting={stompConnecting}
                        icon={Wifi}
                        label="WebSocket"
                    />
                    <ConnectionIcon
                        connected={stompConnected}
                        connecting={stompConnecting}
                        icon={Radio}
                        label="MQTT"
                    />
                    <ConnectionIcon
                        connected={isAuthenticated}
                        connecting={authLoading}
                        icon={Server}
                        label="Auth/Server"
                    />
                </div>

                {/* Alerts Bell */}
                <button className="relative p-2.5 hover:bg-gray-100 rounded-lg transition-colors group">
                    <Bell size={20} className="text-gray-600 group-hover:text-purple-600 transition-colors" />
                    {unreadAlerts > 0 && (
                        <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold text-white rounded-full px-1 ${criticalAlerts > 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                            }`}>
                            {unreadAlerts > 99 ? '99+' : unreadAlerts}
                        </span>
                    )}
                </button>

                {/* Mobile Device Selector */}
                <div className="md:hidden">
                    <select
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                        className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        {devices.map(device => (
                            <option key={device.id} value={device.id}>
                                {device.id}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </header>
    );
}

export default Header;
