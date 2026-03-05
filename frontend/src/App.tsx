import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './layouts/MainLayout';
import { ViewType } from './layouts/Sidebar';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { ObjectBrowser } from './features/buckets/ObjectBrowser';
import { AccessKeyManager } from './features/security/AccessKeyManager';

const queryClient = new QueryClient();

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [currentBucket, setCurrentBucket] = useState<string | null>(null);

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
      case 'buckets':
        return <DashboardOverview onSelectBucket={handleSelectBucket} />;
      case 'keys':
      case 'security':
        return <AccessKeyManager />;
      case 'objects':
        if (!currentBucket) {
           return <DashboardOverview onSelectBucket={handleSelectBucket} />;
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
