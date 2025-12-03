/**
 * Claims Page - View and manage claims
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@presentation/contexts/AuthContext';
import { container } from '@core/container';
import { Claim, ClaimStatus, UserPolicy } from '@core/types';
import {
  FileText,
  Eye,
  Edit2,
  Trash2,
  Send,
  X,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';

export const ClaimsPage: React.FC = () => {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChangePolicyModal, setShowChangePolicyModal] = useState(false);

  const [editForm, setEditForm] = useState({
    emailSubject: '',
    emailDraft: '',
  });

  const [availablePolicies, setAvailablePolicies] = useState<UserPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadClaims();
    }
  }, [user]);

  const loadClaims = async () => {
    try {
      setLoading(true);
      const data = await container.claimProcessorService.getUserClaims(user!.uid);
      setClaims(data);
    } catch (error) {
      console.error('Failed to load claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewClaim = async (claim: Claim) => {
    setSelectedClaim(claim);
    setShowDetailModal(true);
  };

  const handleEditClaim = async (claim: Claim) => {
    setSelectedClaim(claim);
    setEditForm({
      emailSubject: claim.emailSubject || '',
      emailDraft: claim.emailDraft || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedClaim) return;

    try {
      await container.claimRepository.update(selectedClaim.claimId, {
        emailSubject: editForm.emailSubject,
        emailDraft: editForm.emailDraft,
      } as Partial<Claim>);

      setShowEditModal(false);
      setSelectedClaim(null);
      loadClaims();
    } catch (error) {
      console.error('Failed to save claim edits:', error);
    }
  };

  const handleDeleteClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to delete this claim?')) return;

    try {
      await container.claimRepository.delete(claimId);
      setSelectedClaim(null);
      setShowDetailModal(false);
      loadClaims();
    } catch (error) {
      console.error('Failed to delete claim:', error);
    }
  };

  const handleResendClaim = async (claim: Claim) => {
    if (!claim.emailSubject || !claim.emailDraft) {
      alert('Email draft not generated for this claim');
      return;
    }

    try {
      const pkg = await container.claimGeneratorService.getClaimSubmissionPackage(claim.claimId);

      // Show email package (in real app, this would integrate with email service)
      alert(`Ready to send:\n\nTo: ${pkg.recipient}\nSubject: ${pkg.subject}\n\nBody:\n${pkg.body.substring(0, 200)}...`);

      // Mark as submitted
      await container.claimGeneratorService.submitClaim(
        { claimId: claim.claimId },
        user!.uid
      );

      loadClaims();
    } catch (error) {
      console.error('Failed to resend claim:', error);
      alert('Failed to resend claim: ' + (error as Error).message);
    }
  };

  const handleChangePolicy = async (claim: Claim) => {
    try {
      // Load all user's policies
      const persons = await container.insuredPersonRepository.findByUserId(user!.uid);
      const allPolicies: UserPolicy[] = [];

      for (const person of persons) {
        const policies = await container.policyRepository.findByPersonId(person.personId);
        allPolicies.push(...policies);
      }

      setAvailablePolicies(allPolicies);
      setSelectedPolicyId(claim.policyId || '');
      setSelectedClaim(claim);
      setShowChangePolicyModal(true);
    } catch (error) {
      console.error('Failed to load policies:', error);
    }
  };

  const handleSaveNewPolicy = async () => {
    if (!selectedClaim || !selectedPolicyId) return;

    try {
      // Regenerate email with new insurer
      await container.claimGeneratorService.regenerateForNewInsurer(
        selectedClaim.claimId,
        selectedPolicyId
      );

      setShowChangePolicyModal(false);
      setSelectedClaim(null);
      loadClaims();
    } catch (error) {
      console.error('Failed to change policy:', error);
    }
  };

  const getStatusIcon = (status: ClaimStatus) => {
    switch (status) {
      case ClaimStatus.SUBMITTED:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case ClaimStatus.APPROVED:
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case ClaimStatus.READY_FOR_REVIEW:
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case ClaimStatus.DRAFT:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
      case ClaimStatus.REJECTED:
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Claims</h2>
          <p className="text-gray-600">View and manage your insurance claims</p>
        </div>
      </div>

      {claims.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No claims yet. Upload a receipt to get started!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <div
              key={claim.claimId}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      {getStatusIcon(claim.status)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {claim.extractedData.retailerName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {claim.extractedData.serviceDescription}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {formatDate(claim.createdAt)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      {claim.extractedData.currency} {claim.extractedData.totalAmount.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(claim.status)}`}>
                        {claim.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {claim.extractedData.extractionConfidence}% confidence
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleViewClaim(claim)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditClaim(claim)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit email"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleResendClaim(claim)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Resend"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleChangePolicy(claim)}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Change insurer"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClaim(claim.claimId)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Detail Modal */}
      {showDetailModal && selectedClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Claim Details</h3>
              <button onClick={() => setShowDetailModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedClaim.status)}`}>
                  {selectedClaim.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Receipt Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Retailer</label>
                  <p className="text-gray-900">{selectedClaim.extractedData.retailerName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                  <p className="text-gray-900">{selectedClaim.extractedData.serviceDescription}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <p className="text-gray-900">{selectedClaim.extractedData.receiptDate}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <p className="text-gray-900">
                    {selectedClaim.extractedData.currency} {selectedClaim.extractedData.totalAmount.toFixed(2)}
                  </p>
                </div>
                {selectedClaim.extractedData.invoiceNumber && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice #</label>
                    <p className="text-gray-900">{selectedClaim.extractedData.invoiceNumber}</p>
                  </div>
                )}
                {selectedClaim.extractedData.policyNumber && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Policy #</label>
                    <p className="text-gray-900">{selectedClaim.extractedData.policyNumber}</p>
                  </div>
                )}
              </div>

              {/* Line Items */}
              {selectedClaim.extractedData.lineItems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedClaim.extractedData.lineItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.quantity || '-'}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">${item.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Email Draft */}
              {selectedClaim.emailSubject && selectedClaim.emailDraft && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Draft</label>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="mb-3">
                      <span className="text-xs font-medium text-gray-500">Subject:</span>
                      <p className="text-sm text-gray-900 mt-1">{selectedClaim.emailSubject}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">Body:</span>
                      <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{selectedClaim.emailDraft}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Images Placeholder */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attached Images</label>
                <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                  <p className="text-sm text-gray-500">Image storage coming soon...</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handleEditClaim(selectedClaim);
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Edit Email
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Email Modal */}
      {showEditModal && selectedClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Email Draft</h3>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={editForm.emailSubject}
                  onChange={(e) => setEditForm({ ...editForm, emailSubject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Body</label>
                <textarea
                  value={editForm.emailDraft}
                  onChange={(e) => setEditForm({ ...editForm, emailDraft: e.target.value })}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Policy Modal */}
      {showChangePolicyModal && selectedClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Change Insurer/Policy</h3>
              <button onClick={() => setShowChangePolicyModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select a different policy. The email will be regenerated for the new insurer.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">Policy</label>
                <select
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select policy...</option>
                  {availablePolicies.map((policy) => (
                    <option key={policy.policyId} value={policy.policyId}>
                      {policy.policyType} - {policy.policyNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveNewPolicy}
                disabled={!selectedPolicyId}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Regenerate Email
              </button>
              <button
                onClick={() => setShowChangePolicyModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
