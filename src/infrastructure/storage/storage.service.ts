/**
 * Firebase Storage Service
 * Handles file uploads and downloads from Firebase Storage
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadString,
  UploadResult,
} from 'firebase/storage';
import { getFirebaseStorage } from '@infrastructure/database/firebase';
import { getStorage } from 'firebase/storage';
import { UUID } from '@core/types';

export class StorageService {
  private storage = getFirebaseStorage();

  /**
   * Upload a base64-encoded image to Firebase Storage
   * @param claimId The claim ID to organize storage
   * @param fileName The file name
   * @param base64Data The base64-encoded image data (without data:image/... prefix)
   * @param mimeType The MIME type of the image
   * @returns The download URL of the uploaded file
   */
  async uploadClaimAttachment(
    claimId: UUID,
    fileName: string,
    base64Data: string,
    mimeType: string
  ): Promise<string> {
    const storage = getStorage();
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageRef = ref(storage, `claims/${claimId}/${timestamp}_${safeFileName}`);

    // Upload the base64 string
    await uploadString(storageRef, base64Data, 'base64', {
      contentType: mimeType,
    });

    // Get and return the download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  }

  /**
   * Upload multiple claim attachments
   * @param claimId The claim ID
   * @param attachments Array of attachments with fileName, base64Data, and mimeType
   * @returns Array of download URLs
   */
  async uploadClaimAttachments(
    claimId: UUID,
    attachments: Array<{ fileName: string; base64Data: string; mimeType: string }>
  ): Promise<string[]> {
    const uploadPromises = attachments.map((attachment) =>
      this.uploadClaimAttachment(
        claimId,
        attachment.fileName,
        attachment.base64Data,
        attachment.mimeType
      )
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Fetch an image from a Storage URL and convert to base64
   * @param storageUrl The Firebase Storage download URL
   * @returns Base64-encoded image data (without data:image/...;base64, prefix)
   */
  async fetchImageAsBase64(storageUrl: string): Promise<string> {
    try {
      // Fetch the image from the URL
      const response = await fetch(storageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      // Get the blob
      const blob = await response.blob();

      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Remove the data:image/...;base64, prefix
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error fetching image as base64:', error);
      throw new Error(`Failed to fetch image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a policy document to Firebase Storage
   * @param file - The file to upload
   * @param userId - The user ID for organizing files
   * @param policyId - The policy ID for organizing files
   * @returns The download URL of the uploaded file
   */
  async uploadPolicyDocument(
    file: File,
    userId: string,
    policyId: string
  ): Promise<string> {
    try {
      // Create a unique file path
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `policy-documents/${userId}/${policyId}/${timestamp}_${sanitizedFileName}`;

      // Create a storage reference
      const storageRef = ref(this.storage, filePath);

      // Upload the file
      const uploadResult: UploadResult = await uploadBytes(storageRef, file, {
        contentType: file.type,
      });

      // Get the download URL
      const downloadURL = await getDownloadURL(uploadResult.ref);

      return downloadURL;
    } catch (error) {
      console.error('Failed to upload policy document:', error);
      throw new Error('Failed to upload policy document');
    }
  }

  /**
   * Delete a policy document from Firebase Storage
   * @param downloadURL - The download URL of the file to delete
   */
  async deletePolicyDocument(downloadURL: string): Promise<void> {
    try {
      // Extract the file path from the download URL
      const storageRef = ref(this.storage, downloadURL);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Failed to delete policy document:', error);
      // Don't throw error - file might already be deleted
    }
  }

  /**
   * Fetch policy document content for AI analysis
   * @param url - The URL of the policy document (Firebase Storage or web URL)
   * @returns The text content of the document
   */
  async fetchPolicyDocumentContent(url: string): Promise<string> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');

      // For PDF files, we'll need to convert to text
      // For now, return a message indicating PDF support
      if (contentType?.includes('application/pdf')) {
        // In a real implementation, you'd use a PDF parsing library
        // For now, we'll return the URL and let the AI service handle it
        return `[PDF Document: ${url}]`;
      }

      // For text files, return the content
      if (contentType?.includes('text/')) {
        return await response.text();
      }

      // For other types, return URL
      return `[Document: ${url}]`;
    } catch (error) {
      console.error('Failed to fetch policy document content:', error);
      throw new Error('Failed to fetch policy document content');
    }
  }
}
