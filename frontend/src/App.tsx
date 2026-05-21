import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './layouts/MainLayout';
import type { ViewType } from './layouts/Sidebar';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { ObjectBrowser } from './features/buckets/ObjectBrowser';
import { ObjectBucketSelector } from './features/buckets/ObjectBucketSelector';
import { AccessKeyManager } from './features/security/AccessKeyManager';
import { PublicShareView } from './features/shares/PublicShareView';
import { DirectObjectView } from './features/shares/DirectObjectView';
import { Login } from './features/auth/Login';
import { Register } from './features/auth/Register';
import { UserManagement } from './features/auth/UserManagement';
import { PWAInstallToast } from './components/ui/PWAInstallToast';
import api from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [currentBucket, setCurrentBucket] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [username, setUsername] = useState<string>('');
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lumbungs3_token');
    }
    return null;
  });

  // Verify token and fetch role on mount
  useEffect(() => {
    if (token) {
      api.get('/auth/verify')
        .then(res => {
          if (res.data.role) setUserRole(res.data.role);
          if (res.data.username) setUsername(res.data.username);
        })
        .catch(() => {
          // If token invalid, logout
          localStorage.removeItem('lumbungs3_token');
          setToken(null);
        });
    }
  }, [token]);

  // Check if the current URL is a public share path
  const isSharePath = window.location.pathname.startsWith('/share/');
  const shareId = isSharePath ? window.location.pathname.substring(7) : null;

  if (isSharePath && shareId) {
    return (
      <QueryClientProvider client={queryClient}>
        <PublicShareView shareId={shareId} />
      </QueryClientProvider>
    );
  }

  // Check if the current URL is a direct viewer path
  const isViewPath = window.location.pathname.startsWith('/view/');
  const viewPathParts = isViewPath ? window.location.pathname.substring(6).split('/') : [];
  const viewBucket = viewPathParts[0];
  const viewKey = viewPathParts.slice(1).join('/');

  if (isViewPath && viewBucket && viewKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <DirectObjectView bucketName={viewBucket} objectKey={viewKey} />
      </QueryClientProvider>
    );
  }

  // Check if current URL is register path
  const isRegisterPath = window.location.pathname === '/register';
  if (isRegisterPath && !token) {
    return <Register />;
  }

  // Intercept and prompt login screen if unauthorized
  if (!token) {
    return (
      <Login onLogin={(newToken, role) => {
        localStorage.setItem('lumbungs3_token', newToken);
        setToken(newToken);
        if (role) setUserRole(role);
      }} />
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('lumbungs3_token');
    setToken(null);
    setUserRole('user');
    setUsername('');
  };

  const handleNavigate = (view: ViewType) => {
    setCurrentView(view);
    setCurrentBucket(null);
  };

  const handleSelectBucket = (name: string) => {
    setCurrentBucket(name);
    setCurrentView('objects');
  };

  const renderContent = () => {
    if (currentBucket && currentView === 'objects') {
      return (
        <ObjectBrowser 
          bucketName={currentBucket} 
          onBack={() => {
            setCurrentBucket(null);
            setCurrentView('overview');
          }} 
        />
      );
    }

    switch (currentView) {
      case 'overview':
        return <DashboardOverview onSelectBucket={handleSelectBucket} />;
      case 'buckets':
        return <DashboardOverview onSelectBucket={handleSelectBucket} viewMode="buckets" />;
      case 'security':
        return <AccessKeyManager />;
      case 'users':
        return <UserManagement />;
      case 'objects':
        if (!currentBucket) {
           return <ObjectBucketSelector onSelectBucket={handleSelectBucket} />;
        }
        return null;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
            <h3 className="text-xl font-medium">Under Construction</h3>
            <p>This module is currently being implemented.</p>
          </div>
        );
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout
        currentView={currentView}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        userRole={userRole}
        username={username}
      >
        {renderContent()}
      </MainLayout>
      <PWAInstallToast />
    </QueryClientProvider>
  );
}

export default App;
