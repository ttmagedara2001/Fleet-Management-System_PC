import React, { useState } from 'react';
import {
    Settings as SettingsIcon,
    Thermometer,
    Battery,
    Zap,
    Power,
    Wind,
    Bot,
    Save,
    RotateCcw,
    AlertTriangle,
    CheckCircle,
    Loader2
} from 'lucide-react';
import { useDevice } from '../contexts/DeviceContext';
import { useApi } from '../hooks/useApi';

function ToggleSwitch({ enabled, onChange, disabled }) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!enabled)}
            className={`toggle ${enabled ? 'active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={disabled}
        >
            <div className="toggle-knob" />
        </button>
    );
}

function SettingCard({ title, description, icon: Icon, children }) {
    return (
        <div className="card p-4">
            <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                    <Icon size={20} className="text-purple-600" />
                </div>
                <div>
                    <h4 className="font-semibold text-gray-900">{title}</h4>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
            </div>
            {children}
        </div>
    );
}

function ThresholdInput({ label, value, onChange, unit, min, max }) {
    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    min={min}
                    max={max}
                    className="input w-20 text-center"
                />
                <span className="text-sm text-gray-500 w-8">{unit}</span>
            </div>
        </div>
    );
}

function Settings() {
    const { selectedDeviceId, currentRobots, devices } = useDevice();
    const {
        controlAC,
        controlAirPurifier,
        setThreshold,
        setSystemMode,
        assignRobotTask
    } = useApi();

    // System Controls
    const [acEnabled, setAcEnabled] = useState(true);
    const [airPurifierEnabled, setAirPurifierEnabled] = useState(true);
    const [systemMode, setLocalSystemMode] = useState('AUTOMATED');

    // Thresholds
    const [tempThreshold, setTempThreshold] = useState(28);
    const [humidityThreshold, setHumidityThreshold] = useState(60);
    const [batteryThreshold, setBatteryThreshold] = useState(20);
    const [pressureThresholdLow, setPressureThresholdLow] = useState(1000);
    const [pressureThresholdHigh, setPressureThresholdHigh] = useState(1030);

    // Task Assignment
    const [selectedRobot, setSelectedRobot] = useState('');
    const [taskType, setTaskType] = useState('MOVE_FOUP');
    const [taskSource, setTaskSource] = useState('');
    const [taskDestination, setTaskDestination] = useState('');
    const [taskPriority, setTaskPriority] = useState('NORMAL');

    // Loading states
    const [savingThresholds, setSavingThresholds] = useState(false);
    const [savingControls, setSavingControls] = useState(false);
    const [assigningTask, setAssigningTask] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const robots = Object.values(currentRobots || {});

    const handleACToggle = async (enabled) => {
        console.log('[Settings] ❄️ Toggling AC:', enabled);
        setAcEnabled(enabled);
        try {
            await controlAC(selectedDeviceId, enabled);
            console.log('[Settings] ✅ AC control successful');
        } catch (error) {
            console.error('[Settings] ❌ AC control failed:', error);
            setAcEnabled(!enabled); // Revert on error
        }
    };

    const handleAirPurifierToggle = async (enabled) => {
        console.log('[Settings] 🌬️ Toggling Air Purifier:', enabled);
        setAirPurifierEnabled(enabled);
        try {
            await controlAirPurifier(selectedDeviceId, enabled);
            console.log('[Settings] ✅ Air purifier control successful');
        } catch (error) {
            console.error('[Settings] ❌ Air purifier control failed:', error);
            setAirPurifierEnabled(!enabled);
        }
    };

    const handleModeChange = async (mode) => {
        console.log('[Settings] ⚙️ Changing system mode:', mode);
        setLocalSystemMode(mode);
        try {
            await setSystemMode(selectedDeviceId, mode);
            console.log('[Settings] ✅ Mode change successful');
        } catch (error) {
            console.error('[Settings] ❌ Mode change failed:', error);
        }
    };

    const handleSaveThresholds = async () => {
        console.log('[Settings] 💾 Saving thresholds...');
        setSavingThresholds(true);

        try {
            await Promise.all([
                setThreshold(selectedDeviceId, 'temperature_max', tempThreshold),
                setThreshold(selectedDeviceId, 'humidity_max', humidityThreshold),
                setThreshold(selectedDeviceId, 'battery_min', batteryThreshold),
                setThreshold(selectedDeviceId, 'pressure_min', pressureThresholdLow),
                setThreshold(selectedDeviceId, 'pressure_max', pressureThresholdHigh),
            ]);

            console.log('[Settings] ✅ Thresholds saved successfully');
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('[Settings] ❌ Failed to save thresholds:', error);
        } finally {
            setSavingThresholds(false);
        }
    };

    const handleAssignTask = async () => {
        if (!selectedRobot || !taskSource || !taskDestination) {
            console.warn('[Settings] ⚠️ Missing task parameters');
            return;
        }

        console.log('[Settings] 🤖 Assigning task to robot:', selectedRobot);
        setAssigningTask(true);

        try {
            await assignRobotTask(selectedDeviceId, selectedRobot, {
                type: taskType,
                source: taskSource,
                destination: taskDestination,
                priority: taskPriority
            });

            console.log('[Settings] ✅ Task assigned successfully');
            // Clear form
            setTaskSource('');
            setTaskDestination('');
        } catch (error) {
            console.error('[Settings] ❌ Task assignment failed:', error);
        } finally {
            setAssigningTask(false);
        }
    };

    const locations = [
        { id: 'cleanroom-a', name: 'Cleanroom A' },
        { id: 'cleanroom-b', name: 'Cleanroom B' },
        { id: 'loading-bay', name: 'Loading Bay' },
        { id: 'storage-1', name: 'Storage Zone 1' },
        { id: 'storage-2', name: 'Storage Zone 2' },
        { id: 'maintenance', name: 'Maintenance Area' },
    ];

    const taskTypes = [
        { id: 'MOVE_FOUP', name: 'Move FOUP' },
        { id: 'PICKUP', name: 'Pickup' },
        { id: 'DELIVERY', name: 'Delivery' },
        { id: 'RETURN_HOME', name: 'Return to Home' },
        { id: 'CHARGE', name: 'Go to Charger' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Settings</h2>
                    <p className="text-sm text-gray-500">
                        Configure thresholds, controls, and automation for{' '}
                        <span className="text-purple-600 font-medium">{selectedDeviceId}</span>
                    </p>
                </div>

                {saveSuccess && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                        <CheckCircle size={16} />
                        <span className="text-sm font-medium">Settings saved!</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Controls */}
                <SettingCard
                    title="System Controls"
                    description="Manual control of environmental systems"
                    icon={Power}
                >
                    <div className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <Zap size={18} className="text-blue-500" />
                                <div>
                                    <p className="font-medium text-gray-900">Air Conditioning</p>
                                    <p className="text-xs text-gray-500">Climate control system</p>
                                </div>
                            </div>
                            <ToggleSwitch enabled={acEnabled} onChange={handleACToggle} />
                        </div>

                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <Wind size={18} className="text-green-500" />
                                <div>
                                    <p className="font-medium text-gray-900">Air Purifier</p>
                                    <p className="text-xs text-gray-500">Particle filtration system</p>
                                </div>
                            </div>
                            <ToggleSwitch enabled={airPurifierEnabled} onChange={handleAirPurifierToggle} />
                        </div>

                        <div className="pt-2">
                            <p className="text-sm font-medium text-gray-700 mb-2">System Mode</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleModeChange('MANUAL')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${systemMode === 'MANUAL'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Manual
                                </button>
                                <button
                                    onClick={() => handleModeChange('AUTOMATED')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${systemMode === 'AUTOMATED'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Automated
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {systemMode === 'AUTOMATED'
                                    ? 'System will auto-adjust based on thresholds'
                                    : 'Manual control of all systems'
                                }
                            </p>
                        </div>
                    </div>
                </SettingCard>

                {/* Thresholds */}
                <SettingCard
                    title="Alert Thresholds"
                    description="Configure alert trigger points"
                    icon={AlertTriangle}
                >
                    <div className="space-y-1">
                        <ThresholdInput
                            label="Temperature Max"
                            value={tempThreshold}
                            onChange={setTempThreshold}
                            unit="°C"
                            min={15}
                            max={40}
                        />
                        <ThresholdInput
                            label="Humidity Max"
                            value={humidityThreshold}
                            onChange={setHumidityThreshold}
                            unit="%"
                            min={20}
                            max={80}
                        />
                        <ThresholdInput
                            label="Battery Min"
                            value={batteryThreshold}
                            onChange={setBatteryThreshold}
                            unit="%"
                            min={5}
                            max={50}
                        />
                        <ThresholdInput
                            label="Pressure Min"
                            value={pressureThresholdLow}
                            onChange={setPressureThresholdLow}
                            unit="hPa"
                            min={950}
                            max={1050}
                        />
                        <ThresholdInput
                            label="Pressure Max"
                            value={pressureThresholdHigh}
                            onChange={setPressureThresholdHigh}
                            unit="hPa"
                            min={950}
                            max={1050}
                        />
                    </div>

                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                        <button
                            onClick={handleSaveThresholds}
                            disabled={savingThresholds}
                            className="btn btn-primary flex-1"
                        >
                            {savingThresholds ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            Save Thresholds
                        </button>
                        <button
                            onClick={() => {
                                setTempThreshold(28);
                                setHumidityThreshold(60);
                                setBatteryThreshold(20);
                                setPressureThresholdLow(1000);
                                setPressureThresholdHigh(1030);
                            }}
                            className="btn btn-secondary"
                        >
                            <RotateCcw size={16} />
                            Reset
                        </button>
                    </div>
                </SettingCard>

                {/* Task Assignment */}
                <SettingCard
                    title="Robot Task Assignment"
                    description="Assign tasks to active robots"
                    icon={Bot}
                >
                    <div className="space-y-4">
                        {/* Robot Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Select Robot
                            </label>
                            <select
                                value={selectedRobot}
                                onChange={(e) => setSelectedRobot(e.target.value)}
                                className="select"
                            >
                                <option value="">Choose a robot...</option>
                                {robots.map(robot => (
                                    <option key={robot.id} value={robot.id}>
                                        {robot.id} - {robot.status?.state || 'Unknown'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Task Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Task Type
                            </label>
                            <select
                                value={taskType}
                                onChange={(e) => setTaskType(e.target.value)}
                                className="select"
                            >
                                {taskTypes.map(type => (
                                    <option key={type.id} value={type.id}>{type.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Source */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Source Location
                            </label>
                            <select
                                value={taskSource}
                                onChange={(e) => setTaskSource(e.target.value)}
                                className="select"
                            >
                                <option value="">Select source...</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Destination */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Destination Location
                            </label>
                            <select
                                value={taskDestination}
                                onChange={(e) => setTaskDestination(e.target.value)}
                                className="select"
                            >
                                <option value="">Select destination...</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Priority
                            </label>
                            <div className="flex gap-2">
                                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(priority => (
                                    <button
                                        key={priority}
                                        onClick={() => setTaskPriority(priority)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${taskPriority === priority
                                                ? priority === 'URGENT' ? 'bg-red-500 text-white'
                                                    : priority === 'HIGH' ? 'bg-amber-500 text-white'
                                                        : 'bg-purple-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {priority}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleAssignTask}
                            disabled={assigningTask || !selectedRobot || !taskSource || !taskDestination}
                            className="btn btn-primary w-full"
                        >
                            {assigningTask ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Bot size={16} />
                            )}
                            Assign Task
                        </button>
                    </div>
                </SettingCard>

                {/* Device Info */}
                <SettingCard
                    title="Device Configuration"
                    description="Current device information"
                    icon={SettingsIcon}
                >
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Device ID</span>
                            <span className="text-sm font-mono font-medium text-gray-900">{selectedDeviceId}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Zone</span>
                            <span className="text-sm font-medium text-gray-900">
                                {devices.find(d => d.id === selectedDeviceId)?.zone || 'Unknown'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Active Robots</span>
                            <span className="text-sm font-medium text-purple-600">{robots.length}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-500">System Mode</span>
                            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${systemMode === 'AUTOMATED'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                {systemMode}
                            </span>
                        </div>
                    </div>
                </SettingCard>
            </div>
        </div>
    );
}

export default Settings;
