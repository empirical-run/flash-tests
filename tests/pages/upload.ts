import { Page, Locator } from '@playwright/test';
import { readFileSync } from 'fs';

/**
 * Helper functions for file upload functionality
 */
export class UploadHelpers {
  constructor(private page: Page) {}

  /**
   * Simulates dragging and dropping a file onto a target element
   * @param filePath - Path to the file to upload (relative to project root)
   * @param targetElement - The element to drop the file onto
   * @param fileName - Optional custom filename (defaults to extracted from filePath)
   * @param mimeType - Optional MIME type (defaults to auto-detection based on extension)
   */
  async dragAndDropFile(
    filePath: string, 
    targetElement: Locator, 
    fileName?: string,
    mimeType?: string
  ): Promise<void> {
    // Read the file into a buffer
    const buffer = readFileSync(filePath);
    
    // Extract filename from path if not provided
    const actualFileName = fileName || filePath.split('/').pop() || 'uploaded-file';
    
    // Auto-detect MIME type based on file extension if not provided
    const actualMimeType = mimeType || this.getMimeType(actualFileName);
    
    // Create the DataTransfer and File
    const dataTransfer = await this.page.evaluateHandle(
      ({ data, fileName: fn, mimeType: mt }) => {
        const dt = new DataTransfer();
        // Convert the buffer to a Uint8Array for the File constructor
        const uint8Array = new Uint8Array(data);
        const file = new File([uint8Array], fn, { type: mt });
        dt.items.add(file);
        return dt;
      }, 
      { 
        data: Array.from(buffer), 
        fileName: actualFileName, 
        mimeType: actualMimeType 
      }
    );
    
    // Dispatch the drop event on the target element
    await targetElement.dispatchEvent('drop', { dataTransfer });
  }

  /**
   * Auto-detect MIME type based on file extension
   * @param fileName - The filename to analyze
   * @returns The appropriate MIME type
   */
  private getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      case 'pdf':
        return 'application/pdf';
      case 'txt':
        return 'text/plain';
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      case 'xml':
        return 'application/xml';
      default:
        return 'application/octet-stream';
    }
  }
}