/**
 * New Claim Page - Upload and create new claims
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@presentation/contexts/AuthContext';
import { useNavigation } from '@presentation/contexts/NavigationContext';
import { container } from '@core/container';
import {
  ExtractedReceiptData,
  InsuredPerson,
  UserPolicy,
} from '@core/types';
import {
  Upload,
  FileImage,
  CheckCircle,
  AlertCircle,
  User,
  CreditCard,
  Loader,
  X,
  FileText,
  FileIcon,
} from 'lucide-react';

type UploadStage = 'upload' | 'processing' | 'review' | 'generating' | 'complete';

interface SelectedFile {
  file: File;
  preview: string;
}

export const NewClaimPage: React.FC = () => {
  const { user } = useAuth();
  const { shouldOpenFilePicker, setShouldOpenFilePicker } = useNavigation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<UploadStage>('upload');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Extracted data
  const [claimId, setClaimId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedReceiptData | null>(null);

  // Selection data
  const [persons, setPersons] = useState<InsuredPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [policies, setPolicies] = useState<UserPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');

  // Generated email
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');

  // Listen for file picker trigger from dashboard
  useEffect(() => {
    if (shouldOpenFilePicker && fileInputRef.current) {
      fileInputRef.current.click();
      setShouldOpenFilePicker(false);
    }
  }, [shouldOpenFilePicker, setShouldOpenFilePicker]);

  // Helper to check if file type is supported
  const isSupportedFileType = (file: File): boolean => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const pdfType = 'application/pdf';
    const textTypes = ['text/plain', 'text/csv'];

    return (
      imageTypes.includes(file.type) ||
      file.type === pdfType ||
      textTypes.includes(file.type) ||
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.txt') ||
      file.name.toLowerCase().endsWith('.csv')
    );
  };

  // Helper to get file type
  const getFileType = (file: File): 'image' | 'pdf' | 'text' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
      return 'pdf';
    return 'text';
  };

  // Helper to render preview based on file type
  const renderFilePreview = (sf: SelectedFile) => {
    const fileType = getFileType(sf.file);

    if (fileType === 'image') {
      return (
        <img
          src={sf.preview}
          alt={sf.file.name}
          className="w-full h-40 object-cover rounded-lg shadow-md"
        />
      );
    } else if (fileType === 'pdf') {
      return (
        <div className="w-full h-40 bg-red-50 rounded-lg shadow-md flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="text-xs text-red-600 font-medium">PDF</p>
          </div>
        </div>
      );
    } else {
      return (
        <div className="w-full h-40 bg-blue-50 rounded-lg shadow-md flex items-center justify-center">
          <div className="text-center">
            <FileIcon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-xs text-blue-600 font-medium">Text</p>
          </div>
        </div>
      );
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate all files
    const validFiles: SelectedFile[] = [];
    let hasError = false;

    for (const file of files) {
      // Validate file type
      if (!isSupportedFileType(file)) {
        setError(`${file.name} is not a supported file type (images, PDF, or text)`);
        hasError = true;
        break;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} exceeds 10MB size limit`);
        hasError = true;
        break;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        let preview: string;

        // For image files, use the data URL directly
        if (file.type.startsWith('image/')) {
          preview = e.target?.result as string;
        }
        // For PDF and text files, create a text preview
        else {
          preview = `file://${file.name}`; // Placeholder for non-image files
        }

        validFiles.push({ file, preview });

        // Update state when all previews are loaded
        if (validFiles.length === files.length) {
          setSelectedFiles((prev) => [...prev, ...validFiles]);
        }
      };

      // Read differently based on file type
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsDataURL(file); // Still use DataURL for consistency
      }
    }

    if (!hasError) {
      setError(null);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;

    // Create synthetic event for handleFileSelect
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    input.files = dataTransfer.files;

    handleFileSelect({ target: input } as any);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAndProcess = async () => {
    if (selectedFiles.length === 0 || !user) return;

    try {
      setStage('processing');
      setError(null);

      // Convert all images to base64
      const images = await Promise.all(
        selectedFiles.map(async (sf) => {
          const base64 = await fileToBase64(sf.file);
          return {
            data: base64,
            type: sf.file.type,
            description: sf.file.name,
          };
        })
      );

      // Process receipt with all images
      const result = await container.claimProcessorService.processReceipt(user.uid, {
        images,
      });

      setClaimId(result.claimId);
      setExtractedData(result.extractedData);

      // Load persons for selection
      const personsList = await container.insuredPersonRepository.findByUserId(user.uid);
      setPersons(personsList);

      // Check One-Click eligibility
      const eligibility = await container.claimProcessorService.checkOneClickEligibility(
        user.uid,
        result.extractedData
      );

      if (eligibility.isEligible && eligibility.suggestedPersonId && eligibility.suggestedPolicyId) {
        // Auto-select suggested person and policy
        setSelectedPersonId(eligibility.suggestedPersonId);
        setSelectedPolicyId(eligibility.suggestedPolicyId);

        // Load policies for the person
        const policiesList = await container.policyRepository.findByPersonId(
          eligibility.suggestedPersonId
        );
        setPolicies(policiesList);
      }

      setStage('review');
    } catch (err) {
      console.error('Failed to process receipt:', err);
      setError((err as Error).message || 'Failed to process receipt');
      setStage('upload');
    }
  };

  const handlePersonChange = async (personId: string) => {
    setSelectedPersonId(personId);
    setSelectedPolicyId('');

    if (personId) {
      const policiesList = await container.policyRepository.findByPersonId(personId);
      setPolicies(policiesList);
    } else {
      setPolicies([]);
    }
  };

  const handleGenerateEmail = async () => {
    if (!claimId || !selectedPersonId || !selectedPolicyId) {
      setError('Please select both a person and a policy');
      return;
    }

    try {
      setStage('generating');
      setError(null);

      // Update claim with person and policy
      await container.claimProcessorService.updateClaim(claimId, user!.uid, {
        personId: selectedPersonId,
        policyId: selectedPolicyId,
      });

      // Generate email draft
      const { subject, body } = await container.claimGeneratorService.generateEmailDraft(claimId);

      setEmailSubject(subject);
      setEmailBody(body);
      setStage('complete');
    } catch (err) {
      console.error('Failed to generate email:', err);
      setError((err as Error).message || 'Failed to generate email');
      setStage('review');
    }
  };

  const handleReset = () => {
    setStage('upload');
    setSelectedFiles([]);
    setError(null);
    setClaimId(null);
    setExtractedData(null);
    setPersons([]);
    setSelectedPersonId('');
    setPolicies([]);
    setSelectedPolicyId('');
    setEmailSubject('');
    setEmailBody('');
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">New Claim</h2>
        <p className="text-gray-600">Upload receipt images to create a new claim</p>
      </div>

      {/* Upload Stage */}
      {stage === 'upload' && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-indigo-400 transition-colors"
          >
            {selectedFiles.length > 0 ? (
              <div className="space-y-6">
                {/* File Previews */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedFiles.map((sf, idx) => (
                    <div key={idx} className="relative group">
                      {renderFilePreview(sf)}
                      <button
                        onClick={() => removeFile(idx)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <p className="text-xs text-gray-600 mt-1 truncate">{sf.file.name}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <FileImage className="w-4 h-4" />
                  {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                </div>

                <div className="flex gap-3 justify-center">
                  <label className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                    Add More Files
                    <input
                      type="file"
                      accept="image/*,.pdf,.txt,.csv"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={handleUploadAndProcess}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Process {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-gray-600 mb-2">
                    Drag and drop files here, or click to select
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Upload images, PDF, or text files (invoice, doctor's summary, medicine list, receipts, etc.)
                  </p>
                  <label className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer">
                    Choose Files
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.txt,.csv"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500">Supports images, PDF, and text files (max 10MB per file)</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Processing Stage */}
      {stage === 'processing' && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Loader className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Processing {selectedFiles.length} Image{selectedFiles.length > 1 ? 's' : ''}...
          </h3>
          <p className="text-gray-600">
            Extracting data from your documents using AI. This may take a moment.
          </p>
        </div>
      )}

      {/* Review Stage */}
      {stage === 'review' && extractedData && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Documents Processed Successfully
              </h3>
              <p className="text-sm text-gray-600">
                Confidence: {extractedData.extractionConfidence}% | Claim Type:{' '}
                {extractedData.claimType || 'Medical Consultation'}
              </p>
            </div>
          </div>

          {/* Extracted Data */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Extracted Information</h4>
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="text-xs font-medium text-gray-500">Medical Facility</label>
                <p className="text-sm text-gray-900">{extractedData.retailerName}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Service</label>
                <p className="text-sm text-gray-900">{extractedData.serviceDescription}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Date</label>
                <p className="text-sm text-gray-900">{extractedData.receiptDate}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Total Amount</label>
                <p className="text-sm text-gray-900">
                  {extractedData.currency} {extractedData.totalAmount.toFixed(2)}
                </p>
              </div>
              {extractedData.doctorName && (
                <div>
                  <label className="text-xs font-medium text-gray-500">Doctor</label>
                  <p className="text-sm text-gray-900">
                    {extractedData.doctorTitle} {extractedData.doctorName}
                  </p>
                </div>
              )}
              {extractedData.medicalIssues && extractedData.medicalIssues.length > 0 && (
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500">Medical Issues</label>
                  <p className="text-sm text-gray-900">
                    {extractedData.medicalIssues.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Person and Policy Selection */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Assign to Person and Policy</h4>

            <div>
              <label className="block text-sm font-medium mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Insured Person
              </label>
              <select
                value={selectedPersonId}
                onChange={(e) => handlePersonChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select person...</option>
                {persons.map((person) => (
                  <option key={person.personId} value={person.personId}>
                    {person.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                <CreditCard className="w-4 h-4 inline mr-1" />
                Insurance Policy
              </label>
              <select
                value={selectedPolicyId}
                onChange={(e) => setSelectedPolicyId(e.target.value)}
                disabled={!selectedPersonId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select policy...</option>
                {policies.map((policy) => (
                  <option key={policy.policyId} value={policy.policyId}>
                    {policy.policyType} - {policy.policyNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleGenerateEmail}
              disabled={!selectedPersonId || !selectedPolicyId}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Email Draft
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Generating Stage */}
      {stage === 'generating' && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Loader className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Generating Email...</h3>
          <p className="text-gray-600">Creating your claim email draft with AI.</p>
        </div>
      )}

      {/* Complete Stage */}
      {stage === 'complete' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Claim Created Successfully!</h3>
              <p className="text-sm text-gray-600">
                Your email draft has been generated and saved. You can view and edit it in the
                Claims tab.
              </p>
            </div>
          </div>

          {/* Email Preview */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Email Preview</h4>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Subject:</label>
                <p className="text-sm text-gray-900 mt-1">{emailSubject}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Body:</label>
                <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap line-clamp-10">
                  {emailBody}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Create Another Claim
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
