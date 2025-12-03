/**
 * Receipt upload component
 */

import React, { useState, useRef } from 'react';
import { useAuth } from '@presentation/contexts/AuthContext';
import { container } from '@core/container';
import { Upload } from 'lucide-react';

export const UploadReceipt: React.FC = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    try {
      // Convert to base64
      const base64 = await fileToBase64(file);

      // Process with One-Click service
      const oneClickService = container.oneClickClaimService;
      const result = await oneClickService.processOneClickClaim(user.uid, {
        images: [{
          data: base64.split(',')[1], // Remove data URL prefix
          type: file.type,
          description: file.name,
        }],
      });

      if (result.isEligible) {
        setSuccess(
          'Receipt processed! Your claim is eligible for One-Click submission. Review it in the claims list.'
        );
      } else {
        setSuccess(
          `Receipt processed! Reason for manual review: ${result.reason}. Complete the claim in the claims list.`
        );
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process receipt');
    } finally {
      setUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
          id="receipt-upload"
        />
        <label
          htmlFor="receipt-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <Upload className="w-12 h-12 text-gray-400 mb-3" />
          <p className="text-lg font-medium text-gray-700 mb-1">
            {uploading ? 'Processing...' : 'Upload Receipt'}
          </p>
          <p className="text-sm text-gray-500">
            Click to select an image (JPG, PNG, WebP)
          </p>
        </label>
      </div>

      {uploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse w-full"></div>
          </div>
          <p className="text-sm text-gray-600 text-center mt-2">
            Extracting data with AI...
          </p>
        </div>
      )}
    </div>
  );
};
