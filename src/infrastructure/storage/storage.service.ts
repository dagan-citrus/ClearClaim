/**
 * Firebase Storage Service
 * Handles file uploads and downloads from Firebase Storage
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  UploadResult,
} from 'firebase/storage';
import { getFirebaseStorage } from '@infrastructure/database/firebase';

export class StorageService {
  private storage = getFirebaseStorage();

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
