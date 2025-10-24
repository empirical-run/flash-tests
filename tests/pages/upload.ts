import { Page, Locator } from '@playwright/test';
import { readFileSync } from 'fs';

/**
 * Auto-detect MIME type based on file extension
 * @param fileName - The filename to analyze
 * @returns The appropriate MIME type
 */
export function getMimeType(fileName: string): string {
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
    case 'webm':
      return 'video/webm';
    case 'mp4':
      return 'video/mp4';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Simulates dragging and dropping a file onto a target element
 * @param page - The Playwright page object
 * @param filePath - Path to the file to upload (relative to project root)
 * @param targetElement - The element to drop the file onto
 * @param fileName - Optional custom filename (defaults to extracted from filePath)
 * @param mimeType - Optional MIME type (defaults to auto-detection based on extension)
 */
export async function dragAndDropFile(
  page: Page,
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
  const actualMimeType = mimeType || getMimeType(actualFileName);
  
  // Create the DataTransfer and File
  const dataTransfer = await page.evaluateHandle(
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
 * Simulates pasting a file from clipboard into a target element
 * @param filePath - Path to the file to upload (relative to project root)
 * @param targetElement - The element that should receive the paste event
 * @param fileName - Optional custom filename (defaults to extracted from filePath)
 * @param mimeType - Optional MIME type (defaults to auto-detection based on extension)
 */
export async function pasteFile(
  filePath: string,
  targetElement: Locator,
  fileName?: string,
  mimeType?: string
): Promise<void> {
  const buffer = readFileSync(filePath);
  const base64Data = buffer.toString('base64');
  const actualFileName = fileName || filePath.split('/').pop() || 'uploaded-file';
  const actualMimeType = mimeType || getMimeType(actualFileName);

  await targetElement.focus();

  await targetElement.evaluate(
    (element, { data, fileName: fn, mimeType: mt }) => {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      const file = new File([bytes], fn, { type: mt });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(event, 'clipboardData', {
        value: dataTransfer,
        writable: false,
        enumerable: true,
        configurable: false,
      });

      element.dispatchEvent(event);
    },
    { data: base64Data, fileName: actualFileName, mimeType: actualMimeType }
  );
}