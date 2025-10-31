/**
 * Compress an image file using Canvas and return a new File/Blob.
 * - Downscales to maxWidth while preserving aspect ratio
 * - Outputs WebP when supported, otherwise JPEG
 *
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} quality 0..1
 * @returns {Promise<File|Blob>}
 */
export async function compressImageFile(file, maxWidth = 1600, quality = 0.82) {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = objectUrl;
    });
    const { width, height } = img;
    const scale = width > maxWidth ? maxWidth / width : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const type = 'image/webp';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob) return file; // fallback

    // Safari may not support webp; if size is larger than original, fallback to jpeg
    if (blob.size >= file.size) {
      const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      return jpegBlob || file;
    }
    return blob;
  } catch {
    return file; // on any error, use original file
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
