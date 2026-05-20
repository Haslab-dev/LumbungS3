import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './layouts/MainLayout';
import type { ViewType } from './layouts/Sidebar';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { ObjectBrowser } from './features/buckets/ObjectBrowser';
import { ObjectBucketSelector } from './features/buckets/ObjectBucketSelector';
import { AccessKeyManager } from './features/security/AccessKeyManager';
import { SharedLinksManager } from './features/shares/SharedLinksManager';
import { PublicShareView } from './features/shares/PublicShareView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent refetching when browser window/tab is refocused
      staleTime: 5000,            // Consider query data fresh for 5 seconds to prevent mount/routing loop calls
    },
  },
});

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [currentBucket, setCurrentBucket] = useState<string | null>(null);

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

  const handleNavigate = (view: ViewType) => {
    setCurrentView(view);
    setCurrentBucket(null); // Clear bucket if navigating away from object browser
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
      case 'keys':
      case 'security':
        return <AccessKeyManager />;
      case 'shares':
        return <SharedLinksManager />;
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
      <MainLayout currentView={currentView} onNavigate={handleNavigate}>
        {renderContent()}
      </MainLayout>
    </QueryClientProvider>
  )
}

export default App

