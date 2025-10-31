/**
 * Convert image to base64 and store in Firestore
 * This is a fallback when Firebase Storage is not available
 * @param {Blob|File} file
 * @returns {Promise<string>} Base64 data URL
 */
export async function convertToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload image without Firebase Storage - store as base64 in Firestore
 * @param {File} file
 * @returns {Promise<string>} Base64 data URL
 */
export async function uploadImageAsBase64(file) {
  try {
    // Import compression
    const { compressImageFile } = await import('./imageUtils');
    
    console.log('📦 Compressing image for base64 storage...');
    // Compress to 200KB for base64 (smaller because base64 adds ~33% overhead)
    const compressed = await compressImageFile(file, 800, 0.6, 200);
    console.log(`✅ Compressed to ${(compressed.size / 1024).toFixed(0)}KB`);
    
    // Convert to base64
    console.log('🔄 Converting to base64...');
    const base64 = await convertToBase64(compressed);
    console.log('✅ Base64 conversion complete');
    
    return base64;
  } catch (error) {
    console.error('Base64 conversion failed:', error);
    throw error;
  }
}
