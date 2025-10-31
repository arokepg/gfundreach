/**
 * Ultra-aggressive image compression with multiple fallback strategies
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} quality
 * @param {number} targetSizeKB
 * @returns {Promise<File|Blob>}
 */
export async function compressImageFile(file, maxWidth = 1000, quality = 0.7, targetSizeKB = 400) {
  // Strategy 1: Try browser's createImageBitmap for faster processing
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    
    // Calculate dimensions
    let { width, height } = bitmap;
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.round(height * ratio);
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for smaller size
    
    // Use better image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    
    // Try multiple formats and pick the smallest
    const formats = [
      { type: 'image/webp', quality: quality },
      { type: 'image/jpeg', quality: quality },
    ];
    
    let bestBlob = null;
    let currentQuality = quality;
    const targetBytes = targetSizeKB * 1024;
    
    // Progressive compression
    for (let attempt = 0; attempt < 12; attempt++) {
      for (const format of formats) {
        const blob = await new Promise(resolve => 
          canvas.toBlob(resolve, format.type, currentQuality)
        );
        
        if (blob && (!bestBlob || blob.size < bestBlob.size)) {
          bestBlob = blob;
        }
        
        // If we hit target size, return immediately
        if (blob && blob.size <= targetBytes) {
          console.log(`✅ Compressed to ${(blob.size / 1024).toFixed(0)}KB (${format.type}, ${(currentQuality * 100).toFixed(0)}% quality)`);
          return blob;
        }
      }
      
      // Reduce quality more aggressively
      if (bestBlob && bestBlob.size > targetBytes) {
        currentQuality *= 0.75; // Reduce by 25% each time
        if (currentQuality < 0.05) break;
        console.log(`🔄 Retrying with ${(currentQuality * 100).toFixed(0)}% quality... (current: ${(bestBlob.size / 1024).toFixed(0)}KB)`);
      }
    }
    
    // If still too large, aggressively reduce dimensions
    if (bestBlob && bestBlob.size > targetBytes && width > 400) {
      console.log('📐 Reducing dimensions further...');
      const smallCanvas = document.createElement('canvas');
      const newWidth = Math.max(400, Math.round(width * 0.5));
      const newHeight = Math.round(height * (newWidth / width));
      smallCanvas.width = newWidth;
      smallCanvas.height = newHeight;
      const smallCtx = smallCanvas.getContext('2d', { alpha: false });
      smallCtx.imageSmoothingEnabled = true;
      smallCtx.imageSmoothingQuality = 'medium';
      smallCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
      
      const tinyBlob = await new Promise(resolve => 
        smallCanvas.toBlob(resolve, 'image/jpeg', 0.6)
      );
      if (tinyBlob && tinyBlob.size < bestBlob.size) {
        bestBlob = tinyBlob;
      }
    }
    
    if (bestBlob) {
      console.log(`✅ Final size: ${(bestBlob.size / 1024).toFixed(0)}KB`);
      return bestBlob;
    }
    
  } catch (err) {
    console.warn('ImageBitmap compression failed, trying fallback:', err);
  }
  
  // Strategy 2: Fallback to traditional Image element
  try {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = objectUrl;
      setTimeout(() => reject(new Error('Image load timeout')), 5000);
    });
    
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.round(height * ratio);
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(objectUrl);
    
    // Ultra-compressed JPEG
    const blob = await new Promise(resolve => 
      canvas.toBlob(resolve, 'image/jpeg', 0.5)
    );
    
    if (blob) {
      console.log(`✅ Fallback compression: ${(blob.size / 1024).toFixed(0)}KB`);
      return blob;
    }
  } catch (err) {
    console.error('All compression strategies failed:', err);
  }
  
  // Last resort: return original file
  console.warn('⚠️ Using original file (compression failed)');
  return file;
}

