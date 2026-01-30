import React from 'react';

function LoadingScreen({ message = 'Loading...', stage = 'init' }) {
    const stages = {
        init: { progress: 10, color: 'bg-primary-600' },
        auth: { progress: 40, color: 'bg-primary-600' },
        stomp: { progress: 70, color: 'bg-green-500' },
        ready: { progress: 100, color: 'bg-green-500' }
    };

    const currentStage = stages[stage] || stages.init;

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center">
            <div className="text-center">
                {/* Logo */}
                <div className="w-20 h-20 mx-auto mb-6 gradient-primary rounded-2xl flex items-center justify-center shadow-xl animate-pulse">
                    <svg
                        viewBox="0 0 24 24"
                        className="w-10 h-10 text-white"
                        fill="currentColor"
                    >
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                        <path d="M12 6v2M12 16v2M6 12h2M16 12h2" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold gradient-text mb-2">Fabrix</h1>
                <p className="text-gray-500 mb-8">Semiconductor Fab Monitoring</p>

                {/* Progress Bar */}
                <div className="w-64 mx-auto mb-4">
                    <div className="progress-bar h-2">
                        <div
                            className={`progress-bar-fill ${currentStage.color} transition-all duration-500`}
                            style={{ width: `${currentStage.progress}%` }}
                        />
                    </div>
                </div>

                {/* Status Message */}
                <div className="flex items-center justify-center gap-2 text-gray-600">
                    <div className="loading-spinner w-4 h-4 border-2" />
                    <span className="text-sm">{message}</span>
                </div>

                {/* Stage Indicators */}
                <div className="flex items-center justify-center gap-6 mt-8">
                    <StageIndicator
                        label="Auth"
                        active={stage === 'auth'}
                        complete={['stomp', 'ready'].includes(stage)}
                    />
                    <div className="w-8 h-0.5 bg-gray-200" />
                    <StageIndicator
                        label="Connect"
                        active={stage === 'stomp'}
                        complete={['ready'].includes(stage)}
                    />
                    <div className="w-8 h-0.5 bg-gray-200" />
                    <StageIndicator
                        label="Ready"
                        active={stage === 'ready'}
                        complete={false}
                    />
                </div>
            </div>
        </div>
    );
}

function StageIndicator({ label, active, complete }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${complete
                    ? 'bg-green-500 text-white'
                    : active
                        ? 'bg-primary-600 text-white animate-pulse'
                        : 'bg-gray-200 text-gray-500'
                }`}>
                {complete ? '✓' : active ? '...' : '○'}
            </div>
            <span className={`text-xs ${active ? 'text-purple-600 font-medium' : 'text-gray-500'}`}>
                {label}
            </span>
        </div>
    );
}

export default LoadingScreen;
