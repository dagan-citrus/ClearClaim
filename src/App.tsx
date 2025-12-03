/**
 * Main App with tab-based navigation
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@presentation/contexts/AuthContext';
import { LoginPage } from '@presentation/pages/LoginPage';
import { DashboardPage } from '@presentation/pages/DashboardPage';
import { ProfilesPage } from '@presentation/pages/ProfilesPage';
import { InsurersPage } from '@presentation/pages/InsurersPage';
import { ClaimsPage } from '@presentation/pages/ClaimsPage';
import { NewClaimPage } from '@presentation/pages/NewClaimPage';
import { initializeFirebase } from '@infrastructure/database/firebase';
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  PlusCircle,
  LogOut,
} from 'lucide-react';

// Initialize Firebase on app start
initializeFirebase();

type TabType = 'dashboard' | 'profiles' | 'insurers' | 'claims' | 'new-claim';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
}

const tabs: TabConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, component: DashboardPage },
  { id: 'profiles', label: 'Profiles', icon: Users, component: ProfilesPage },
  { id: 'insurers', label: 'Insurers', icon: Building2, component: InsurersPage },
  { id: 'claims', label: 'Claims', icon: FileText, component: ClaimsPage },
  { id: 'new-claim', label: 'New Claim', icon: PlusCircle, component: NewClaimPage },
];

function AppContent() {
  const { user, appUser, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component || DashboardPage;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">ClearClaim</h1>
                <p className="text-xs text-gray-500">Insurance Made Easy</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {appUser?.displayName || appUser?.email}
                </p>
                <p className="text-xs text-gray-500">{appUser?.subscriptionTier} Plan</p>
              </div>
              <button
                onClick={signOut}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs Navigation */}
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                    ${
                      isActive
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ActiveComponent />
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
