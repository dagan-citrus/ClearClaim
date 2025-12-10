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
  ClaimAttachment,
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
  Shield,
  CheckCircle2,
  XCircle,
  HelpCircle,
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
  const [regenerateDescription, setRegenerateDescription] = useState<string>('');

  // Sending email state
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [sendEmailError, setSendEmailError] = useState<string | null>(null);
  const [sendEmailSuccess, setSendEmailSuccess] = useState<boolean>(false);

  // Insurer details for email sending
  const [insurer, setInsurer] = useState<any>(null);
  const [insuredPerson, setInsuredPerson] = useState<any>(null);

  // Claim attachments
  const [claimAttachments, setClaimAttachments] = useState<ClaimAttachment[]>([]);

  // Store base64 data in memory (not in Firestore due to 1MB limit)
  const [attachmentBase64Data, setAttachmentBase64Data] = useState<{ [fileName: string]: string }>({});

  // Policy coverage test state
  const [isTestingCoverage, setIsTestingCoverage] = useState<boolean>(false);
  const [coverageTestResult, setCoverageTestResult] = useState<{
    status: 'Covered' | 'Not Covered' | 'Not Sure';
    explanation: string;
    relevantSections?: string[];
    confidence?: number;
  } | null>(null);

  // Listen for file picker trigger from dashboard
  useEffect(() => {
    if (shouldOpenFilePicker) {
      // Reset the flag immediately to prevent double-triggering
      setShouldOpenFilePicker(false);
      // Then open the file picker
      if (fileInputRef.current) {
        // Use setTimeout to ensure the flag is reset before clicking
        setTimeout(() => {
          fileInputRef.current?.click();
        }, 0);
      }
    }
  }, [shouldOpenFilePicker, setShouldOpenFilePicker]);

  // Helper to check if file type is supported
  const isSupportedFileType = (file: File): boolean => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const documentTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'text/plain',
      'text/csv',
      'text/markdown',
      'text/html',
      'application/json',
    ];

    const fileName = file.name.toLowerCase();
    const fileExtensions = ['.pdf', '.docx', '.doc', '.txt', '.csv', '.md', '.html', '.json'];

    return (
      imageTypes.includes(file.type) ||
      documentTypes.includes(file.type) ||
      fileExtensions.some((ext) => fileName.endsWith(ext))
    );
  };

  // Helper to get file type category
  const getFileType = (file: File): 'image' | 'document' => {
    if (file.type.startsWith('image/')) return 'image';
    return 'document';
  };

  // Helper to render preview based on file type
  const renderFilePreview = (sf: SelectedFile) => {
    const fileType = getFileType(sf.file);
    const fileName = sf.file.name.toLowerCase();

    if (fileType === 'image') {
      return (
        <img
          src={sf.preview}
          alt={sf.file.name}
          className="w-full h-40 object-cover rounded-lg shadow-md"
        />
      );
    }

    // Document preview with appropriate icons and colors
    let iconColor = 'text-blue-600';
    let bgColor = 'bg-blue-50';
    let fileLabel = 'Document';

    if (fileName.endsWith('.pdf')) {
      iconColor = 'text-red-600';
      bgColor = 'bg-red-50';
      fileLabel = 'PDF';
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      iconColor = 'text-blue-600';
      bgColor = 'bg-blue-50';
      fileLabel = 'Word';
    } else if (fileName.endsWith('.txt')) {
      iconColor = 'text-gray-600';
      bgColor = 'bg-gray-50';
      fileLabel = 'Text';
    } else if (fileName.endsWith('.md')) {
      iconColor = 'text-purple-600';
      bgColor = 'bg-purple-50';
      fileLabel = 'Markdown';
    } else if (fileName.endsWith('.html')) {
      iconColor = 'text-orange-600';
      bgColor = 'bg-orange-50';
      fileLabel = 'HTML';
    } else if (fileName.endsWith('.json')) {
      iconColor = 'text-green-600';
      bgColor = 'bg-green-50';
      fileLabel = 'JSON';
    }

    return (
      <div className={`w-full h-40 ${bgColor} rounded-lg shadow-md flex items-center justify-center`}>
        <div className="text-center">
          <FileText className={`w-8 h-8 ${iconColor} mx-auto mb-2`} />
          <p className={`text-xs ${iconColor} font-medium`}>{fileLabel}</p>
        </div>
      </div>
    );
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
        setError(`${file.name} is not a supported file type. Supported: images (JPG, PNG, etc.), PDF, DOCX, TXT, MD, HTML, JSON`);
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

      // Separate files by type
      const imageFiles = selectedFiles.filter((sf) => getFileType(sf.file) === 'image');
      const documentFiles = selectedFiles.filter((sf) => getFileType(sf.file) === 'document');

      // Convert all files to base64
      const images = await Promise.all(
        imageFiles.map(async (sf) => {
          const base64 = await fileToBase64(sf.file);
          return {
            data: base64,
            type: sf.file.type,
            description: sf.file.name,
          };
        })
      );

      const documents = await Promise.all(
        documentFiles.map(async (sf) => {
          const base64 = await fileToBase64(sf.file);
          return {
            data: base64,
            type: sf.file.type,
            description: sf.file.name,
          };
        })
      );

      // Process receipt with both images and documents
      const result = await container.claimProcessorService.processReceipt(user.uid, {
        images,
        documents,
      });

      setClaimId(result.claimId);
      setExtractedData(result.extractedData);

      // Store base64 data in memory for email attachments
      const base64Map: { [fileName: string]: string } = {};
      const attachmentsList: ClaimAttachment[] = [];

      images.forEach((img) => {
        if (img.description && img.data) {
          base64Map[img.description] = img.data;
          attachmentsList.push({
            fileName: img.description,
            mimeType: img.type || 'image/jpeg',
            storageUrl: undefined, // Will be set in Firestore, not needed in memory
            base64Data: img.data,
          });
        }
      });

      setAttachmentBase64Data(base64Map);
      setClaimAttachments(attachmentsList);

      // Load persons for selection
      const personsList = await container.insuredPersonRepository.findByUserId(user.uid);
      setPersons(personsList);

      // Auto-select person and policy for fully automatic flow
      let selectedPerson: string | null = null;
      let selectedPolicy: string | null = null;
      let policiesList: any[] = [];

      // Check One-Click eligibility first
      const eligibility = await container.claimProcessorService.checkOneClickEligibility(
        user.uid,
        result.extractedData
      );

      if (eligibility.isEligible && eligibility.suggestedPersonId && eligibility.suggestedPolicyId) {
        // Use One-Click suggested person and policy
        selectedPerson = eligibility.suggestedPersonId;
        selectedPolicy = eligibility.suggestedPolicyId;
        policiesList = await container.policyRepository.findByPersonId(selectedPerson);
      } else if (personsList.length > 0) {
        // No One-Click match - auto-select first person
        selectedPerson = personsList[0].personId;
        policiesList = await container.policyRepository.findByPersonId(selectedPerson);

        if (policiesList.length > 0) {
          // Find default policy or use first policy
          const defaultPolicy = policiesList.find(p => p.isDefault);
          selectedPolicy = defaultPolicy ? defaultPolicy.policyId : policiesList[0].policyId;
        }
      }

      // Update state
      setSelectedPersonId(selectedPerson || '');
      setSelectedPolicyId(selectedPolicy || '');
      setPolicies(policiesList);

      // Auto-proceed if we have both person and policy
      if (selectedPerson && selectedPolicy) {
        try {
          await autoProceedToEmail(result.claimId, selectedPerson, selectedPolicy, policiesList);
        } catch (autoErr) {
          console.error('Auto-proceed failed, falling back to manual review:', autoErr);
          setError('Auto-processing encountered an issue. Please review and continue manually.');
          setStage('review');
        }
      } else {
        // No person or policy found - show review stage
        setError('Please set up your profile and insurance policy in the settings first.');
        setStage('review');
      }
    } catch (err) {
      console.error('Failed to process receipt:', err);
      setError((err as Error).message || 'Failed to process receipt');
      setStage('upload');
    }
  };

  const autoProceedToEmail = async (
    claimId: string,
    personId: string,
    policyId: string,
    policiesList: UserPolicy[]
  ) => {
    setStage('generating');

    // Update claim with person and policy
    await container.claimProcessorService.updateClaim(claimId, user!.uid, {
      personId,
      policyId,
    });

    // Generate email draft
    const { subject, body } = await container.claimGeneratorService.generateEmailDraft(claimId);

    setEmailSubject(subject);
    setEmailBody(body);

    // Note: We already have attachments in memory with base64 data
    // Don't reload from Firestore as they won't have base64 data

    // Load insurer and person details for email sending
    const selectedPolicy = policiesList.find((p) => p.policyId === policyId);
    if (selectedPolicy) {
      const insurerData = await container.insurerRepository.findById(selectedPolicy.insurerId);
      const personData = await container.insuredPersonRepository.findById(personId);
      setInsurer(insurerData);
      setInsuredPerson(personData);
    }

    setStage('complete');
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

      // Load claim attachments
      const claim = await container.claimRepository.findById(claimId);
      if (claim && claim.attachments) {
        setClaimAttachments(claim.attachments);
      }

      // Load insurer and person details for email sending
      const selectedPolicy = policies.find((p) => p.policyId === selectedPolicyId);
      if (selectedPolicy) {
        const insurerData = await container.insurerRepository.findById(selectedPolicy.insurerId);
        const personData = await container.insuredPersonRepository.findById(selectedPersonId);
        setInsurer(insurerData);
        setInsuredPerson(personData);
      }

      setStage('complete');
    } catch (err) {
      console.error('Failed to generate email:', err);
      setError((err as Error).message || 'Failed to generate email');
      setStage('review');
    }
  };

  const handleRegenerateEmail = async () => {
    if (!claimId || !user) {
      setError('Missing claim ID');
      return;
    }

    try {
      setStage('generating');
      setError(null);

      // Update claim with new person and policy if changed
      if (selectedPersonId && selectedPolicyId) {
        await container.claimProcessorService.updateClaim(claimId, user.uid, {
          personId: selectedPersonId,
          policyId: selectedPolicyId,
        });
      }

      // Regenerate email draft (with optional description for refinement)
      let subject, body;
      if (regenerateDescription) {
        // Use refineDraft if description is provided
        const refined = await container.claimGeneratorService.refineDraft(
          claimId,
          regenerateDescription
        );
        subject = refined.subject;
        body = refined.body;
      } else {
        // Otherwise regenerate from scratch
        const generated = await container.claimGeneratorService.generateEmailDraft(claimId);
        subject = generated.subject;
        body = generated.body;
      }

      setEmailSubject(subject);
      setEmailBody(body);
      setRegenerateDescription(''); // Clear description after use

      // Update insurer and person details if changed
      const selectedPolicy = policies.find((p) => p.policyId === selectedPolicyId);
      if (selectedPolicy) {
        const insurerData = await container.insurerRepository.findById(selectedPolicy.insurerId);
        const personData = await container.insuredPersonRepository.findById(selectedPersonId);
        setInsurer(insurerData);
        setInsuredPerson(personData);
      }

      setStage('complete');
    } catch (err) {
      console.error('Failed to regenerate email:', err);
      setError((err as Error).message || 'Failed to regenerate email');
      setStage('complete'); // Stay on complete stage
    }
  };

  const handleSendEmail = async () => {
    if (!claimId || !insurer || !insuredPerson) {
      setSendEmailError('Missing required information for sending email');
      return;
    }

    try {
      setIsSendingEmail(true);
      setSendEmailError(null);
      setSendEmailSuccess(false);

      // Format the email HTML
      const selectedPolicy = policies.find((p) => p.policyId === selectedPolicyId);
      const htmlContent = container.emailService.formatClaimEmailHTML(
        insuredPerson.fullName,
        selectedPolicy?.policyNumber || 'Unknown',
        insurer.insurerName,
        emailBody
      );

      // Prepare attachments for SendGrid using base64 data from memory
      console.log('Claim attachments:', claimAttachments);
      console.log('Base64 data available:', Object.keys(attachmentBase64Data));

      const attachments = claimAttachments
        .filter((att) => attachmentBase64Data[att.fileName]) // Only include if we have base64 data
        .map((att) => ({
          content: attachmentBase64Data[att.fileName],
          filename: att.fileName,
          type: att.mimeType,
          disposition: 'attachment',
        }));

      console.log('Attachments to send:', attachments.length);

      // Send the email - Cloud Function will validate the email address
      const result = await container.emailService.sendClaimEmail({
        to: insurer.claimsEmail || '',
        subject: emailSubject,
        htmlContent,
        textContent: emailBody,
        claimId,
        attachments,
      });

      if (result.success) {
        setSendEmailSuccess(true);
      }
    } catch (err) {
      console.error('Failed to send email:', err);
      setSendEmailError((err as Error).message || 'Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleTestCoverage = async () => {
    if (!claimId || !selectedPolicyId) return;

    try {
      setIsTestingCoverage(true);
      setCoverageTestResult(null);

      const result = await container.policyCoverageService.testCoverage(claimId, selectedPolicyId);
      setCoverageTestResult(result);
    } catch (err) {
      console.error('Failed to test policy coverage:', err);
      setCoverageTestResult({
        status: 'Not Sure',
        explanation: 'Failed to test policy coverage. Please try again.',
      });
    } finally {
      setIsTestingCoverage(false);
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
    setInsurer(null);
    setInsuredPerson(null);
    setClaimAttachments([]);
    setAttachmentBase64Data({});
    setIsSendingEmail(false);
    setSendEmailError(null);
    setSendEmailSuccess(false);
    setCoverageTestResult(null);
    setIsTestingCoverage(false);
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
                      accept="image/*,.pdf,.docx,.doc,.txt,.csv,.md,.html,.json"
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
                    Upload images (JPG, PNG) or documents (PDF, DOCX, TXT, MD, HTML, JSON)
                  </p>
                  <label className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer">
                    Choose Files
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.docx,.doc,.txt,.csv,.md,.html,.json"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500">Images use OCR extraction, documents use direct text processing</p>
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
          {sendEmailSuccess ? (
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Email Sent Successfully!</h3>
                <p className="text-sm text-gray-600">
                  Your claim has been sent to {insurer?.insurerName}. The claim status has been
                  updated to submitted.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Claim Created Successfully!</h3>
                <p className="text-sm text-gray-600">
                  Your email draft has been generated. Review it below and send it to the insurer.
                </p>
              </div>
            </div>
          )}

          {/* Person/Policy Selection for Regeneration */}
          {!sendEmailSuccess && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
              <h4 className="font-medium text-gray-900 mb-2">Change Person or Policy</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Insured Person
                  </label>
                  <select
                    value={selectedPersonId}
                    onChange={async (e) => {
                      setSelectedPersonId(e.target.value);
                      if (e.target.value) {
                        const policiesList = await container.policyRepository.findByPersonId(e.target.value);
                        setPolicies(policiesList);
                        if (policiesList.length > 0) {
                          const defaultPolicy = policiesList.find(p => p.isDefault);
                          setSelectedPolicyId(defaultPolicy ? defaultPolicy.policyId : policiesList[0].policyId);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {persons.map((person) => (
                      <option key={person.personId} value={person.personId}>
                        {person.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Policy
                  </label>
                  <select
                    value={selectedPolicyId}
                    onChange={(e) => setSelectedPolicyId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {policies.map((policy) => (
                      <option key={policy.policyId} value={policy.policyId}>
                        {policy.policyNumber} {policy.isDefault && '(Default)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Context (Optional)
                </label>
                <textarea
                  value={regenerateDescription}
                  onChange={(e) => setRegenerateDescription(e.target.value)}
                  placeholder="Add any specific instructions or context for regenerating the email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={2}
                />
              </div>
              <button
                onClick={handleRegenerateEmail}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Regenerate Email
              </button>
            </div>
          )}

          {/* Email Preview */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Email Preview (Editable)</h4>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Recipient:</label>
                <p className="text-sm text-gray-900 mt-1">
                  {insurer?.insurerName || 'Unknown Insurer'} ({insurer?.claimsEmail || 'No email'})
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={sendEmailSuccess}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body:</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={10}
                  disabled={sendEmailSuccess}
                />
              </div>
              {claimAttachments.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Attachments ({claimAttachments.length}):
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {claimAttachments.map((attachment, idx) => (
                      <div key={idx} className="relative group">
                        {attachment.mimeType.startsWith('image/') ? (
                          <img
                            src={
                              attachmentBase64Data[attachment.fileName]
                                ? `data:${attachment.mimeType};base64,${attachmentBase64Data[attachment.fileName]}`
                                : attachment.storageUrl || ''
                            }
                            alt={attachment.fileName}
                            className="w-full h-24 object-cover rounded border border-gray-300"
                          />
                        ) : (
                          <div className="w-full h-24 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                        <p className="text-xs text-gray-600 mt-1 truncate">{attachment.fileName}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Policy Coverage Test */}
          {!sendEmailSuccess && (
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    Test Policy Coverage
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Verify if this claim is covered by your policy before sending
                  </p>
                </div>
                <button
                  onClick={handleTestCoverage}
                  disabled={isTestingCoverage}
                  className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isTestingCoverage ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Test Coverage
                    </>
                  )}
                </button>
              </div>

              {coverageTestResult && (
                <div
                  className={`p-4 rounded-lg border-2 ${
                    coverageTestResult.status === 'Covered'
                      ? 'bg-green-50 border-green-300'
                      : coverageTestResult.status === 'Not Covered'
                        ? 'bg-red-50 border-red-300'
                        : 'bg-yellow-50 border-yellow-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {coverageTestResult.status === 'Covered' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : coverageTestResult.status === 'Not Covered' ? (
                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <HelpCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h5 className="font-semibold text-gray-900 mb-1">
                        {coverageTestResult.status}
                        {coverageTestResult.confidence !== undefined && (
                          <span className="ml-2 text-sm font-normal text-gray-600">
                            (Confidence: {coverageTestResult.confidence}%)
                          </span>
                        )}
                      </h5>
                      <p className="text-sm text-gray-700 mb-2">{coverageTestResult.explanation}</p>
                      {coverageTestResult.relevantSections &&
                        coverageTestResult.relevantSections.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-700 mb-1">
                              Relevant Policy Sections:
                            </p>
                            <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                              {coverageTestResult.relevantSections.map((section, idx) => (
                                <li key={idx}>{section}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {sendEmailError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{sendEmailError}</p>
            </div>
          )}

          <div className="flex gap-3">
            {!sendEmailSuccess && (
              <button
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSendingEmail ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Sending Email...
                  </>
                ) : (
                  'Send to Insurer'
                )}
              </button>
            )}
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sendEmailSuccess ? 'Create Another Claim' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
