/**
 * Storage service for uploading files to Firebase Storage
 */

import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { UUID } from '@core/types';

export class StorageService {
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
   * @returns Base64-encoded image data (without data:image/... prefix)
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
}
