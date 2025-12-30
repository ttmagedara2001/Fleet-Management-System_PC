import React, { useState, useEffect, useMemo } from 'react';
import { useDevice } from '../../contexts/DeviceContext';

// Fab layout zones configuration
const ZONES = [
    { id: 'cleanroom-a', name: 'Cleanroom A', x: 50, y: 50, width: 300, height: 200, type: 'cleanroom' },
    { id: 'cleanroom-b', name: 'Cleanroom B', x: 400, y: 50, width: 300, height: 200, type: 'cleanroom' },
    { id: 'loading-bay', name: 'Loading Bay', x: 50, y: 300, width: 200, height: 150, type: 'loading' },
    { id: 'storage', name: 'Storage', x: 300, y: 300, width: 200, height: 150, type: 'storage' },
    { id: 'maintenance', name: 'Maintenance', x: 550, y: 300, width: 150, height: 150, type: 'storage' },
];

// Aisles
const AISLES = [
    { id: 'aisle-1', points: '200,250 200,300 350,300 350,250', name: 'Aisle 1' },
    { id: 'aisle-2', points: '350,50 350,300', name: 'Aisle 2', isVertical: true },
    { id: 'aisle-3', points: '50,250 750,250', name: 'Aisle 3', isHorizontal: true },
];

function RobotMarker({ robot, isSelected, onClick }) {
    const getBatteryColor = () => {
        const battery = robot.status?.battery;
        if (!battery) return 'gray';
        if (battery > 60) return 'green';
        if (battery > 30) return 'amber';
        return 'red';
    };

    const getStatusColor = () => {
        const state = robot.status?.state;
        if (state === 'MOVING' || state === 'ACTIVE') return 'bg-green-500';
        if (state === 'CHARGING') return 'bg-amber-500';
        if (state === 'ERROR' || state === 'STOPPED') return 'bg-red-500';
        return 'bg-gray-400';
    };

    // Convert lat/lng to map coordinates (simplified transformation)
    const x = 100 + (robot.location?.lng || 0) * 500;
    const y = 100 + (robot.location?.lat || 0) * 300;
    const heading = robot.heading || 0;

    return (
        <g
            transform={`translate(${x}, ${y})`}
            onClick={onClick}
            style={{ cursor: 'pointer' }}
            className="robot-marker-group"
        >
            {/* Selection ring */}
            {isSelected && (
                <circle
                    r="28"
                    fill="none"
                    stroke="#9333ea"
                    strokeWidth="3"
                    strokeDasharray="4 2"
                    className="animate-spin-slow"
                />
            )}

            {/* Robot body */}
            <circle
                r="18"
                className="fill-purple-600"
                stroke="white"
                strokeWidth="3"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"
            />

            {/* Heading indicator */}
            <line
                x1="0"
                y1="0"
                x2="0"
                y2="-25"
                stroke="#9333ea"
                strokeWidth="3"
                markerEnd="url(#arrowhead)"
                transform={`rotate(${heading})`}
            />

            {/* Robot ID */}
            <text
                y="4"
                textAnchor="middle"
                className="text-xs font-bold fill-white"
                style={{ fontSize: '10px' }}
            >
                {robot.id.split('-')[1] || robot.id.substring(0, 3)}
            </text>

            {/* Status indicator */}
            <circle
                cx="12"
                cy="-12"
                r="5"
                className={getStatusColor()}
                stroke="white"
                strokeWidth="2"
            />

            {/* Battery indicator (small bar) */}
            <rect
                x="-8"
                y="22"
                width="16"
                height="4"
                rx="2"
                fill="#e5e7eb"
            />
            <rect
                x="-8"
                y="22"
                width={`${(robot.status?.battery || 0) * 0.16}`}
                height="4"
                rx="2"
                fill={getBatteryColor() === 'green' ? '#22c55e' : getBatteryColor() === 'amber' ? '#f59e0b' : '#ef4444'}
            />
        </g>
    );
}

function ZoneComponent({ zone }) {
    const getZoneClass = () => {
        switch (zone.type) {
            case 'cleanroom': return 'fill-purple-100 stroke-purple-300';
            case 'loading': return 'fill-green-100 stroke-green-300';
            case 'storage': return 'fill-amber-100 stroke-amber-300';
            default: return 'fill-gray-100 stroke-gray-300';
        }
    };

    return (
        <g>
            <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                rx="8"
                className={`${getZoneClass()} fill-opacity-60`}
                strokeWidth="2"
                strokeDasharray="8 4"
            />
            <text
                x={zone.x + zone.width / 2}
                y={zone.y + 20}
                textAnchor="middle"
                className="text-xs font-semibold fill-gray-600"
                style={{ fontSize: '12px' }}
            >
                {zone.name}
            </text>
        </g>
    );
}

