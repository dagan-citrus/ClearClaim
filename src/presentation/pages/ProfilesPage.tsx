/**
 * Profiles Page - Manage insured persons and their policies
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@presentation/contexts/AuthContext';
import { container } from '@core/container';
import { InsuredPerson, UserPolicy, Insurer, PolicyType } from '@core/types';
import { Plus, Trash2, User, FileText, X, Edit } from 'lucide-react';

export const ProfilesPage: React.FC = () => {
  const { user } = useAuth();
  const [persons, setPersons] = useState<InsuredPerson[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<InsuredPerson | null>(null);
  const [policies, setPolicies] = useState<UserPolicy[]>([]);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPerson, setEditingPerson] = useState<InsuredPerson | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<UserPolicy | null>(null);

  // Form states
  const [personForm, setPersonForm] = useState({
    fullName: '',
    dateOfBirth: '',
    primaryId: '',
  });

  const [policyForm, setPolicyForm] = useState({
    insurerId: '',
    policyType: PolicyType.HEALTH,
    policyNumber: '',
    isDefault: false,
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedPerson) {
      loadPolicies(selectedPerson.personId);
    }
  }, [selectedPerson]);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [personsData, insurersData] = await Promise.all([
        container.insuredPersonRepository.findByUserId(user.uid),
        container.insurerRepository.findAllOrdered(),
      ]);
      setPersons(personsData);
      setInsurers(insurersData);
      if (personsData.length > 0 && !selectedPerson) {
        setSelectedPerson(personsData[0]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPolicies = async (personId: string) => {
    try {
      const policiesData = await container.policyRepository.findByPersonId(personId);
      setPolicies(policiesData);
    } catch (error) {
      console.error('Failed to load policies:', error);
    }
  };

  const handleSavePerson = async () => {
    if (!user) return;
    try {
      if (editingPerson) {
        // Update existing person
        await container.insuredPersonRepository.update(editingPerson.personId, personForm);
      } else {
        // Create new person
        const db = (await import('@infrastructure/database/firebase')).getFirebaseFirestore();
        const { collection, addDoc, Timestamp } = await import('firebase/firestore');
        const personsRef = collection(db, 'insured_persons');

        await addDoc(personsRef, {
          appUserId: user.uid,
          ...personForm,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      setShowPersonForm(false);
      setPersonForm({ fullName: '', dateOfBirth: '', primaryId: '' });
      setEditingPerson(null);
      loadData();
    } catch (error) {
      console.error('Failed to save person:', error);
    }
  };

  const handleEditPerson = (person: InsuredPerson) => {
    setEditingPerson(person);
    setPersonForm({
      fullName: person.fullName,
      dateOfBirth: person.dateOfBirth,
      primaryId: person.primaryId,
    });
    setShowPersonForm(true);
  };

  const handleSavePolicy = async () => {
    if (!selectedPerson) return;
    try {
      if (editingPolicy) {
        // Update existing policy
        await container.policyRepository.update(editingPolicy.policyId, policyForm);
      } else {
        // Create new policy
        const db = (await import('@infrastructure/database/firebase')).getFirebaseFirestore();
        const { collection, addDoc, Timestamp } = await import('firebase/firestore');
        const policiesRef = collection(db, 'policies');

        await addDoc(policiesRef, {
          personId: selectedPerson.personId,
          ...policyForm,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      setShowPolicyForm(false);
      setPolicyForm({ insurerId: '', policyType: PolicyType.HEALTH, policyNumber: '', isDefault: false });
      setEditingPolicy(null);
      loadPolicies(selectedPerson.personId);
    } catch (error) {
      console.error('Failed to save policy:', error);
    }
  };

  const handleEditPolicy = (policy: UserPolicy) => {
    setEditingPolicy(policy);
    setPolicyForm({
      insurerId: policy.insurerId,
      policyType: policy.policyType,
      policyNumber: policy.policyNumber,
      isDefault: policy.isDefault,
    });
    setShowPolicyForm(true);
  };

  const handleDeletePerson = async (personId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;
    try {
      await container.insuredPersonRepository.delete(personId);
      setSelectedPerson(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete person:', error);
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    try {
      await container.policyRepository.delete(policyId);
      if (selectedPerson) {
        loadPolicies(selectedPerson.personId);
      }
    } catch (error) {
      console.error('Failed to delete policy:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Insured Profiles</h2>
          <p className="text-gray-600">Manage insured persons and their insurance policies</p>
        </div>
        <button
          onClick={() => setShowPersonForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Profile
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Persons List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-semibold text-gray-900">Profiles</h3>
          {persons.map((person) => (
            <div
              key={person.personId}
              onClick={() => setSelectedPerson(person)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedPerson?.personId === person.personId
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{person.fullName}</h4>
                    <p className="text-sm text-gray-500">{person.primaryId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPerson(person);
                    }}
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePerson(person.personId);
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Person Details & Policies */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPerson ? (
            <>
              {/* Person Details */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900">Profile Details</h3>
                  <button
                    onClick={() => handleEditPerson(selectedPerson)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Full Name</dt>
                    <dd className="font-medium">{selectedPerson.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Date of Birth</dt>
                    <dd className="font-medium">{selectedPerson.dateOfBirth}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">ID Number</dt>
                    <dd className="font-medium">{selectedPerson.primaryId}</dd>
                  </div>
                </dl>
              </div>

              {/* Policies */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900">Insurance Policies</h3>
                  <button
                    onClick={() => setShowPolicyForm(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="w-3 h-3" />
                    Add Policy
                  </button>
                </div>

                <div className="space-y-3">
                  {policies.map((policy) => {
                    const insurer = insurers.find((i) => i.insurerId === policy.insurerId);
                    return (
                      <div
                        key={policy.policyId}
                        className="p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {insurer?.insurerName || 'Unknown Insurer'}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {policy.policyType} • {policy.policyNumber}
                              </p>
                              {policy.isDefault && (
                                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                  Default
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditPolicy(policy)}
                              className="text-indigo-600 hover:text-indigo-700"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePolicy(policy.policyId)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {policies.length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      No policies added yet. Add your first policy above.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a profile to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Person Modal */}
      {showPersonForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingPerson ? 'Edit' : 'Add'} Insured Profile
              </h3>
              <button onClick={() => {
                setShowPersonForm(false);
                setEditingPerson(null);
                setPersonForm({ fullName: '', dateOfBirth: '', primaryId: '' });
              }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={personForm.fullName}
                  onChange={(e) => setPersonForm({ ...personForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={personForm.dateOfBirth}
                  onChange={(e) => setPersonForm({ ...personForm, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ID Number</label>
                <input
                  type="text"
                  value={personForm.primaryId}
                  onChange={(e) => setPersonForm({ ...personForm, primaryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSavePerson}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowPersonForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Policy Modal */}
      {showPolicyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingPolicy ? 'Edit' : 'Add'} Insurance Policy
              </h3>
              <button onClick={() => {
                setShowPolicyForm(false);
                setEditingPolicy(null);
                setPolicyForm({ insurerId: '', policyType: PolicyType.HEALTH, policyNumber: '', isDefault: false });
              }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Insurer</label>
                <select
                  value={policyForm.insurerId}
                  onChange={(e) => setPolicyForm({ ...policyForm, insurerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Insurer</option>
                  {insurers.map((insurer) => (
                    <option key={insurer.insurerId} value={insurer.insurerId}>
                      {insurer.insurerName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Type</label>
                <select
                  value={policyForm.policyType}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, policyType: e.target.value as PolicyType })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={PolicyType.HEALTH}>Health</option>
                  <option value={PolicyType.DENTAL}>Dental</option>
                  <option value={PolicyType.VISION}>Vision</option>
                  <option value={PolicyType.OTHER}>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Number</label>
                <input
                  type="text"
                  value={policyForm.policyNumber}
                  onChange={(e) => setPolicyForm({ ...policyForm, policyNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policyForm.isDefault}
                    onChange={(e) => setPolicyForm({ ...policyForm, isDefault: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm">Set as default policy</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSavePolicy}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowPolicyForm(false)}
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
