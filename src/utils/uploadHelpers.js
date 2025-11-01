import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, STORAGE_ENABLED } from '../config/firebase';

/**
 * Upload file to Firebase Storage with retry mechanism and progress tracking
 * @param {Blob|File} file File to upload
 * @param {string} path Storage path
 * @param {Function} onProgress Progress callback (0-100)
 * @param {number} maxRetries Maximum retry attempts
 * @returns {Promise<string>} Download URL
 */
export async function uploadFileWithRetry(file, path, onProgress = null, maxRetries = 3) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    try {
      console.log(`🚀 Upload attempt ${attempt + 1}/${maxRetries} for ${path}`);
      
      const storageRef = ref(storage, path);
      
      // Use resumable upload for better reliability
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'image/jpeg',
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      });

      // Wait for upload to complete
      const downloadURL = await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`📊 Upload progress: ${progress.toFixed(0)}%`);
            if (onProgress) onProgress(progress);
          },
          (error) => {
            console.error('Upload error:', error);
            reject(error);
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('✅ Upload successful!');
              resolve(url);
            } catch (err) {
              reject(err);
            }
          }
        );
      });

      return downloadURL;

    } catch (error) {
      lastError = error;
      attempt++;
      
      console.error(`❌ Upload attempt ${attempt} failed:`, error.message);
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10s
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries failed
  throw new Error(`Upload failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Upload image with automatic compression and retry
 * Falls back to base64 if Firebase Storage fails
 * @param {File} file Original image file
 * @param {string} storagePath Storage path (e.g., 'posts/userId/timestamp.jpg')
 * @param {Function} onProgress Progress callback
 * @returns {Promise<string>} Download URL or base64 data URL
 */
export async function uploadImage(file, storagePath, onProgress = null) {
  try {
    // Import compression utility
    const { compressImageFile } = await import('./imageUtils');
    
    console.log(`📦 Original file size: ${(file.size / 1024).toFixed(0)}KB`);
    
    // Compress image first
    const compressed = await compressImageFile(file, 1000, 0.7, 400);
    console.log(`✅ Compressed to: ${(compressed.size / 1024).toFixed(0)}KB`);
    
    // If storage is disabled, or explicitly requested off, use base64 directly
    if (!STORAGE_ENABLED) {
      const { uploadImageAsBase64 } = await import('./base64Upload');
      const base64Url = await uploadImageAsBase64(compressed);
      console.log('✅ Using base64 storage (Storage disabled)');
      return base64Url;
    }

    // Otherwise, try Firebase Storage upload with retry; if it fails, fall back to base64
    try {
      const url = await uploadFileWithRetry(compressed, storagePath, onProgress, 2); // Reduced to 2 retries
      return url;
    } catch (storageError) {
      console.warn('⚠️ Firebase Storage upload failed, falling back to base64...', storageError.message);
      const { uploadImageAsBase64 } = await import('./base64Upload');
      const base64Url = await uploadImageAsBase64(compressed);
      console.log('✅ Using base64 storage (fallback)');
      return base64Url;
    }
  } catch (error) {
    console.error('All upload methods failed:', error);
    throw new Error('Failed to upload image. Please try again or contact support.');
  }
}