function FabMap() {
    const { currentRobots, selectedDeviceId } = useDevice();
    const [selectedRobotId, setSelectedRobotId] = useState(null);
    const [mapDimensions] = useState({ width: 750, height: 500 });

    const robots = useMemo(() => {
        return Object.values(currentRobots || {});
    }, [currentRobots]);

    const selectedRobot = selectedRobotId ? currentRobots[selectedRobotId] : null;

    return (
        <div className="card overflow-hidden">
            {/* Map Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-gray-900">Fab Floor Map</h3>
                    <p className="text-sm text-gray-500">
                        {robots.length} robot{robots.length !== 1 ? 's' : ''} active
                    </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-purple-200 border-2 border-purple-400" />
                        <span>Cleanroom</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-green-200 border-2 border-green-400" />
                        <span>Loading</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-amber-200 border-2 border-amber-400" />
                        <span>Storage</span>
                    </div>
                </div>
            </div>

            {/* SVG Map */}
            <div className="relative bg-gradient-to-br from-gray-50 to-gray-100">
                <svg
                    viewBox={`0 0 ${mapDimensions.width} ${mapDimensions.height}`}
                    className="w-full h-[400px]"
                >
                    {/* Defs */}
                    <defs>
                        <marker
                            id="arrowhead"
                            markerWidth="6"
                            markerHeight="6"
                            refX="3"
                            refY="3"
                            orient="auto"
                        >
                            <polygon
                                points="0,0 6,3 0,6"
                                fill="#9333ea"
                            />
                        </marker>
                        <pattern
                            id="grid"
                            width="40"
                            height="40"
                            patternUnits="userSpaceOnUse"
                        >
                            <path
                                d="M 40 0 L 0 0 0 40"
                                fill="none"
                                stroke="#e5e7eb"
                                strokeWidth="0.5"
                            />
                        </pattern>
                    </defs>

                    {/* Grid background */}
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Zones */}
                    {ZONES.map(zone => (
                        <ZoneComponent key={zone.id} zone={zone} />
                    ))}

                    {/* Aisles */}
                    {AISLES.map(aisle => (
                        <path
                            key={aisle.id}
                            d={aisle.isHorizontal
                                ? `M ${aisle.points.split(' ')[0]} L ${aisle.points.split(' ')[1]}`
                                : aisle.isVertical
                                    ? `M ${aisle.points.split(' ')[0]} L ${aisle.points.split(' ')[1]}`
                                    : `M ${aisle.points}`
                            }
                            stroke="#9ca3af"
                            strokeWidth="20"
                            strokeLinecap="round"
                            fill="none"
                            opacity="0.3"
                        />
                    ))}

                    {/* Task routes - draw dotted lines for active tasks */}
                    {robots.map(robot => {
                        if (!robot.task?.source && !robot.task?.destination) return null;

                        const startX = 100 + (robot.location?.lng || 0) * 500;
                        const startY = 100 + (robot.location?.lat || 0) * 300;
                        // Mock destination (would come from task data)
                        const endX = startX + 100;
                        const endY = startY + 50;

                        return (
                            <path
                                key={`route-${robot.id}`}
                                d={`M ${startX} ${startY} L ${endX} ${endY}`}
                                stroke="#9333ea"
                                strokeWidth="2"
                                strokeDasharray="6 4"
                                fill="none"
                                opacity="0.6"
                            />
                        );
                    })}

                    {/* Robots */}
                    {robots.map(robot => (
                        <RobotMarker
                            key={robot.id}
                            robot={robot}
                            isSelected={robot.id === selectedRobotId}
                            onClick={() => setSelectedRobotId(robot.id === selectedRobotId ? null : robot.id)}
                        />
                    ))}
                </svg>

                {/* Robot Info Overlay */}
                {selectedRobot && (
                    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 min-w-[200px] border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">{selectedRobot.id}</h4>
                            <button
                                onClick={() => setSelectedRobotId(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ×
                            </button>
                        </div>
                        <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Status</span>
                                <span className="font-medium">{selectedRobot.status?.state || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Battery</span>
                                <span className="font-medium">{selectedRobot.status?.battery || '--'}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Load</span>
                                <span className="font-medium">{selectedRobot.status?.load || 'None'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Temperature</span>
                                <span className="font-medium">{selectedRobot.environment?.temp || '--'}°C</span>
                            </div>
                            {selectedRobot.task && (
                                <div className="pt-2 border-t border-gray-100">
                                    <p className="text-xs text-gray-400">Current Task</p>
                                    <p className="font-medium text-purple-600 text-xs">
                                        {selectedRobot.task.type}: {selectedRobot.task.source} → {selectedRobot.task.destination}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FabMap;
