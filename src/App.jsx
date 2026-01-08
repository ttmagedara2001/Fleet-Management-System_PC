import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { StompProvider } from './contexts/StompContext';
import { DeviceProvider } from './contexts/DeviceContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Settings from './pages/Settings';
import { useAuth } from './contexts/AuthContext';

// Loading Screen Component
function LoadingScreen({ message }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 50%, #F5F3FF 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(124, 58, 237, 0.15)',
        padding: '48px 56px',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        {/* Logo Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 24px',
          background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 25px rgba(124, 58, 237, 0.35)'
        }}>
          <svg style={{ width: '40px', height: '40px', color: 'white' }} fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#5B21B6',
          marginBottom: '8px'
        }}>
          Fabrix
        </h1>

        {/* Message */}
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          marginBottom: '28px'
        }}>
          {message}
        </p>

        {/* Loading Spinner */}
        <div style={{
          width: '48px',
          height: '48px',
          margin: '0 auto',
          border: '4px solid #E5E7EB',
          borderTop: '4px solid #7C3AED',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />

        {/* Inline keyframes for spinner */}
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

// Error Screen Component
function ErrorScreen({ error, onRetry }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 50%, #F5F3FF 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(124, 58, 237, 0.15)',
        padding: '48px 40px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Error Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 24px',
          background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg
            style={{ width: '40px', height: '40px', color: '#EF4444' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#1F2937',
          marginBottom: '12px'
        }}>
          Authentication Failed
        </h2>

        {/* Error Message */}
        <p style={{
          fontSize: '15px',
          color: '#6B7280',
          marginBottom: '32px',
          lineHeight: '1.6'
        }}>
          {error || 'Unable to connect to the server. Please check your network connection and try again.'}
        </p>

        {/* Retry Button */}
        <button
          onClick={onRetry}
          style={{
            width: '100%',
            padding: '16px 24px',
            background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.35)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.45)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 15px rgba(124, 58, 237, 0.35)';
          }}
        >
          Retry Connection
        </button>

        {/* Help Text */}
        <p style={{
          fontSize: '13px',
          color: '#9CA3AF',
          marginTop: '20px'
        }}>
          If the problem persists, contact your administrator.
        </p>
      </div>
    </div>
  );
}

// App Content Component
function AppContent() {
  const { isLoading: authLoading, isAuthenticated, error: authError, performLogin } = useAuth();

  // Persist active tab in localStorage
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('fabrix_activeTab');
      if (saved && ['dashboard', 'analysis', 'settings'].includes(saved)) {
        return saved;
      }
    } catch (e) {
      console.error('[App] Failed to load activeTab:', e);
    }
    return 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Save active tab to localStorage when it changes
  React.useEffect(() => {
    try {
      localStorage.setItem('fabrix_activeTab', activeTab);
    } catch (e) {
      console.error('[App] Failed to save activeTab:', e);
    }
  }, [activeTab]);

  if (authLoading) {
    return <LoadingScreen message="Authenticating..." />;
  }

  if (authError && !isAuthenticated) {
    return <ErrorScreen error={authError} onRetry={performLogin} />;
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
    <div className="min-h-screen bg-gray-100">
      <Header onMenuToggle={() => setSidebarOpen(true)} />
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

function App() {
  console.log('[App] 🚀 Fabrix Dashboard initializing...');

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
