/**
 * Main dashboard page
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@presentation/contexts/AuthContext';
import { container } from '@core/container';
import {
  Claim,
  ClaimStatus,
  SubscriptionTier,
} from '@core/types';
import {
  FileText,
  Users,
  Clock,
  CheckCircle,
  Building2,
  PlusCircle,
  TrendingUp,
  Calendar,
  DollarSign,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClaims: 0,
    pendingReview: 0,
    submitted: 0,
    insuredPersons: 0,
    insurers: 0,
    claimsThisMonth: 0,
  });
  const [recentClaims, setRecentClaims] = useState<Claim[]>([]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load claims
      const claims = await container.claimProcessorService.getUserClaims(user!.uid);

      // Calculate stats
      const pendingCount = claims.filter(
        (c) => c.status === ClaimStatus.READY_FOR_REVIEW
      ).length;
      const submittedCount = claims.filter(
        (c) => c.status === ClaimStatus.SUBMITTED
      ).length;

      // Count claims this month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const claimsThisMonthCount = claims.filter(
        (c) => c.createdAt >= monthStart
      ).length;

      // Load insured persons
      const persons = await container.insuredPersonRepository.findByUserId(user!.uid);

      // Load insurers (shared across users, but we'll count them anyway)
      const insurers = await container.insurerRepository.findAllOrdered();

      setStats({
        totalClaims: claims.length,
        pendingReview: pendingCount,
        submitted: submittedCount,
        insuredPersons: persons.length,
        insurers: insurers.length,
        claimsThisMonth: claimsThisMonthCount,
      });

      // Get recent claims (last 5)
      setRecentClaims(claims.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ClaimStatus) => {
    switch (status) {
      case ClaimStatus.SUBMITTED:
        return 'bg-green-100 text-green-800';
      case ClaimStatus.APPROVED:
        return 'bg-blue-100 text-blue-800';
      case ClaimStatus.READY_FOR_REVIEW:
        return 'bg-yellow-100 text-yellow-800';
      case ClaimStatus.DRAFT:
        return 'bg-gray-100 text-gray-800';
      case ClaimStatus.REJECTED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getSubscriptionLimit = () => {
    if (appUser?.subscriptionTier === SubscriptionTier.FREE) {
      return { personLimit: 1, claimLimit: 3 };
    }
    return { personLimit: null, claimLimit: null }; // Unlimited
  };

  const limits = getSubscriptionLimit();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {appUser?.displayName || 'User'}
        </h2>
        <p className="text-gray-600">Here's what's happening with your claims</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Claims */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Claims</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalClaims}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Insured Profiles */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Insured Profiles</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.insuredPersons}
                {limits.personLimit && (
                  <span className="text-sm text-gray-500 ml-1">/ {limits.personLimit}</span>
                )}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Pending Review */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Review</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingReview}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Submitted */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Submitted</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.submitted}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Usage Stats for FREE tier */}
      {appUser?.subscriptionTier === SubscriptionTier.FREE && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                FREE Plan Usage
              </h3>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">Claims This Month</span>
                    <span className="text-sm font-medium text-gray-900">
                      {stats.claimsThisMonth} / {limits.claimLimit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (stats.claimsThisMonth / (limits.claimLimit || 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">Insured Profiles</span>
                    <span className="text-sm font-medium text-gray-900">
                      {stats.insuredPersons} / {limits.personLimit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (stats.insuredPersons / (limits.personLimit || 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
              Upgrade to PAID
            </button>
          </div>
        </div>
      )}

      {/* Recent Claims */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Claims</h3>
        </div>

        {recentClaims.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No claims yet</p>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <PlusCircle className="w-4 h-4" />
              Create Your First Claim
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentClaims.map((claim) => (
              <div key={claim.claimId} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {claim.extractedData.retailerName}
                      </h4>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          claim.status
                        )}`}
                      >
                        {claim.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {claim.extractedData.serviceDescription}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(claim.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {claim.extractedData.currency} {claim.extractedData.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Insurance Companies */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Insurance Companies</h4>
              <p className="text-sm text-gray-600">Configured in the system</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.insurers}</p>
        </div>

        {/* Activity This Month */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Activity This Month</h4>
              <p className="text-sm text-gray-600">Claims submitted this month</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.claimsThisMonth}</p>
        </div>
      </div>
    </div>
  );
};
