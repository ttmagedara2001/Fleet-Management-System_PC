/**
 * Fabrix Fleet Management System — Root Application
 *
 * Wraps the app in Auth + Device context providers and handles
 * top-level routing between Dashboard, Analysis, and Settings pages.
 * Authentication state drives loading / error screens.
 *
 * @module App
 */
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DeviceProvider } from './contexts/DeviceContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Settings from './pages/Settings';

/* ------------------------------------------------------------------ */
/*  Loading Screen — shown during initial authentication              */
/* ------------------------------------------------------------------ */
function LoadingScreen({ message }) {
  return (
    <div className="loading-screen">
      <div className="loading-screen-card">
        <div className="loading-screen-logo">
          <svg width="40" height="40" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          </svg>
        </div>
        <h1 className="loading-screen-title">Fabrix</h1>
        <p className="loading-screen-message">{message}</p>
        <div className="loading-spinner" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Error Screen — shown when authentication fails                    */
/* ------------------------------------------------------------------ */
function ErrorScreen({ error, onRetry }) {
  return (
    <div className="loading-screen">
      <div className="loading-screen-card">
        <div className="error-screen-icon">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="error-screen-title">Authentication Failed</h2>
        <p className="error-screen-message">
          {error || 'Unable to connect to the server. Please check your network connection and try again.'}
        </p>
        <button className="error-screen-retry" onClick={onRetry}>Retry Connection</button>
        <p className="error-screen-help">If the problem persists, contact your administrator.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App Content — authenticated shell with sidebar + page routing     */
/* ------------------------------------------------------------------ */

/** Valid tab identifiers for navigation. */
const VALID_TABS = ['dashboard', 'analysis', 'settings'];

function AppContent() {
  const { isLoading: authLoading, isAuthenticated, error: authError, performLogin } = useAuth();

  // Persist active tab across page reloads
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('fabrix_activeTab');
      return VALID_TABS.includes(saved) ? saved : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('fabrix_activeTab', activeTab); } catch { /* quota exceeded — ignore */ }
  }, [activeTab]);

  if (authLoading) return <LoadingScreen message="Authenticating..." />;
  if (authError && !isAuthenticated) return <ErrorScreen error={authError} onRetry={performLogin} />;

  /** Render the active page based on the selected tab. */
  const renderPage = () => {
    switch (activeTab) {
      case 'analysis': return <Analysis />;
      case 'settings': return <Settings />;
      default:         return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header onMenuToggle={() => setSidebarOpen(prev => !prev)} sidebarOpen={sidebarOpen} />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">{renderPage()}</main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App — root component with context providers                       */
/* ------------------------------------------------------------------ */
function App() {
  return (
    <AuthProvider>
      <DeviceProvider>
        <AppContent />
      </DeviceProvider>
    </AuthProvider>
  );
}

export default App;
