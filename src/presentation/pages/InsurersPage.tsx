/**
 * Insurers Page - Manage insurance companies
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@presentation/contexts/AuthContext';
import { container } from '@core/container';
import { Insurer } from '@core/types';
import { Plus, Trash2, Building2, X, Mail, MessageSquare } from 'lucide-react';

export const InsurersPage: React.FC = () => {
  const { user } = useAuth();
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    insurerName: '',
    claimsEmailTemplate: '',
    templatePrompt: '',
  });

  useEffect(() => {
    if (user) {
      loadInsurers();
    }
  }, [user]);

  const loadInsurers = async () => {
    try {
      setLoading(true);
      const data = await container.insurerRepository.findAllOrdered();
      setInsurers(data);
    } catch (error) {
      console.error('Failed to load insurers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const db = (await import('@infrastructure/database/firebase')).getFirebaseFirestore();
      const { collection, addDoc, Timestamp } = await import('firebase/firestore');
      const insurersRef = collection(db, 'insurers');

      await addDoc(insurersRef, {
        ...form,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      setShowForm(false);
      setForm({ insurerName: '', claimsEmailTemplate: '', templatePrompt: '' });
      loadInsurers();
    } catch (error) {
      console.error('Failed to save insurer:', error);
    }
  };

  const handleDelete = async (insurerId: string) => {
    if (!confirm('Are you sure you want to delete this insurer?')) return;
    try {
      await container.insurerRepository.delete(insurerId);
      loadInsurers();
    } catch (error) {
      console.error('Failed to delete insurer:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Insurance Companies</h2>
          <p className="text-gray-600">Manage insurance providers and their details</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Insurer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {insurers.map((insurer) => (
          <div
            key={insurer.insurerId}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{insurer.insurerName}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Mail className="w-3 h-3" />
                    {insurer.claimsEmailTemplate}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(insurer.insurerId)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {insurer.templatePrompt && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                  <MessageSquare className="w-4 h-4" />
                  <span className="font-medium">Custom Template</span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-3">{insurer.templatePrompt}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Insurer Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Insurance Company</h3>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name</label>
                <input
                  type="text"
                  value={form.insurerName}
                  onChange={(e) => setForm({ ...form, insurerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Blue Cross"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Claims Email Address</label>
                <input
                  type="email"
                  value={form.claimsEmailTemplate}
                  onChange={(e) => setForm({ ...form, claimsEmailTemplate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="claims@insurer.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Custom Email Template (Optional)
                </label>
                <textarea
                  value={form.templatePrompt}
                  onChange={(e) => setForm({ ...form, templatePrompt: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Add specific instructions for this insurer's email format (leave blank to use default template)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Example: "Always mention member ID in the first paragraph"
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
