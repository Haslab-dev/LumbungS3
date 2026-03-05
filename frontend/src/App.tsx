import { MainLayout } from './layouts/MainLayout';
import { DashboardOverview } from './features/dashboard/DashboardOverview';

function App() {
  return (
    <MainLayout>
      <DashboardOverview />
    </MainLayout>
  )
}

export default App
