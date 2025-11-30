/**
 * Main dashboard page
 */

import React from 'react';
import { useAuth } from '@presentation/contexts/AuthContext';
import { UploadReceipt } from '@presentation/components/UploadReceipt';
import { ClaimsList } from '@presentation/components/ClaimsList';

export const DashboardPage: React.FC = () => {
  const { appUser, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AutoClaim Generator</h1>
              <p className="text-sm text-gray-600">
                Welcome back, {appUser?.displayName || appUser?.email}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {appUser?.subscriptionTier} Plan
              </span>
              <button
                onClick={signOut}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Upload New Receipt
            </h2>
            <UploadReceipt />
          </div>

          {/* Recent Claims */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Claims</h2>
            <ClaimsList />
          </div>
        </div>
      </main>
    </div>
  );
};
