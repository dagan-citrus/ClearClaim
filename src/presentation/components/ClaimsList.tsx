/**
 * Claims list component
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '@presentation/contexts/AuthContext';
import { container } from '@core/container';
import { Claim, ClaimStatus } from '@core/types';
import { FileText, CheckCircle, Clock } from 'lucide-react';

export const ClaimsList: React.FC = () => {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadClaims();
    }
  }, [user]);

  const loadClaims = async () => {
    if (!user) return;

    try {
      const claimProcessor = container.claimProcessorService;
      const userClaims = await claimProcessor.getUserClaims(user.uid);
      setClaims(userClaims);
    } catch (error) {
      console.error('Failed to load claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: ClaimStatus) => {
    switch (status) {
      case ClaimStatus.SUBMITTED:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case ClaimStatus.APPROVED:
      case ClaimStatus.READY_FOR_REVIEW:
        return <Clock className="w-5 h-5 text-blue-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: ClaimStatus) => {
    switch (status) {
      case ClaimStatus.DRAFT:
        return 'Draft';
      case ClaimStatus.READY_FOR_REVIEW:
        return 'Ready for Review';
      case ClaimStatus.APPROVED:
        return 'Approved';
      case ClaimStatus.SUBMITTED:
        return 'Submitted';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>No claims yet. Upload a receipt to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {claims.slice(0, 5).map((claim) => (
        <div
          key={claim.claimId}
          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {getStatusIcon(claim.status)}
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">
                  {claim.extractedData.retailerName}
                </h3>
                <p className="text-sm text-gray-600">
                  {claim.extractedData.serviceDescription}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(claim.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                ${claim.extractedData.totalAmount.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{getStatusText(claim.status)}</p>
            </div>
          </div>

          {claim.isOneClickEligible && claim.status === ClaimStatus.APPROVED && (
            <button className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              Submit with One-Click
            </button>
          )}
        </div>
      ))}

      {claims.length > 5 && (
        <button className="w-full py-2 text-blue-600 hover:text-blue-700 font-medium">
          View All Claims ({claims.length})
        </button>
      )}
    </div>
  );
};
