import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { StompProvider } from './contexts/StompContext';
import { DeviceProvider } from './contexts/DeviceContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Settings from './pages/Settings';
import LoadingScreen from './components/LoadingScreen';
import { useAuth } from './contexts/AuthContext';
import { useStomp } from './contexts/StompContext';

// Loading wrapper component
function AppContent() {
  const { isLoading: authLoading, isAuthenticated, error: authError } = useAuth();
  const { isConnecting: stompConnecting } = useStomp();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Show loading screen during auth
  if (authLoading) {
    return <LoadingScreen message="Authenticating..." stage="auth" />;
  }

  // Show error if auth failed
  if (authError && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
          <p className="text-gray-500 mb-4">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show connecting screen while STOMP connects
  if (stompConnecting && !isAuthenticated) {
    return <LoadingScreen message="Connecting to server..." stage="stomp" />;
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'analysis':
        return <Analysis />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMenuToggle={() => setSidebarOpen(true)} />
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

function App() {
  console.log('[App] 🚀 Fabrix Dashboard initializing...');
  console.log('[App] 📅 Timestamp:', new Date().toISOString());
  console.log('[App] 🌐 Environment:', import.meta.env.MODE);

  return (
    <AuthProvider>
      <StompProvider>
        <DeviceProvider>
          <AppContent />
        </DeviceProvider>
      </StompProvider>
    </AuthProvider>
  );
}

export default App;
