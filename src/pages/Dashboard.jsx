import React from 'react';
import DeviceEnvironmentPanel from '../components/dashboard/DeviceEnvironmentPanel';
import FabMap from '../components/dashboard/FabMap';
import RobotFleetPanel from '../components/dashboard/RobotFleetPanel';
import AlertsPanel from '../components/dashboard/AlertsPanel';

function Dashboard() {
    return (
        <div className="space-y-6">
            {/* Device Environment Section */}
            <DeviceEnvironmentPanel />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Fab Map - Takes 2 columns on XL */}
                <div className="xl:col-span-2">
                    <FabMap />
                </div>

                {/* Alerts Panel */}
                <div className="xl:col-span-1">
                    <AlertsPanel />
                </div>
            </div>

            {/* Robot Fleet Panel */}
            <RobotFleetPanel />
        </div>
    );
}

export default Dashboard;
